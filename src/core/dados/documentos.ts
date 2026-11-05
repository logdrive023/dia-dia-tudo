// MODELOS DE DOCUMENTO DA VENDA — o que o papel mostra (a NOTA), separado dos dados (services/documentos.ts) e do
// desenho (ui/notaVenda.tsx). Inspirados na representação gráfica da FACTURA boliviana (SIAT · Servicio de Impuestos
// Nacionales): emisor com NIT e sucursal, nº e data/hora, comprador com NIT/CI, detalhe (cantidad · unidad · precio
// unitario · descuento · subtotal), totais, "Son: … 00/100 Bolivianos" e as formas de pagamento.
//
// ⚠️ NENHUM destes modelos é FACTURA: o sistema não está ligado ao SIN, então não há CUF (Código Único de Factura),
// QR de verificação nem as leyendas oficiais — e o sistema NÃO os inventa. Todo documento diz "sin validez fiscal".
// Um modelo fiscal no futuro (factura en línea, com integração ao SIAT) entra aqui com `fiscal: true` e os campos
// que vierem do SIN (cuf, qr, leyendas) — o desenho e a impressão continuam os mesmos.

export type ModeloDocumentoId = 'carta' | 'rollo'

/** as colunas do detalhe (a ordem é a do papel) */
export type ColunaDocumento = 'codigo' | 'cantidad' | 'unidad' | 'descripcion' | 'precio' | 'descuento' | 'subtotal'

export interface ModeloDocumento {
  id: ModeloDocumentoId
  /** nome na escolha (português; a tela traduz) */
  nome: string
  descricao: string
  /** o tamanho do papel: carta/A4 (folha) ou rollo (impressora térmica de 80 mm) */
  formato: 'folha' | 'rollo'
  /** só verdadeiro com integração oficial ao SIN (ainda não existe) */
  fiscal: false
  colunas: ColunaDocumento[]
}

export const MODELOS_DOCUMENTO: Record<ModeloDocumentoId, ModeloDocumento> = {
  carta: {
    id: 'carta',
    nome: 'Folha (carta / A4)',
    descricao: 'O documento inteiro numa folha: bom para PDF, e-mail e impressora comum.',
    formato: 'folha',
    fiscal: false,
    colunas: ['codigo', 'cantidad', 'unidad', 'descripcion', 'precio', 'descuento', 'subtotal'],
  },
  rollo: {
    id: 'rollo',
    nome: 'Rolo (80 mm)',
    descricao: 'Tira estreita para impressora térmica de balcão (como o cupom do supermercado).',
    formato: 'rollo',
    fiscal: false,
    colunas: ['cantidad', 'descripcion', 'subtotal'],
  },
}

export const MODELO_PADRAO: ModeloDocumentoId = 'carta'

/** o título do documento e o aviso legal (em espanhol: é o papel que vai para a cliente na Bolívia) */
export const TEXTO_NOTA = {
  titulo: 'NOTA DE VENTA',
  aviso: 'Documento comercial SIN VALIDEZ FISCAL — no es factura ni otorga crédito fiscal.',
  anulada: 'ANULADA',
  pendiente: 'PENDIENTE',
} as const

const MOEDA_EXTENSO: Record<string, [string, string]> = { BOB: ['Boliviano', 'Bolivianos'], USD: ['Dólar estadounidense', 'Dólares estadounidenses'], BRL: ['Real', 'Reales'] }

const UNI = ['', 'uno', 'dos', 'tres', 'cuatro', 'cinco', 'seis', 'siete', 'ocho', 'nueve', 'diez', 'once', 'doce', 'trece', 'catorce', 'quince', 'dieciséis', 'diecisiete', 'dieciocho', 'diecinueve', 'veinte', 'veintiuno', 'veintidós', 'veintitrés', 'veinticuatro', 'veinticinco', 'veintiséis', 'veintisiete', 'veintiocho', 'veintinueve']
const DEC = ['', '', '', 'treinta', 'cuarenta', 'cincuenta', 'sesenta', 'setenta', 'ochenta', 'noventa']
const CEN = ['', 'ciento', 'doscientos', 'trescientos', 'cuatrocientos', 'quinientos', 'seiscientos', 'setecientos', 'ochocientos', 'novecientos']

function ate999(n: number): string {
  if (n === 0) return ''
  if (n === 100) return 'cien'
  const c = Math.floor(n / 100)
  const r = n % 100
  const resto = r < 30 ? UNI[r] : DEC[Math.floor(r / 10)] + (r % 10 ? ` y ${UNI[r % 10]}` : '')
  return [CEN[c], resto].filter(Boolean).join(' ')
}

/** número inteiro por extenso em espanhol (até 999.999.999.999). Ex.: 1250 → "mil doscientos cincuenta" */
export function porExtenso(n: number): string {
  n = Math.floor(Math.abs(n))
  if (n === 0) return 'cero'
  const partes: string[] = []
  const milMillones = Math.floor(n / 1e9)
  const millones = Math.floor((n % 1e9) / 1e6)
  const miles = Math.floor((n % 1e6) / 1e3)
  const resto = n % 1e3
  const umOuUn = (x: number) => ate999(x).replace(/veintiuno$/, 'veintiún').replace(/uno$/, 'un')
  if (milMillones) partes.push(milMillones === 1 ? 'mil millones' : `${umOuUn(milMillones)} mil millones`)
  if (millones) partes.push(millones === 1 ? 'un millón' : `${umOuUn(millones)} millones`)
  if (miles) partes.push(miles === 1 ? 'mil' : `${umOuUn(miles)} mil`)
  if (resto) partes.push(ate999(resto))
  return partes.join(' ')
}

/** "Son: Sesenta 00/100 Bolivianos" — o valor em centavos e a moeda (como na factura boliviana) */
export function totalPorExtenso(centavos: number, moeda: string): string {
  const inteiro = Math.floor(Math.abs(centavos) / 100)
  const cent = Math.abs(centavos) % 100
  const [um, varios] = MOEDA_EXTENSO[moeda] ?? [moeda, moeda]
  const txt = porExtenso(inteiro)
  return `Son: ${txt.charAt(0).toUpperCase()}${txt.slice(1)} ${String(cent).padStart(2, '0')}/100 ${inteiro === 1 ? um : varios}`
}
