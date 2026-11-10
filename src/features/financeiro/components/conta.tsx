// PADRÃO DE CONTA (adiantamento e empréstimo — o dinheiro que alguém deve ou a loja deve). Três peças, sempre iguais:
//
//   LISTA   <CartaoConta>   faixa da cor do lado · quem (avatar) · o que foi combinado · situação
//                           O NÚMERO QUE IMPORTA em destaque (falta receber / falta pagar / saldo devedor) · o prazo
//                           a barra "quanto já voltou" · detalhes curtos (entregas, viagem…)
//
//   FICHA   <AcoesConta>    a ação principal à vista; o resto no ⋯ (regra do celular)
//           <ResumoConta>   o número que importa + a frase do que ele quer dizer + a barra + as partes (como se chegou
//                           nele) + os ajustes da conta (Interruptor) e os links (viagem, pessoa)
//           e, embaixo, ABAS: o assunto da ficha (linha do tempo / parcelas) · Comprovantes · Histórico
//
// A conta (números) é do serviço; estas peças só mostram. Ver docs/architecture/DESENHO.md §11.9.
import type { ReactNode } from 'react'
import { Botao, cx } from '../../../shared/ui/base'
import { useT } from '../../../shared/ui/i18n'
import { type Acao, MenuAcoes } from '../../../shared/ui/menuAcoes'
import { corDoNome, iniciais } from '../../../shared/ui/tabelaDados'

export function AvatarConta({ nome, grande }: { nome: string; grande?: boolean }) {
  const cor = corDoNome(nome)
  return (
    <span aria-hidden className={cx('flex shrink-0 items-center justify-center font-bold', grande ? 'h-14 w-14 rounded-2xl text-lg' : 'h-10 w-10 rounded-full text-sm')}
      style={{ background: `color-mix(in srgb, ${cor} 18%, transparent)`, color: cor, boxShadow: `inset 0 0 0 1.5px color-mix(in srgb, ${cor} 45%, transparent)` }}>{iniciais(nome)}</span>
  )
}

/** UM CARTÃO da lista de contas */
export function CartaoConta({ cor, nome, sub, situacao, rotuloValor, valor, corValor, lado, barra, rodape, onAbrir }: {
  /** a cor do lado (faixa à esquerda) */
  cor: string
  nome: string
  /** o que foi combinado: "Emprestei Bs 28.000 · 03/10/2026" ou "AD-0001 · 18/10/2026" */
  sub: ReactNode
  situacao: ReactNode
  rotuloValor: string
  valor: ReactNode
  corValor?: string
  /** à direita do valor: a próxima parcela ou o prazo */
  lado?: ReactNode
  barra: ReactNode
  rodape?: ReactNode
  onAbrir(): void
}) {
  const t = useT()
  return (
    <button type="button" onClick={onAbrir} className="group relative flex h-full w-full flex-col gap-2.5 overflow-hidden rounded-2xl border border-[var(--borda)] bg-[var(--cartao)] p-3 pl-4 text-left shadow-sm transition hover:border-[var(--marca)] active:scale-[0.99]">
      <span aria-hidden className="absolute inset-y-0 left-0 w-1" style={{ background: cor }} />
      <span className="flex items-center gap-3">
        <AvatarConta nome={nome} />
        <span className="min-w-0 flex-1">
          <b className="block truncate">{nome}</b>
          <span className="num block truncate text-xs text-[var(--suave)]">{sub}</span>
        </span>
        <span className="shrink-0">{situacao}</span>
      </span>
      <span className="flex flex-wrap items-end justify-between gap-x-3 gap-y-2">
        <span>
          <span className="block text-[11px] font-semibold uppercase tracking-wide text-[var(--suave)]">{t(rotuloValor)}</span>
          <b className="num block whitespace-nowrap text-xl leading-tight" style={{ color: corValor }}>{valor}</b>
        </span>
        {lado}
      </span>
      {barra}
      {rodape && <span className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-[var(--suave)]">{rodape}</span>}
    </button>
  )
}

/** a parte do resumo: "Financiado Bs 5.000" (tocar pode levar à aba que explica) */
export interface ParteConta { rotulo: string; valor: ReactNode; sub?: ReactNode; cor?: string; onClick?(): void }

/** O RESUMO DA FICHA: o número que importa, o que ele quer dizer, a barra, as partes e os ajustes */
export function ResumoConta({ rotulo, valor, cor, frase, barra, partes, ajustes }: {
  rotulo: string
  valor: ReactNode
  cor?: string
  /** uma frase do que o número quer dizer ("Falta voltar em cabelo ou dinheiro") */
  frase?: ReactNode
  barra?: ReactNode
  partes: ParteConta[]
  /** interruptores da conta e links (viagem, pessoa, encerramento) */
  ajustes?: ReactNode
}) {
  const t = useT()
  return (
    <section aria-label={t(rotulo)} className="overflow-hidden rounded-2xl border border-[var(--borda)] bg-[var(--cartao)] shadow-sm">
      <div className="space-y-3 p-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-[var(--suave)]">{t(rotulo)}</p>
          <p className="num text-3xl font-bold leading-tight sm:text-4xl" style={{ color: cor }}>{valor}</p>
          {frase && <p className="mt-0.5 text-sm text-[var(--suave)]">{frase}</p>}
        </div>
        {barra}
      </div>
      <dl className={cx('grid divide-[var(--borda)] border-t border-[var(--borda)] bg-[var(--fundo)]/40', partes.length >= 4 ? 'grid-cols-2 divide-x sm:grid-cols-4' : 'grid-cols-3 divide-x')}>
        {partes.map((p, k) => {
          const dentro = (
            <>
              <dt className="text-[11px] font-semibold text-[var(--suave)]">{t(p.rotulo)}</dt>
              <dd className="num truncate text-sm font-bold sm:text-base" style={{ color: p.cor }}>{p.valor}</dd>
              {p.sub && <dd className="num truncate text-[11px] text-[var(--suave)]">{p.sub}</dd>}
            </>
          )
          const classe = cx('min-w-0 px-3 py-2.5 text-left', partes.length >= 4 && k >= 2 && 'border-t border-[var(--borda)] sm:border-t-0')
          return p.onClick
            ? <button key={p.rotulo} type="button" onClick={p.onClick} className={cx(classe, 'min-h-11 transition hover:bg-[var(--marca-suave)] active:bg-[var(--marca-suave)]')}>{dentro}</button>
            : <div key={p.rotulo} className={classe}>{dentro}</div>
        })}
      </dl>
      {ajustes && <div className="space-y-2 border-t border-[var(--borda)] p-3 text-sm">{ajustes}</div>}
    </section>
  )
}

/** AS AÇÕES DA FICHA: a principal à vista; as outras no ⋯ (no celular nunca uma fileira de botões soltos) */
export function AcoesConta({ principal, outras }: { principal?: { rotulo: string; icone?: string; onClick(): void; tom?: 'alerta' }; outras: Acao[] }) {
  const t = useT()
  if (!principal && !outras.length) return null
  return (
    <div className="flex items-center gap-2">
      {principal && <Botao className={cx('flex-1 sm:flex-none', principal.tom === 'alerta' && '!bg-[var(--alerta)]')} onClick={principal.onClick}>{principal.icone} {t(principal.rotulo)}</Botao>}
      {outras.length > 0 && <MenuAcoes acoes={outras} pergunta="O que mais fazer?" />}
    </div>
  )
}
