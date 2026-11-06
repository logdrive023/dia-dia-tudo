// PEÇAS DE SEÇÃO (as mesmas em toda ficha: pedido, pacote, venda, viagem):
//   · CartaoSecao — o cartão com título (ícone · nome · contagem · ⓘ · algo à direita), corpo e rodapé de links
//   · BarraPartes — de um total, quanto foi para cada lado: barra + legenda com os números (uma parte só = só a frase)
//   · LinhaPacote — um pacote numa lista: foto, código, situação, nome, peso e ⋯ (tocar abre)
import type { ReactNode } from 'react'
import type { FotoResumo } from '../../core/services/fotos'
import type { Id } from '../../core/domain/tipos'
import { Info, cx, gramasTexto } from './base'
import { CodigoTexto } from './codigos'
import { MiniaturaLote } from './fotos'
import { useT } from './i18n'
import { type Acao, MenuAcoes } from './menuAcoes'

export function CartaoSecao({ icone, titulo, conta, ajuda, exemplo, direita, rodape, children, rotulo, className }: {
  icone?: string
  titulo: string
  /** número ao lado do título (ex.: 3 itens) */
  conta?: number
  ajuda?: string
  exemplo?: string
  /** à direita do título (um selo, um total) */
  direita?: ReactNode
  /** links embaixo (🏷 Etiquetas · 🔎 Rastreio) */
  rodape?: ReactNode
  children: ReactNode
  /** nome da região para leitor de tela (padrão: o título) */
  rotulo?: string
  className?: string
}) {
  const t = useT()
  return (
    <section aria-label={t(rotulo ?? titulo)} className={cx('overflow-hidden rounded-2xl border border-[var(--borda)] bg-[var(--cartao)] shadow-sm', className)}>
      <h2 className="flex flex-wrap items-center gap-x-2 gap-y-1 px-4 pb-2 pt-3">
        <span className="inline-flex min-w-min items-center gap-2 font-bold">{icone && <span aria-hidden>{icone}</span>}{t(titulo)}</span>
        {conta !== undefined && <span className="num rounded-full bg-[var(--fundo)] px-2 text-xs font-semibold text-[var(--suave)]">{conta}</span>}
        {ajuda && <Info texto={ajuda} exemplo={exemplo} />}
        {direita && <span className="ml-auto">{direita}</span>}
      </h2>
      {children}
      {rodape && <div className="flex flex-wrap gap-x-1 border-t border-[var(--borda)] px-2 py-1">{rodape}</div>}
    </section>
  )
}

/** link do rodapé do CartaoSecao */
export function LinkSecao({ onClick, children }: { onClick(): void; children: ReactNode }) {
  return <button type="button" onClick={onClick} className="min-h-11 whitespace-nowrap rounded-lg px-2 text-sm font-semibold text-[var(--marca)] hover:bg-[var(--marca-suave)]">{children}</button>
}

export interface Parte { id: string; nome: string; g: number; cor: string }

/** Barra das partes de um total em gramas. Uma parte só: sem barra, só "● Aguardando triagem · 3 kg (tudo)". */
export function BarraPartes({ partes }: { partes: Parte[] }) {
  const t = useT()
  const ps = partes.filter((x) => x.g > 0)
  if (!ps.length) return null
  const total = ps.reduce((s, x) => s + x.g, 0)
  return (
    <div>
      {ps.length > 1 && (
        <div className="mb-2 flex h-2.5 overflow-hidden rounded-full bg-[var(--fundo)]" aria-hidden>
          {ps.map((x) => <span key={x.id} style={{ width: `${(x.g * 100) / total}%`, background: x.cor }} />)}
        </div>
      )}
      <ul className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
        {ps.map((x) => (
          <li key={x.id} className="inline-flex items-center gap-1.5 whitespace-nowrap">
            <span aria-hidden className="h-2.5 w-2.5 rounded-full" style={{ background: x.cor }} />
            <span className="text-[var(--suave)]">{t(x.nome)}</span>
            <b className="num">{gramasTexto(x.g)}</b>
            {ps.length === 1 && <span className="text-[var(--suave)]">({t('tudo')})</span>}
          </li>
        ))}
      </ul>
    </div>
  )
}

export type TomSituacao = 'marca' | 'bom' | 'alerta' | 'suave'
const TOM: Record<TomSituacao, string> = {
  marca: 'bg-[var(--marca-suave)] text-[var(--marca)]',
  bom: 'bg-[var(--bom)]/12 text-[var(--bom)]',
  alerta: 'bg-[var(--alerta)]/12 text-[var(--alerta)]',
  suave: 'bg-[var(--fundo)] text-[var(--suave)]',
}

export function LinhaPacote({ id, codigo, nome, foto, marcador, situacao, valor, acoes, onAbrir }: {
  id: Id
  codigo?: string
  nome: string
  foto?: FotoResumo
  marcador: string
  situacao?: { texto: string; tom: TomSituacao }
  /** à direita (o peso) */
  valor: ReactNode
  acoes?: Acao[]
  onAbrir(): void
}) {
  return (
    <li className="flex items-center gap-1 rounded-xl hover:bg-[var(--fundo)]">
      <button type="button" onClick={onAbrir} className="flex min-h-14 min-w-0 flex-1 flex-wrap items-center gap-x-3 gap-y-1 px-2 py-2 text-left">
        <MiniaturaLote itemId={id} foto={foto} marcador={marcador} tamanho="sm" />
        <span className="linha-texto">
          <span className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
            <CodigoTexto codigo={codigo} className="text-sm" />
            {situacao && <span className={cx('whitespace-nowrap rounded-full px-2 text-[11px] font-semibold', TOM[situacao.tom])}>{situacao.texto}</span>}
          </span>
          <span className="block truncate text-xs text-[var(--suave)]">{nome}</span>
        </span>
        <b className="num ml-auto shrink-0 whitespace-nowrap">{valor}</b>
      </button>
      {acoes && acoes.length > 0 && <MenuAcoes className="shrink-0" acoes={acoes} />}
    </li>
  )
}
