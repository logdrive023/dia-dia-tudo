// CONSULTANDO — os 4 estados de qualquer dado que vem do servidor, num lugar só (as telas não repetem "if"):
//
//   parado      a consulta está desligada (useConsulta(..., ativo=false))  → `ocioso` (ou nada)
//   carregando  ainda não chegou                                           → o ESQUELETO no formato do que vai chegar
//   erro        não veio (sem internet, sem permissão…)                    → a mensagem + "Tentar de novo"
//   sucesso     chegou                                                     → children(dados) — ou o VAZIO, se não há nada
//
// Uso (com o resultado do useConsulta, sem mudar nada nele):
//   const q = useConsulta('vendas', { de, ate })
//   <Consultando consulta={q} formato="tabela" colunas={5} vazio="Nenhuma venda no período." ehVazio={(d) => !d.length}>
//     {(vendas) => <TabelaDados linhas={vendas} … />}
//   </Consultando>
// Hoje os dados estão no aparelho; com a API (ou "Simular internet" em Configurações › Dados) é o mesmo código.
import { type ReactNode, useEffect, useState } from 'react'
import { Botao, Carregando, Vazio } from './base'
import { useT } from './i18n'

export interface EstadoConsulta<T> {
  dados?: T
  erro?: string
  /** quantas respostas já chegaram (do useConsulta): o "Tentar de novo" para de girar quando chega a próxima */
  respostas?: number
  recarregar(): void
}

export function Consultando<T>({ consulta, ativo = true, ocioso, formato = 'bloco', linhas, colunas, acoes, vazio, iconeVazio, acaoVazio, ehVazio, children }: {
  consulta: EstadoConsulta<T>
  /** false = parado (a consulta foi desligada de propósito): mostra `ocioso` */
  ativo?: boolean
  ocioso?: ReactNode
  /** o contorno do esqueleto enquanto carrega (mesmo do Carregando) */
  formato?: 'bloco' | 'tabela' | 'cartoes'
  linhas?: number
  colunas?: number
  acoes?: boolean
  /** texto do vazio (sem ele, lista vazia mostra o children normalmente) */
  vazio?: string
  iconeVazio?: string
  /** o botão que resolve o vazio (ex.: "+ Nova venda") */
  acaoVazio?: ReactNode
  /** quando conta como vazio (padrão: lista sem itens) */
  ehVazio?(dados: T): boolean
  children(dados: T): ReactNode
}) {
  if (!ativo) return <>{ocioso ?? null}</>
  if (consulta.erro && consulta.dados === undefined) return <ErroConsulta texto={consulta.erro} respostas={consulta.respostas} onTentar={consulta.recarregar} />
  if (consulta.dados === undefined) return <Carregando formato={formato} linhas={linhas} colunas={colunas} acoes={acoes} />
  const vazia = ehVazio ? ehVazio(consulta.dados) : Array.isArray(consulta.dados) && consulta.dados.length === 0
  if (vazio && vazia) return <Vazio texto={vazio} icone={iconeVazio}>{acaoVazio}</Vazio>
  return <>{children(consulta.dados)}</>
}

/** ERRO de consulta: o que aconteceu (traduzido) + "Tentar de novo", que pede de novo e mostra o giro enquanto espera */
export function ErroConsulta({ texto, respostas, onTentar }: { texto: string; respostas?: number; onTentar(): void }) {
  const t = useT()
  const [tentando, setTentando] = useState(false)
  // chegou a resposta da tentativa (o mesmo erro de novo, ou outro): o botão volta ao normal
  useEffect(() => setTentando(false), [respostas, texto])
  // sem o contador (uso fora do useConsulta): no máximo 8 s girando
  useEffect(() => {
    if (!tentando) return
    const id = setTimeout(() => setTentando(false), 8000)
    return () => clearTimeout(id)
  }, [tentando])
  return (
    // CELULAR: ícone + texto numa linha, o botão embaixo na largura toda; sm+: os três lado a lado
    <div role="alert" className="grid grid-cols-[auto_minmax(0,1fr)] items-center gap-3 rounded-2xl border border-[var(--ruim)]/40 bg-[var(--ruim)]/10 p-4 sm:grid-cols-[auto_minmax(0,1fr)_auto]">
      <span aria-hidden className="text-2xl">⚠️</span>
      <span className="min-w-0 text-sm">
        <b className="block text-[var(--ruim)]">{t('Não deu para carregar.')}</b>
        <span className="block break-words text-[var(--suave)]">{t(texto)}</span>
      </span>
      <Botao variante="secundario" className="col-span-2 w-full sm:col-span-1 sm:w-auto" carregando={tentando} onClick={() => (setTentando(true), onTentar())}>↻ {t('Tentar de novo')}</Botao>
    </div>
  )
}
