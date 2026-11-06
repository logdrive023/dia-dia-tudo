// PAINEL — a porta de entrada. Baseado em padrões reais (Shopify/Stripe: "ver rápido e agir rápido", notificações do
// que pede ação + poucos números com comparação; Stephen Few: o essencial à vista, por exceção; NN/g: divulgação
// progressiva e cor forte só para o que importa). A ordem responde às perguntas de quem abre o sistema de manhã:
//  1. O QUE PRECISA DE MIM? — pendências (urgente/atenção), fechadas numa linha cada; tocar abre os registros;
//  2. COMO ESTÁ A OPERAÇÃO? — o caminho do cabelo (compras → triagem → estoque → etiqueta) com o MESMO número de
//     cada tela e o que trava cada etapa; tocar abre o módulo;
//  3. COMO ESTÁ INDO? — vendas e lucro do período, com a comparação ao período anterior, e a evolução;
//  4. o resto (dinheiro, de onde vem, viagens, áreas) em seções que abrem e fecham — as secundárias começam fechadas.
// Cor só com função: vermelho = urgente/travado, âmbar = atenção, verde = em dia. Nada simulado: sem dado, não aparece.
//
// Este arquivo só ORGANIZA a tela: o estado e as consultas ficam em painel/usePainel.ts, as contas em
// painel/calculos.ts e cada seção no seu arquivo em painel/.

import { Abas, Carregando, Erro, Titulo } from '../../../shared/ui/base'
import { useApp } from '../../../shared/ui/contexto'
import { useT } from '../../../shared/ui/i18n'
import { MetasDoMes } from '../../../shared/ui/metas'
import { AtencaoAgora, resumoAlertas } from '../components/AtencaoAgora'
import { textoPeriodo } from '../model/calculos'
import { FiltrosPainel } from '../components/FiltrosPainel'
import { Secao } from '../components/Secao'
import { AreasPainel, DeOndeVem, DinheiroPainel, EvolucaoPainel, ResultadoImpostos } from '../components/SecoesPainel'
import { usePainel } from '../hooks/usePainel'
import { ViagensPainel } from '../components/ViagensPainel'
import { VisaoGeral } from '../components/VisaoGeral'

export function Painel() {
  const t = useT()
  const { ir } = useApp()
  const d = usePainel()
  const { p, periodo, areaAtual } = d
  const visaoGeral = !areaAtual

  return (
    <div>
      <Titulo subtitulo={t('O que pede você, a operação e as vendas. Toque num número para ver de onde vem.')}>{t('Painel')}</Titulo>

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
          {/* 1. O QUE PRECISA DE VOCÊ (só na visão geral) */}
          {visaoGeral && (
            <Secao id="atencao" titulo="Precisa de você" subtitulo="O que está atrasado ou travado. Toque para ver os registros." resumo={resumoAlertas(t, p.alertas)}>
              <AtencaoAgora alertas={p.alertas} moeda={d.principal} />
            </Secao>
          )}

          {/* 2. VISÃO GERAL — o período (vendas, lucro, compras) e AGORA (o caminho do cabelo + o caixa) numa composição só */}
          <MetasDoMes className="mb-4" />
          <VisaoGeral p={p} comparar={d.comparar} periodoTexto={textoPeriodo(periodo.de, periodo.ate, d.comparar, t('vs.'))} comCabelo={visaoGeral || areaAtual === 'cabelo'} />

          {/* 3. ANÁLISES COMPLEMENTARES: o detalhe que não precisa disputar atenção com a visão geral (abre e fecha) */}
          <h2 className="mb-3 mt-2 text-xs font-bold uppercase tracking-wider text-[var(--suave)]">{t('Análises complementares')}</h2>
          {d.impostosLigados && d.rel && <ResultadoImpostos rel={d.rel} visao={d.visaoImposto} onVisao={d.setVisaoImposto} onAbrirEstados={() => ir('relatorios', { relatorio: 'estados' })} />}
          <EvolucaoPainel p={p} />

          {/* 4. O RESTO, sob demanda */}
          <DinheiroPainel p={p} cartao={d.cartao} mostrarCaixa={!!areaAtual && areaAtual !== 'cabelo'} />
          {visaoGeral && <DeOndeVem p={p} principal={d.principal} onArea={d.escolherArea} onForma={(forma) => ir('vendas', { de: periodo.de, ate: periodo.ate, forma })} />}
          {(visaoGeral || areaAtual === 'viagens') && <ViagensPainel de={periodo.de} ate={periodo.ate} completo={areaAtual === 'viagens'} />}
          <AreasPainel p={p} principal={d.principal} fechadas={visaoGeral} />
        </>
      )}
    </div>
  )
}
