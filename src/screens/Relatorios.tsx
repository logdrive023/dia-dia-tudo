// RELATÓRIOS contábeis e gerenciais: resultado (DRE) e divisão entre sócias, livro caixa, inventário, balanço,
// vendas e compras linha a linha, contas, e o LOG de tudo (filtra por usuário e período). CSV e imprimir/PDF.

import { formatar } from '../core/domain/dinheiro'
import { Abas, Botao, Carregando, Cartao, Entrada, Selecao, Titulo, Vazio, cx, dataBR, loc } from '../ui/base'
import { useConsulta, useParamTela } from '../ui/contexto'
import { SeletorPeriodo, usePeriodo } from '../ui/filtros'
import { useT } from '../ui/i18n'
import { EstadosFinanceiros } from './relatorio/EstadosFinanceiros'

export { baixarCSV } from '../ui/csv'
import { baixarCSV } from '../ui/csv'


// o 1º é o relatório contábil (Estados Financieros: resumo + impostos + conferência + anexos com cada centavo);
// livro caixa, vendas, compras, inventário e balanço viraram ANEXOS dele (cada informação num lugar só)
const RELATORIOS = [
  { id: 'estados', nome: 'Estados financeiros' },
  { id: 'dre', nome: 'Divisão entre sócias' },
  { id: 'servicos', nome: 'Serviços: receita × insumos' },
  { id: 'log', nome: 'Log (quem fez o quê)' },
]

export function Relatorios() {
  const t = useT()
  const [relTxt, setRel] = useParamTela('relatorio', 'estados')
  const rel = RELATORIOS.some((r) => r.id === relTxt) ? relTxt : 'estados'
  const [periodo, setPeriodo] = usePeriodo('rel.periodo', 'mes')
  return (
    <div>
      <Titulo subtitulo={t('Estados financeiros no padrão boliviano (ou brasileiro), com cada centavo nos anexos.')}>{t('Relatórios')}</Titulo>
      <div className="nao-imprimir">
        <Abas atual={rel} onChange={setRel} abas={RELATORIOS} />
        <div className="mb-3"><SeletorPeriodo periodo={periodo} onChange={setPeriodo} /></div>
      </div>
      <p className="mb-2 hidden text-sm print:block">{t(RELATORIOS.find((r) => r.id === rel)!.nome)} · {dataBR(periodo.de)} – {dataBR(periodo.ate)}</p>
      {rel === 'estados' && <EstadosFinanceiros de={periodo.de} ate={periodo.ate} />}
      {rel === 'dre' && <Dre de={periodo.de} ate={periodo.ate} />}
      {rel === 'servicos' && <ServicosInsumos de={periodo.de} ate={periodo.ate} />}
      {rel === 'log' && <Log de={periodo.de} ate={periodo.ate} />}
    </div>
  )
}

/** Serviços do salão: receita, insumos (custo do salão), comissão e margem do salão, por tipo e por serviço. */
function ServicosInsumos({ de, ate }: { de: string; ate: string }) {
  const t = useT()
  const { dados } = useConsulta('servicosReceitaInsumos', { de, ate })
  if (!dados) return <Carregando />
  const m = dados.moeda
  const tabela = (titulo: string, linhas: typeof dados.porServico, csv: string) => (
    <Cartao titulo={t(titulo)} acao={<Botao variante="leve" className="nao-imprimir" onClick={() => baixarCSV(csv, linhas.map((l) => ({ nome: l.nome, tipo: l.categoria, feitos: l.n, receita: l.receita / 100, insumos: l.insumos / 100, comissao: l.comissao / 100, margem_salao: l.margem / 100 })))}>📥 {t('Baixar planilha')}</Botao>}>
      {!linhas.length ? (
        <Vazio texto="Nada no período." />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[32rem] text-sm">
            <thead>
              <tr className="text-left text-xs text-[var(--suave)]">
                <th className="py-1">{t('Serviço')}</th>
                <th className="text-right">{t('Feitos')}</th>
                <th className="text-right">{t('Receita')}</th>
                <th className="text-right">{t('Insumos')}</th>
                <th className="text-right">{t('Comissão')}</th>
                <th className="text-right">{t('Margem do salão')}</th>
              </tr>
            </thead>
            <tbody>
              {[...linhas, { ...dados.total, nome: t('Total') }].map((l, i) => (
                <tr key={i} className={cx('border-t border-[var(--borda)]', i === linhas.length && 'font-bold')}>
                  <td className="py-1">{l.nome}</td>
                  <td className="num text-right">{l.n}</td>
                  <td className="num text-right">{formatar(l.receita, m)}</td>
                  <td className="num text-right text-[var(--ruim)]">{l.insumos ? `−${formatar(l.insumos, m)}` : '—'}</td>
                  <td className="num text-right text-[var(--ruim)]">{l.comissao ? `−${formatar(l.comissao, m)}` : '—'}</td>
                  <td className={cx('num text-right font-semibold', l.margem < 0 && 'text-[var(--ruim)]')}>{formatar(l.margem, m)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Cartao>
  )
  return (
    <div className="space-y-4">
      <p className="text-sm text-[var(--suave)]">{t('Insumos (tinta, água oxigenada…) são custo do salão e saem antes da comissão. Margem do salão = receita − insumos − comissão.')}</p>
      {tabela('Por tipo de serviço', dados.porCategoria, 'servicos-por-tipo')}
      {tabela('Por serviço', dados.porServico, 'servicos-receita-insumos')}
    </div>
  )
}

function Dre({ de, ate }: { de: string; ate: string }) {
  const t = useT()
  const { dados } = useConsulta('dre', { de, ate })
  if (!dados) return <Carregando />
  const m = dados.moeda
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Cartao titulo={t('Resultado do período')} acao={<Botao variante="leve" className="nao-imprimir" onClick={() => baixarCSV('resultado', dados.linhas.map((l) => ({ conta: l.conta, valor: l.valor / 100 })))}>📥 {t('Baixar planilha')}</Botao>} ajuda="Receita − descontos − custo do que foi vendido − insumos dos serviços − comissões = lucro bruto; − despesas = resultado.">
        <table className="w-full text-sm">
          <tbody>
            {dados.linhas.map((l, i) => (
              <tr key={i} className={cx('border-t border-[var(--borda)]', l.nivel === 0 && 'font-bold')}>
                <td className={cx('py-1', l.nivel === 1 && 'pl-4')}>{t(l.conta)}</td>
                <td className={cx('num text-right', l.valor < 0 && 'text-[var(--ruim)]')}>{formatar(l.valor, m)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="mt-2 text-sm text-[var(--suave)]">{dados.vendas} {t('vendas')} · {t('margem')} {(dados.margem / 100).toLocaleString(loc())}%</p>
      </Cartao>
      <Cartao titulo={t('Divisão entre sócias')} ajuda="Resultado × parte de cada uma − o que já retirou = quanto falta acertar (o “÷ 2” do caderno).">
        {!dados.socios.length ? <Vazio texto="Cadastre as sócias em Configurações." /> : (
          <table className="w-full text-sm">
            <thead><tr className="text-left text-xs text-[var(--suave)]"><th>{t('Sócia')}</th><th className="text-right">{t('Parte')}</th><th className="text-right">{t('Retirou')}</th><th className="text-right">{t('Falta acertar')}</th></tr></thead>
            <tbody>
              {dados.socios.map((s) => (
                <tr key={s.id} className="border-t border-[var(--borda)]">
                  <td className="py-1">{s.nome} ({s.parteBp / 100}%)</td>
                  <td className="num text-right">{formatar(s.parte, m)}</td>
                  <td className="num text-right">{formatar(s.retirou, m)}</td>
                  <td className={cx('num text-right font-bold', s.falta < 0 && 'text-[var(--ruim)]')}>{formatar(s.falta, m)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Cartao>
    </div>
  )
}

function Log({ de, ate }: { de: string; ate: string }) {
  const t = useT()
  const [usuarioId, setUsuarioId] = useParamTela('usuarioId', '')
  const [acao, setAcao] = useParamTela('acao', '')
  const [busca, setBusca] = useParamTela('busca', '')
  const { dados } = useConsulta('logDetalhado', { de, ate, usuarioId: usuarioId || undefined, acao: acao || undefined, busca: busca || undefined })
  const { dados: todos } = useConsulta('logDetalhado', { limite: 0 })
  return (
    <Cartao titulo={`${t('Log')} · ${dados?.total ?? 0} ${t('ações')}`} ajuda="Toda ação fica registrada com quem fez e quando. Filtre por pessoa e período: “o que a funcionária fez do dia X ao Y”." acao={dados && <Botao variante="leve" className="nao-imprimir" onClick={() => baixarCSV('log', dados.linhas.map((l) => ({ quando: l.criadoEm, quem: l.usuarioNome ?? l.criadoPor, acao: l.nomeAcao, detalhe: l.resumo })))}>📥 {t('Baixar planilha')}</Botao>}>
      <div className="nao-imprimir mb-3 flex flex-wrap gap-2">
        <Selecao className="w-auto" valor={usuarioId} onChange={setUsuarioId} vazio="Todos os usuários" opcoes={todos?.usuarios ?? []} />
        <Selecao className="w-auto" valor={acao} onChange={setAcao} vazio="Todas as ações" opcoes={(todos?.acoes ?? []).map((a) => ({ id: a.id, nome: t(a.nome) }))} />
        <Entrada className="w-auto flex-1" placeholder={t('Buscar')} value={busca} onChange={(e) => setBusca(e.target.value)} />
      </div>
      {!dados ? <Carregando /> : !dados.linhas.length ? <Vazio texto="Nada no log com esse filtro." /> : (
        <ul className="divide-y divide-[var(--borda)] text-sm">
          {dados.linhas.map((l) => (
            <li key={l.id} className="py-2">
              <div className="text-xs text-[var(--suave)]">{new Date(l.criadoEm).toLocaleString(loc())} · <b>{l.usuarioNome ?? l.criadoPor}</b></div>
              <div><b>{t(l.nomeAcao)}</b> · {l.resumo}</div>
            </li>
          ))}
        </ul>
      )}
    </Cartao>
  )
}
