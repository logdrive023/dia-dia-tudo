// TELEFONE / WHATSAPP — o campo único: [🇧🇴 +591 ▾] [7123 4567]
//   · a bandeira com o código do país; escolhe na lista (Bolívia, Brasil, EUA, Paraguai, Argentina, Peru, Chile…)
//   · colou/digitou com "+" ou "00" (ex.: +55 11 91234-5678): reconhece o país sozinho e troca a bandeira
//   · parou de digitar (ou saiu do campo): formata no padrão do país pelo tamanho ("(11) 91234-5678", "7123 4567")
//   · o valor salvo é "+código número formatado" (ex.: "+591 7123 4567") — o link do WhatsApp usa só os dígitos
import { useEffect, useRef, useState } from 'react'
import { Bandeira } from './bandeira'
import { cx } from './base'
import { useT } from './i18n'

export interface Pais {
  id: string
  bandeira: string
  nome: string
  codigo: string
  /** máscaras por quantidade de dígitos (# = dígito); a primeira que tiver o mesmo tamanho vale */
  mascaras: string[]
  exemplo: string
}

export const PAISES: Pais[] = [
  { id: 'BO', bandeira: '🇧🇴', nome: 'Bolívia', codigo: '591', mascaras: ['#### ####', '# ### ####'], exemplo: '7123 4567' },
  { id: 'BR', bandeira: '🇧🇷', nome: 'Brasil', codigo: '55', mascaras: ['(##) #####-####', '(##) ####-####'], exemplo: '(11) 91234-5678' },
  { id: 'US', bandeira: '🇺🇸', nome: 'Estados Unidos / Canadá', codigo: '1', mascaras: ['(###) ###-####'], exemplo: '(201) 555-0123' },
  { id: 'PY', bandeira: '🇵🇾', nome: 'Paraguai', codigo: '595', mascaras: ['### ### ###', '## ### ###'], exemplo: '981 123 456' },
  { id: 'AR', bandeira: '🇦🇷', nome: 'Argentina', codigo: '54', mascaras: ['# ## ####-####', '## ####-####'], exemplo: '9 11 1234-5678' },
  { id: 'PE', bandeira: '🇵🇪', nome: 'Peru', codigo: '51', mascaras: ['### ### ###', '# ### ####'], exemplo: '912 345 678' },
  { id: 'CL', bandeira: '🇨🇱', nome: 'Chile', codigo: '56', mascaras: ['# #### ####'], exemplo: '9 1234 5678' },
  { id: 'UY', bandeira: '🇺🇾', nome: 'Uruguai', codigo: '598', mascaras: ['## ### ###', '#### ####'], exemplo: '94 123 456' },
  { id: 'CO', bandeira: '🇨🇴', nome: 'Colômbia', codigo: '57', mascaras: ['### ### ####'], exemplo: '321 123 4567' },
  { id: 'MX', bandeira: '🇲🇽', nome: 'México', codigo: '52', mascaras: ['## #### ####'], exemplo: '55 1234 5678' },
  { id: 'EC', bandeira: '🇪🇨', nome: 'Equador', codigo: '593', mascaras: ['## ### ####'], exemplo: '99 123 4567' },
  { id: 'VE', bandeira: '🇻🇪', nome: 'Venezuela', codigo: '58', mascaras: ['### ### ####'], exemplo: '412 123 4567' },
  { id: 'PT', bandeira: '🇵🇹', nome: 'Portugal', codigo: '351', mascaras: ['### ### ###'], exemplo: '912 345 678' },
  { id: 'ES', bandeira: '🇪🇸', nome: 'Espanha', codigo: '34', mascaras: ['### ## ## ##'], exemplo: '612 34 56 78' },
  { id: 'IT', bandeira: '🇮🇹', nome: 'Itália', codigo: '39', mascaras: ['### ### ####', '### ### ###'], exemplo: '312 345 6789' },
]

const soDigitos = (s: string) => s.replace(/\D/g, '')

/** aplica a máscara do país pelo tamanho; sem máscara do tamanho: grupos de 3–4 */
export function formatarNumero(digitos: string, pais: Pais) {
  const m = pais.mascaras.find((x) => (x.match(/#/g) ?? []).length === digitos.length)
  if (!m) return digitos.replace(/(\d{3,4})(?=\d)/g, '$1 ').trim()
  let k = 0
  return m.replace(/#/g, () => digitos[k++])
}

/** "+55 11 91234…" / "0055…" → o país (o código mais longo que bate) e o resto */
export function separarPais(texto: string): { pais?: Pais; resto: string } {
  const t = texto.trim()
  if (!t.startsWith('+') && !t.startsWith('00')) return { resto: soDigitos(t) }
  const d = soDigitos(t).replace(/^00/, '')
  const pais = [...PAISES].sort((a, b) => b.codigo.length - a.codigo.length).find((p) => d.startsWith(p.codigo))
  return pais ? { pais, resto: d.slice(pais.codigo.length) } : { resto: d }
}

/** o valor salvo: "+591 7123 4567" (vazio = sem telefone) */
export function telefoneCompleto(digitos: string, pais: Pais) {
  return digitos ? `+${pais.codigo} ${formatarNumero(digitos, pais)}` : ''
}

export function CampoTelefone({ valor, onChange, paisPadrao = 'BO', rotulo = 'WhatsApp' }: { valor: string; onChange(v: string): void; paisPadrao?: string; rotulo?: string }) {
  const t = useT()
  const inicial = separarPais(valor)
  const [pais, setPais] = useState<Pais>(inicial.pais ?? PAISES.find((p) => p.id === paisPadrao) ?? PAISES[0])
  const [texto, setTexto] = useState(inicial.pais ? formatarNumero(inicial.resto, inicial.pais) : valor)
  const espera = useRef<ReturnType<typeof setTimeout>>()
  useEffect(() => () => clearTimeout(espera.current), [])

  // formata (e manda para fora) com o país certo
  const fixar = (txt: string, p: Pais) => {
    const sep = separarPais(txt)
    const pp = sep.pais ?? p
    if (sep.pais && sep.pais.id !== p.id) setPais(sep.pais)
    const d = sep.resto
    setTexto(d ? formatarNumero(d, pp) : '')
    onChange(telefoneCompleto(d, pp))
  }
  const digitar = (txt: string) => {
    setTexto(txt)
    // já manda o valor (sem formatar a cada tecla) e formata quando parar de digitar
    const sep = separarPais(txt)
    onChange(telefoneCompleto(sep.resto, sep.pais ?? pais))
    clearTimeout(espera.current)
    espera.current = setTimeout(() => fixar(txt, pais), 800)
  }
  const trocarPais = (id: string) => {
    const p = PAISES.find((x) => x.id === id)!
    setPais(p)
    fixar(texto, p)
  }
  return (
    <div className="flex min-h-11 items-stretch overflow-hidden rounded-xl border border-[var(--borda)] bg-[var(--cartao)] focus-within:border-[var(--marca)]">
      {/* a bandeira com o código: a lista nativa (fácil no celular) por cima */}
      <label className="relative flex shrink-0 items-center gap-1 border-r border-[var(--borda)] bg-[var(--fundo)] px-2.5 text-sm font-semibold" title={t(pais.nome)}>
        <Bandeira pais={pais.id} />
        <span className="num">+{pais.codigo}</span>
        <span aria-hidden className="text-xs text-[var(--suave)]">▾</span>
        <select aria-label={t('País do telefone')} value={pais.id} onChange={(e) => trocarPais(e.target.value)} className="absolute inset-0 cursor-pointer opacity-0">
          {PAISES.map((p) => <option key={p.id} value={p.id}>{t(p.nome)} (+{p.codigo})</option>)}
        </select>
      </label>
      <input type="tel" inputMode="tel" autoComplete="tel" aria-label={t(rotulo)} value={texto} placeholder={pais.exemplo}
        onChange={(e) => digitar(e.target.value)} onBlur={() => (clearTimeout(espera.current), fixar(texto, pais))}
        className={cx('num min-w-0 flex-1 bg-transparent px-3 text-base outline-none placeholder:text-[var(--suave)] placeholder:opacity-70')} />
    </div>
  )
}
