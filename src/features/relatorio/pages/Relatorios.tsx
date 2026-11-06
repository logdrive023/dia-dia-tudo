// RELATÓRIOS contábeis e gerenciais: resultado (DRE) e divisão entre sócias, livro caixa, inventário, balanço,
// vendas e compras linha a linha e contas. CSV e imprimir/PDF. (O log de quem fez o quê é a tela Auditoria.)

import { useEffect } from 'react'
import { BotaoPeriodo } from '../../../shared/ui/filtroPadrao'
import { Abas, Titulo, dataBR } from '../../../shared/ui/base'
import { useApp, useParamTela } from '../../../shared/ui/contexto'
import { usePeriodo } from '../../../shared/ui/filtros'
import { useT } from '../../../shared/ui/i18n'
import { EstadosFinanceiros } from '../components/EstadosFinanceiros'
import { ImpostoRenda } from '../components/ImpostoRenda'
import { ComparaViagens } from '../components/ComparaViagens'
import { Reposicao } from '../components/Reposicao'
import { DivisaoSocias, ServicosInsumos } from '../components/socios'



// o 1º é o relatório contábil (Estados Financieros: resumo + impostos + conferência + anexos com cada centavo);
// livro caixa, vendas, compras, inventário e balanço viraram ANEXOS dele (cada informação num lugar só)
const RELATORIOS = [
  { id: 'estados', nome: 'Estados financeiros' },
  { id: 'dre', nome: 'Divisão entre sócias' },
  { id: 'servicos', nome: 'Serviços: receita × insumos' },
  // o exercício fiscal boliviano (IVA, IT, IUE, retenções), com o documento anual — IMPOSTO-RENDA.md
  // comparar as viagens de compra (custo por kg com a viagem, resultado, A × B)
  { id: 'viagens', nome: 'Viagens' },
  // sugestão de compra: o que mais vende × o que tem em estoque, por medida (quando acaba, quanto comprar)
  { id: 'reposicao', nome: 'Reposição' },
  { id: 'ir', nome: 'Imposto de Renda' },
]

export function Relatorios() {
  const t = useT()
  const [relTxt, setRel] = useParamTela('relatorio', 'estados')
  const rel = RELATORIOS.some((r) => r.id === relTxt) ? relTxt : 'estados'
  // o log virou a tela Auditoria: endereço antigo (#/relatorios?relatorio=log) vai para lá
  const { ir, nav } = useApp()
  useEffect(() => { if (relTxt === 'log') ir('auditoria', { usuarioId: (nav.params.usuarioId as string) || undefined } as never) }, [relTxt]) // eslint-disable-line react-hooks/exhaustive-deps
  const [periodo, setPeriodo] = usePeriodo('rel.periodo', 'mes')
  return (
    <div>
      <Titulo subtitulo={t('Estados financeiros no padrão boliviano (ou brasileiro), com cada centavo nos anexos.')}>{t('Relatórios')}</Titulo>
      <div className="nao-imprimir">
        <Abas atual={rel} onChange={setRel} abas={RELATORIOS} />
        {rel !== 'ir' && rel !== 'viagens' && rel !== 'reposicao' && <div className="mb-3 mt-3 flex"><BotaoPeriodo obrigatorio de={periodo.de} ate={periodo.ate} presets={['mes', 'mesPassado', '30d', 'ano']} onChange={(de, ate) => de && ate && setPeriodo({ preset: 'livre', de, ate })} /></div>}
      </div>
      <p className="mb-2 hidden text-sm print:block">{t(RELATORIOS.find((r) => r.id === rel)!.nome)} · {dataBR(periodo.de)} – {dataBR(periodo.ate)}</p>
      {rel === 'estados' && <EstadosFinanceiros de={periodo.de} ate={periodo.ate} />}
      {rel === 'dre' && <DivisaoSocias de={periodo.de} ate={periodo.ate} />}
      {rel === 'servicos' && <ServicosInsumos de={periodo.de} ate={periodo.ate} />}
      {rel === 'viagens' && <div className="mt-3"><ComparaViagens /></div>}
      {rel === 'reposicao' && <div className="mt-3"><Reposicao /></div>}
      {rel === 'ir' && <div className="mt-3"><ImpostoRenda /></div>}
    </div>
  )
}
