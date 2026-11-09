// O CAMINHO DO CABELO: onde o cabelo está agora, em passos ligados (compras em aberto → para separar → pronto para vender
// → sem etiqueta) e o caixa. Não depende do período; cada linha abre a tela de onde o número vem.
import { formatar } from '../../../core/domain/dinheiro'
import type { Cartao as CartaoDados } from '../../../core/modulos'
import { fmt, gramasTexto } from '../../../shared/ui/base'
import { useApp, useConsulta } from '../../../shared/ui/contexto'
import { useT } from '../../../shared/ui/i18n'

export function CaminhoCabelo({ caixa, moeda }: { caixa?: CartaoDados; moeda: string }) {
  const t = useT()
  const { ir } = useApp()
  const { dados: o } = useConsulta('operacao', {})
  type Passo = { id: string; icone: string; nome: string; valor: string; sub?: string; aviso?: { texto: string; tom: 'ruim' | 'alerta' }; ok?: string; abrir(): void }
  const passos: Passo[] = o ? [
    { id: 'compras', icone: '🛒', nome: 'Compras em aberto', valor: String(o.compras.abertas), sub: o.compras.abertas ? `${gramasTexto(o.compras.gramas)} · ${formatar(o.compras.valor, moeda)}` : undefined, aviso: o.compras.urgentes ? { texto: t('{n} urgente(s)', { n: o.compras.urgentes }), tom: 'ruim' } : undefined, ok: t('nada pendente'), abrir: () => ir('comprar') },
    { id: 'separar', icone: '✂️', nome: 'Para separar', valor: o.triagem.separar ? gramasTexto(o.triagem.gramas) : '0', sub: o.triagem.separar ? t('{n} pacote(s)', { n: o.triagem.separar }) : undefined, aviso: o.triagem.parados ? { texto: t('{n} parado(s)', { n: o.triagem.parados }), tom: 'ruim' } : o.triagem.paraDepois ? { texto: t('{n} para depois', { n: o.triagem.paraDepois }), tom: 'alerta' } : undefined, ok: t('tudo separado'), abrir: () => ir('triagem') },
    { id: 'pronto', icone: '📦', nome: 'Pronto para vender', valor: gramasTexto(o.estoque.disponivel), sub: [t('{n} lote(s)', { n: o.estoque.lotes }), o.estoque.prontoValor ? formatar(o.estoque.prontoValor, moeda) : ''].filter(Boolean).join(' · '), abrir: () => ir('estoque', { status: 'separado' }) },
    { id: 'etiqueta', icone: '🏷', nome: 'Sem etiqueta', valor: String(o.etiqueta.sem), aviso: o.etiqueta.velhas ? { texto: t('{n} peso mudou', { n: o.etiqueta.velhas }), tom: 'ruim' } : o.etiqueta.sem ? { texto: t('Falta imprimir'), tom: 'alerta' } : undefined, ok: t('tudo em dia'), abrir: () => ir('etiquetas') },
  ] : []
  return (
    <div className="min-w-0 rounded-2xl border border-[var(--borda)] bg-[var(--cartao)] p-3 shadow-sm sm:p-4">
      {!o ? <p className="mt-3 text-sm text-[var(--suave)]">{t('Carregando…')}</p> : (
        <ol>
          {passos.map((x, k) => (
            <li key={x.id} className="relative">
              {/* a linha que liga os passos */}
              {k < passos.length - 1 && <span aria-hidden className="absolute bottom-0 left-[19px] top-10 w-px bg-[var(--borda)]" />}
              <button type="button" onClick={x.abrir} className="flex w-full items-center gap-3 rounded-xl py-1.5 pr-1 text-left transition hover:bg-[var(--fundo)]">
                <span aria-hidden className="relative z-10 flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-[var(--borda)] bg-[var(--cartao)] text-base">{x.icone}</span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold">{t(x.nome)}</span>
                  <span className="block truncate text-xs" style={{ color: x.aviso ? (x.aviso.tom === 'ruim' ? 'var(--ruim)' : 'var(--alerta)') : 'var(--suave)' }}>
                    {x.aviso ? `${x.aviso.tom === 'ruim' ? '●' : '○'} ${x.aviso.texto}` : x.sub || (x.ok ? `✓ ${x.ok}` : '')}
                  </span>
                </span>
                <b className="num shrink-0 text-base">{x.valor}</b>
                <span aria-hidden className="shrink-0 text-[var(--suave)]">›</span>
              </button>
            </li>
          ))}
        </ol>
      )}
      {caixa && (
        <button type="button" onClick={() => ir('caixa')} className="mt-2 flex w-full items-center gap-3 rounded-xl border-t border-[var(--borda)] pt-3 text-left">
          <span aria-hidden className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[var(--bom)]/12 text-base">💵</span>
          <span className="min-w-0 flex-1 text-sm font-semibold">{t('Caixa agora')}<span className="block text-xs font-normal text-[var(--suave)]">{t('Na mão + no banco')}</span></span>
          <b className="num shrink-0 text-base">{fmt(caixa.valor, caixa.formato, caixa.moeda)}</b>
          <span aria-hidden className="shrink-0 text-[var(--suave)]">›</span>
        </button>
      )}
    </div>
  )
}
