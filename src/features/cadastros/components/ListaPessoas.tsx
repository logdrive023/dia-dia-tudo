// PESSOAS › a lista em LINHAS CURTAS (celular primeiro) e as SEÇÕES por grupo da visão "Todas":
//   [avatar] Nome · 💬 telefone · papéis          Bs 1.200 · me deve  ›
// Seção: 👤 Clientes · 8 — "Quem compra cabelo…" · as 5 primeiras · "Ver os 8 clientes ›"
import type { ReactNode } from 'react'
import { formatar } from '../../../core/domain/dinheiro'
import type { Papel } from '../../../core/domain/tipos'
import { Pilula, cx } from '../../../shared/ui/base'
import { useT } from '../../../shared/ui/i18n'
import { corDoNome, iniciais } from '../../../shared/ui/tabelaDados'

/** o nome do papel para gente (o id é técnico: "funcionario" → "Funcionária") */
export const NOME_PAPEL: Record<Papel, { nome: string; icone: string }> = {
  cliente: { nome: 'Cliente', icone: '👤' }, fornecedor: { nome: 'Fornecedora', icone: '🛒' }, doadora: { nome: 'Doadora', icone: '🎁' },
  profissional: { nome: 'Profissional', icone: '✂️' }, funcionario: { nome: 'Funcionária', icone: '🧑‍💼' }, devedor: { nome: 'Devedor', icone: '⬇' },
  credor: { nome: 'Credor', icone: '⬆' }, socio: { nome: 'Sócia', icone: '🤝' },
}

export function AvatarPessoa({ nome }: { nome: string }) {
  const cor = corDoNome(nome)
  return <span aria-hidden className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-bold" style={{ background: `color-mix(in srgb, ${cor} 18%, transparent)`, color: cor, boxShadow: `inset 0 0 0 1.5px color-mix(in srgb, ${cor} 45%, transparent)` }}>{iniciais(nome)}</span>
}

export interface PessoaLinha { id: string; nome: string; telefone?: string; papeis: Papel[] }

/** UMA pessoa: o nome, o WhatsApp, os papéis e — se tiver conta aberta — quanto deve ou a quem devo */
export function LinhaPessoa({ p, saldo, moeda, onAbrir }: { p: PessoaLinha; saldo?: number; moeda: string; onAbrir(id: string): void }) {
  const t = useT()
  return (
    <li>
      <button type="button" onClick={() => onAbrir(p.id)} className="flex min-h-14 w-full items-center gap-3 px-3 py-2.5 text-left transition-colors hover:bg-[var(--fundo)] active:bg-[var(--fundo)]">
        <AvatarPessoa nome={p.nome} />
        <span className="min-w-0 flex-1">
          <b className="block truncate">{p.nome}</b>
          <span className="mt-0.5 flex flex-wrap items-center gap-1 text-xs text-[var(--suave)]">
            {p.telefone && <span className="num mr-1 truncate">💬 {p.telefone}</span>}
            {p.papeis.map((x) => <Pilula key={x} pequena tom={x === 'cliente' ? 'marca' : 'neutro'}>{NOME_PAPEL[x]?.icone} {t(NOME_PAPEL[x]?.nome ?? x)}</Pilula>)}
          </span>
        </span>
        {!!saldo && (
          <span className="shrink-0 text-right">
            <b className={cx('num block text-sm', saldo > 0 ? 'text-[var(--bom)]' : 'text-[var(--ruim)]')}>{formatar(Math.abs(saldo), moeda)}</b>
            <span className="block text-[11px] text-[var(--suave)]">{t(saldo > 0 ? 'me deve' : 'eu devo')}</span>
          </span>
        )}
        <span aria-hidden className="text-[var(--suave)]">›</span>
      </button>
    </li>
  )
}

/** a moldura de uma lista de linhas */
export function CaixaLista({ children }: { children: ReactNode }) {
  return <ul className="divide-y divide-[var(--borda)] overflow-hidden rounded-2xl border border-[var(--borda)] bg-[var(--cartao)] shadow-sm">{children}</ul>
}

/** UMA SEÇÃO da visão "Todas": título do grupo com o número, para que serve, as primeiras pessoas e "ver todas" */
export function SecaoGrupo({ icone, nome, descricao, n, extra, children, onVerTodas, mostrando }: {
  icone: string; nome: string; descricao: string; n: number; extra?: ReactNode; children: ReactNode; onVerTodas(): void; mostrando: number
}) {
  const t = useT()
  return (
    <section className="space-y-2">
      <div className="flex items-end justify-between gap-2 px-1">
        <div className="min-w-0">
          <h2 className="flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-[var(--suave)]"><span aria-hidden>{icone}</span>{t(nome)} <span className="num rounded-full bg-[var(--marca-suave)] px-2 text-xs normal-case tracking-normal text-[var(--marca)]">{n}</span></h2>
          <p className="text-xs text-[var(--suave)]">{t(descricao)}</p>
        </div>
        {extra}
      </div>
      <CaixaLista>{children}</CaixaLista>
      {n > mostrando && (
        <button type="button" onClick={onVerTodas} className="min-h-11 w-full rounded-xl text-sm font-semibold text-[var(--marca)] transition hover:bg-[var(--marca-suave)] active:scale-[0.98]">
          {t('Ver todas as {n} ›', { n })}
        </button>
      )}
    </section>
  )
}
