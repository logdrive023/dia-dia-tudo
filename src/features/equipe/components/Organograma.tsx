// ORGANOGRAMA — quem responde a quem, DESENHADO como organograma:
//   tablet/computador: a árvore de cima para baixo — cartões compactos e centrados (avatar, nome, cargo, unidade, os
//     números do período) ligados por linhas com cantos arredondados (CSS em index.css › .organograma). Árvore larga
//     rola para o lado dentro do quadro (a página nunca).
//   celular: os níveis em lista, a linha à esquerda na cor do chefe e o "cotovelo" de cada pessoa.
//   buscando: só quem bate (nome ou cargo), numa lista com "responde a".
// Tocar numa pessoa abre o resumo (Equipe › Resumo).
import { formatar } from '../../../core/domain/dinheiro'
import type { Id } from '../../../core/domain/tipos'
import type { NoOrganograma } from '../../../core/services/equipe'
import { cx, moedaPadrao } from '../../../shared/ui/base'
import { useLargo } from '../../../shared/ui/calendario'
import { VazioFiltro } from '../../../shared/ui/filtroPadrao'
import { useT } from '../../../shared/ui/i18n'
import { NotaTela } from '../../../shared/ui/notaTela'
import { corDoNome, iniciais } from '../../../shared/ui/tabelaDados'

/** os totais da árvore (pessoas, atendimentos e faturado, somando todos os níveis) */
export const contarOrganograma = (ns: NoOrganograma[]): { pessoas: number; atend: number; fat: number } =>
  ns.reduce((s, n) => { const f = contarOrganograma(n.subordinados); return { pessoas: s.pessoas + 1 + f.pessoas, atend: s.atend + n.atendimentos + f.atend, fat: s.fat + n.faturamento + f.fat } }, { pessoas: 0, atend: 0, fat: 0 })

const semAcento = (x: string) => x.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
/** quem bate com a busca (nome ou cargo), com o nome de quem é o chefe */
export function acharNoOrganograma(ns: NoOrganograma[], busca: string, chefe?: string): { n: NoOrganograma; chefe?: string }[] {
  const b = semAcento(busca.trim())
  return ns.flatMap((n) => [
    ...(semAcento(`${n.pessoa.nome} ${n.pessoa.cargo ?? ''}`).includes(b) ? [{ n, chefe }] : []),
    ...acharNoOrganograma(n.subordinados, busca, n.pessoa.nome),
  ])
}

type PropsNo = { n: NoOrganograma; eu?: Id; nomeLocal: Map<Id, string>; onClick(id: Id): void }

function Avatar({ nome, tamanho }: { nome: string; tamanho: 'md' | 'lg' }) {
  const cor = corDoNome(nome)
  return (
    <span aria-hidden className={cx('flex shrink-0 items-center justify-center rounded-full font-bold', tamanho === 'lg' ? 'h-14 w-14 text-lg' : 'h-11 w-11 text-sm')}
      style={{ background: `color-mix(in srgb, ${cor} 18%, var(--cartao))`, color: cor, boxShadow: `inset 0 0 0 2px color-mix(in srgb, ${cor} 50%, transparent)` }}>{iniciais(nome)}</span>
  )
}

/** os números do período: ✂️ atendimentos · 💰 faturado */
function Numeros({ n, centro }: { n: NoOrganograma; centro?: boolean }) {
  const t = useT()
  const m = moedaPadrao()
  return (
    <span className={cx('num flex flex-wrap gap-1 text-[11px]', centro && 'justify-center')}>
      <span className="whitespace-nowrap rounded-md bg-[var(--fundo)] px-1.5 py-0.5">✂️ <b>{n.atendimentos}</b> {t('atend.')}</span>
      {n.faturamento > 0 && <span className="whitespace-nowrap rounded-md bg-[var(--bom)]/12 px-1.5 py-0.5 text-[var(--bom)]">💰 <b>{formatar(n.faturamento, m)}</b></span>}
    </span>
  )
}

/** CARTÃO DA ÁRVORE (tablet/computador): compacto e centrado, a cor da pessoa no alto, o selo da equipe embaixo */
function NoCartao({ n, eu, nomeLocal, onClick }: PropsNo) {
  const t = useT()
  const cor = corDoNome(n.pessoa.nome)
  const equipe = contarOrganograma(n.subordinados).pessoas
  const local = n.pessoa.localId ? nomeLocal.get(n.pessoa.localId) : undefined
  const souEu = !!eu && n.pessoa.id === eu
  return (
    <button type="button" onClick={() => onClick(n.pessoa.id)} title={t('Ver o resumo')}
      className={cx('organograma-no group relative flex w-52 flex-col items-center gap-1 rounded-2xl border bg-[var(--cartao)] px-3 pb-4 pt-3 text-center shadow-sm transition hover:-translate-y-0.5 hover:shadow-md focus-visible:-translate-y-0.5', souEu ? 'border-[var(--marca)] ring-2 ring-[var(--marca-suave)]' : 'border-[var(--borda)] hover:border-[var(--marca)]')}>
      <span aria-hidden className="absolute inset-x-0 top-0 h-1 rounded-t-2xl" style={{ background: cor }} />
      <Avatar nome={n.pessoa.nome} tamanho="lg" />
      <b className="mt-1 max-w-full truncate leading-tight">{n.pessoa.nome}</b>
      {souEu && <span className="rounded-full bg-[var(--marca)] px-1.5 py-px text-[10px] font-bold text-white">{t('Você')}</span>}
      <span className="max-w-full truncate text-xs text-[var(--suave)]">{n.pessoa.cargo || '—'}</span>
      {local && <span className="max-w-full truncate rounded-full bg-[var(--fundo)] px-2 py-0.5 text-[11px] font-semibold text-[var(--suave)]">🏢 {local}</span>}
      <span className="mt-1"><Numeros n={n} centro /></span>
      {/* quantas pessoas respondem a ela: o selo fica em cima da linha que desce */}
      {equipe > 0 && (
        <span className="num absolute -bottom-3 left-1/2 z-[1] flex h-6 min-w-6 -translate-x-1/2 items-center justify-center gap-0.5 rounded-full border border-[var(--borda)] bg-[var(--cartao)] px-2 text-[11px] font-bold text-[var(--suave)] shadow-sm" title={t('{n} pessoa(s) na equipe dela', { n: equipe })}>
          👥 {equipe}
        </span>
      )}
    </button>
  )
}

/** a árvore: ul/li — as linhas são desenhadas pelo CSS (.organograma) */
function Ramo(p: PropsNo) {
  const { n } = p
  return (
    <li>
      <NoCartao {...p} />
      {n.subordinados.length > 0 && <ul>{n.subordinados.map((s) => <Ramo key={s.pessoa.id} {...p} n={s} />)}</ul>}
    </li>
  )
}

/** CARTÃO DE LISTA (celular e busca): a linha inteira, com a faixa da cor da pessoa */
function CartaoLinha({ n, eu, nomeLocal, onClick, chefe }: PropsNo & { chefe?: string }) {
  const t = useT()
  const cor = corDoNome(n.pessoa.nome)
  const equipe = contarOrganograma(n.subordinados).pessoas
  const local = n.pessoa.localId ? nomeLocal.get(n.pessoa.localId) : undefined
  const souEu = !!eu && n.pessoa.id === eu
  return (
    <button type="button" onClick={() => onClick(n.pessoa.id)}
      className={cx('group relative flex w-full items-start gap-3 overflow-hidden rounded-2xl border bg-[var(--cartao)] p-3 pl-4 text-left shadow-sm transition active:scale-[0.99]', souEu ? 'border-[var(--marca)]' : 'border-[var(--borda)] hover:border-[var(--marca)]')}>
      <span aria-hidden className="absolute inset-y-0 left-0 w-1" style={{ background: cor }} />
      <Avatar nome={n.pessoa.nome} tamanho="md" />
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-1.5">
          <b className="truncate">{n.pessoa.nome}</b>
          {souEu && <span className="shrink-0 rounded-full bg-[var(--marca)] px-1.5 py-px text-[10px] font-bold text-white">{t('Você')}</span>}
        </span>
        <span className="block truncate text-xs text-[var(--suave)]">{[n.pessoa.cargo, local && `🏢 ${local}`].filter(Boolean).join(' · ') || '—'}</span>
        {chefe && <span className="block truncate text-xs text-[var(--suave)]">↑ {t('responde a')} {chefe}</span>}
        <span className="mt-1.5 flex flex-wrap items-center gap-1">
          <Numeros n={n} />
          {equipe > 0 && <span className="num whitespace-nowrap rounded-md bg-[var(--fundo)] px-1.5 py-0.5 text-[11px]">👥 <b>{equipe}</b></span>}
        </span>
      </span>
      <span aria-hidden className="self-center text-lg text-[var(--suave)] transition group-hover:translate-x-0.5 group-hover:text-[var(--marca)]">›</span>
    </button>
  )
}

/** celular: a árvore em níveis — a linha à esquerda tem a cor de quem é o chefe, e cada cartão tem o seu "cotovelo" */
function NoLista(p: PropsNo) {
  const { n } = p
  const linha = `color-mix(in srgb, ${corDoNome(n.pessoa.nome)} 45%, transparent)`
  return (
    <li>
      <CartaoLinha {...p} />
      {n.subordinados.length > 0 && (
        <ul className="ml-4 mt-2 space-y-2 border-l-2 pl-3" style={{ borderColor: linha }}>
          {n.subordinados.map((s) => (
            <li key={s.pessoa.id} className="relative list-none">
              <span aria-hidden className="absolute -left-3 top-7 h-0.5 w-3" style={{ background: linha }} />
              <ul><NoLista {...p} n={s} /></ul>
            </li>
          ))}
        </ul>
      )}
    </li>
  )
}

export function Organograma({ raizes, busca, eu, nomeLocal, onClick, onLimpar }: { raizes: NoOrganograma[]; busca: string; eu?: Id; nomeLocal: Map<Id, string>; onClick(id: Id): void; onLimpar(): void }) {
  const t = useT()
  const largo = useLargo()
  const p = { eu, nomeLocal, onClick }
  if (busca.trim()) {
    const achados = acharNoOrganograma(raizes, busca)
    if (!achados.length) return <VazioFiltro texto="Ninguém com esse nome ou cargo." filtrando onLimpar={onLimpar} />
    return (
      <ul className="grid gap-2 sm:grid-cols-2">
        {achados.map(({ n, chefe }) => <li key={n.pessoa.id}><CartaoLinha n={n} {...p} chefe={chefe} /></li>)}
      </ul>
    )
  }
  return (
    <div className="rounded-2xl border border-[var(--borda)] bg-[var(--fundo)] p-3 sm:p-6">
      {largo ? (
        <div className="overflow-x-auto pb-4 [scrollbar-width:thin]">
          {/* min-w-max + mx-auto: árvore estreita fica no meio; larga rola dentro do quadro */}
          <ul className="organograma mx-auto w-max">{raizes.map((n) => <Ramo key={n.pessoa.id} n={n} {...p} />)}</ul>
        </div>
      ) : (
        <ul className="space-y-2">{raizes.map((n) => <NoLista key={n.pessoa.id} n={n} {...p} />)}</ul>
      )}
      <NotaTela className="mt-3">{t('Toque numa pessoa para ver o resumo.')}</NotaTela>
    </div>
  )
}
