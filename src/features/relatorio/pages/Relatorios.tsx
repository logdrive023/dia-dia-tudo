// RELATÓRIOS contábeis e gerenciais: resultado (DRE) e divisão entre sócias, livro caixa, inventário, balanço,
// vendas e compras linha a linha e contas. CSV e imprimir/PDF. (O log de quem fez o quê é a tela Auditoria.)

import { Suspense, lazy, useEffect } from 'react'
import { BotaoPeriodo } from '../../../shared/ui/filtroPadrao'
import { Abas, Carregando, Titulo, dataBR } from '../../../shared/ui/base'
import { useApp, useParamTela } from '../../../shared/ui/contexto'
import { usePeriodo } from '../../../shared/ui/filtros'
import { useT } from '../../../shared/ui/i18n'
import { EstadosFinanceiros } from '../components/EstadosFinanceiros'

// a 1ª aba vem junto; as outras só carregam quando a pessoa abre (o Imposto de Renda e as Viagens são grandes)
const ImpostoRenda = lazy(() => import('../components/ImpostoRenda').then((m) => ({ default: m.ImpostoRenda })))
const ComparaViagens = lazy(() => import('../components/ComparaViagens').then((m) => ({ default: m.ComparaViagens })))
const Reposicao = lazy(() => import('../components/Reposicao').then((m) => ({ default: m.Reposicao })))
const DivisaoSocias = lazy(() => import('../components/socios').then((m) => ({ default: m.DivisaoSocias })))
const ServicosInsumos = lazy(() => import('../components/socios').then((m) => ({ default: m.ServicosInsumos })))



// o 1º é o relatório contábil (Estados Financieros: resumo + impostos + conferência + anexos com cada centavo);
// livro caixa, vendas, compras, inventário e balanço viraram ANEXOS dele (cada informação num lugar só)
// cada aba tem o ícone e A PERGUNTA que ela responde (aparece logo abaixo das abas: abriu, já sabe o que está vendo)
const RELATORIOS = [
  { id: 'estados', icone: '📊', nome: 'Estados financeiros', pergunta: 'Como foi o período: o que entrou, para onde foi e o que sobrou — e o formato do contador.' },
  { id: 'dre', icone: '🤝', nome: 'Divisão entre sócias', pergunta: 'Quanto do resultado é de cada sócia e quanto falta acertar.' },
  { id: 'servicos', icone: '✂️', nome: 'Serviços: receita × insumos', pergunta: 'Quanto cada serviço rende depois dos insumos e das comissões.' },
  // comparar as viagens de compra (custo por kg com a viagem, resultado, A × B)
  { id: 'viagens', icone: '✈️', nome: 'Viagens', pergunta: 'Quanto custou cada kg em cada viagem e quanto já voltou.' },
  // sugestão de compra: o que mais vende × o que tem em estoque, por medida (quando acaba, quanto comprar)
  { id: 'reposicao', icone: '🧳', nome: 'Reposição', pergunta: 'Quais medidas estão acabando e quanto comprar na próxima viagem.' },
  // o exercício fiscal boliviano (IVA, IT, IUE, retenções), com o documento anual — docs/business/FISCAL.md
  { id: 'ir', icone: '🧾', nome: 'Imposto de Renda', pergunta: 'O ano fiscal: impostos estimados, o que já foi pago e o documento anual.' },
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
        <Abas atual={rel} onChange={setRel} abas={RELATORIOS.map((r) => ({ id: r.id, nome: `${r.icone} ${t(r.nome)}` }))} />
        <p className="mt-2 px-1 text-sm text-[var(--suave)]">{t(RELATORIOS.find((r) => r.id === rel)!.pergunta)}</p>
        {rel !== 'ir' && rel !== 'viagens' && rel !== 'reposicao' && <div className="mb-3 mt-3 flex"><BotaoPeriodo obrigatorio de={periodo.de} ate={periodo.ate} presets={['mes', 'mesPassado', '30d', 'ano']} onChange={(de, ate) => de && ate && setPeriodo({ preset: 'livre', de, ate })} /></div>}
      </div>
      <p className="mb-2 hidden text-sm print:block">{t(RELATORIOS.find((r) => r.id === rel)!.nome)} · {dataBR(periodo.de)} – {dataBR(periodo.ate)}</p>
      <Suspense fallback={<Carregando />}>
      {rel === 'estados' && <EstadosFinanceiros de={periodo.de} ate={periodo.ate} />}
      {rel === 'dre' && <DivisaoSocias de={periodo.de} ate={periodo.ate} />}
      {rel === 'servicos' && <ServicosInsumos de={periodo.de} ate={periodo.ate} />}
      {rel === 'viagens' && <div className="mt-3"><ComparaViagens /></div>}
      {rel === 'reposicao' && <div className="mt-3"><Reposicao /></div>}
      {rel === 'ir' && <div className="mt-3"><ImpostoRenda /></div>}
      </Suspense>
    </div>
  )
}
