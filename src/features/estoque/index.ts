// ESTOQUE — o contrato público do domínio: o que o app e os outros domínios podem usar daqui.
// O resto (components, hooks, model) é interno: outro domínio não importa direto.
export { Estoque } from './pages/Estoque'
export { Etiquetas } from './pages/Etiquetas'
export { Livro } from './pages/Livro'
export { useCamposModulo, ehBruto } from './model/comum'
export type { Linha } from './model/comum'
export { Ajustar } from './components/janelas'
