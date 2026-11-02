// LOG DA TRIAGEM do lote: quem, quando, o quê, peso bruto × líquido e perda (o grafo completo fica em rastreioTotal.tsx).

import type { ResultadoConsulta } from '../core/services'
import { cx, dataBR, fmt, gramasTexto } from './base'
import { useT } from './i18n'

type Ficha = ResultadoConsulta<'fichaItem'>

const hora = (iso: string) => `${dataBR(iso)} ${iso.slice(11, 16)}`

/** LOG DA TRIAGEM: quem fez, quando, o quê, peso bruto × líquido e perda (do log de auditoria). */
export function LogTriagem({ linhas }: { linhas: Ficha['logTriagem'] }) {
  const t = useT()
  if (!linhas.length) return <p className="text-sm text-[var(--suave)]">{t('Nada registrado ainda.')}</p>
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="text-left text-xs text-[var(--suave)]">
          <tr>
            <th className="p-2">{t('Quando')}</th>
            <th className="p-2">{t('Quem')}</th>
            <th className="p-2">{t('Ação')}</th>
            <th className="p-2 text-right">{t('Peso bruto')}</th>
            <th className="p-2 text-right">{t('Líquido')}</th>
            <th className="p-2 text-right">{t('Perda')}</th>
          </tr>
        </thead>
        <tbody>
          {linhas.map((l) => (
            <tr key={l.id} className="border-t border-[var(--borda)] align-top">
              <td className="num whitespace-nowrap p-2">{hora(l.em)}</td>
              <td className="p-2">{l.por ?? '—'}</td>
              <td className="min-w-[12rem] p-2"><b>{t(l.nome)}</b><div className="text-xs text-[var(--suave)] [overflow-wrap:anywhere]">{l.resumo}</div></td>
              <td className="num whitespace-nowrap p-2 text-right">{l.pesoBruto !== undefined ? gramasTexto(l.pesoBruto) : '—'}</td>
              <td className="num whitespace-nowrap p-2 text-right">{l.pesoLiquido !== undefined ? gramasTexto(l.pesoLiquido) : '—'}</td>
              <td className={cx('num whitespace-nowrap p-2 text-right', l.perda ? 'text-[var(--ruim)]' : undefined)}>{l.perda !== undefined ? `${gramasTexto(l.perda)} (${fmt(l.perdaPct ?? 0, 'percentual')})` : '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
