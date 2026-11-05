// ESCOLHA EM CARTÕES — quando a escolha muda o que acontece depois, cada opção é um cartão com ícone, nome e uma
// linha do que quer dizer (ninguém precisa adivinhar o que é "credor" ou "juros composto"). Uma ou várias (`varias`).
//   [💸 Eu emprestei      ] [🤝 Eu peguei emprestado]
//    o dinheiro sai do caixa   o dinheiro entra no caixa
import { cx } from './base'
import { useT } from './i18n'

export interface OpcaoCartao<T extends string> { id: T; icone: string; nome: string; descricao?: string }

export function EscolhaCartoes<T extends string>({ rotulo, opcoes, valor, onChange, colunas = 2 }: {
  rotulo: string
  opcoes: OpcaoCartao<T>[]
  /** vazio = nada escolhido ainda (nenhum cartão marcado) */
  valor: T | undefined
  onChange(v: T): void
  colunas?: 1 | 2 | 3
}) {
  return <Cartoes rotulo={rotulo} opcoes={opcoes} marcado={(id) => id === valor} onToque={onChange} colunas={colunas} papel="radio" />
}

/** várias ao mesmo tempo (ex.: papéis de uma pessoa: cliente E fornecedora) */
export function EscolhaCartoesVarias<T extends string>({ rotulo, opcoes, valor, onChange, colunas = 2 }: {
  rotulo: string
  opcoes: OpcaoCartao<T>[]
  valor: T[]
  onChange(v: T[]): void
  colunas?: 1 | 2 | 3
}) {
  return <Cartoes rotulo={rotulo} opcoes={opcoes} marcado={(id) => valor.includes(id)} onToque={(id) => onChange(valor.includes(id) ? valor.filter((x) => x !== id) : [...valor, id])} colunas={colunas} papel="checkbox" />
}

function Cartoes<T extends string>({ rotulo, opcoes, marcado, onToque, colunas, papel }: { rotulo: string; opcoes: OpcaoCartao<T>[]; marcado(id: T): boolean; onToque(id: T): void; colunas: 1 | 2 | 3; papel: 'radio' | 'checkbox' }) {
  const t = useT()
  return (
    <div role={papel === 'radio' ? 'radiogroup' : 'group'} aria-label={t(rotulo)}
      className={cx('grid gap-2', colunas === 1 ? 'grid-cols-1' : colunas === 3 ? 'grid-cols-[repeat(auto-fit,minmax(min(10rem,100%),1fr))]' : 'grid-cols-[repeat(auto-fit,minmax(min(13rem,100%),1fr))]')}>
      {opcoes.map((o) => {
        const on = marcado(o.id)
        return (
          <button key={o.id} type="button" role={papel} aria-checked={on} onClick={() => onToque(o.id)}
            className={cx('flex min-h-14 items-start gap-3 rounded-2xl border-2 p-3 text-left transition', on ? 'border-[var(--marca)] bg-[var(--marca-suave)]' : 'border-[var(--borda)] bg-[var(--cartao)] hover:border-[var(--marca)]')}>
            <span aria-hidden className={cx('flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-lg', on ? 'bg-[var(--marca)] text-white' : 'bg-[var(--fundo)]')}>{on && papel === 'checkbox' ? '✓' : o.icone}</span>
            <span className="min-w-0 flex-1">
              <b className={cx('block leading-tight', on && 'text-[var(--marca)]')}>{t(o.nome)}</b>
              {o.descricao && <span className="mt-0.5 block text-xs leading-snug text-[var(--suave)]">{t(o.descricao)}</span>}
            </span>
          </button>
        )
      })}
    </div>
  )
}
