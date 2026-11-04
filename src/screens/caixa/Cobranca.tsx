// COBRANÇA DO MODO CAIXA — as peças do lado do dinheiro (a tela junta: ao lado no computador, embaixo no celular):
//   · CobrarEm: [ Bs | US$ | R$ ] + a cotação quando não é a principal ("1 R$ = [1,28] Bs")
//   · TotalVenda: quantos itens, o total grande na moeda de cobrança (e o equivalente), o desconto aplicado
//   · OpcoesVenda: o "+ mais" em GRUPOS (Cliente · Preço · Quem e onde · Observação), com um resumo do que está ligado
//     quando fechado ("👤 Ana · −5% · 🧑 Paula") — nada fica escondido sem a pessoa saber

import type { ReactNode } from 'react'
import type { Id } from '../../core/domain/tipos'
import { Campo, Entrada, Escolha, Info, Selecao, ValorInput, cx } from '../../ui/base'
import { SeletorPessoa } from '../../ui/compartilhados'
import { useT } from '../../ui/i18n'

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
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <span className="shrink-0 text-sm font-semibold text-[var(--suave)]">{t('Cobrar em')}</span>
        <div className="min-w-0 flex-1"><Escolha rotulo="Cobrar em" valor={valor} onChange={onChange} opcoes={moedas} /></div>
        <Info texto="Escolha a moeda de quem está comprando. Ex.: brasileira paga em R$ com cotação 1 R$ = 1,28 Bs." />
      </div>
      {cotacao !== undefined && (
        <label className="flex flex-wrap items-center gap-2 text-sm font-semibold">
          <span className="shrink-0">{t('Cotação')}: 1 {simbolo} =</span>
          <input inputMode="decimal" aria-label={t('Cotação de {m}', { m: simbolo })} value={cotacao} onChange={(e) => onCotacao(e.target.value)}
            className={cx('num min-h-10 w-24 rounded-xl border bg-[var(--cartao)] px-2 text-base outline-none focus:border-[var(--marca)]', cotacaoValida ? 'border-[var(--borda)]' : 'border-[var(--ruim)]')} />
          <span className="shrink-0">{simboloPrincipal}</span>
        </label>
      )}
      {!cotacaoValida && <p className="text-sm font-semibold text-[var(--ruim)]">{t('Digite a cotação de {m}.', { m: simbolo })}</p>}
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
  colunas: { id: string; nome: string }[]
  colunaId?: string
  onColuna(id?: string): void
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
  return (
    <div>
      <button type="button" aria-expanded={p.aberto} onClick={p.onAlternar} className="flex min-h-10 w-full flex-wrap items-center gap-x-2 gap-y-1 text-left text-sm font-semibold text-[var(--marca)]">
        <span>{p.aberto ? '− ' : '+ '}{t('mais (cliente, desconto, quem vendeu, observação)')}</span>
        {!p.aberto && p.resumo.length > 0 && <span className="flex flex-wrap gap-1">{p.resumo.map((r) => <span key={r} className="rounded-full bg-[var(--marca-suave)] px-2 py-0.5 text-xs">{r}</span>)}</span>}
      </button>
      {p.aberto && (
        <div className="mt-2 space-y-3">
          <Grupo icone="👤" titulo="Cliente">
            <SeletorPessoa rotulo="Cliente" valor={p.pessoaId} onChange={p.onPessoa} opcional />
          </Grupo>
          <Grupo icone="🏷" titulo="Preço">
            {p.colunas.length > 1 && (
              <Campo rotulo="Coluna da tabela (comprador)" ajuda="Cada comprador tem seu preço. Se a pessoa estiver ligada a uma coluna, ela já vem escolhida.">
                <Selecao valor={p.colunaId} onChange={(v) => p.onColuna(v || undefined)} vazio="Automática" opcoes={p.colunas} />
              </Campo>
            )}
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
          </Grupo>
          {(!!p.vendedores?.length || (p.locais?.length ?? 0) > 1) && (
            <Grupo icone="🧑" titulo="Quem e onde">
              {!!p.vendedores?.length && <Campo rotulo="Quem vendeu" ajuda="A comissão e o relatório de vendas vão para esta pessoa. Vazio = a casa."><Selecao valor={p.vendedorId} onChange={(v) => p.onVendedor(v || undefined)} vazio="A casa (ninguém)" opcoes={p.vendedores} /></Campo>}
              {(p.locais?.length ?? 0) > 1 && <Campo rotulo="Unidade"><Selecao valor={p.localId} onChange={(v) => p.onLocal(v || undefined)} vazio="—" opcoes={p.locais!} /></Campo>}
            </Grupo>
          )}
          <Grupo icone="📝" titulo="Observação">
            <Entrada aria-label={t('Observação')} placeholder={t('Ex.: cliente volta amanhã para buscar')} value={p.obs} onChange={(e) => p.onObs(e.target.value)} />
          </Grupo>
        </div>
      )}
    </div>
  )
}
