// O QUE FALTA NA VENDA — um componente só para isso, no lugar do selo solto ("○ Sem comprovante do pagamento").
// Cada pendência numa linha: a CLASSE (💰 Dinheiro · 📎 Documento) e o NÍVEL (Urgente · Atenção), o que falta, DESDE
// QUANDO ("há 3 dias · desde 02/11"), o valor (quando é dinheiro), um ⓘ que explica por que importa e como resolver, e
// o botão que resolve. As regras de quando falta são do servidor (pendenciasVenda): aqui só o desenho.
import { diasEntre, dataLocal } from '../../core/domain/datas'
import { formatar } from '../../core/domain/dinheiro'
import type { Pendencia } from '../../core/services/pendencias'
import { Botao, Info, cx, dataBR } from './base'
import { useT } from './i18n'

/** a classe, a explicação (tooltip) e o rótulo da ação de cada pendência da venda */
const SOBRE: Record<string, { classe: 'dinheiro' | 'documento'; porque: string; acao: string }> = {
  faltaReceber: {
    classe: 'dinheiro',
    porque: 'A venda foi concluída, mas parte do valor ainda não entrou no caixa. Enquanto faltar, o valor fica na conta da cliente (e aparece no Painel em "Falta receber"). Resolva registrando o pagamento quando ela pagar.',
    acao: 'Registrar pagamento',
  },
  semComprovante: {
    classe: 'documento',
    porque: 'O pagamento não foi em dinheiro vivo (QR, transferência, cartão…): guarde o comprovante para conferir com o banco e ter prova se a cliente contestar. Resolva anexando a foto ou o PDF do comprovante em Arquivos.',
    acao: 'Anexar comprovante',
  },
}
const CLASSE = { dinheiro: { icone: '💰', nome: 'Dinheiro' }, documento: { icone: '📎', nome: 'Documento' } } as const
const NIVEL = { urgente: { nome: 'Urgente', cor: 'var(--ruim)' }, atencao: { nome: 'Atenção', cor: 'var(--alerta)' } } as const

export function FaltaNaVenda({ pendencias, desde, moeda, onAcao }: {
  pendencias: Pendencia[]
  /** desde quando a venda está assim (o dia em que foi concluída) */
  desde: string
  moeda: string
  /** o botão de cada pendência (receber, anexar…) */
  onAcao(id: Pendencia['id']): void
}) {
  const t = useT()
  if (!pendencias.length) return null
  const dias = Math.max(0, diasEntre(desde, dataLocal()))
  const ha = dias === 0 ? t('desde hoje') : `${dias === 1 ? t('há 1 dia') : t('há {n} dias', { n: dias })} · ${t('desde')} ${dataBR(desde)}`
  const urgentes = pendencias.filter((p) => p.nivel === 'urgente').length
  return (
    <section aria-label={t('O que falta nesta venda')} className="overflow-hidden rounded-2xl border border-[var(--borda)] bg-[var(--cartao)] shadow-sm">
      <p className="flex flex-wrap items-baseline gap-x-2 border-b border-[var(--borda)] px-4 py-2.5">
        <b className="text-sm">{t('O que falta nesta venda')}</b>
        <span className="text-xs text-[var(--suave)]">{t('{n} pendência(s)', { n: pendencias.length })}{urgentes ? ` · ${t('{n} urgente(s)', { n: urgentes })}` : ''}</span>
      </p>
      <ul className="divide-y divide-[var(--borda)]">
        {pendencias.map((p) => {
          const s = SOBRE[p.id] ?? { classe: 'documento' as const, porque: '', acao: '' }
          const n = NIVEL[p.nivel === 'urgente' ? 'urgente' : 'atencao']
          const c = CLASSE[s.classe]
          return (
            <li key={p.id} className="relative flex flex-wrap items-center gap-x-3 gap-y-2 py-3 pl-5 pr-4">
              <span aria-hidden className="absolute inset-y-0 left-0 w-1" style={{ background: n.cor }} />
              <span className="min-w-[min(100%,15rem)] flex-1">
                <span className="flex flex-wrap items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide">
                  <span className="rounded-full px-2 py-0.5" style={{ color: n.cor, background: `color-mix(in srgb, ${n.cor} 12%, transparent)` }}>{t(n.nome)}</span>
                  <span className="text-[var(--suave)]">{c.icone} {t(c.nome)}</span>
                </span>
                <span className="mt-1 flex items-center gap-1 font-semibold">
                  {t(p.texto)}
                  {p.valor !== undefined && <span className="num" style={{ color: n.cor }}>· {formatar(p.valor, moeda)}</span>}
                  {s.porque && <Info texto={s.porque} />}
                </span>
                <span className={cx('num block text-xs', dias >= 3 ? 'font-semibold text-[var(--ruim)]' : 'text-[var(--suave)]')}>⏱ {ha}</span>
              </span>
              {s.acao && <Botao variante={p.nivel === 'urgente' ? 'primario' : 'secundario'} className="w-full shrink-0 sm:w-auto" onClick={() => onAcao(p.id)}>{t(s.acao)}</Botao>}
            </li>
          )
        })}
      </ul>
    </section>
  )
}
