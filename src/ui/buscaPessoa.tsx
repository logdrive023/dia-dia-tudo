// BUSCA DE PESSOA (fornecedor, cliente…): digita e acha (nome, telefone ou sigla), recentes num toque e cadastro na
// hora com o nome digitado ("+ Novo fornecedor: Rosa"). Escolhida, vira uma linha compacta com o detalhe que a tela
// quiser (sigla, saldo, última compra) e "Trocar". Teclado: ↑ ↓ escolhe, Enter confirma, Esc limpa.

import { type ReactNode, useId, useRef, useState } from 'react'
import { novoId } from '../core/domain/ids'
import type { Id, Papel } from '../core/domain/tipos'
import { cx } from './base'
import { useComando, useConsulta } from './contexto'
import { useT } from './i18n'

const sem = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

export function BuscaPessoa({ valor, onChange, papel = 'fornecedor', rotulo, recentes = [], siglas, detalhe, autoFocus, novoRotulo = 'Novo fornecedor', erro }: {
  valor?: Id
  onChange(id: Id | undefined): void
  papel?: Papel
  rotulo: string
  /** ids das pessoas usadas por último (viram botões rápidos) */
  recentes?: Id[]
  /** sigla de cada pessoa: a busca também acha por ela */
  siglas?: Record<Id, string>
  /** linha de detalhe quando escolhida (saldo, última compra…) */
  detalhe?: ReactNode
  autoFocus?: boolean
  novoRotulo?: string
  /** aviso de campo que falta (validação) */
  erro?: string
}) {
  const t = useT()
  const id = useId()
  const { dados } = useConsulta('pessoas', { papel })
  const { executar, ocupado } = useComando()
  const [q, setQ] = useState('')
  const [marcado, setMarcado] = useState(0)
  const [dica, setDica] = useState(false)
  const entrada = useRef<HTMLInputElement>(null)
  const pessoas = dados ?? []
  const escolhida = valor ? pessoas.find((p) => p.id === valor) : undefined
  const b = sem(q.trim())
  const achadas = b ? pessoas.filter((p) => sem(`${p.nome} ${p.telefone ?? ''} ${siglas?.[p.id] ?? ''}`).includes(b) || sem(siglas?.[p.id] ?? '') === b).slice(0, 6) : []
  const exata = pessoas.some((p) => sem(p.nome) === b)
  const opcoes: ({ tipo: 'pessoa'; id: Id; nome: string } | { tipo: 'novo' })[] = [...achadas.map((p) => ({ tipo: 'pessoa' as const, id: p.id, nome: p.nome })), ...(b && !exata ? [{ tipo: 'novo' as const }] : [])]
  const rapidas = recentes.map((r) => pessoas.find((p) => p.id === r)).filter((p): p is (typeof pessoas)[number] => !!p).slice(0, 5)

  const escolher = (pid: Id) => {
    onChange(pid)
    setQ('')
    setMarcado(0)
  }
  const cadastrar = async () => {
    const nome = q.trim()
    if (!nome || ocupado) return
    const novo = novoId()
    if (await executar('salvarPessoa', { id: novo, nome, papeis: [papel] }, t('{n} cadastrado(a).', { n: nome }))) escolher(novo)
  }
  const confirmar = (k: number) => {
    const o = opcoes[k]
    if (!o) return
    if (o.tipo === 'novo') void cadastrar()
    else escolher(o.id)
  }

  if (valor)
    return (
      <div>
        <span className="mb-1 block text-sm font-semibold text-[var(--suave)]">{t(rotulo)}</span>
        <div className="flex items-start gap-2 rounded-xl border border-[var(--marca)]/40 bg-[var(--marca-suave)]/40 p-2 pl-3">
          <div className="min-w-0 flex-1">
            <b className="block truncate text-base">{escolhida?.nome ?? '…'}</b>
            {detalhe}
          </div>
          <button type="button" className="min-h-11 shrink-0 rounded-lg px-3 text-sm font-semibold text-[var(--marca)] hover:bg-[var(--marca-suave)]" onClick={() => (onChange(undefined), setTimeout(() => entrada.current?.focus(), 0))}>
            {t('Trocar')}
          </button>
        </div>
      </div>
    )

  return (
    <div>
      <label htmlFor={id} className="mb-1 block text-sm font-semibold text-[var(--suave)]">{t(rotulo)}</label>
      <input
        id={id}
        ref={entrada}
        type="search"
        role="combobox"
        aria-expanded={opcoes.length > 0}
        aria-controls={`${id}-lista`}
        aria-invalid={!!erro}
        autoComplete="off"
        autoFocus={autoFocus}
        data-enter="proprio"
        value={q}
        placeholder={dica ? t('Digite o nome de quem é novo') : t('Buscar pelo nome ou sigla…')}
        onChange={(e) => (setQ(e.target.value), setMarcado(0))}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown') (e.preventDefault(), setMarcado((m) => Math.min(m + 1, opcoes.length - 1)))
          else if (e.key === 'ArrowUp') (e.preventDefault(), setMarcado((m) => Math.max(m - 1, 0)))
          else if (e.key === 'Escape') setQ('')
          else if (e.key === 'Enter' && !e.ctrlKey && !e.metaKey && opcoes.length) (e.preventDefault(), e.stopPropagation(), confirmar(marcado))
        }}
        className={cx('min-h-11 w-full rounded-xl border bg-[var(--cartao)] px-3 text-base outline-none focus:border-[var(--marca)]', erro ? 'border-[var(--ruim)]' : 'border-[var(--borda)]')}
      />
      {opcoes.length > 0 && (
        <ul id={`${id}-lista`} role="listbox" className="mt-1 overflow-hidden rounded-xl border border-[var(--borda)] bg-[var(--cartao)] shadow-lg">
          {opcoes.map((o, k) => (
            <li key={o.tipo === 'novo' ? 'novo' : o.id} role="option" aria-selected={k === marcado}>
              <button
                type="button"
                onMouseEnter={() => setMarcado(k)}
                onClick={() => confirmar(k)}
                disabled={o.tipo === 'novo' && ocupado}
                className={cx('flex min-h-11 w-full items-center gap-2 px-3 text-left text-sm', k === marcado && 'bg-[var(--marca-suave)]', o.tipo === 'novo' && 'font-semibold text-[var(--marca)]')}
              >
                {o.tipo === 'novo' ? (
                  <span className="truncate">+ {t(novoRotulo)}: <b>{q.trim()}</b></span>
                ) : (
                  <>
                    <span className="min-w-0 flex-1 truncate">{o.nome}</span>
                    {siglas?.[o.id] && <span className="shrink-0 font-mono text-xs text-[var(--suave)]">{siglas[o.id]}</span>}
                  </>
                )}
              </button>
            </li>
          ))}
        </ul>
      )}
      {!b && (
        <div className="mt-2 flex flex-wrap gap-2">
          {rapidas.map((p) => (
            <button key={p.id} type="button" onClick={() => escolher(p.id)} className="inline-flex min-h-11 max-w-full items-center gap-1.5 rounded-full border border-[var(--borda)] bg-[var(--cartao)] px-3 text-sm hover:border-[var(--marca)]">
              <span className="truncate">{p.nome}</span>
              {siglas?.[p.id] && <span className="shrink-0 rounded-md bg-[var(--marca-suave)] px-1.5 font-mono text-[11px] font-bold text-[var(--marca)]">{siglas[p.id]}</span>}
            </button>
          ))}
          <button type="button" onClick={() => (setDica(true), entrada.current?.focus())} className="min-h-11 rounded-full px-3 text-sm font-semibold text-[var(--marca)] hover:bg-[var(--marca-suave)]">
            + {t(novoRotulo)}
          </button>
        </div>
      )}
      {erro && <p className="mt-1 text-xs font-semibold text-[var(--ruim)]">{erro}</p>}
    </div>
  )
}
