// MENSAGEM DE WHATSAPP COM MODELO (vitrine e cobrança): o texto tem {variáveis} que viram os dados de verdade, e a
// PRÉVIA mostra como chega — o balão verde do WhatsApp, com *negrito* como lá.
import { useT } from './i18n'

/** troca cada {variavel} pelo valor; a que não existe fica como está (o editor avisa) */
export const preencherModelo = (texto: string, valores: Record<string, string>) => texto.replace(/\{(\w+)\}/g, (inteiro, k: string) => valores[k] ?? inteiro)

/** "{nome}" escrito errado sairia assim mesmo: as variáveis do texto que não estão na lista */
export const variaveisFora = (texto: string, conhecidas: readonly string[]) => [...new Set([...texto.matchAll(/\{(\w+)\}/g)].map((x) => x[1]).filter((k) => !conhecidas.includes(k)))]

/** como o WhatsApp mostra: *assim* fica em negrito */
function ComNegrito({ texto }: { texto: string }) {
  return <>{texto.split(/(\*[^*\n]+\*)/g).map((x, k) => (/^\*[^*\n]+\*$/.test(x) ? <b key={k}>{x.slice(1, -1)}</b> : x))}</>
}

/** o balão da mensagem, no fundo do WhatsApp */
export function PreviaWhatsapp({ texto, testId = 'previa-whatsapp' }: { texto: string; testId?: string }) {
  const t = useT()
  return (
    <div>
      <p className="mb-1 text-xs font-bold uppercase tracking-wider text-[var(--suave)]">{t('Prévia no WhatsApp')}</p>
      <div className="rounded-xl bg-[#e5ddd5] p-3">
        <p data-testid={testId} className="ml-auto w-fit max-w-[90%] whitespace-pre-wrap break-words rounded-lg bg-[#dcf8c6] px-3 py-2 text-sm text-[#111111]"><ComNegrito texto={texto} /></p>
      </div>
    </div>
  )
}
