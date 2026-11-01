// TABELAS DE PREÇO: grade simples (medida × comprador → fator), editável na hora, com categoria (Normal, Tinte…),
// "vale a partir de" e histórico das versões anteriores. "Duplicar" cria a próxima versão sem redigitar.

import { useState } from 'react'
import { fatorValido } from '../core/domain/dinheiro'
import { dataLocal } from '../core/domain/datas'
import { novoId } from '../core/domain/ids'
import type { TabelaPreco } from '../core/domain/tipos'
import { Botao, Campo, Carregando, Cartao, Entrada, Janela, Pilula, Selecao, Titulo, Vazio, cx, dataBR } from '../ui/base'
import { useComando, useConsulta } from '../ui/contexto'
import { useT } from '../ui/i18n'

type Rascunho = Pick<TabelaPreco, 'id' | 'moduloId' | 'nome' | 'categoria' | 'validaDesde' | 'moeda' | 'unidadeMedida' | 'fatorPor' | 'linhas' | 'colunas' | 'valores'>

export function Precos() {
  const t = useT()
  const { dados } = useConsulta('tabelasPreco', {})
  const { dados: pessoas } = useConsulta('pessoas', {})
  const { executar, ocupado } = useComando()
  const [edit, setEdit] = useState<Rascunho>()
  const [hist, setHist] = useState<string>()
  const nova = (base?: TabelaPreco): Rascunho =>
    base
      ? { ...base, id: novoId(), nome: `${base.nome} (${dataBR(dataLocal())})`, validaDesde: dataLocal(), valores: { ...base.valores }, colunas: base.colunas.map((c) => ({ ...c })), linhas: [...base.linhas] }
      : { id: novoId(), moduloId: 'cabelo', nome: t('Nova tabela'), moeda: 'BOB', unidadeMedida: 'cm', fatorPor: 'grama', validaDesde: dataLocal(), linhas: [40, 50, 55, 60, 70, 80, 90, 100], colunas: [{ id: 'c1', nome: 'Comprador 1' }], valores: {} }
  return (
    <div>
      <Titulo acao={<Botao onClick={() => setEdit(nova())}>+ {t('Tabela')}</Botao>} subtitulo={t('Valor = gramas × fator. Ex.: 40 cm, 2.000 g × 3,5 = Bs 7.000.')}>{t('Tabelas de preço')}</Titulo>
      {!dados ? <Carregando /> : !dados.length ? <Vazio texto="Nenhuma tabela ainda." /> : (
        <div className="space-y-4">
          {dados.map((tb) => (
            <Cartao key={tb.id} titulo={<>{tb.nome} {tb.categoria && <Pilula tom="marca">{tb.categoria}</Pilula>}</>} acao={
              <div className="flex flex-wrap gap-2">
                <Botao variante="secundario" onClick={() => setEdit({ ...tb, valores: { ...tb.valores } })}>{t('Editar')}</Botao>
                <Botao variante="leve" onClick={() => setEdit(nova(tb))}>⟳ {t('Duplicar (nova versão)')}</Botao>
                <Botao variante="leve" onClick={() => setHist(tb.id)}>{t('Versões anteriores')}</Botao>
              </div>
            }>
              <p className="mb-2 text-xs text-[var(--suave)]">{t('Vale desde')} {dataBR(tb.validaDesde)} · {tb.moeda} {t('por grama')}</p>
              <Grade tb={tb} />
            </Cartao>
          ))}
        </div>
      )}
      {edit && (
        <Janela aberta larga titulo={t('Editar tabela')} onFechar={() => setEdit(undefined)} rodape={<Botao grande className="w-full" disabled={ocupado} onClick={async () => (await executar('salvarTabelaPreco', edit, t('Tabela salva (a versão anterior fica no histórico).'))) && setEdit(undefined)}>{t('Salvar')}</Botao>}>
          <Editor r={edit} setR={setEdit} pessoas={(pessoas ?? []).map((p) => ({ id: p.id, nome: p.nome }))} />
        </Janela>
      )}
      {hist && <Historico id={hist} onFechar={() => setHist(undefined)} />}
    </div>
  )
}

function Grade({ tb, editar }: { tb: Pick<TabelaPreco, 'linhas' | 'colunas' | 'valores'>; editar?: (k: string, v: string) => void }) {
  return (
    <div className="overflow-x-auto">
      <table className="border-separate border-spacing-0 text-sm">
        <thead>
          <tr>
            <th className="sticky left-0 bg-[var(--cartao)] p-1" />
            {tb.colunas.map((c) => <th key={c.id} className="min-w-16 p-1 text-xs">{c.nome}</th>)}
          </tr>
        </thead>
        <tbody>
          {tb.linhas.map((l) => (
            <tr key={l}>
              <th className="sticky left-0 bg-[var(--cartao)] p-1 text-right">{l}</th>
              {tb.colunas.map((c) => {
                const k = `${l}|${c.id}`
                const v = tb.valores[k] ?? ''
                return (
                  <td key={c.id} className="border border-[var(--borda)] p-0">
                    {editar ? (
                      <input aria-label={`${l} ${c.nome}`} inputMode="decimal" value={v} onChange={(e) => editar(k, e.target.value)} className={cx('num h-10 w-16 bg-transparent text-center outline-none focus:bg-[var(--marca-suave)]', v && !fatorValido(v) && 'text-[var(--ruim)]')} />
                    ) : (
                      <div className="num h-9 w-16 py-2 text-center">{v || '·'}</div>
                    )}
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function Editor({ r, setR, pessoas }: { r: Rascunho; setR(x: Rascunho): void; pessoas: { id: string; nome: string }[] }) {
  const t = useT()
  const [novaLinha, setNovaLinha] = useState('')
  return (
    <div className="space-y-3">
      <div className="grid gap-2 sm:grid-cols-4">
        <Campo rotulo="Nome" className="sm:col-span-2"><Entrada value={r.nome} onChange={(e) => setR({ ...r, nome: e.target.value })} /></Campo>
        <Campo rotulo="Categoria" ajuda="Vazio = tabela geral (Normal). Tinte, CH… usam a própria tabela."><Entrada list="cats-t" value={r.categoria ?? ''} onChange={(e) => setR({ ...r, categoria: e.target.value || undefined })} /><datalist id="cats-t">{['Tinte', 'CH', 'CH+', 'Rojo', 'Quemado', 'Menudo'].map((c) => <option key={c} value={c} />)}</datalist></Campo>
        <Campo rotulo="Vale desde"><Entrada type="date" value={r.validaDesde ?? ''} onChange={(e) => setR({ ...r, validaDesde: e.target.value })} /></Campo>
      </div>
      <p className="text-sm text-[var(--suave)]">{t('Toque numa célula e digite o fator (3,5 · 17.5). Célula vazia = sem preço.')}</p>
      <Grade tb={r} editar={(k, v) => setR({ ...r, valores: { ...r.valores, [k]: v } })} />
      <div className="grid gap-3 md:grid-cols-2">
        <Cartao titulo={t('Colunas (compradores)')}>
          <ul className="space-y-2">
            {r.colunas.map((c, i) => (
              <li key={c.id} className="grid grid-cols-[1fr_1fr_auto] gap-1">
                <Entrada value={c.nome} onChange={(e) => setR({ ...r, colunas: r.colunas.map((x, k) => (k === i ? { ...x, nome: e.target.value } : x)) })} />
                <Selecao valor={c.pessoaId} vazio="Ligar a pessoa…" onChange={(v) => setR({ ...r, colunas: r.colunas.map((x, k) => (k === i ? { ...x, pessoaId: v || undefined } : x)) })} opcoes={pessoas} />
                <button type="button" aria-label={t('Tirar')} className="px-2 text-xl" onClick={() => setR({ ...r, colunas: r.colunas.filter((_, k) => k !== i) })}>×</button>
              </li>
            ))}
          </ul>
          <Botao className="mt-2" variante="secundario" onClick={() => setR({ ...r, colunas: [...r.colunas, { id: novoId().slice(-6).toLowerCase(), nome: `Coluna ${r.colunas.length + 1}` }] })}>+ {t('Coluna')}</Botao>
        </Cartao>
        <Cartao titulo={t('Linhas (medidas)')}>
          <div className="flex flex-wrap gap-1">{r.linhas.map((l) => <button key={l} type="button" className="rounded-full bg-[var(--marca-suave)] px-3 py-1 text-sm" onClick={() => setR({ ...r, linhas: r.linhas.filter((x) => x !== l) })}>{l} ×</button>)}</div>
          <div className="mt-2 flex gap-2"><Entrada inputMode="numeric" placeholder="65" value={novaLinha} onChange={(e) => setNovaLinha(e.target.value)} /><Botao variante="secundario" onClick={() => { const n = Number(novaLinha); if (n > 0) setR({ ...r, linhas: [...new Set([...r.linhas, n])].sort((a, b) => a - b) }); setNovaLinha('') }}>+</Botao></div>
        </Cartao>
      </div>
    </div>
  )
}

function Historico({ id, onFechar }: { id: string; onFechar(): void }) {
  const t = useT()
  const { dados } = useConsulta('historicoTabela', { id })
  return (
    <Janela aberta larga titulo={t('Versões anteriores')} onFechar={onFechar}>
      {!dados?.length ? <Vazio texto="Nenhuma versão anterior." /> : dados.map((v) => (
        <div key={v.em} className="mb-4">
          <p className="mb-1 text-sm font-semibold">{t('Até')} {new Date(v.em).toLocaleString('pt-BR')}</p>
          <Grade tb={v} />
        </div>
      ))}
    </Janela>
  )
}
