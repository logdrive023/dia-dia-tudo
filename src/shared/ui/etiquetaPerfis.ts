// ETIQUETA: PERFIS PRONTOS e HISTÓRICO DO TAMANHO (contas puras, sem tela — testadas em etiquetaPerfis.test.ts).
// O tamanho fica NO APARELHO (cada lugar tem a sua impressora); o histórico também: cada mudança guarda quando, quem e
// a configuração inteira, e "Usar de novo" volta exatamente para ela.
import type { ModoEtiqueta } from '../../core/services/codigos'

export type PapelEtiqueta = 'pequena' | 'a4' | 'livre'

/** tudo o que define como a etiqueta sai */
export interface ConfigEtiqueta {
  papel: PapelEtiqueta
  /** só no papel "livre" (mm) */
  w: number
  h: number
  modo: ModoEtiqueta
  /** altura do código de barras em % do normal (50–200) */
  escalaBarras: number
}

export type PerfilId = 'cabelo' | 'compacto' | 'soBarras'

/** PERFIS PRONTOS: um toque já deixa papel, tamanho, tipo e barras certos para o uso */
export const PERFIS_ETIQUETA: { id: PerfilId; nome: string; uso: string; config: ConfigEtiqueta }[] = [
  { id: 'cabelo', nome: 'Pacote de cabelo', uso: 'Grande, para o saco do cabelo: QR, barras, medida, peso e foto.', config: { papel: 'livre', w: 70, h: 40, modo: 'qrBarras', escalaBarras: 100 } },
  { id: 'compacto', nome: 'Item pequeno', uso: 'Tag pequena presa com elástico: QR e código, sem foto.', config: { papel: 'livre', w: 40, h: 22, modo: 'qr', escalaBarras: 100 } },
  { id: 'soBarras', nome: 'Só código de barras', uso: 'Produto pequeno lido no balcão pelo leitor: barras altas, sem QR.', config: { papel: 'livre', w: 50, h: 20, modo: 'barras', escalaBarras: 150 } },
]

export const ESCALAS_BARRAS = [75, 100, 150, 200]
export const MAX_HISTORICO = 12

export interface MudancaEtiqueta extends ConfigEtiqueta {
  /** ISO (quando mudou) */
  em: string
  por?: string
}

/** duas configurações dão a MESMA etiqueta? (no rolo e no A4 a largura × altura digitada não conta) */
export function mesmaEtiqueta(a: ConfigEtiqueta, b: ConfigEtiqueta) {
  return a.papel === b.papel && a.modo === b.modo && a.escalaBarras === b.escalaBarras && (a.papel !== 'livre' || (a.w === b.w && a.h === b.h))
}

/** qual perfil pronto esta configuração é (ou nenhum: "do jeito da casa") */
export function perfilDe(c: ConfigEtiqueta): PerfilId | undefined {
  return PERFIS_ETIQUETA.find((p) => mesmaEtiqueta(p.config, c))?.id
}

/** guarda a mudança no topo do histórico: igual à última → não repete; passa do máximo → sai a mais antiga */
export function registrarMudanca(hist: MudancaEtiqueta[], c: ConfigEtiqueta, em: string, por?: string): MudancaEtiqueta[] {
  if (hist[0] && mesmaEtiqueta(hist[0], c)) return hist
  const { papel, w, h, modo, escalaBarras } = c
  return [{ papel, w, h, modo, escalaBarras, em, por }, ...hist].slice(0, MAX_HISTORICO)
}

/** só os campos da configuração (para "Usar de novo": volta exatamente para ela) */
export function configDe(m: MudancaEtiqueta): ConfigEtiqueta {
  return { papel: m.papel, w: m.w, h: m.h, modo: m.modo, escalaBarras: m.escalaBarras }
}
