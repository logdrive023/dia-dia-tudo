// ABA PAGAMENTO DO PEDIDO — um componente só, na ordem de quem bate o olho:
//   1. A CONTA DESTE PEDIDO: Total · Pago · Falta (números grandes), a barra e cada pagamento feito
//   2. PAGAR AGORA (o normal: compra paga no ato): as formas já com o valor que falta e UM botão "Pagar e concluir"
//      — a compra vai direto até Concluído. Pagar depois? Configurações › Geral ("Compra paga no ato") ou "etapa por
//      etapa" logo abaixo
//   3. A CONTA DO FORNECEDOR (antes era uma aba só dela): quanto devo / me deve, com todas as compras com ele
//   4. AS ETAPAS (Chegou → Conferido → Pago → Concluído) recolhidas: para quem usa o fluxo completo, recusar ou cancelar

import { useEffect, useState } from 'react'
import { formatar } from '../core/domain/dinheiro'
import { novoId } from '../core/domain/ids'
import type { Id } from '../core/domain/tipos'
import { Botao, Campo, Cartao, Confirmar, Entrada, GramasInput, Info, Pilula, ValorInput, cx, dataBR } from '../ui/base'
import { CodigoTexto } from '../ui/codigos'
import { EditorPagamentos, type PagamentoTela, useCotacoes } from '../ui/compartilhados'
import { useApp, useComando, useConsulta } from '../ui/contexto'
import { useT } from '../ui/i18n'
import { NumeroGrande, GrupoNumeros } from '../ui/numeroGrande'
import { SeloPendencias } from '../ui/pendencias'

type DadosPedido = NonNullable<ReturnType<typeof useConsulta<'pedido'>>['dados']>
const ENCERRADAS = ['concluido', 'recusado', 'cancelado']

export function PagamentoCompra({ dados, comLote }: { dados: DadosPedido; comLote(linhaId: Id): boolean }) {
  const t = useT()
  const { ir, sessao } = useApp()
  const { executar, ocupado } = useComando()
  const { cfg } = useCotacoes('compra')
  const { dados: config } = useConsulta('configuracoes', {})
  const c = dados.compra
  const m = c.moedaPrincipal
  const admin = sessao.perfil === 'admin'
  const encerrada = ENCERRADAS.includes(c.etapa)
  const cancelada = c.etapa === 'recusado' || c.etapa === 'cancelado'
  const noAto = config?.config.compraPagaNoAto !== false
  const falta = Math.max(0, c.totalPrincipal - dados.pago)
  const [pagamentos, setPagamentos] = useState<PagamentoTela[]>([])
  const [ajustes, setAjustes] = useState<Record<Id, { quantidade?: number; total?: number }>>({})
  const [motivo, setMotivo] = useState('')
  const [etapas, setEtapas] = useState(false)
  // pagar agora: já vem com o que falta em dinheiro (um toque e pronto; dá para trocar a forma ou dividir)
  useEffect(() => {
    if (!encerrada && falta > 0 && !pagamentos.length) setPagamentos([{ id: novoId(), forma: 'dinheiro', moeda: m, valor: falta }])
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [encerrada, falta])
  const nomeForma = new Map((cfg?.formas ?? []).map((f) => [f.id, f.nome]))
  const valendo = pagamentos.filter((p) => p.valor)
  const somaAgora = valendo.reduce((s, p) => s + (p.moeda === m ? p.valor! : 0), 0)
  const pagar = async () => {
    const r = await executar('pagarCompra', { compraId: c.id, motivo: motivo || undefined, pagamentos: valendo.map((p) => ({ id: p.id, forma: p.forma, moeda: p.moeda, valor: p.valor! })) }, t('Pago e concluído ✓'))
    if (r) (setPagamentos([]), setMotivo(''))
  }
  const avancar = async (para: string, motivoDado?: string) => {
    const r = await executar('avancarTriagem', {
      compraId: c.id, para, motivo: motivoDado || motivo || undefined,
      ajustes: Object.entries(ajustes).map(([linhaId, a]) => ({ linhaId, ...a })),
      pagamentos: valendo.map((p) => ({ id: p.id, forma: p.forma, moeda: p.moeda, valor: p.valor! })),
    }, t('Etapa registrada.'))
    if (r) (setAjustes({}), setPagamentos([]), setMotivo(''))
  }
  const cancelar = async (mot?: string) => { await executar('cancelarCompra', { compraId: c.id, motivo: mot ?? motivo }, t('Compra cancelada.')) }
  const saldo = dados.saldoConta ?? 0
  const pct = c.totalPrincipal ? Math.min(100, Math.round((dados.pago * 100) / c.totalPrincipal)) : 0
  return (
    <div className="grid items-start gap-4 lg:grid-cols-[1fr_22rem]">
      <div className="min-w-0 space-y-4">
        {/* 1. A CONTA DESTE PEDIDO */}
        <section aria-label={t('Pagamento')} className="space-y-2">
          <GrupoNumeros colunas={3} celular={3} className="mb-0">
            <NumeroGrande icone="🧾" rotulo="Total" valor={formatar(c.totalPrincipal, m)} />
            <NumeroGrande icone="✅" rotulo="Pago" valor={formatar(dados.pago, m)} tom={dados.pago > 0 ? 'bom' : undefined} />
            <NumeroGrande icone="⏳" rotulo="Falta" valor={formatar(falta, m)} tom={cancelada ? undefined : falta > 0 ? 'alerta' : 'bom'} sub={!cancelada && falta === 0 ? `✓ ${t('quitado')}` : undefined} />
          </GrupoNumeros>
          <div className="flex h-2 overflow-hidden rounded-full bg-[var(--fundo)] ring-1 ring-[var(--borda)]" aria-hidden><span className="bg-[var(--bom)]" style={{ width: `${pct}%` }} /></div>
          {c.pagamentos.length > 0 && (
            <ul className="divide-y divide-[var(--borda)] overflow-hidden rounded-xl border border-[var(--borda)] bg-[var(--cartao)] text-sm">
              {c.pagamentos.map((p) => (
                <li key={p.id} className="flex items-center justify-between gap-2 px-3 py-2">
                  <span>💵 {t(nomeForma.get(p.forma) ?? p.forma)}</span>
                  <b className="num">{formatar(p.valor, p.moeda)}</b>
                </li>
              ))}
            </ul>
          )}
          {cancelada && <Pilula tom="ruim">{t(c.etapa === 'recusado' ? 'Recusado' : 'Cancelado')}</Pilula>}
          {c.etapa === 'concluido' && (
            <p className={cx('rounded-xl px-3 py-2.5 text-sm font-semibold', falta > 0 ? 'bg-[var(--alerta)]/12 text-[var(--texto)]' : 'bg-[var(--bom)]/10 text-[var(--bom)]')}>
              {falta > 0 ? `⏳ ${t('Concluída, mas faltam {v}: ficou na conta do fornecedor (ao lado).', { v: formatar(falta, m) })}` : `✓ ${t('Pago e entregue.')}`}
            </p>
          )}
        </section>

        {/* 2. PAGAR AGORA (o normal) */}
        {admin && !encerrada && noAto && (
          <Cartao titulo={`💵 ${t('Pagar agora')}`} ajuda="Compra paga na hora (o normal): escolha a forma, confira o valor e toque em Pagar e concluir. O pedido vai direto até Concluído. Pagou só uma parte? O resto fica na conta do fornecedor.">
            <div className="space-y-3">
              <EditorPagamentos uso="compra" total={falta} moedaTotal={m} pagamentos={pagamentos} onChange={setPagamentos} permiteFiado={!!c.pessoaId} />
              <Campo rotulo="Observação (opcional · fica no histórico)"><Entrada value={motivo} onChange={(e) => setMotivo(e.target.value)} /></Campo>
              <Botao grande className="w-full" disabled={ocupado || !valendo.length} onClick={pagar}>✓ {t('Pagar {v} e concluir', { v: formatar(somaAgora || falta, m) })}</Botao>
              <button type="button" aria-expanded={etapas} onClick={() => setEtapas(!etapas)} className="min-h-10 text-sm font-semibold text-[var(--marca)] hover:underline">{t('Pagar depois ou seguir etapa por etapa')} {etapas ? '▴' : '▾'}</button>
            </div>
          </Cartao>
        )}

        {/* 4. AS ETAPAS (recolhidas quando é pago no ato; abertas quando a regra é pagar depois) */}
        {(!noAto || etapas || encerrada || !admin) && (
          <EtapasCompra compra={c} comLote={comLote} ocupado={ocupado} ajustes={ajustes} setAjustes={setAjustes} pagamentos={pagamentos} setPagamentos={setPagamentos} motivo={motivo} setMotivo={setMotivo} avancar={avancar} cancelar={cancelar} semPagar={noAto && admin} />
        )}
      </div>

      {/* 3. A CONTA DO FORNECEDOR */}
      <aside className="h-fit space-y-4 lg:sticky lg:top-4">
        {dados.pessoa ? (
          <Cartao titulo={t('Conta do fornecedor')} ajuda="Saldo de tudo com esta pessoa: compras, pagamentos, adiantamentos e acertos. Ex.: comprei Bs 6.000, paguei 5.000 → devo Bs 1.000." acao={<Botao variante="leve" onClick={() => ir('pessoa', { id: dados.pessoa!.id })}>{t('Abrir')} ›</Botao>}>
            <p className="mb-1 text-sm font-semibold">{dados.pessoa.nome}</p>
            <p className={cx('num rounded-xl px-3 py-3 text-xl font-bold', saldo < 0 ? 'bg-[var(--ruim)]/10 text-[var(--ruim)]' : saldo > 0 ? 'bg-[var(--bom)]/10 text-[var(--bom)]' : 'bg-[var(--fundo)]')}>
              {saldo < 0 ? `${t('Devo')} ${formatar(-saldo, m)}` : saldo > 0 ? `${t('Me deve')} ${formatar(saldo, m)}` : `✓ ${t('Conta em dia')}`}
            </p>
            {dados.outras.length > 0 && (
              <details className="mt-3">
                <summary className="min-h-10 cursor-pointer py-2 text-sm font-semibold text-[var(--marca)]">{t('Outras compras com {p}', { p: dados.pessoa.nome })} ({dados.outras.length})</summary>
                <ul className="divide-y divide-[var(--borda)] overflow-hidden rounded-xl border border-[var(--borda)] text-sm">
                  {dados.outras.map((o) => (
                    <li key={o.id}>
                      <button type="button" onClick={() => ir('pedido', { id: o.id, aba: 'pagamento' })} className="flex min-h-11 w-full items-center justify-between gap-2 px-3 text-left hover:bg-[var(--fundo)]">
                        <span className="min-w-0 truncate"><CodigoTexto codigo={o.codigo} /> <span className="text-[var(--suave)]">· {dataBR(o.data)} · {t(o.etapa)}</span></span>
                        <span className="num shrink-0 font-semibold">{formatar(o.total, m)}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              </details>
            )}
          </Cartao>
        ) : (
          <Cartao titulo={t('Conta do fornecedor')}><p className="text-sm text-[var(--suave)]">{t('Compra sem fornecedor: não há conta para acompanhar.')}</p></Cartao>
        )}
      </aside>
    </div>
  )
}

/** Progresso das etapas em miniatura (lista) ou completo (tela do pedido). */
export function Progresso({ etapas, atual, mini }: { etapas: { id: string; nome: string }[]; atual: string; mini?: boolean }) {
  const t = useT()
  const idx = atual === 'concluido' ? etapas.length - 1 : etapas.findIndex((e) => e.id === atual)
  const parou = atual === 'recusado' || atual === 'cancelado'
  if (mini)
    return (
      <span className="flex items-center gap-1" title={etapas.map((e) => t(e.nome)).join(' → ')}>
        {etapas.map((e, i) => (
          <span key={e.id} className={cx('h-1.5 w-5 rounded-full', parou ? 'bg-[var(--ruim)]/40' : i <= idx ? 'bg-[var(--marca)]' : 'bg-[var(--borda)]')} />
        ))}
      </span>
    )
  return (
    <ol className="flex w-full items-start">
      {etapas.map((e, i) => {
        const feito = !parou && i < idx
        const agora = !parou && i === idx
        return (
          <li key={e.id} className="relative flex flex-1 flex-col items-center text-center">
            {i > 0 && <span className={cx('absolute right-1/2 top-4 h-0.5 w-full', feito || agora ? 'bg-[var(--marca)]' : 'bg-[var(--borda)]')} aria-hidden />}
            <span className={cx('relative z-10 flex h-8 w-8 items-center justify-center rounded-full border-2 text-sm font-bold', feito ? 'border-[var(--marca)] bg-[var(--marca)] text-white' : agora ? 'border-[var(--marca)] bg-[var(--cartao)] text-[var(--marca)]' : 'border-[var(--borda)] bg-[var(--cartao)] text-[var(--suave)]')}>
              {feito || (agora && atual === 'concluido') ? '✓' : i + 1}
            </span>
            <span className={cx('mt-1 px-1 text-xs', agora ? 'font-bold text-[var(--marca)]' : 'text-[var(--suave)]')}>{t(e.nome)}</span>
          </li>
        )
      })}
    </ol>
  )
}

function EtapasCompra(p: {
  compra: DadosPedido['compra']
  /** a linha já tem lote (o peso conferido vira lançamento: aqui só o valor) */
  comLote(linhaId: Id): boolean
  ocupado: boolean
  ajustes: Record<Id, { quantidade?: number; total?: number }>
  setAjustes(a: Record<Id, { quantidade?: number; total?: number }>): void
  pagamentos: PagamentoTela[]
  setPagamentos(x: PagamentoTela[]): void
  motivo: string
  setMotivo(m: string): void
  avancar(para: string, motivo?: string): void
  cancelar(motivo?: string): void
  /** o pagamento é feito no cartão "Pagar agora" (aqui as etapas avançam sem o editor de pagamento) */
  semPagar?: boolean
}) {
  const t = useT()
  const { ir, sessao, nav } = useApp()
  const admin = sessao.perfil === 'admin'
  const { dados: cfg } = useConsulta('configuracoes', {})
  const c = p.compra
  // as etapas vêm do módulo (genérico: cada modalidade define as suas)
  const etapas = cfg?.modulos.find((m) => m.id === c.moduloId)?.etapas ?? []
  const idx = etapas.findIndex((e) => e.id === c.etapa)
  const prox = etapas[idx + 1]
  const encerrada = ['concluido', 'recusado', 'cancelado'].includes(c.etapa)
  const [recusar, setRecusar] = useState(false)
  const [cancelarConcluida, setCancelarConcluida] = useState(false)
  return (
    <Cartao titulo={t('Etapas do pedido')}>
      <div className="mb-4">
        <Progresso etapas={etapas} atual={c.etapa} />
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <span className="text-sm text-[var(--suave)]">{t('O que falta')}:</span>
          <SeloPendencias pendencias={c.pendencias} moeda={c.moedaPrincipal} />
          {admin && (
            <button type="button" onClick={() => ir('config', { aba: 'etapas', modulo: c.moduloId })} className="ml-auto min-h-10 rounded-xl px-2 text-sm font-semibold text-[var(--marca)] hover:bg-[var(--marca-suave)]">⚙ {t('Personalizar etapas')}</button>
          )}
        </div>
      </div>
      {prox && !encerrada && <p className="mb-3 text-sm text-[var(--suave)]">{t('Próximo passo')}: <b className="text-[var(--texto)]">{t(prox.nome)}</b> <Info texto={prox.ajuda ?? ''} /></p>}
      {!encerrada && prox && (
        <div className="space-y-3">
          {!c.pagamentos.length && (
            <details open={!!nav.params.ajustar}>
              <summary className="cursor-pointer text-sm font-semibold text-[var(--marca)]">{t('Ajustar o valor (antes de pagar)')}</summary>
              <div className="mt-2 space-y-2">
                {c.linhas.map((l) => (
                  <div key={l.id} className="grid grid-cols-2 gap-2 text-sm">
                    {!p.comLote(l.id) ? <Campo rotulo={`${l.descricao} · ${t('peso real')}`}><GramasInput valor={p.ajustes[l.id]?.quantidade ?? l.quantidade} onChange={(q) => p.setAjustes({ ...p.ajustes, [l.id]: { ...p.ajustes[l.id], quantidade: q } })} /></Campo> : <span className="self-end pb-3 font-medium">{l.descricao}</span>}
                    <Campo rotulo="Valor"><ValorInput moeda={l.moeda} valor={p.ajustes[l.id]?.total ?? l.total} onChange={(v) => p.setAjustes({ ...p.ajustes, [l.id]: { ...p.ajustes[l.id], total: v } })} /></Campo>
                  </div>
                ))}
              </div>
            </details>
          )}
          {prox.faz?.includes('pagamento') && !p.semPagar && (
            <EditorPagamentos uso="compra" total={c.totalPrincipal} moedaTotal={c.moedaPrincipal} pagamentos={p.pagamentos} onChange={p.setPagamentos} permiteFiado={!!c.pessoaId} />
          )}
          <Campo rotulo="Observação / motivo (fica no histórico)"><Entrada value={p.motivo} onChange={(e) => p.setMotivo(e.target.value)} /></Campo>
          <div className="flex flex-wrap gap-2">
            <Botao grande disabled={p.ocupado} onClick={() => p.avancar(prox.id)}>→ {t(prox.nome)}</Botao>
            {!c.pagamentos.length && <Botao variante="perigo" disabled={p.ocupado} onClick={() => setRecusar(true)}>{t('Recusar')}</Botao>}
            {c.pagamentos.length > 0 && <Botao variante="leve" disabled={p.ocupado || !p.motivo} onClick={() => p.cancelar()}>{t('Cancelar compra')}</Botao>}
          </div>
        </div>
      )}
      {recusar && <Confirmar titulo="Recusar este pedido?" texto="O pedido é encerrado e o cabelo sai da Triagem (se ninguém separou). Fica no histórico com o motivo." rotulo="Recusar" perigo pedirMotivo motivoPadrao={p.motivo} onFechar={() => setRecusar(false)} onConfirmar={(motivo) => (p.setMotivo(motivo), p.avancar('recusado', motivo))} />}
      {c.etapa === 'concluido' && (
        // concluída: um aviso claro; cancelar é exceção → link discreto que pede o motivo numa confirmação
        <div className="space-y-2">
          {admin && <button type="button" disabled={p.ocupado} onClick={() => setCancelarConcluida(true)} className="min-h-10 rounded-lg px-1 text-sm font-semibold text-[var(--ruim)] hover:underline">{t('Cancelar compra…')}</button>}
        </div>
      )}
      {cancelarConcluida && <Confirmar titulo="Cancelar esta compra?" texto="O dinheiro volta e o cabelo sai do estoque (se ainda não foi vendido). Fica no histórico com o motivo." rotulo="Cancelar compra" perigo pedirMotivo motivoPadrao={p.motivo} onFechar={() => setCancelarConcluida(false)} onConfirmar={(motivo) => p.cancelar(motivo)} />}
    </Cartao>
  )
}
