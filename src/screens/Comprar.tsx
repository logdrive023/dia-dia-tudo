// COMPRAR + TRIAGEM: pedido de compra com fotos/PDF, anda etapa por etapa (quem fez fica registrado) e só então
// entra no estoque. Lote bruto pode ser separado depois em Estoque › Separar.

import { useState } from 'react'
import { formatar, multiplicarFator, fatorValido } from '../core/domain/dinheiro'
import { novoId } from '../core/domain/ids'
import type { Campos, Id, Transacao } from '../core/domain/tipos'
import { fatorDaTabela } from '../core/services/precos'
import { Abas, Botao, Campo, Carregando, Cartao, Entrada, GramasInput, Janela, Pilula, Selecao, Titulo, ValorInput, Vazio, cx, dataBR, gramasTexto } from '../ui/base'
import { useApp, useComando, useConsulta } from '../ui/contexto'
import { Anexos, EditorPagamentos, type PagamentoTela, SeletorPessoa } from '../ui/compartilhados'
import { LinhaDoTempo } from '../ui/linhaTempo'
import { useT } from '../ui/i18n'

export function Comprar() {
  const t = useT()
  const { nav } = useApp()
  const [aba, setAba] = useState<'abertas' | 'encerradas'>(nav.params.encerradas ? 'encerradas' : 'abertas')
  const [nova, setNova] = useState<{ base?: Transacao } | undefined>()
  const [aberta, setAberta] = useState<Id | undefined>(nav.params.id as Id | undefined)
  const { dados: fila } = useConsulta('filaTriagem', { incluirEncerradas: aba === 'encerradas' })
  const { dados: cfg } = useConsulta('configuracoes', {})
  const lista = (fila ?? []).filter((c) => (aba === 'abertas' ? !['concluido', 'recusado', 'cancelado'].includes(c.etapa) : ['concluido', 'recusado', 'cancelado'].includes(c.etapa))).filter((c) => !nav.params.semComprovante || c.semComprovanteOrigem)
  const modulos = (cfg?.modulos ?? []).filter((m) => m.temCompra && cfg?.config.modulosAtivos.includes(m.id))
  const etapasPorModulo = new Map<string, string[]>()
  for (const c of fila ?? []) if (!etapasPorModulo.has(c.moduloId)) etapasPorModulo.set(c.moduloId, [])

  return (
    <div>
      <Titulo acao={<Botao grande onClick={() => setNova({})}>+ {t('Nova compra')}</Botao>} subtitulo={t('Todo pedido passa pela triagem antes de entrar no estoque.')}>
        {t('Comprar')}
      </Titulo>
      <Abas atual={aba} onChange={(v) => setAba(v as typeof aba)} abas={[{ id: 'abertas', nome: 'Na triagem', extra: <Pilula tom="marca">{(fila ?? []).filter((c) => !['concluido', 'recusado', 'cancelado'].includes(c.etapa)).length}</Pilula> }, { id: 'encerradas', nome: 'Encerradas' }]} />
      {!fila ? (
        <Carregando />
      ) : !lista.length ? (
        <Vazio texto={aba === 'abertas' ? 'Nenhuma compra esperando.' : 'Nenhuma compra encerrada.'} />
      ) : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {lista.map((c) => (
            <button key={c.id} type="button" onClick={() => setAberta(c.id)} className="rounded-2xl border border-[var(--borda)] bg-[var(--cartao)] p-3 text-left hover:border-[var(--marca)]">
              <div className="flex items-center justify-between gap-2">
                <b>{c.pessoa ?? t('Sem fornecedor')}</b>
                <Pilula tom={c.etapa === 'concluido' ? 'bom' : c.etapa === 'recusado' || c.etapa === 'cancelado' ? 'ruim' : c.diasParada >= 3 ? 'alerta' : 'marca'}>{t(c.nomeEtapa)}</Pilula>
              </div>
              <div className="mt-1 text-sm text-[var(--suave)]">{dataBR(c.data)} · {c.linhas.length} {t('item(ns)')} · {gramasTexto(c.linhas.reduce((s, l) => s + l.quantidade, 0))}</div>
              <div className="num mt-1 text-lg font-bold">{formatar(c.totalPrincipal, c.moedaPrincipal)}</div>
              <div className="mt-1 flex flex-wrap gap-1 text-xs">
                {c.diasParada >= 3 && aba === 'abertas' && <Pilula tom="alerta">{t('parada há {n} dias', { n: c.diasParada })}</Pilula>}
                {c.semFotos && <Pilula>{t('sem fotos')}</Pilula>}
                {c.semComprovanteOrigem && <Pilula tom="alerta">{t('sem comprovante de origem')}</Pilula>}
              </div>
            </button>
          ))}
        </div>
      )}
      {nova && <NovaCompra modulos={modulos} base={nova.base} onFechar={() => setNova(undefined)} onCriada={(id) => (setNova(undefined), setAberta(id))} />}
      {aberta && <DetalheCompra id={aberta} onFechar={() => setAberta(undefined)} onRepetir={(base) => (setAberta(undefined), setNova({ base }))} />}
    </div>
  )
}

interface LinhaNova {
  id: Id
  modo: 'bruto' | 'tabela' | 'item'
  itemId?: Id
  quantidade?: number
  total?: number
  medida?: number
  fator?: string
  campos: Campos
}

function NovaCompra({ modulos, base, onFechar, onCriada }: { modulos: { id: string; nome: string; icone: string }[]; base?: Transacao; onFechar(): void; onCriada(id: Id): void }) {
  const t = useT()
  const { executar, ocupado } = useComando()
  const [id] = useState(() => novoId())
  const [moduloId, setModuloId] = useState(base?.moduloId ?? modulos[0]?.id ?? 'cabelo')
  const [pessoaId, setPessoaId] = useState<Id | undefined>(base?.pessoaId)
  const [obs, setObs] = useState('')
  const ehCabelo = moduloId === 'cabelo'
  const [linhas, setLinhas] = useState<LinhaNova[]>(
    base
      ? base.linhas.map((l) => ({ id: novoId(), modo: l.campos.fator ? 'tabela' : ehCabelo ? 'bruto' : 'item', itemId: ehCabelo ? undefined : l.itemId, quantidade: l.quantidade, total: l.total, medida: l.campos.comprimento as number | undefined, fator: l.campos.fator as string | undefined, campos: { ...l.campos } }))
      : [{ id: novoId(), modo: ehCabelo ? 'bruto' : 'item', campos: ehCabelo ? { estado: 'Bruto', categoria: 'Normal' } : {} }],
  )
  const { dados: tabelas } = useConsulta('tabelasPreco', { moduloId: 'cabelo' })
  const { dados: catalogo } = useConsulta('catalogo', { moduloId })
  const tabela = tabelas?.find((x) => !x.categoria) ?? tabelas?.[0]
  const colunaFornecedor = tabela?.colunas.find((c) => c.pessoaId === pessoaId)?.id
  const [coluna, setColuna] = useState<string>()
  const col = coluna ?? colunaFornecedor ?? tabela?.colunas[0]?.id
  const att = (i: number, d: Partial<LinhaNova>) => setLinhas(linhas.map((l, k) => (k === i ? { ...l, ...d } : l)))
  const totalLinha = (l: LinhaNova) => {
    if (l.modo === 'tabela') {
      const f = l.fator || (tabela && l.medida && col ? fatorDaTabela(tabela, l.medida, col).fator : undefined)
      return l.quantidade && f && fatorValido(f) ? multiplicarFator(l.quantidade, f, 'BOB') : undefined
    }
    return l.total
  }
  const total = linhas.reduce((s, l) => s + (totalLinha(l) ?? 0), 0)

  const salvar = async () => {
    const r = await executar('criarCompra', {
      id,
      moduloId,
      pessoaId,
      obs,
      linhas: linhas.map((l) => {
        const fator = l.modo === 'tabela' ? l.fator || (tabela && l.medida && col ? fatorDaTabela(tabela, l.medida, col).fator : undefined) : undefined
        return {
          id: l.id,
          itemId: l.itemId,
          quantidade: l.quantidade ?? 0,
          moeda: 'BOB',
          total: l.total ?? 0,
          campos: { ...l.campos, estado: l.modo === 'bruto' ? 'Bruto' : ehCabelo ? 'Separado' : undefined },
          calculo: fator ? { medida: l.medida, fator, tabelaId: tabela?.id, colunaId: col, categoria: l.campos.categoria as string | undefined } : undefined,
        }
      }),
    }, t('Compra registrada. Agora é só andar a triagem.'))
    if (r) onCriada(r.id)
  }

  return (
    <Janela aberta larga titulo={t(base ? 'Repetir compra' : 'Nova compra')} onFechar={onFechar} rodape={<div className="flex items-center justify-between gap-2"><b className="num text-lg">{formatar(total, 'BOB')}</b><Botao grande disabled={ocupado} onClick={salvar}>{t('Registrar pedido')}</Botao></div>}>
      <div className="space-y-3">
        <div className="grid gap-3 sm:grid-cols-2">
          <Campo rotulo="O que está comprando?">
            <Selecao valor={moduloId} onChange={setModuloId} opcoes={modulos.map((m) => ({ id: m.id, nome: `${m.icone} ${t(m.nome)}` }))} />
          </Campo>
          <SeletorPessoa rotulo="De quem?" valor={pessoaId} onChange={setPessoaId} papel="fornecedor" />
        </div>
        {ehCabelo && tabela && (
          <Campo rotulo="Coluna da tabela (preço do fornecedor)" ajuda="Compra pela tabela: medida | gramas × fator da coluna do fornecedor.">
            <Selecao valor={col} onChange={setColuna} opcoes={tabela.colunas.map((c) => ({ id: c.id, nome: c.nome }))} />
          </Campo>
        )}
        {linhas.map((l, i) => (
          <div key={l.id} className="rounded-xl border border-[var(--borda)] p-3">
            <div className="mb-2 flex flex-wrap items-center gap-2">
              {ehCabelo && (
                <div className="flex gap-1">
                  {(['bruto', 'tabela'] as const).map((m) => (
                    <button key={m} type="button" onClick={() => att(i, { modo: m })} className={cx('rounded-lg px-3 py-1 text-sm font-semibold', l.modo === m ? 'bg-[var(--marca)] text-white' : 'bg-[var(--marca-suave)] text-[var(--marca)]')}>
                      {t(m === 'bruto' ? 'Lote bruto (separar depois)' : 'Já separado (pela tabela)')}
                    </button>
                  ))}
                </div>
              )}
              <button type="button" className="ml-auto text-xl" aria-label={t('Tirar')} onClick={() => setLinhas(linhas.filter((_, k) => k !== i))}>×</button>
            </div>
            <div className="grid gap-2 sm:grid-cols-4">
              {l.modo === 'item' && (
                <Campo rotulo="Item" className="sm:col-span-2">
                  <Selecao valor={l.itemId} onChange={(v) => att(i, { itemId: v })} vazio="Escolha…" opcoes={(catalogo ?? []).map((x) => ({ id: x.id, nome: x.nome }))} />
                </Campo>
              )}
              {l.modo === 'tabela' && (
                <>
                  <Campo rotulo="Medida (cm)"><Entrada inputMode="numeric" value={l.medida ?? ''} onChange={(e) => att(i, { medida: Number(e.target.value) || undefined })} /></Campo>
                  <Campo rotulo="Categoria"><Selecao valor={String(l.campos.categoria ?? 'Normal')} onChange={(v) => att(i, { campos: { ...l.campos, categoria: v } })} opcoes={['Normal', 'Tinte', 'CH', 'CH+', 'Rojo', 'Quemado', 'Menudo', 'Entresaque'].map((c) => ({ id: c, nome: c }))} /></Campo>
                </>
              )}
              <Campo rotulo={moduloId === 'cabelo' ? 'Peso' : 'Quantidade'}>
                {moduloId === 'cabelo' ? <GramasInput valor={l.quantidade} onChange={(q) => att(i, { quantidade: q })} /> : <Entrada inputMode="numeric" value={l.quantidade ?? ''} onChange={(e) => att(i, { quantidade: Number(e.target.value) || undefined })} />}
              </Campo>
              {l.modo === 'tabela' ? (
                <Campo rotulo="Fator">
                  <Entrada inputMode="decimal" value={l.fator ?? ''} placeholder={tabela && l.medida && col ? fatorDaTabela(tabela, l.medida, col).fator ?? '?' : '?'} onChange={(e) => att(i, { fator: e.target.value })} />
                </Campo>
              ) : (
                <Campo rotulo="Valor total"><ValorInput moeda="BOB" valor={l.total} onChange={(v) => att(i, { total: v })} /></Campo>
              )}
            </div>
            {l.modo === 'bruto' && (
              <div className="mt-2 grid gap-2 sm:grid-cols-3">
                <Campo rotulo="Cor"><Selecao valor={String(l.campos.cor ?? '')} vazio="—" onChange={(v) => att(i, { campos: { ...l.campos, cor: v } })} opcoes={['Misturado', 'Preto', 'Castanho', 'Loiro'].map((c) => ({ id: c, nome: c }))} /></Campo>
                <Campo rotulo="Origem"><Selecao valor={String(l.campos.origem ?? '')} vazio="—" onChange={(v) => att(i, { campos: { ...l.campos, origem: v } })} opcoes={['Bolívia', 'Paraguai', 'Brasil', 'Peru', 'Outro'].map((c) => ({ id: c, nome: c }))} /></Campo>
                {l.quantidade && l.total ? <p className="self-end text-sm text-[var(--suave)]">{t('Custo por kg')}: <b className="num">{formatar(Math.round((l.total * 1000) / l.quantidade), 'BOB')}</b></p> : null}
              </div>
            )}
            {l.modo === 'tabela' && totalLinha(l) !== undefined && (
              <p className="num mt-2 font-bold">{l.medida} | {l.quantidade?.toLocaleString('pt-BR')} × {l.fator || (tabela && l.medida && col ? fatorDaTabela(tabela, l.medida, col).fator : '?')} = {formatar(totalLinha(l)!, 'BOB')}</p>
            )}
          </div>
        ))}
        <Botao variante="secundario" onClick={() => setLinhas([...linhas, { id: novoId(), modo: ehCabelo ? 'tabela' : 'item', campos: ehCabelo ? { categoria: 'Normal' } : {} }])}>+ {t('Outra linha')}</Botao>
        <Campo rotulo="Observação"><Entrada value={obs} onChange={(e) => setObs(e.target.value)} /></Campo>
        <Cartao titulo={t('Fotos, PDF e arquivos do pedido')}>
          <Anexos donoId={id} categorias={['pedido', 'produto', 'comprovante', 'origem']} />
        </Cartao>
      </div>
    </Janela>
  )
}

function DetalheCompra({ id, onFechar, onRepetir }: { id: Id; onFechar(): void; onRepetir(base: Transacao): void }) {
  const t = useT()
  const { ir } = useApp()
  const { dados } = useConsulta('compra', { id })
  const { dados: cfg } = useConsulta('configuracoes', {})
  const { executar, ocupado } = useComando()
  const [ajustes, setAjustes] = useState<Record<Id, { quantidade?: number; total?: number }>>({})
  const [pagamentos, setPagamentos] = useState<PagamentoTela[]>([])
  const [motivo, setMotivo] = useState('')
  if (!dados) return <Janela aberta titulo="…" onFechar={onFechar}><Carregando /></Janela>
  const c = dados.compra
  void cfg
  return (
    <Janela aberta larga titulo={`${t('Compra')} · ${dados.pessoa?.nome ?? ''}`} onFechar={onFechar}>
      <ConteudoCompra c={c} />
      <EtapasCompra
        compra={c}
        ocupado={ocupado}
        ajustes={ajustes}
        setAjustes={setAjustes}
        pagamentos={pagamentos}
        setPagamentos={setPagamentos}
        motivo={motivo}
        setMotivo={setMotivo}
        avancar={async (para) => {
          const r = await executar('avancarTriagem', {
            compraId: c.id,
            para,
            motivo: motivo || undefined,
            ajustes: Object.entries(ajustes).map(([linhaId, a]) => ({ linhaId, ...a })),
            pagamentos: pagamentos.filter((p) => p.valor).map((p) => ({ id: p.id, forma: p.forma, moeda: p.moeda, valor: p.valor! })),
          }, t('Etapa registrada.'))
          if (r) {
            setAjustes({})
            setPagamentos([])
            setMotivo('')
          }
        }}
        cancelar={async () => {
          await executar('cancelarCompra', { compraId: c.id, motivo }, t('Compra cancelada.'))
        }}
      />
      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <Cartao titulo={t('Fotos, PDF e arquivos')}>
          <Anexos donoId={c.id} categorias={['pedido', 'produto', 'comprovante', 'origem']} />
        </Cartao>
        <Cartao titulo={t('Linha do tempo')}>
          <LinhaDoTempo id={c.id} />
        </Cartao>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <Botao variante="secundario" onClick={() => onRepetir(c)}>⟳ {t('Repetir esta compra')}</Botao>
        {c.etapa === 'concluido' && <Botao variante="secundario" onClick={() => ir('rastreio', { compraId: c.id })}>🔎 {t('Rastrear: para onde foi')}</Botao>}
      </div>
    </Janela>
  )
}

function ConteudoCompra({ c }: { c: Transacao }) {
  const t = useT()
  return (
    <div className="mb-3">
      <div className="text-sm text-[var(--suave)]">{dataBR(c.data)}{c.obs ? ` · ${c.obs}` : ''}</div>
      <ul className="mt-2 divide-y divide-[var(--borda)] rounded-xl border border-[var(--borda)]">
        {c.linhas.map((l) => (
          <li key={l.id} className="flex justify-between gap-2 p-2 text-sm">
            <span>{l.descricao}{l.campos.calculo ? <span className="num block text-[var(--suave)]">{String(l.campos.calculo)}</span> : null}</span>
            <span className="num text-right">{gramasTexto(l.quantidade)}<br /><b>{formatar(l.total, l.moeda)}</b></span>
          </li>
        ))}
      </ul>
      <div className="mt-2 flex justify-between font-bold"><span>{t('Total')}</span><span className="num">{formatar(c.totalPrincipal, c.moedaPrincipal)}</span></div>
      {c.pagamentos.length > 0 && <div className="text-sm text-[var(--suave)]">{t('Pago')}: {c.pagamentos.map((p) => formatar(p.valor, p.moeda)).join(' + ')}</div>}
    </div>
  )
}

function EtapasCompra(p: {
  compra: Transacao
  ocupado: boolean
  ajustes: Record<Id, { quantidade?: number; total?: number }>
  setAjustes(a: Record<Id, { quantidade?: number; total?: number }>): void
  pagamentos: PagamentoTela[]
  setPagamentos(x: PagamentoTela[]): void
  motivo: string
  setMotivo(m: string): void
  avancar(para: string): void
  cancelar(): void
}) {
  const t = useT()
  const { dados: cfg } = useConsulta('configuracoes', {})
  const c = p.compra
  // as etapas vêm do módulo (genérico: cada modalidade define as suas)
  const etapas = cfg?.modulos.find((m) => m.id === c.moduloId)?.etapas ?? []
  const idx = etapas.findIndex((e) => e.id === c.etapa)
  const prox = etapas[idx + 1]
  const encerrada = ['concluido', 'recusado', 'cancelado'].includes(c.etapa)
  return (
    <Cartao titulo={t('Triagem')}>
      <ol className="mb-3 flex flex-wrap gap-1">
        {etapas.map((e, i) => (
          <li key={e.id} className={cx('rounded-full px-3 py-1 text-xs font-semibold', i < idx || c.etapa === 'concluido' ? 'bg-[var(--bom)]/15 text-[var(--bom)]' : i === idx ? 'bg-[var(--marca)] text-white' : 'bg-[var(--fundo)] text-[var(--suave)]')}>
            {i + 1}. {t(e.nome)}
          </li>
        ))}
        {(c.etapa === 'recusado' || c.etapa === 'cancelado') && <Pilula tom="ruim">{t(c.etapa === 'recusado' ? 'Recusado' : 'Cancelado')}</Pilula>}
      </ol>
      {!encerrada && prox && (
        <div className="space-y-3">
          {!c.pagamentos.length && (
            <details>
              <summary className="cursor-pointer text-sm font-semibold text-[var(--marca)]">{t('Ajustar peso ou valor (conferência)')}</summary>
              <div className="mt-2 space-y-2">
                {c.linhas.map((l) => (
                  <div key={l.id} className="grid grid-cols-2 gap-2 text-sm">
                    <Campo rotulo={`${l.descricao} · ${t('peso real')}`}><GramasInput valor={p.ajustes[l.id]?.quantidade ?? l.quantidade} onChange={(q) => p.setAjustes({ ...p.ajustes, [l.id]: { ...p.ajustes[l.id], quantidade: q } })} /></Campo>
                    <Campo rotulo="Valor"><ValorInput moeda={l.moeda} valor={p.ajustes[l.id]?.total ?? l.total} onChange={(v) => p.setAjustes({ ...p.ajustes, [l.id]: { ...p.ajustes[l.id], total: v } })} /></Campo>
                  </div>
                ))}
              </div>
            </details>
          )}
          {prox.faz?.includes('pagamento') && (
            <EditorPagamentos total={c.totalPrincipal} moedaTotal={c.moedaPrincipal} pagamentos={p.pagamentos} onChange={p.setPagamentos} permiteFiado={!!c.pessoaId} />
          )}
          <Campo rotulo="Observação / motivo (fica no histórico)"><Entrada value={p.motivo} onChange={(e) => p.setMotivo(e.target.value)} /></Campo>
          <div className="flex flex-wrap gap-2">
            <Botao grande disabled={p.ocupado} onClick={() => p.avancar(prox.id)}>→ {t(prox.nome)}</Botao>
            {!c.pagamentos.length && <Botao variante="perigo" disabled={p.ocupado || !p.motivo} onClick={() => p.avancar('recusado')}>{t('Recusar')}</Botao>}
            {c.pagamentos.length > 0 && <Botao variante="leve" disabled={p.ocupado || !p.motivo} onClick={p.cancelar}>{t('Cancelar compra')}</Botao>}
          </div>
        </div>
      )}
      {c.etapa === 'concluido' && (
        <div className="space-y-2">
          <p className="text-sm text-[var(--bom)]">✓ {t('No estoque.')}</p>
          <Campo rotulo="Motivo para cancelar (devolve o dinheiro)"><Entrada value={p.motivo} onChange={(e) => p.setMotivo(e.target.value)} /></Campo>
          <Botao variante="leve" disabled={p.ocupado || !p.motivo} onClick={p.cancelar}>{t('Cancelar compra')}</Botao>
        </div>
      )}
    </Cartao>
  )
}
