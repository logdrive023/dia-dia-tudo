// PAINEL — a porta de entrada. Pensado para quem abre o sistema pela primeira vez: uma pergunta por bloco, em linguagem
// simples, e o essencial à vista (padrões de Shopify/Stripe e divulgação progressiva da NN/g):
//   1. PRECISA DE VOCÊ — até 3 pendências, sempre à vista;
//   2. COMO ESTÁ INDO — o faturamento do período e poucos números;
//   3. METAS — só a principal (as outras abrem no lugar);
//   4. O CAMINHO DO CABELO — onde o cabelo está agora e o caixa;
//   5. o resto (análises) guardado em "Ver mais detalhes".
// Cor só com função: vermelho = urgente/travado, âmbar = atenção, verde = em dia. Nada simulado: sem dado, não aparece.
//
// Este arquivo só ORGANIZA a tela: o estado e as consultas ficam em hooks/usePainel.ts, as contas em model/calculos.ts
// e cada bloco no seu arquivo em components/.

import { Abas, Carregando, Erro, Titulo } from '../../../shared/ui/base'
import { useApp } from '../../../shared/ui/contexto'
import { useT } from '../../../shared/ui/i18n'
import { MetasDoMes } from '../../../shared/ui/metas'
import { NotaTela } from '../../../shared/ui/notaTela'
import { AtencaoAgora, resumoAlertas } from '../components/AtencaoAgora'
import { textoPeriodo } from '../model/calculos'
import { FiltrosPainel } from '../components/FiltrosPainel'
import { BlocoPainel } from '../components/BlocoPainel'
import { CaminhoCabelo } from '../components/CaminhoCabelo'
import { MaisDetalhes } from '../components/MaisDetalhes'
import { ResumoPeriodo } from '../components/ResumoPeriodo'
import { AreasPainel, DeOndeVem, DinheiroPainel, EvolucaoPainel, ResultadoImpostos } from '../components/SecoesPainel'
import { usePainel } from '../hooks/usePainel'
import { ViagensPainel } from '../components/ViagensPainel'

export function Painel() {
  const t = useT()
  const { ir } = useApp()
  const d = usePainel()
  const { p, periodo, areaAtual } = d
  const visaoGeral = !areaAtual
  const resumo = p && <BlocoPainel titulo="Como está indo" resumo={textoPeriodo(periodo.de, periodo.ate, d.comparar, t('vs.'))}><ResumoPeriodo p={p} comparar={d.comparar} /></BlocoPainel>
  const caminho = p && <BlocoPainel titulo="O caminho do cabelo" ajuda="Onde o cabelo está agora, da compra até ficar pronto para vender. Não depende do período escolhido."><CaminhoCabelo caixa={d.cartao('caixa')} moeda={d.principal} /></BlocoPainel>
  const analises = p && (
    <>
      {d.impostosLigados && d.rel && <ResultadoImpostos rel={d.rel} visao={d.visaoImposto} onVisao={d.setVisaoImposto} onAbrirEstados={() => ir('relatorios', { relatorio: 'estados' })} />}
      <EvolucaoPainel p={p} />
      <DinheiroPainel p={p} cartao={d.cartao} mostrarCaixa={!!areaAtual && areaAtual !== 'cabelo'} />
      {visaoGeral && <DeOndeVem p={p} principal={d.principal} onArea={d.escolherArea} onForma={(forma) => ir('vendas', { de: periodo.de, ate: periodo.ate, forma })} />}
      {(visaoGeral || areaAtual === 'viagens') && <ViagensPainel de={periodo.de} ate={periodo.ate} completo={areaAtual === 'viagens'} />}
      <AreasPainel p={p} principal={d.principal} fechadas={visaoGeral} />
    </>
  )

  return (
    <div>
      <Titulo subtitulo={t('Como está o negócio e o que precisa de você.')}>{t('Painel')}</Titulo>

      <FiltrosPainel
        periodo={periodo} setPeriodo={d.setPeriodo}
        moeda={d.moedaFiltro} setMoeda={d.setMoeda}
        localId={d.localId} setLocalId={d.setLocalId}
        comparar={d.comparar} setComparar={d.setComparar}
        moedas={d.moedas} principal={d.principal} locais={d.saloes}
        impostos={d.impostosLigados ? { valor: d.visaoImposto, onChange: d.setVisaoImposto } : undefined}
      />

      {/* áreas: abas simples */}
      <Abas variante="sublinhado" atual={areaAtual} onChange={d.escolherArea} abas={[{ id: '', nome: 'Visão geral' }, ...d.modulos.map((m) => ({ id: m.id, nome: `${m.icone} ${t(m.nome)}` })), { id: 'viagens', nome: '✈️ Viagens' }]} />

      <Erro texto={d.erro} />
      {!p ? (
        <Carregando />
      ) : (
        <>
          {visaoGeral ? (
            <>
              <div className="lg:grid lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)] lg:items-start lg:gap-5">
                <div className="min-w-0">
                  <BlocoPainel titulo="Precisa de você" resumo={p.alertas.length ? resumoAlertas(t, p.alertas) : undefined}>
                    <AtencaoAgora alertas={p.alertas} moeda={d.principal} />
                  </BlocoPainel>
                  {resumo}
                </div>
                <div className="min-w-0">
                  <MetasDoMes resumida className="mb-5" />
                  {caminho}
                </div>
              </div>
              <NotaTela className="mb-4">{t('Toque em qualquer número para ver de onde ele vem.')}</NotaTela>
              <MaisDetalhes>{analises}</MaisDetalhes>
            </>
          ) : (
            <>
              <MetasDoMes className="mb-5" />
              {resumo}
              {areaAtual === 'cabelo' && caminho}
              {analises}
            </>
          )}
        </>
      )}
    </div>
  )
}
