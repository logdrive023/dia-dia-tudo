// TRIAGEM › os dois ⓘ do título "Para separar", DESENHADOS (não parágrafo):
//   LegendaTriagem — cada selo da lista com a MESMA cara que tem na lista (as mesmas peças) + o que quer dizer
//   AjudaSeparar   — a separação num exemplo: o bruto → as partes → o que sobra é perda (a conta fecha)
import type { ReactNode } from 'react'
import { Info, Pilula } from '../../../shared/ui/base'
import { SeloEtiqueta } from '../../../shared/ui/etiquetas'
import { useT } from '../../../shared/ui/i18n'

function Titulinho({ children }: { children: ReactNode }) {
  return <b className="mb-2 block text-[11px] uppercase tracking-wide text-[var(--marca)]">{children}</b>
}

/** uma linha da legenda: o selo (como na lista) à esquerda, o significado à direita */
function Linha({ selo, children }: { selo: ReactNode; children: ReactNode }) {
  return (
    <li className="grid grid-cols-[7.5rem_minmax(0,1fr)] items-start gap-2 py-1.5">
      <span className="flex min-w-0 flex-wrap gap-1 pt-0.5">{selo}</span>
      <span className="text-xs leading-snug text-[var(--suave)]">{children}</span>
    </li>
  )
}

export function LegendaTriagem({ diasParado }: { diasParado: number }) {
  const t = useT()
  return (
    <Info conteudo={
      <span className="block">
        <Titulinho>{t('O que os selos dizem')}</Titulinho>
        <ul className="divide-y divide-[var(--borda)]">
          <Linha selo={<Pilula pequena tom="ruim">{t('parado')}</Pilula>}>{t('Esperando para separar há mais de {n} dias. Separe primeiro.', { n: diasParado })}</Linha>
          <Linha selo={<Pilula pequena tom="alerta">❓ {t('para depois')}</Pilula>}>{t('Ficou sem identificar numa separação: volte nele quando souber o que é.')}</Linha>
          <Linha selo={<Pilula pequena tom="alerta">{t('só {g}', { g: '40 g' })}</Pilula>}>{t('Sobra pequena: junte com outro ou ajuste como perda.')}</Linha>
          <Linha selo={<Pilula pequena tom="marca">🔗 {t('juntado')}</Pilula>}>{t('2 ou mais pacotes viraram um (ou tem cabelo de mais de uma compra).')}</Linha>
          <Linha selo={<SeloEtiqueta soLeitura id="legenda" impressaEm={new Date().toISOString()} />}>{t('Etiqueta já impressa. Toque para ver ou reimprimir.')}</Linha>
          <Linha selo={<SeloEtiqueta soLeitura id="legenda" />}>{t('Ainda sem etiqueta. Toque para imprimir.')}</Linha>
        </ul>
        <span className="mt-2 block rounded-lg bg-[var(--fundo)] px-2.5 py-2 text-xs text-[var(--suave)]">
          ⚙ {t('Quantos dias contam como “parado”: Configurações › Etapas da compra.')}
        </span>
      </span>
    } />
  )
}

/** "Para separar": o exemplo da separação desenhado, com a conta fechando (o que sobra vira perda) */
export function AjudaSeparar() {
  const t = useT()
  const parte = (g: string, nome: string, tom: 'bom' | 'alerta') => (
    <span className={`flex items-center justify-between gap-2 rounded-lg px-2.5 py-1.5 ${tom === 'bom' ? 'bg-[var(--bom)]/10' : 'bg-[var(--alerta)]/10'}`}>
      <span className="text-xs">{nome}</span>
      <b className="num text-sm">{g}</b>
    </span>
  )
  return (
    <Info conteudo={
      <span className="block space-y-2">
        <Titulinho>{t('Como separar')}</Titulinho>
        <span className="block text-sm">{t('Diga o peso e o que é cada parte. O que sobrar é perda.')}</span>
        <span className="block rounded-xl border border-[var(--borda)] p-2.5">
          <span className="flex items-center justify-between gap-2 rounded-lg bg-[var(--fundo)] px-2.5 py-1.5">
            <span className="text-xs">{t('Pacote bruto')}</span><b className="num text-sm">10 kg</b>
          </span>
          <span aria-hidden className="block py-1 text-center text-[var(--suave)]">↓ {t('separar')}</span>
          <span className="block space-y-1">
            {parte('2 kg', t('Loiro · 60 cm'), 'bom')}
            {parte('2 kg', t('Moreno · 50 cm'), 'bom')}
            {parte('5,8 kg', `❓ ${t('para depois')}`, 'alerta')}
          </span>
          <span className="mt-2 flex items-center justify-between gap-2 border-t border-[var(--borda)] pt-2 text-xs">
            <span className="text-[var(--suave)]">{t('Sobrou (10 − 9,8)')}</span>
            <b className="num text-[var(--ruim)]">{t('{g} de perda', { g: '0,2 kg' })}</b>
          </span>
        </span>
        <span className="block text-xs text-[var(--suave)]">💡 {t('Cada parte vira um pacote novo com etiqueta. “Para depois” é o que ainda não deu para identificar.')}</span>
      </span>
    } />
  )
}
