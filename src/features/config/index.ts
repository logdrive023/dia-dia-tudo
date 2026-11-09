// CONFIGURAÇÕES — o contrato público do domínio: o que o app e os outros domínios podem usar daqui.
// O resto (components, hooks, model) é interno: outro domínio não importa direto.
// A tela é pesada e o menu só precisa da lista de seções: ela é baixada só quando abre.
import { lazy } from 'react'

export const Config = lazy(() => import('./pages/Configuracoes').then((m) => ({ default: m.Config })))
export { GRUPOS_CONFIG, secoesDoPerfil } from './model/configSecoes'
