// VIAGEM DE COMPRA no celular: o gasto em segundos (categoria → valor → salvar) e o painel de quem está viajando.
// Tudo passa pelos comandos normais: salvo neste aparelho na hora (fila de saída) e sincronizado quando houver sinal.

import { useState } from 'react'
import { formatar } from '../core/domain/dinheiro'
import { dataLocal } from '../core/domain/datas'
import { novoId } from '../core/domain/ids'
import type { Id } from '../core/domain/tipos'
import type { CategoriaViagem, SaldoCarteira } from '../core/services/viagens'
import { Botao, Campo, Cartao, Confirmar, Entrada, Janela, Pilula, Selecao, ValorInput, Vazio, cx, dataBR, gramasTexto } from './base'
import { useApp, useComando, useConsulta } from './contexto'
import { Anexos } from './compartilhados'
import { useLembrado } from './filtros'
import { useT } from './i18n'

/** "Salvo neste aparelho · sincroniza quando houver sinal" (só quando os dados ficam no aparelho). */
export function AvisoNoAparelho({ className }: { className?: string }) {
  const t = useT()
  const { backend } = useApp()
  if (backend.tipo === 'api') return null
  return <p className={cx('text-center text-xs text-[var(--suave)]', className)}>📶 {t('Salvo neste aparelho · sincroniza quando houver sinal')}</p>
}

/**
 * FOLHA DO GASTO: 3 campos. Categoria em chips (lembra a última), valor com a moeda em chips, foto opcional.
 * Dois toques: escolher a categoria (a última fica lembrada), digitar o valor e "Salvar".
 */
export function FolhaDespesa({ aberta, onFechar, viagemId, categorias, moedas, moedaPadrao }: { aberta: boolean; onFechar(): void; viagemId: Id; categorias: CategoriaViagem[]; moedas: string[]; moedaPadrao: string }) {
  const t = useT()
  const { executar, ocupado } = useComando()
  const [ultimaCat, setUltimaCat] = useLembrado('viagem.categoria', categorias[0]?.id ?? '')
  const [ultimaMoeda, setUltimaMoeda] = useLembrado('viagem.moeda', moedaPadrao)
  const [categoria, setCategoria] = useState<string>()
  const [moedaEscolhida, setMoeda] = useState<string>()
  const [valor, setValor] = useState<number>()
  const [nota, setNota] = useState('')
  const [comNota, setComNota] = useState(false)
  const [outroDia, setOutroDia] = useState<string>()
  const [id, setId] = useState(() => novoId())
  const cat = categoria ?? (categorias.some((c) => c.id === ultimaCat) ? ultimaCat : categorias[0]?.id)
  const moeda = moedaEscolhida ?? (moedas.includes(ultimaMoeda) ? ultimaMoeda : moedaPadrao)
  const limpar = () => {
    setCategoria(undefined)
    setMoeda(undefined)
    setValor(undefined)
    setNota('')
    setComNota(false)
    setOutroDia(undefined)
    setId(novoId())
  }
  const salvar = async () => {
    if (!cat || !valor) return
    const r = await executar('registrarDespesaViagem', { id, viagemId, categoria: cat, moeda, valor, nota: nota.trim() || undefined, data: outroDia || undefined }, t('Gasto salvo.'))
    if (!r) return
    setUltimaCat(cat)
    setUltimaMoeda(moeda)
    limpar()
    onFechar()
  }
  return (
    <Janela
      aberta={aberta}
      titulo={`+ ${t('Gasto da viagem')}`}
      onFechar={onFechar}
      rodape={
        <div className="space-y-1">
          <Botao grande className="w-full" disabled={ocupado || !cat || !valor} onClick={salvar}>
            {t('Salvar')} {valor ? formatar(valor, moeda) : ''}
          </Botao>
          <AvisoNoAparelho />
        </div>
      }
    >
      <div className="space-y-4">
        <div role="radiogroup" aria-label={t('Categoria')} className="grid grid-cols-3 gap-2 sm:grid-cols-4">
          {categorias.map((c) => (
            <button
              key={c.id}
              type="button"
              role="radio"
              aria-checked={cat === c.id}
              onClick={() => setCategoria(c.id)}
              className={cx('flex min-h-16 flex-col items-center justify-center gap-0.5 rounded-2xl border px-1 py-2 text-xs font-semibold', cat === c.id ? 'border-[var(--marca)] bg-[var(--marca-suave)] text-[var(--marca)]' : 'border-[var(--borda)]')}
            >
              <span aria-hidden className="text-2xl leading-none">{c.icone}</span>
              <span className="w-full truncate text-center">{t(c.nome)}</span>
            </button>
          ))}
        </div>
        <div>
          <div role="radiogroup" aria-label={t('Moeda')} className="mb-2 flex flex-wrap gap-1">
            {moedas.map((m) => (
              <button key={m} type="button" role="radio" aria-checked={m === moeda} onClick={() => setMoeda(m)} className={cx('min-h-10 rounded-full px-4 text-sm font-bold', m === moeda ? 'bg-[var(--marca)] text-white' : 'bg-[var(--marca-suave)] text-[var(--marca)]')}>
                {m}
              </button>
            ))}
          </div>
          <ValorInput moeda={moeda} valor={valor} onChange={setValor} />
        </div>
        <div>
          <span className="mb-1 block text-sm font-semibold text-[var(--suave)]">{t('Foto do recibo (opcional)')}</span>
          <Anexos donoId={id} categorias={['comprovante']} />
        </div>
        <div className="flex flex-wrap gap-2 text-sm">
          {!comNota && <Botao variante="leve" onClick={() => setComNota(true)}>+ {t('Nota')}</Botao>}
          {outroDia === undefined && <Botao variante="leve" onClick={() => setOutroDia(dataLocal())}>{t('Foi em outro dia?')}</Botao>}
        </div>
        {comNota && <Campo rotulo="Nota"><Entrada autoFocus value={nota} onChange={(e) => setNota(e.target.value)} placeholder={t('Ex.: posto na saída de Oruro')} /></Campo>}
        {outroDia !== undefined && <Campo rotulo="Dia do gasto"><Entrada type="date" value={outroDia} onChange={(e) => setOutroDia(e.target.value)} /></Campo>}
      </div>
    </Janela>
  )
}

/** Carteira da viagem por moeda: o que levou, gastou e deve ter na mão. */
export function CarteiraViagem({ carteira }: { carteira: SaldoCarteira[] }) {
  const t = useT()
  if (!carteira.length) return <p className="text-sm text-[var(--suave)]">{t('Sem adiantamento: os gastos ficam para reembolsar na prestação de contas.')}</p>
  return (
    <ul className="grid gap-2 sm:grid-cols-2">
      {carteira.map((c) => (
        <li key={c.moeda} className="rounded-2xl bg-[var(--fundo)] p-3">
          <div className="text-xs font-semibold text-[var(--suave)]">{t('Na mão')} · {c.moeda}</div>
          <div className={cx('num text-2xl font-bold', c.saldo < 0 && 'text-[var(--ruim)]')}>{formatar(c.saldo, c.moeda)}</div>
          <div className="num text-xs text-[var(--suave)]">
            {t('levou')} {formatar(c.adiantado, c.moeda)} · {t('gastou')} {formatar(c.gasto, c.moeda)}
            {c.devolvido ? ` · ${t('devolveu')} ${formatar(c.devolvido, c.moeda)}` : ''}
            {c.reembolsado ? ` · ${t('reembolso')} ${formatar(c.reembolsado, c.moeda)}` : ''}
          </div>
          {c.saldo < 0 && <div className="text-xs text-[var(--ruim)]">{t('Gastou mais do que levou (pagou do bolso).')}</div>}
        </li>
      ))}
    </ul>
  )
}

/** Barra de orçamento: usado × previsto (vermelha quando passa). */
export function BarraOrcamento({ rotulo, usado, previsto, moeda }: { rotulo: string; usado: number; previsto?: number; moeda: string }) {
  const t = useT()
  const pct = previsto ? Math.round((usado * 100) / previsto) : undefined
  return (
    <div>
      <div className="flex flex-wrap justify-between gap-2 text-sm">
        <span className="font-semibold">{t(rotulo)}</span>
        <span className="num">
          {formatar(usado, moeda)}
          {previsto ? <span className="text-[var(--suave)]"> / {formatar(previsto, moeda)} ({pct}%)</span> : <span className="text-[var(--suave)]"> · {t('sem orçamento')}</span>}
        </span>
      </div>
      {!!previsto && (
        <span className="mt-1 block h-2.5 rounded-full bg-[var(--marca-suave)]">
          <span className={cx('block h-2.5 rounded-full', pct! > 100 ? 'bg-[var(--ruim)]' : pct! > 85 ? 'bg-[var(--alerta)]' : 'bg-[var(--bom)]')} style={{ width: `${Math.min(100, pct!)}%` }} />
        </span>
      )}
    </div>
  )
}

/** Uma linha de gasto (ícone, categoria, quem, quando, valor) com "anular" para quem pode. */
export function LinhaGasto({ g, onAnular }: { g: { id: Id; icone: string; nomeCategoria: string; valor: number; moeda: string; valorPrincipal: number; data: string; porNome: string; nota?: string; anulada?: { motivo: string; porNome: string } }; onAnular?: () => void }) {
  const t = useT()
  return (
    <li className="flex items-center gap-3 py-2">
      <span aria-hidden className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--fundo)] text-xl">{g.icone}</span>
      <span className="min-w-0 flex-1">
        <span className={cx('block truncate font-semibold', g.anulada && 'line-through opacity-60')}>{t(g.nomeCategoria)}{g.nota ? ` · ${g.nota}` : ''}</span>
        <span className="block truncate text-xs text-[var(--suave)]">
          {dataBR(g.data)} · {g.porNome}
          {g.anulada ? ` · ${t('anulado')}: ${g.anulada.motivo}` : ''}
        </span>
      </span>
      <span className={cx('num shrink-0 text-right font-bold', g.anulada && 'line-through opacity-60')}>{formatar(g.valor, g.moeda)}</span>
      {onAnular && !g.anulada && <Botao variante="leve" className="shrink-0" onClick={onAnular}>{t('anular')}</Botao>}
    </li>
  )
}

/**
 * PAINEL DO VIAJANTE: a viagem aberta de quem está usando. Orçamento, gasto, cabelo comprado, dinheiro na mão por
 * moeda, o botão gigante "+ Gasto" e as listas de gastos e compras.
 */
export function PainelViajante({ viagemId }: { viagemId?: Id }) {
  const t = useT()
  const { sessao, ir } = useApp()
  const [escolhida, setEscolhida] = useState<Id | undefined>(viagemId)
  const { dados } = useConsulta('painelViajante', { viagemId: escolhida })
  const { executar } = useComando()
  const [folha, setFolha] = useState(false)
  const [anular, setAnular] = useState<Id>()
  if (!dados) return null
  const v = dados.viagem
  if (!v) return <Vazio texto="Você não tem viagem de compra aberta." />
  const admin = sessao.perfil === 'admin'
  return (
    <div className="space-y-3">
      <Cartao>
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="text-xs font-semibold text-[var(--suave)]">✈️ {t('Em viagem')} · {v.codigo}</div>
            <h2 className="break-words text-xl font-bold">{v.nome}</h2>
            <p className="text-sm text-[var(--suave)]">{v.viajantes.join(', ')} · {t('desde')} {dataBR(v.inicio)}{v.fim ? ` ${t('até')} ${dataBR(v.fim)}` : ''}</p>
          </div>
          {v.acimaOrcamento && <Pilula tom="ruim">{t('Acima do orçamento')}</Pilula>}
        </div>
        {dados.abertas.length > 1 && (
          <div className="mt-2">
            <Selecao valor={v.id} onChange={(x) => setEscolhida(x)} opcoes={dados.abertas.map((x) => ({ id: x.id, nome: `${x.codigo} · ${x.nome}${x.minha ? ' ★' : ''}` }))} />
          </div>
        )}
        <button type="button" onClick={() => setFolha(true)} className="mt-4 flex min-h-20 w-full items-center justify-center gap-2 rounded-3xl bg-[var(--marca)] text-2xl font-black text-white shadow-lg active:scale-[0.99]">
          <span aria-hidden>+</span> {t('Gasto')}
        </button>
        <AvisoNoAparelho className="mt-2" />
      </Cartao>
      <Cartao titulo={t('Dinheiro da viagem')}>
        <CarteiraViagem carteira={v.carteira} />
      </Cartao>
      <Cartao titulo={t('Orçamento')}>
        <div className="space-y-3">
          <BarraOrcamento rotulo="Gastos da viagem" usado={v.gasto} previsto={v.orcamento} moeda={dados.moeda} />
          <BarraOrcamento rotulo="Cabelo comprado" usado={v.valorCompras} previsto={v.orcamentoCompra} moeda={dados.moeda} />
          <p className="num text-sm">{t('Cabelo comprado')}: <b>{gramasTexto(v.gramas)}</b> · {formatar(v.valorCompras, dados.moeda)}</p>
        </div>
      </Cartao>
      <Cartao titulo={`${t('Gastos')} (${v.despesas.filter((x) => !x.anulada).length})`}>
        {!v.despesas.length ? (
          <p className="text-sm text-[var(--suave)]">{t('Nenhum gasto ainda. Toque em "+ Gasto" a cada despesa.')}</p>
        ) : (
          <ul className="divide-y divide-[var(--borda)]">
            {v.despesas.map((g) => <LinhaGasto key={g.id} g={g} onAnular={g.minha || admin ? () => setAnular(g.id) : undefined} />)}
          </ul>
        )}
      </Cartao>
      <Cartao titulo={`${t('Compras da viagem')} (${v.compras.length})`}>
        {!v.compras.length ? (
          <p className="text-sm text-[var(--suave)]">{t('Nenhuma compra ligada a esta viagem (ainda). Viagem sem compra também conta: é prospecção.')}</p>
        ) : (
          <ul className="divide-y divide-[var(--borda)] text-sm">
            {v.compras.map((c) => (
              <li key={c.id}>
                <button type="button" disabled={!admin} onClick={() => ir('pedido', { id: c.id })} className="flex min-h-11 w-full items-center justify-between gap-2 py-1 text-left disabled:cursor-default">
                  <span className="min-w-0"><b>{c.codigo}</b> · {c.fornecedor ?? t('Sem fornecedor')} <span className="text-xs text-[var(--suave)]">{dataBR(c.data)}</span></span>
                  <span className="num shrink-0">{gramasTexto(c.gramas)} · {formatar(c.valor, dados.moeda)}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </Cartao>
      {admin && <Botao variante="secundario" className="w-full" onClick={() => ir('viagem', { id: v.id })}>{t('Abrir a viagem (resultado e prestação de contas)')} →</Botao>}
      <FolhaDespesa aberta={folha} onFechar={() => setFolha(false)} viagemId={v.id} categorias={dados.categorias} moedas={dados.moedas} moedaPadrao={dados.moeda} />
      {anular && (
        <Confirmar titulo="Anular gasto?" texto="O gasto fica riscado no histórico (nada é apagado)." rotulo="Anular" perigo pedirMotivo onFechar={() => setAnular(undefined)} onConfirmar={(motivo) => executar('anularDespesaViagem', { viagemId: v.id, despesaId: anular, motivo }, t('Gasto anulado.'))} />
      )}
    </div>
  )
}
