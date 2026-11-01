// LINHA DO TEMPO interativa: "Pedido entrou dia X com Y, Z · fulana conferiu · pagou · entrou no estoque · vendido para…".

import { useState } from 'react'
import { Botao, cx } from './base'
import { useApp, useConsulta } from './contexto'
import { useT } from './i18n'

const ICONES = { etapa: '🔁', acao: '✳️', anexo: '📎', estoque: '📦', caixa: '💵', conta: '📒' } as const

export function LinhaDoTempo({ id }: { id: string }) {
  const t = useT()
  const { ir } = useApp()
  const { dados } = useConsulta('linhaDoTempo', { id })
  const [filtro, setFiltro] = useState<string>('')
  const [tudo, setTudo] = useState(false)
  if (!dados) return null
  const tipos = [...new Set(dados.map((e) => e.tipo))]
  const lista = dados.filter((e) => !filtro || e.tipo === filtro)
  const visiveis = tudo ? lista : lista.slice(-12)
  return (
    <div>
      <div className="mb-2 flex flex-wrap gap-1">
        <button type="button" onClick={() => setFiltro('')} className={cx('rounded-full px-3 py-1 text-xs font-semibold', !filtro ? 'bg-[var(--marca)] text-white' : 'bg-[var(--marca-suave)] text-[var(--marca)]')}>{t('Tudo')}</button>
        {tipos.map((tp) => (
          <button key={tp} type="button" onClick={() => setFiltro(tp)} className={cx('rounded-full px-3 py-1 text-xs font-semibold', filtro === tp ? 'bg-[var(--marca)] text-white' : 'bg-[var(--marca-suave)] text-[var(--marca)]')}>
            {ICONES[tp]} {t({ etapa: 'Etapas', acao: 'Ações', anexo: 'Arquivos', estoque: 'Estoque', caixa: 'Dinheiro', conta: 'Conta' }[tp])}
          </button>
        ))}
      </div>
      {!tudo && lista.length > 12 && <Botao variante="leve" onClick={() => setTudo(true)}>{t('Ver tudo ({n})', { n: lista.length })}</Botao>}
      <ol className="relative ml-3 border-l-2 border-[var(--borda)]">
        {visiveis.map((e, i) => (
          <li key={i} className="mb-3 ml-4">
            <span className="absolute -left-[13px] flex h-6 w-6 items-center justify-center rounded-full bg-[var(--cartao)] text-sm" aria-hidden>{ICONES[e.tipo]}</span>
            <div className="text-xs text-[var(--suave)]">
              {new Date(e.em).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' })}
              {e.por && <> · <b>{e.por}</b></>}
            </div>
            <button type="button" disabled={!e.ref} onClick={() => e.ref && ir(e.ref.tela, { id: e.ref.id })} className={cx('text-left text-sm font-semibold', e.ref && 'text-[var(--marca)] underline')}>
              {t(e.titulo)}
            </button>
            {e.detalhe && <div className="text-sm text-[var(--suave)]">{e.detalhe}</div>}
          </li>
        ))}
      </ol>
    </div>
  )
}
