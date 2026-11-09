// DIVISÃO INTERNA DA VENDA (fora da nota): em cada serviço, a barra e os valores de quem ficou com quanto e, embaixo, de
// onde veio a comissão com o atalho para o lugar exato de mudar. A regra de quem pode ver é podeVerDivisao (serviço).
import { pct } from '../../../core/domain/comissao'
import { formatar } from '../../../core/domain/dinheiro'
import type { Linha } from '../../../core/domain/tipos'
import { Cartao } from '../../../shared/ui/base'
import { useApp, useConsulta } from '../../../shared/ui/contexto'
import { useT } from '../../../shared/ui/i18n'
import { type DestinoComissao, origemComissao, partesDaLinha } from '../model/divisao'
import { NotaTela } from '../../../shared/ui/notaTela'

const COR = { insumos: 'var(--alerta)', salao: 'var(--suave)', profissional: 'var(--marca)' }

function Parte({ cor, nome, valor, forte }: { cor: string; nome: string; valor: string; forte?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-3 text-sm">
      <span className="flex min-w-0 items-center gap-2">
        <span aria-hidden className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: cor }} />
        <span className={forte ? 'min-w-0 break-words font-semibold' : 'min-w-0 break-words'}>{nome}</span>
      </span>
      <span className={forte ? 'num whitespace-nowrap font-semibold' : 'num whitespace-nowrap'}>{valor}</span>
    </div>
  )
}

export function DivisaoInterna({ linhas, moeda, onCorrigir }: { linhas: Linha[]; moeda: string; onCorrigir?(): void }) {
  const t = useT()
  const { ir } = useApp()
  const { dados: pessoas } = useConsulta('pessoas', {})
  const f = (v: number) => formatar(v, moeda)
  const abrir = (d: DestinoComissao) => {
    if (d.tipo === 'corrigir') onCorrigir?.()
    else if (d.tipo === 'servico') ir('configSecao', { id: 'catalogo', servico: d.itemId })
    else if (d.tipo === 'profissional') ir('novoFuncionario', { id: d.pessoaId })
    else ir('configSecao', { id: 'catalogo' })
  }
  return (
    <Cartao titulo={t('Divisão interna (não sai na nota)')} ajuda="A comissão segue esta ordem: ajuste na venda › % do serviço › % da profissional › padrão do salão. Os insumos saem antes da divisão.">
      <ul className="divide-y divide-[var(--borda)]">
        {linhas.map((l) => {
          const p = partesDaLinha(l)
          const origem = origemComissao(l)
          const nome = (l.profissionalId && pessoas?.find((x) => x.id === l.profissionalId)?.nome) || t('Profissional')
          const podeAbrir = origem && (origem.destino.tipo !== 'corrigir' || !!onCorrigir)
          return (
            <li key={l.id} className="space-y-2 py-3 first:pt-0 last:pb-0">
              <div className="flex items-baseline justify-between gap-3">
                <b className="min-w-0 break-words">{l.descricao}</b>
                <b className="num whitespace-nowrap">{f(l.totalPrincipal)}</b>
              </div>
              <div aria-hidden className="flex h-2 gap-0.5 overflow-hidden rounded-full">
                {p.insumos > 0 && <span style={{ width: p.fatias.insumos, background: COR.insumos }} />}
                {p.salao > 0 && <span style={{ width: p.fatias.salao, background: COR.salao }} />}
                {p.profissional > 0 && <span style={{ width: p.fatias.profissional, background: COR.profissional }} />}
              </div>
              <div className="space-y-1">
                {p.insumos > 0 && <Parte cor={COR.insumos} nome={l.insumos?.length ? `${t('Insumos')} (${l.insumos.map((i) => i.nome).join(', ')})` : t('Insumos')} valor={f(p.insumos)} />}
                <Parte cor={COR.salao} nome={t('Salão')} valor={f(p.salao)} />
                {p.profissional > 0 && <Parte forte cor={COR.profissional} nome={l.comissaoBp ? `${nome} · ${pct(l.comissaoBp)}` : nome} valor={f(p.profissional)} />}
              </div>
              {l.insumoMotivo && <p className="text-xs text-[var(--suave)]">{t('Insumos')}: {l.insumoMotivo}</p>}
              {l.motivoPreco && l.precoCatalogo !== undefined && <p className="text-xs text-[var(--suave)]">{t('Preço do catálogo')} {f(l.precoCatalogo)} · {l.motivoPreco}</p>}
              {origem && (
                <div className="flex flex-wrap items-center justify-between gap-x-3 rounded-xl bg-[var(--fundo)] py-1 pl-3 pr-1">
                  <span className="min-w-0 py-1 text-xs text-[var(--suave)]">{t(origem.explica)}</span>
                  {podeAbrir && <button type="button" onClick={() => abrir(origem.destino)} className="min-h-11 rounded-lg px-2 text-sm font-semibold text-[var(--marca)] hover:bg-[var(--marca-suave)]">{t(origem.rotulo)} →</button>}
                </div>
              )}
            </li>
          )
        })}
      </ul>
      {linhas.some((l) => origemComissao(l)) && <NotaTela className="mt-3">{t('Mudar a regra vale para as próximas vendas; esta continua como foi feita.')}</NotaTela>}
    </Cartao>
  )
}
