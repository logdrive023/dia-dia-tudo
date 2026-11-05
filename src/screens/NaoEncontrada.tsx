// 404 — ENDEREÇO QUE NÃO EXISTE (link antigo, digitado errado, tela que saiu do sistema). Antes o app caía no Painel
// sem avisar; agora diz o que aconteceu, mostra o endereço e dá o caminho: voltar, ir para o início ou um atalho do menu.
// Os atalhos são os do menu DA PESSOA (useMenu): a funcionária só vê o que pode abrir.
import { Botao } from '../ui/base'
import { useApp } from '../ui/contexto'
import { useT } from '../ui/i18n'
import { Icone, temIcone } from '../ui/icones'
import { useMenu } from '../ui/Shell'

export function NaoEncontrada() {
  const t = useT()
  const { nav, ir, voltar } = useApp()
  const menu = useMenu()
  const inicio = menu[0]
  const atalhos = menu.slice(0, 4)
  const endereco = typeof window !== 'undefined' ? decodeURIComponent(window.location.hash.replace(/^#/, '')) || `/${nav.tela}` : `/${nav.tela}`
  return (
    <div className="mx-auto flex min-h-[70vh] max-w-lg flex-col items-center justify-center px-2 py-10 text-center">
      {/* o "404" com o T da marca no lugar do zero */}
      <div aria-hidden className="mb-6 flex items-center gap-2 text-7xl font-black tracking-tight text-[var(--marca)] sm:text-8xl">
        <span>4</span>
        <span className="relative flex h-20 w-20 items-center justify-center sm:h-24 sm:w-24">
          <span className="absolute inset-0 rotate-6 rounded-3xl bg-[var(--marca-suave)]" />
          <span className="relative flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-[var(--marca)] to-fuchsia-500 text-4xl text-white shadow-lg shadow-[var(--marca)]/30 sm:h-20 sm:w-20 sm:text-5xl">T</span>
        </span>
        <span>4</span>
      </div>
      <h1 className="text-2xl font-black">{t('Esta página não existe')}</h1>
      <p className="mt-2 text-sm text-[var(--suave)]">{t('O link pode estar antigo ou digitado errado. Nada foi perdido: seus dados continuam iguais.')}</p>
      <code className="mt-3 max-w-full truncate rounded-lg bg-[var(--fundo)] px-3 py-1 text-xs text-[var(--suave)]">{endereco}</code>

      <div className="mt-6 flex w-full flex-col gap-2 sm:flex-row sm:justify-center">
        {inicio && <Botao grande className="sm:min-w-44" onClick={() => ir(inicio.tela)}>{t('Ir para o início')}</Botao>}
        <Botao grande variante="secundario" className="sm:min-w-32" onClick={voltar}>← {t('Voltar')}</Botao>
      </div>

      {atalhos.length > 1 && (
        <nav aria-label={t('Atalhos')} className="mt-8 w-full">
          <p className="mb-2 text-xs font-bold uppercase tracking-wide text-[var(--suave)]">{t('Ou vá direto para')}</p>
          <ul className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {atalhos.map((m) => (
              <li key={m.tela}>
                <button type="button" onClick={() => ir(m.tela)} className="flex min-h-16 w-full flex-col items-center justify-center gap-1 rounded-2xl border border-[var(--borda)] bg-[var(--cartao)] px-2 py-2 text-sm font-semibold hover:border-[var(--marca)] hover:text-[var(--marca)]">
                  {temIcone(m.tela) && <Icone nome={m.tela} className="h-5 w-5" />}
                  <span className="truncate">{t(m.curto ?? m.nome)}</span>
                </button>
              </li>
            ))}
          </ul>
        </nav>
      )}
    </div>
  )
}
