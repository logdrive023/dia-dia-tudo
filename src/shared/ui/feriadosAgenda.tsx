// FERIADOS NA AGENDA — só o desenho (o cadastro e as regras ficam em core/dados/feriados.ts):
//  · no mês do celular, um QUADRADINHO (os eventos são bolinhas: a forma também diferencia, não só a cor);
//  · no mês do computador, uma faixa clara com o nome; na semana e no dia, o aviso com tudo (pt, es, categoria, data,
//    onde vale, a fonte e se a data foi trasladada);
//  · a dica (tooltip nativo) em tudo: "Feriado nacional · Carnaval (segunda) — Carnaval (lunes) · 16/02/2026";
//  · a LEGENDA embaixo do calendário: o que cada bolinha e cada quadradinho quer dizer.
import { type CategoriaFeriado, type FeriadoNoDia, PAISES_FERIADO } from '../../core/dados/feriados'
import { cx, dataBR } from './base'
import { useT } from './i18n'
import { Legenda } from './legenda'

export const CAT_FERIADO: Record<CategoriaFeriado, { nome: string; cor: string }> = {
  nacional: { nome: 'Feriado nacional', cor: '#e11d48' },
  regional: { nome: 'Feriado regional', cor: '#0d9488' },
}

/** onde vale, traduzido pelas partes: "Bolívia (nacional)" · "Departamento de La Paz" / "Departamento de La Paz" (es) */
export function abrangenciaTexto(f: Pick<FeriadoNoDia, 'pais' | 'regiao'>, t: ReturnType<typeof useT>) {
  const p = PAISES_FERIADO[f.pais]
  const r = f.regiao ? p.regioes.find((x) => x.id === f.regiao) : undefined
  return r ? t('{tipo} de {r}', { tipo: t(p.tipoRegiao), r: r.nome }) : t('{p} (nacional)', { p: t(p.nome) })
}

/** a dica completa (tooltip) de um feriado */
export function dicaFeriado(f: FeriadoNoDia, t: ReturnType<typeof useT>) {
  return [
    `${t(CAT_FERIADO[f.categoria].nome)} · ${f.pt}`,
    `${t('em espanhol')}: ${f.es}`,
    `${dataBR(f.data)}${f.movidoDe ? ` (${t('trasladado de')} ${dataBR(f.movidoDe)})` : ''}`,
    `${abrangenciaTexto(f, t)} · ${t('fonte')}: ${f.fonte}${f.confirmacaoAnual ? ` · ${t('confirmado a cada ano')}` : ''}`,
  ].join('\n')
}

/** o quadradinho do feriado (mês no celular) */
export function MarcaFeriado({ f }: { f: FeriadoNoDia }) {
  const t = useT()
  return <span title={dicaFeriado(f, t)} aria-hidden className="h-2 w-2 rounded-[2px]" style={{ background: CAT_FERIADO[f.categoria].cor }} />
}

/** a faixa do feriado na célula do mês (computador): o nome em português, a dica com o resto */
export function FaixaFeriado({ f }: { f: FeriadoNoDia }) {
  const t = useT()
  const c = CAT_FERIADO[f.categoria]
  return (
    <span title={dicaFeriado(f, t)} className="flex h-6 min-w-0 items-center gap-1.5 rounded-md px-1.5 text-xs font-medium" style={{ color: c.cor, background: `${c.cor}1f` }}>
      <span aria-hidden className="h-2 w-2 shrink-0 rounded-[2px]" style={{ background: c.cor }} />
      <span className="truncate">{f.pt}</span>
    </span>
  )
}

/** o aviso do feriado (dia e semana): o nome em pt, o oficial em es (discreto), a categoria, a data e a fonte */
export function AvisoFeriado({ f, compacto }: { f: FeriadoNoDia; compacto?: boolean }) {
  const t = useT()
  const c = CAT_FERIADO[f.categoria]
  return (
    <div role="note" title={dicaFeriado(f, t)} className={cx('flex min-w-0 items-start gap-2.5 rounded-xl border px-3', compacto ? 'py-1.5' : 'py-2.5')} style={{ borderColor: `${c.cor}55`, background: `${c.cor}0f` }}>
      <span aria-hidden className="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-[3px]" style={{ background: c.cor }} />
      <span className="min-w-0 flex-1">
        <span className="flex flex-wrap items-baseline gap-x-2">
          <b className="text-sm">{f.pt}</b>
          <span className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: c.cor }}>{t(c.nome)}</span>
        </span>
        <span lang="es" className="block truncate text-xs italic text-[var(--suave)]">{f.es}</span>
        {!compacto && (
          <span className="block text-xs text-[var(--suave)]">
            {f.movidoDe ? `${t('trasladado de')} ${dataBR(f.movidoDe)} · ` : ''}{abrangenciaTexto(f, t)} · {f.fonte}{f.confirmacaoAnual ? ` · ${t('confirmado a cada ano')}` : ''}
          </span>
        )}
      </span>
    </div>
  )
}

/** a LEGENDA do calendário (componente padrão Legenda): os eventos (bolinhas) e os feriados ligados (quadradinhos) */
export function LegendaCalendario({ tipos, categorias }: { tipos: { id: string; nome: string; cor: string }[]; categorias: CategoriaFeriado[] }) {
  return (
    <Legenda className="mt-3" grupos={[
      { titulo: 'Eventos', itens: [...tipos.map((x) => ({ id: x.id, nome: x.nome, cor: x.cor })), { id: 'feito', nome: 'Já feito', cor: 'var(--suave)', forma: 'apagada' as const, dica: 'A bolinha fica mais clara quando o atendimento ou a parcela já foi feito.' }] },
      { titulo: 'Feriados', itens: categorias.map((c) => ({ id: c, nome: CAT_FERIADO[c].nome, cor: CAT_FERIADO[c].cor, forma: 'quadrado' as const, dica: 'Só informativo: não bloqueia nada. Liga e desliga em ⚙ Filtros.' })) },
    ]} />
  )
}
