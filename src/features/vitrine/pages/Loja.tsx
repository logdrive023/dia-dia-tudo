// A VITRINE COMO O COMPRADOR VÊ (#/loja): página de loja, sem o menu do sistema e sem login. A loja em si (a mesma da
// prévia do gerador) é components/ConteudoLoja.tsx. Quem está logado vê a faixa "Prévia" para voltar.
// Hoje abre neste aparelho (os dados estão nele); com a API, o mesmo endereço vira o link público da loja.
import { useApp, useConsulta } from '../../../shared/ui/contexto'
import { useT } from '../../../shared/ui/i18n'
import { ConteudoLoja } from '../components/ConteudoLoja'

/** o endereço da vitrine (o mesmo app, na rota #/loja) */
export const linkDaLoja = () => `${window.location.origin}${window.location.pathname}#/loja`

export function Loja() {
  const t = useT()
  const { sessao, ir } = useApp()
  const { dados } = useConsulta('vitrine', { publico: true })
  return (
    <div className="min-h-screen bg-[var(--fundo)]">
      {!!sessao.usuarioId && (
        <div className="sticky top-0 z-20 flex flex-wrap items-center justify-center gap-x-3 gap-y-1 bg-[var(--texto)] px-4 py-2 text-center text-xs font-semibold text-[var(--fundo)]">
          <span>👁 {t('Prévia: é assim que o comprador vê a sua vitrine.')}</span>
          <button type="button" className="rounded-full bg-[var(--fundo)] px-3 py-1 text-[var(--texto)]" onClick={() => ir('vitrine')}>← {t('Voltar ao sistema')}</button>
        </div>
      )}
      <ConteudoLoja dados={dados} className="min-h-screen" />
    </div>
  )
}
