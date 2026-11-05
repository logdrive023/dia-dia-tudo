// CAMPO DE SENHA: com o olho para ver o que digitou e, na senha NOVA, a lista da regra (src/core/domain/senha.ts)
// que vai ficando verde enquanto digita. A mesma regra é conferida no serviço.
import { useState } from 'react'
import { REGRAS_SENHA, gerarSenha } from '../core/domain/senha'
import { Entrada, cx } from './base'
import { useT } from './i18n'

export function SenhaInput({ valor, onChange, nova, opcional, id, gerar, rotulo }: {
  valor: string
  onChange(v: string): void
  /** senha nova: mostra a regra */
  nova?: boolean
  /** "deixe vazio para manter": a regra só aparece quando começa a digitar */
  opcional?: boolean
  id?: string
  /** botão "Gerar senha" (o administrador cria uma senha forte e passa para a pessoa) */
  gerar?: boolean
  /** o nome do campo para leitor de tela (o Campo em volta é div: dentro tem o botão do olho) */
  rotulo?: string
}) {
  const t = useT()
  const [ver, setVer] = useState(false)
  const mostrarRegra = nova && (!opcional || valor.length > 0)
  return (
    <div>
      <div className="relative">
        <Entrada id={id} aria-label={rotulo ? t(rotulo) : undefined} type={ver ? 'text' : 'password'} autoComplete={nova ? 'new-password' : 'current-password'} autoCapitalize="none" spellCheck={false}
          value={valor} onChange={(e) => onChange(e.target.value)} className="pr-12" />
        <button type="button" onClick={() => setVer(!ver)} aria-label={t(ver ? 'Esconder senha' : 'Ver senha')} aria-pressed={ver}
          className="absolute right-1 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full text-[var(--suave)] hover:bg-[var(--marca-suave)]">
          {/* o desenho mostra a ação: olho = ver; olho riscado = esconder */}
          <Olho aberto={!ver} />
        </button>
      </div>
      {gerar && (
        <button type="button" onClick={() => (onChange(gerarSenha()), setVer(true))} className="mt-1 inline-flex min-h-9 items-center gap-1 rounded-lg px-2 text-sm font-semibold text-[var(--marca)] hover:bg-[var(--marca-suave)]">
          🎲 {t('Gerar senha')}
        </button>
      )}
      {gerar && ver && valor && <p className="text-xs text-[var(--suave)]">{t('Anote e passe para a pessoa: depois de salvar, ninguém consegue ver esta senha (nem o administrador).')}</p>}
      {mostrarRegra && (
        <ul className="mt-2 space-y-0.5 text-xs" aria-live="polite">
          {REGRAS_SENHA.map((r) => {
            const ok = r.ok(valor)
            return (
              <li key={r.id} className={cx('flex items-center gap-1.5', ok ? 'text-[var(--bom)]' : 'text-[var(--suave)]')}>
                <span aria-hidden className={cx('inline-flex h-4 w-4 items-center justify-center rounded-full text-[10px] font-bold', ok ? 'bg-[var(--bom)] text-white' : 'border border-[var(--borda)]')}>{ok ? '✓' : ''}</span>
                {t(r.texto)}
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}

function Olho({ aberto }: { aberto: boolean }) {
  return (
    <svg aria-hidden viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z" />
      <circle cx="12" cy="12" r="3" />
      {!aberto && <path d="M3 3l18 18" />}
    </svg>
  )
}
