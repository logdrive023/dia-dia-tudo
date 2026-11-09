// COBRANÇA DO MODO CAIXA — as peças do lado do dinheiro (a tela junta: ao lado no computador, embaixo no celular):
//   · CobrarEm: [ Bs | US$ | R$ ] + a cotação quando não é a principal ("1 R$ = [1,28] Bs")
//   · TotalVenda: quantos itens, o total grande na moeda de cobrança (e o equivalente), o desconto aplicado
//   · OpcoesVenda: desconto e observação SEMPRE À VISTA; embaixo, fechado, o opcional (Cliente · Quem e onde), com o resumo do que está ligado
//     quando fechado ("👤 Ana · −5% · 🧑 Paula") — nada fica escondido sem a pessoa saber

import type { ReactNode } from 'react'
import type { Id } from '../../../core/domain/tipos'
import { MOEDAS } from '../../../core/domain/dinheiro'
import { Campo, Entrada, Escolha, Info, Selecao, ValorInput, cx } from '../../../shared/ui/base'
import { Bandeira } from '../../../shared/ui/bandeira'
import { SeletorPessoa } from '../../../shared/ui/compartilhados'
import { useT } from '../../../shared/ui/i18n'

/** bandeira de cada moeda (BOB → Bolívia…) */
const PAIS_MOEDA: Record<string, string> = { BOB: 'BO', USD: 'US', BRL: 'BR', PYG: 'PY', EUR: 'ES', ARS: 'AR', CLP: 'CL', PEN: 'PE' }

export function CobrarEm({ moedas, valor, onChange, simbolo, simboloPrincipal, cotacao, onCotacao, cotacaoValida }: {
  moedas: { id: string; nome: string }[]
  valor: string
  onChange(m: string): void
  simbolo: string
  simboloPrincipal: string
  /** texto da cotação (só quando não é a principal) */
  cotacao?: string
  onCotacao(v: string): void
  cotacaoValida: boolean
}) {
  const t = useT()
  const nomeDe = (id: string) => MOEDAS.find((m) => m.codigo === id)?.nome
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-semibold text-[var(--suave)]">{t('Cobrar em')}</span>
        <Info texto="Escolha a moeda de quem está comprando. Ex.: brasileira paga em R$ com cotação 1 R$ = 1,28 Bs." />
      </div>
      {/* as moedas em cartões: bandeira + símbolo grande + nome */}
      <div role="radiogroup" aria-label={t('Cobrar em')} className="grid gap-2" style={{ gridTemplateColumns: `repeat(${Math.min(moedas.length, 4)}, minmax(0, 1fr))` }}>
        {moedas.map((m) => {
          const sel = m.id === valor
          return (
            <button key={m.id} type="button" role="radio" aria-checked={sel} aria-label={m.nome} onClick={() => onChange(m.id)}
              className={cx('flex min-h-14 min-w-0 flex-col items-center justify-center gap-0.5 rounded-xl border-2 px-1 py-1.5 transition', sel ? 'border-[var(--marca)] bg-[var(--marca-suave)] shadow-sm' : 'border-[var(--borda)] bg-[var(--cartao)] hover:border-[var(--marca)]/50')}>
              <span className="flex items-center gap-1.5">
                <Bandeira pais={PAIS_MOEDA[m.id] ?? m.id.slice(0, 2)} />
                <b className={cx('num text-base leading-none', sel ? 'text-[var(--marca)]' : 'text-[var(--texto)]')}>{m.nome}</b>
              </span>
              {nomeDe(m.id) && <span className="block max-w-full truncate text-[11px] leading-tight text-[var(--suave)]">{t(nomeDe(m.id)!)}</span>}
            </button>
          )
        })}
      </div>
      {/* a cotação do dia (só quando não é a moeda principal): a conta escrita "1 R$ = [ ] Bs" */}
      {cotacao !== undefined && (
        <div className={cx('rounded-xl border p-2.5', cotacaoValida ? 'border-[var(--borda)] bg-[var(--fundo)]' : 'border-[var(--alerta)]/60 bg-[var(--alerta)]/10')}>
          <label className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="w-full text-xs font-semibold text-[var(--suave)]">💱 {t('Cotação de hoje')}</span>
            <span className="num shrink-0 text-base font-bold">1 {simbolo} =</span>
            <input inputMode="decimal" aria-label={t('Cotação de {m}', { m: simbolo })} placeholder="1,28" value={cotacao} onChange={(e) => onCotacao(e.target.value)}
              className={cx('num min-h-11 w-28 rounded-xl border-2 bg-[var(--cartao)] px-3 text-center text-lg font-bold outline-none focus:border-[var(--marca)]', cotacaoValida ? 'border-[var(--borda)]' : 'border-[var(--alerta)]')} />
            <span className="num shrink-0 text-base font-bold">{simboloPrincipal}</span>
          </label>
          {!cotacaoValida && <p className="mt-1.5 text-sm font-semibold text-[var(--alerta)]">{t('Quanto vale 1 {m} em {p} hoje? Digite para fechar a venda.', { m: simbolo, p: simboloPrincipal })}</p>}
        </div>
      )}
    </div>
  )
}

export function TotalVenda({ itens, total, equivalente, desconto, tamanho = 'grande' }: {
  itens: number
  total: string
  /** "= Bs 35.140,00" quando cobra em outra moeda */
  equivalente?: string
  /** "Bs 36.000 − Bs 860" quando tem desconto */
  desconto?: string
  tamanho?: 'grande' | 'barra'
}) {
  const t = useT()
  return (
    <div className="min-w-0">
      <div className={cx('font-semibold text-[var(--suave)]', tamanho === 'barra' ? 'text-xs' : 'text-sm')}>{t('Total')} · {itens}</div>
      <div className={cx('num break-words font-black leading-tight', tamanho === 'barra' ? 'text-xl' : 'text-3xl')}>{total}</div>
      {equivalente && <div className="num text-sm text-[var(--suave)]">{equivalente}</div>}
      {desconto && tamanho === 'grande' && <div className="num text-sm text-[var(--suave)]">{desconto}</div>}
    </div>
  )
}

/** um grupo do "+ mais": título pequeno com ícone, os campos embaixo */
function Grupo({ icone, titulo, children }: { icone: string; titulo: string; children: ReactNode }) {
  const t = useT()
  return (
    <fieldset className="min-w-0 space-y-2 rounded-xl border border-[var(--borda)] p-3">
      <legend className="px-1 text-xs font-bold uppercase tracking-wide text-[var(--suave)]"><span aria-hidden>{icone}</span> {t(titulo)}</legend>
      {children}
    </fieldset>
  )
}

export interface OpcoesVendaProps {
  aberto: boolean
  onAlternar(): void
  /** o que está ligado, para o resumo quando fechado ("👤 Ana", "−5%") */
  resumo: string[]
  pessoaId?: Id
  onPessoa(id?: Id): void
  desconto: { modo: 'pct' | 'valor'; onModo(m: 'pct' | 'valor'): void; pct: string; onPct(v: string): void; valor?: number; onValor(v?: number): void; moeda: string; simbolo: string; aviso?: string; erro?: string }
  /** quem vendeu (comissão): só o administrador escolhe; funcionária vende em nome dela */
  vendedores?: { id: string; nome: string }[]
  vendedorId?: Id
  onVendedor(id?: Id): void
  /** a unidade (loja) da venda */
  locais?: { id: string; nome: string }[]
  localId?: Id
  onLocal(id?: Id): void
  obs: string
  onObs(v: string): void
}

export function OpcoesVenda(p: OpcoesVendaProps) {
  const t = useT()
  const temQuem = !!p.vendedores?.length || (p.locais?.length ?? 0) > 1
  return (
    <div className="space-y-3">
      {/* EM EVIDÊNCIA (sempre à vista): o desconto e a observação — o que mais se usa na hora de cobrar */}
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1">
          <Campo comoDiv rotulo="Desconto" ajuda="Em % ou em valor. Ex.: 5% de Bs 35.000 = Bs 1.750 · ou Bs 500 fixo.">
            <div className="flex gap-2">
              <div className="w-28 shrink-0"><Escolha rotulo="Desconto" valor={p.desconto.modo} onChange={(m) => p.desconto.onModo(m as 'pct' | 'valor')} opcoes={[{ id: 'pct', nome: '%' }, { id: 'valor', nome: p.desconto.simbolo }]} /></div>
              <div className="min-w-0 flex-1">
                {p.desconto.modo === 'pct' ? (
                  <div className="relative">
                    <Entrada inputMode="decimal" aria-label={t('Desconto em %')} placeholder="0" value={p.desconto.pct} onChange={(e) => p.desconto.onPct(e.target.value)} className={cx('num pr-8', p.desconto.erro && 'border-[var(--ruim)]')} />
                    <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-[var(--suave)]">%</span>
                  </div>
                ) : <ValorInput moeda={p.desconto.moeda} valor={p.desconto.valor} onChange={p.desconto.onValor} />}
              </div>
            </div>
          </Campo>
          {p.desconto.aviso && <p className="num text-sm font-semibold text-[var(--bom)]">{p.desconto.aviso}</p>}
          {p.desconto.erro && <p className="text-sm font-semibold text-[var(--ruim)]">{p.desconto.erro}</p>}
        </div>
        <Campo rotulo="Observação">
          <Entrada aria-label={t('Observação')} placeholder={t('Ex.: cliente volta amanhã para buscar')} value={p.obs} onChange={(e) => p.onObs(e.target.value)} />
        </Campo>
      </div>

      {/* EMBAIXO E FECHADO: cliente, quem vendeu e unidade — tudo OPCIONAL (a venda passa sem nada disso) */}
      <div className="rounded-xl border border-dashed border-[var(--borda)]">
        <button type="button" aria-expanded={p.aberto} onClick={p.onAlternar} className="flex min-h-11 w-full flex-wrap items-center gap-x-2 gap-y-1 px-3 py-2 text-left text-sm">
          <span className="font-semibold text-[var(--marca)]">{p.aberto ? '− ' : '+ '}{t(temQuem ? 'Cliente, quem vendeu e unidade' : 'Cliente')}</span>
          <span className="rounded-full bg-[var(--fundo)] px-2 py-0.5 text-[11px] font-bold text-[var(--suave)]">{t('Opcional')}</span>
          {!p.aberto && p.resumo.length > 0 && <span className="flex flex-wrap gap-1">{p.resumo.map((r) => <span key={r} className="rounded-full bg-[var(--marca-suave)] px-2 py-0.5 text-xs font-semibold text-[var(--marca)]">{r}</span>)}</span>}
        </button>
        {p.aberto && (
          <div className="space-y-3 border-t border-dashed border-[var(--borda)] p-3">
            <p className="text-xs text-[var(--suave)]">{t('Nada aqui é obrigatório: deixe em branco e a venda passa do mesmo jeito.')}</p>
            <Grupo icone="👤" titulo="Cliente (opcional)">
              <SeletorPessoa rotulo="Cliente" valor={p.pessoaId} onChange={p.onPessoa} opcional />
            </Grupo>
            {temQuem && (
              <Grupo icone="🧑" titulo="Quem e onde (opcional)">
                {!!p.vendedores?.length && <Campo rotulo="Quem vendeu" ajuda="A comissão e o relatório de vendas vão para esta pessoa. Vazio = a casa."><Selecao valor={p.vendedorId} onChange={(v) => p.onVendedor(v || undefined)} vazio="A casa (ninguém)" opcoes={p.vendedores} /></Campo>}
                {(p.locais?.length ?? 0) > 1 && <Campo rotulo="Unidade"><Selecao valor={p.localId} onChange={(v) => p.onLocal(v || undefined)} vazio="Nenhuma (sem unidade)" opcoes={p.locais!} /></Campo>}
              </Grupo>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
