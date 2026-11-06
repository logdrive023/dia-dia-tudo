// PREÇOS › JANELAS: medida, comprador (coluna), detalhes da tabela e as ferramentas (% , copiar, preencher).
import { useState } from 'react'
import type { TabelaPreco } from '../../core/domain/tipos'
import { Botao, Campo, Entrada, Escolha, Janela, Selecao, cx } from '../../ui/base'
import { useConsulta } from '../../ui/contexto'
import { useT } from '../../ui/i18n'
import { type Alvo, ajustarPct, copiarColuna, preencherVazios } from '../../ui/tabelaPrecoEdicao'
import { CATEGORIAS, type Ferramenta, type Rascunho } from './tipos'

export function JanelaMedida({ titulo, inicial, uma, onFechar, onOk }: { titulo: string; inicial?: string; uma?: boolean; onFechar(): void; onOk(txt: string): string | void }) {
  const t = useT()
  const [txt, setTxt] = useState(inicial ?? '')
  const [erro, setErro] = useState<string>()
  const ok = () => {
    const e = onOk(txt)
    if (e) return setErro(e)
    onFechar()
  }
  return (
    <Janela aberta titulo={titulo} onFechar={onFechar} rodape={<div className="flex justify-end gap-2"><Botao variante="leve" onClick={onFechar}>{t('Voltar')}</Botao><Botao disabled={!txt.trim()} onClick={ok}>{t(uma ? 'Trocar' : 'Adicionar')}</Botao></div>}>
      <Campo rotulo="Nova medida (cm)" ajuda={uma ? 'Os preços desta medida vão junto.' : 'Pode digitar várias: 65, 75, 85.'}>
        <Entrada autoFocus inputMode="decimal" placeholder="65" value={txt} onChange={(e) => (setTxt(e.target.value), setErro(undefined))} onKeyDown={(e) => e.key === 'Enter' && txt.trim() && ok()} />
      </Campo>
      {erro && <p className="mt-2 text-sm text-[var(--ruim)]">{erro}</p>}
    </Janela>
  )
}

export function JanelaComprador({ coluna, numero, onFechar, onOk }: { coluna?: TabelaPreco['colunas'][number]; numero: number; onFechar(): void; onOk(c: { nome: string; pessoaId?: string }): void }) {
  const t = useT()
  const { dados: pessoas } = useConsulta('pessoas', {})
  const [nome, setNome] = useState(coluna?.nome ?? '')
  const [pessoaId, setPessoaId] = useState(coluna?.pessoaId)
  const ok = () => {
    onOk({ nome: nome.trim() || t('Coluna {n}', { n: numero }), pessoaId })
    onFechar()
  }
  return (
    <Janela aberta titulo={t(coluna ? 'Comprador' : 'Novo comprador')} onFechar={onFechar} rodape={<div className="flex justify-end gap-2"><Botao variante="leve" onClick={onFechar}>{t('Voltar')}</Botao><Botao onClick={ok}>{t(coluna ? 'Pronto' : 'Adicionar')}</Botao></div>}>
      <div className="space-y-3">
        <Campo rotulo="Nome do comprador"><Entrada autoFocus value={nome} placeholder="Helena" onChange={(e) => setNome(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && ok()} /></Campo>
        <Campo rotulo="Ligar a pessoa (opcional)" ajuda="Ligada a uma pessoa, ao vender para ela esta coluna vem sozinha." comoDiv>
          <Selecao valor={pessoaId} vazio="Ligar a pessoa…" onChange={(v) => {
            setPessoaId(v || undefined)
            const p = pessoas?.find((x) => x.id === v)
            if (p && !nome.trim()) setNome(p.nome)
          }} opcoes={(pessoas ?? []).map((p) => ({ id: p.id, nome: p.nome }))} />
        </Campo>
      </div>
    </Janela>
  )
}

export function JanelaDetalhes({ g, onFechar, onOk }: { g: Rascunho; onFechar(): void; onOk(d: Pick<Rascunho, 'nome' | 'categoria' | 'validaDesde'>): void }) {
  const t = useT()
  const [d, setD] = useState({ nome: g.nome, categoria: g.categoria, validaDesde: g.validaDesde })
  // categoria nova (não está na lista): digita e vira uma opção
  const [outra, setOutra] = useState(g.categoria && !CATEGORIAS.includes(g.categoria) ? g.categoria : '')
  const opcoes = ['', ...CATEGORIAS, ...(outra.trim() && !CATEGORIAS.includes(outra.trim()) ? [outra.trim()] : [])]
  return (
    <Janela aberta titulo={t('Categoria e vale desde')} onFechar={onFechar} rodape={<div className="flex justify-end gap-2"><Botao variante="leve" onClick={onFechar}>{t('Voltar')}</Botao><Botao disabled={!d.nome.trim()} onClick={() => (onOk({ ...d, nome: d.nome.trim() }), onFechar())}>{t('Pronto')}</Botao></div>}>
      <div className="space-y-3">
        <Campo rotulo="Nome"><Entrada value={d.nome} onChange={(e) => setD({ ...d, nome: e.target.value })} /></Campo>
        <div className="rounded-xl border border-[var(--marca)]/30 bg-[var(--marca-suave)] px-3 py-2 text-sm">
          💡 {t('A categoria diz para qual tipo de cabelo esta tabela vale. Na venda e na compra, o sistema usa a tabela da categoria do pacote.')}
          <span className="num mt-1 block text-xs font-semibold text-[var(--marca)]">{t('Ex.: pacote 60 cm Tinte → usa a tabela "Tinte"; sem tabela Tinte, usa a Normal (geral).')}</span>
        </div>
        <Campo rotulo="Categoria" comoDiv>
          <div className="flex flex-wrap gap-1">
            {opcoes.map((c) => (
              <button key={c || 'normal'} type="button" aria-pressed={(d.categoria ?? '') === c} onClick={() => setD({ ...d, categoria: c || undefined })} className={cx('min-h-10 rounded-full border px-3 text-sm font-semibold', (d.categoria ?? '') === c ? 'border-[var(--marca)] bg-[var(--marca-suave)] text-[var(--marca)]' : 'border-[var(--borda)]')}>{c ? t(c) : `${t('Normal')} (${t('geral')})`}</button>
            ))}
          </div>
        </Campo>
        <Campo rotulo="Criar outra categoria">
          <div className="flex gap-2">
            <Entrada value={outra} placeholder={t('Ex.: Platinado')} onChange={(e) => setOutra(e.target.value)} />
            <Botao variante="secundario" disabled={!outra.trim()} onClick={() => setD({ ...d, categoria: outra.trim() })}>+ {t('Usar')}</Botao>
          </div>
        </Campo>
        <Campo rotulo="Vale desde"><Entrada type="date" value={d.validaDesde ?? ''} onChange={(e) => setD({ ...d, validaDesde: e.target.value })} /></Campo>
      </div>
    </Janela>
  )
}

/** ⋯ Ferramentas: aumentar/diminuir %, copiar coluna, preencher vazios. Tudo vai para o rascunho (nada publica sozinho). */
export function Ferramentas({ g, inicial, onFechar, onAplicar }: { g: Rascunho; inicial: Ferramenta; onFechar(): void; onAplicar(grade: Rascunho, n: number): void }) {
  const t = useT()
  const [tipo, setTipo] = useState<Ferramenta['tipo']>(inicial.tipo)
  const [alvo, setAlvo] = useState<Alvo>(inicial.alvo ?? { tipo: 'tudo' })
  const [pct, setPct] = useState('5')
  const [passo, setPasso] = useState('0')
  const [de, setDe] = useState(g.colunas.find((c) => c.id !== inicial.para)?.id ?? g.colunas[0]?.id)
  const [para, setPara] = useState(inicial.para ?? g.colunas[1]?.id ?? g.colunas[0]?.id)
  const [soVazios, setSoVazios] = useState(false)
  const [valor, setValor] = useState('')
  const p = Number(pct.replace(',', '.'))
  const res =
    tipo === 'pct' ? (Number.isFinite(p) && p !== 0 && p > -100 ? ajustarPct(g, alvo, p, Number(passo)) : { grade: g, mudou: 0 })
    : tipo === 'copiar' ? copiarColuna(g, de, para, soVazios)
    : preencherVazios(g, alvo, valor)
  const nome = (id: string) => g.colunas.find((c) => c.id === id)?.nome ?? ''
  const onde = alvo.tipo === 'tudo' ? t('em toda a tabela') : alvo.tipo === 'medidas' ? (alvo.de === alvo.ate ? t('em {a} cm', { a: alvo.de }) : t('em {a}–{b} cm', { a: Math.min(alvo.de, alvo.ate), b: Math.max(alvo.de, alvo.ate) })) : t('em {nome}', { nome: nome(alvo.colunaId) })
  const resumo =
    tipo === 'pct' ? `${p > 0 ? '+' : ''}${pct}% ${onde}` : tipo === 'copiar' ? t('{de} → {para}', { de: nome(de), para: nome(para) }) : `${valor || '…'} ${t('nos vazios')} ${onde}`
  const medidas = g.linhas.map((l) => ({ id: String(l), nome: `${l} cm` }))
  const escolherAlvo = (
    <div className="space-y-2">
      <Escolha<Alvo['tipo']> rotulo="Onde" valor={alvo.tipo} onChange={(v) => setAlvo(v === 'tudo' ? { tipo: 'tudo' } : v === 'medidas' ? { tipo: 'medidas', de: g.linhas[0], ate: g.linhas[g.linhas.length - 1] } : { tipo: 'coluna', colunaId: g.colunas[0].id })} opcoes={[{ id: 'tudo', nome: 'Tudo' }, { id: 'medidas', nome: 'Medidas' }, { id: 'coluna', nome: 'Comprador' }]} />
      {alvo.tipo === 'medidas' && (
        <div className="flex items-center gap-2 text-sm">
          <span>{t('de')}</span><Selecao className="w-auto" valor={String(alvo.de)} onChange={(v) => setAlvo({ ...alvo, de: Number(v) })} opcoes={medidas} />
          <span>{t('até')}</span><Selecao className="w-auto" valor={String(alvo.ate)} onChange={(v) => setAlvo({ ...alvo, ate: Number(v) })} opcoes={medidas} />
        </div>
      )}
      {alvo.tipo === 'coluna' && <Selecao valor={alvo.colunaId} onChange={(v) => setAlvo({ tipo: 'coluna', colunaId: v })} opcoes={g.colunas.map((c) => ({ id: c.id, nome: c.nome }))} />}
    </div>
  )
  return (
    <Janela aberta titulo={t('Ferramentas')} onFechar={onFechar} rodape={
      <div className="flex flex-wrap items-center justify-end gap-2">
        <span className="mr-auto text-sm text-[var(--suave)]">{res.mudou ? t('Vai mudar {n} preço(s)', { n: res.mudou }) : t('Nada para mudar')}</span>
        <Botao variante="leve" onClick={onFechar}>{t('Voltar')}</Botao>
        <Botao disabled={!res.mudou} onClick={() => (onAplicar(res.grade, res.mudou), onFechar())}>{t('Aplicar')}: {resumo}</Botao>
      </div>
    }>
      <div className="space-y-4">
        <Escolha<Ferramenta['tipo']> rotulo="Ferramenta" valor={tipo} onChange={setTipo} opcoes={[{ id: 'pct', nome: '± %' }, { id: 'copiar', nome: 'Copiar coluna' }, { id: 'preencher', nome: 'Preencher vazios' }]} />
        {tipo === 'pct' && (
          <>
            <Campo rotulo="Aumentar/diminuir (%)" ajuda="Use menos para baixar. Ex.: 5 = +5%; -10 = −10%. Só mexe nos preços preenchidos.">
              <div className="flex flex-wrap gap-2">
                {['-10', '-5', '5', '10'].map((x) => <Botao key={x} className="px-3" variante={pct === x ? 'primario' : 'secundario'} onClick={() => setPct(x)}>{Number(x) > 0 ? '+' : ''}{x}%</Botao>)}
                <Entrada className="w-20" aria-label={t('Outro %')} inputMode="decimal" value={pct} onChange={(e) => setPct(e.target.value)} />
              </div>
            </Campo>
            {escolherAlvo}
            <Campo rotulo="Arredondar" comoDiv>
              <Selecao valor={passo} onChange={setPasso} opcoes={[{ id: '0', nome: t('Não (2 casas)') }, { id: '0.1', nome: '0,1' }, { id: '0.5', nome: '0,5' }, { id: '1', nome: '1' }]} />
            </Campo>
          </>
        )}
        {tipo === 'copiar' && (
          <div className="space-y-3">
            <Campo rotulo="Copiar de" comoDiv><Selecao valor={de} onChange={setDe} opcoes={g.colunas.map((c) => ({ id: c.id, nome: c.nome }))} /></Campo>
            <Campo rotulo="Para" comoDiv><Selecao valor={para} onChange={setPara} opcoes={g.colunas.map((c) => ({ id: c.id, nome: c.nome }))} /></Campo>
            <label className="flex min-h-10 items-center gap-2 text-sm"><input type="checkbox" checked={soVazios} onChange={(e) => setSoVazios(e.target.checked)} /> {t('Só nos vazios (não apaga o que já tem)')}</label>
          </div>
        )}
        {tipo === 'preencher' && (
          <>
            <Campo rotulo="Fator para os vazios"><Entrada autoFocus inputMode="decimal" placeholder="3,5" value={valor} onChange={(e) => setValor(e.target.value)} /></Campo>
            {escolherAlvo}
          </>
        )}
      </div>
    </Janela>
  )
}
