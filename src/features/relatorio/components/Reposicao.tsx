// RELATÓRIOS › Reposição (sugestão de compra): o que mais vende × o que tem em estoque, por medida.
//   · em cima, 4 números: medidas acabando · kg em estoque · kg vendidos na janela · kg sugeridos para comprar
//   · as escolhas (janela, avisar com, cobrir) ficam aqui mesmo e são guardadas (Configurações)
//   · a lista: uma linha por medida, as que acabam primeiro em cima; cada uma diz quando acaba, quanto comprar e
//     quanto custou o último kg (e de qual viagem/compra) — ajuda a decidir a próxima viagem
// A conta é do serviço (src/core/services/reposicao.ts).
import { formatar } from '../../../core/domain/dinheiro'
import type { ResultadoConsulta } from '../../../core/services'
import { Carregando, Pilula, Selecao, Vazio, cx, dataBR, gramasTexto } from '../../../shared/ui/base'
import { useApp, useComando, useConsulta } from '../../../shared/ui/contexto'
import { useT } from '../../../shared/ui/i18n'
import { GrupoNumeros, NumeroGrande } from '../../../shared/ui/numeroGrande'
import { TabelaDados } from '../../../shared/ui/tabelaDados'
import { EmResumo } from './resumo'
import { NotaTela } from '../../../shared/ui/notaTela'

type R = ResultadoConsulta<'reposicao'>
type L = R['linhas'][number]

const SITUACAO: Record<L['situacao'], { nome: string; tom: 'ruim' | 'alerta' | 'bom' | 'neutro'; icone: string }> = {
  acabou: { nome: 'Acabou', tom: 'ruim', icone: '⛔' },
  acabando: { nome: 'Acabando', tom: 'alerta', icone: '⚠️' },
  ok: { nome: 'Tranquilo', tom: 'bom', icone: '✓' },
  parado: { nome: 'Parado', tom: 'neutro', icone: '💤' },
}

const kg = (g: number) => (g >= 1000 ? `${(g / 1000).toLocaleString(undefined, { maximumFractionDigits: 1 })} kg` : gramasTexto(g))

export function Reposicao() {
  const t = useT()
  const { ir } = useApp()
  const { dados } = useConsulta('reposicao', {})
  const { dados: conf } = useConsulta('configuracoes', {})
  const { executar } = useComando()
  if (!dados || !conf) return <Carregando />
  const c = dados.config
  const moeda = conf.config.moedaPrincipal
  const mudar = (k: keyof typeof c, v: string) => executar('salvarConfig', { reposicao: { ...c, [k]: Number(v) } } as never)
  const dias = (n: number) => ({ id: String(n), nome: t('{n} dias', { n }) })
  const nome = (l: L) => `${l.medida} cm${l.categoria !== 'Normal' ? ` · ${t(l.categoria)}` : ''}`
  const quando = (l: L) => (l.situacao === 'acabou' ? t('já acabou') : l.acabaEmDias === undefined ? t('sem venda em {n} dias', { n: c.janelaDias }) : t('acaba em ~{n} dias', { n: l.acabaEmDias }))
  const ultimo = (l: L) => (l.ultimo?.custoKg ? `${formatar(l.ultimo.custoKg, moeda)}/kg${l.ultimo.viagem ? ` · ${l.ultimo.viagem.codigo ?? ''} ${l.ultimo.viagem.nome}` : l.ultimo.compra?.codigo ? ` · ${l.ultimo.compra.codigo}` : ''} (${dataBR(l.ultimo.data.slice(0, 10))})` : '—')
  const urgentes = dados.linhas.filter((l) => l.situacao === 'acabou' || l.situacao === 'acabando').slice(0, 3)
  return (
    <div className="space-y-4">
      <EmResumo tom={dados.totais.acabando ? 'alerta' : 'bom'}
        frase={dados.totais.acabando
          ? <>{t('{n} medida(s) estão acabando.', { n: dados.totais.acabando })} {t('No ritmo de venda dos últimos {n} dias, comprar', { n: c.janelaDias })} <b className="num">{kg(dados.totais.sugestaoG)}</b> {t('cobre os próximos {n} dias.', { n: c.cobrirDias })}</>
          : <>{t('Nenhuma medida acabando: o estoque cobre o ritmo de venda dos últimos {n} dias.', { n: c.janelaDias })}</>}
        fatos={urgentes.map((l) => `${SITUACAO[l.situacao].icone} ${nome(l)} · ${quando(l)}`)} />
      <GrupoNumeros colunas={4}>
        <NumeroGrande rotulo="Medidas acabando" icone="⚠️" valor={String(dados.totais.acabando)} tom={dados.totais.acabando ? 'ruim' : 'bom'} ajuda={t('Medidas que já acabaram ou acabam em até {n} dias no ritmo de venda atual.', { n: c.alertaDias })} />
        <NumeroGrande rotulo="Em estoque (separado)" icone="📦" valor={kg(dados.totais.estoqueG)} selos={dados.bruto.gramas ? [{ texto: `+ ${kg(dados.bruto.gramas)} ${t('bruto')}` }] : undefined} ajuda="Cabelo já separado por medida. O bruto (ainda sem medida) vira medida na triagem." />
        <NumeroGrande rotulo={t('Vendido em {n} dias', { n: c.janelaDias })} icone="🛒" valor={kg(dados.totais.vendidoG)} />
        <NumeroGrande rotulo="Sugestão de compra" icone="🧳" valor={kg(dados.totais.sugestaoG)} ajuda="O que falta para cobrir os dias escolhidos em “Comprar para cobrir”, no ritmo de venda atual, somando todas as medidas." />
      </GrupoNumeros>

      <section className="flex flex-wrap items-end gap-3 rounded-2xl border border-[var(--borda)] bg-[var(--cartao)] p-3 text-sm">
        <label className="min-w-[8rem] flex-1"><span className="mb-1 block text-xs font-semibold text-[var(--suave)]">{t('Olhar as vendas dos últimos')}</span><Selecao valor={String(c.janelaDias)} onChange={(v) => mudar('janelaDias', v)} opcoes={[15, 30, 60, 90].map(dias)} /></label>
        <label className="min-w-[8rem] flex-1"><span className="mb-1 block text-xs font-semibold text-[var(--suave)]">{t('Avisar quando acabar em até')}</span><Selecao valor={String(c.alertaDias)} onChange={(v) => mudar('alertaDias', v)} opcoes={[7, 14, 21, 30].map(dias)} /></label>
        <label className="min-w-[8rem] flex-1"><span className="mb-1 block text-xs font-semibold text-[var(--suave)]">{t('Comprar para cobrir')}</span><Selecao valor={String(c.cobrirDias)} onChange={(v) => mudar('cobrirDias', v)} opcoes={[15, 30, 60, 90].map(dias)} /></label>
      </section>

      {!dados.linhas.length ? <Vazio texto="Ainda não há cabelo separado por medida." /> : (
        <TabelaDados<L>
          linhas={dados.linhas}
          chave={(x) => x.chave}
          onAbrir={(x) => ir('estoque', { modulo: 'cabelo', busca: `${x.medida}` })}
          colunas={[
            { id: 'medida', titulo: 'Medida', classe: 'whitespace-nowrap', celula: (x) => <b>{nome(x)}</b> },
            { id: 'situacao', titulo: 'Situação', classe: 'whitespace-nowrap', celula: (x) => <Pilula tom={SITUACAO[x.situacao].tom} className="shrink-0">{SITUACAO[x.situacao].icone} {t(SITUACAO[x.situacao].nome)}</Pilula> },
            { id: 'estoque', titulo: 'Em estoque', direita: true, classe: 'whitespace-nowrap', celula: (x) => <span>{kg(x.estoqueG)}<span className="block text-xs text-[var(--suave)]">{t('{n} pacote(s)', { n: x.pacotes })}</span></span> },
            { id: 'vendido', titulo: 'Vendeu', direita: true, classe: 'whitespace-nowrap', celula: (x) => <span>{kg(x.vendidoG)}<span className="block text-xs text-[var(--suave)]">{x.ritmoGDia ? `${gramasTexto(x.ritmoGDia)}/${t('dia')}` : '—'}</span></span> },
            { id: 'acaba', titulo: 'Quando acaba', classe: 'whitespace-nowrap', celula: (x) => <span className={cx(x.situacao === 'acabou' || x.situacao === 'acabando' ? 'font-bold text-[var(--ruim)]' : 'text-[var(--suave)]')}>{quando(x)}</span> },
            { id: 'sugestao', titulo: 'Comprar', direita: true, classe: 'whitespace-nowrap', celula: (x) => <b className={cx(x.sugestaoG ? 'text-[var(--marca)]' : 'text-[var(--suave)]')}>{x.sugestaoG ? kg(x.sugestaoG) : '—'}</b> },
            { id: 'ultimo', titulo: 'Último custo', classe: 'min-w-[12rem]', celula: (x) => <span className="text-xs">{ultimo(x)}</span> },
          ]}
          celular={{
            titulo: (x) => nome(x),
            valor: (x) => (x.sugestaoG ? `${t('comprar')} ${kg(x.sugestaoG)}` : kg(x.estoqueG)),
            valorSub: (x) => quando(x),
            situacao: (x) => ({ texto: `${SITUACAO[x.situacao].icone} ${t(SITUACAO[x.situacao].nome)}`, tom: x.situacao === 'acabou' ? 'ruim' : x.situacao === 'acabando' ? 'alerta' : x.situacao === 'ok' ? 'bom' : 'suave' }),
            resumo: (x) => `${t('estoque')} ${kg(x.estoqueG)} · ${t('vendeu')} ${kg(x.vendidoG)} ${t('em {n} dias', { n: c.janelaDias })}`,
            fatos: (x) => [`🏷 ${t('último')} ${ultimo(x)}`, `📦 ${t('{n} pacote(s)', { n: x.pacotes })}`, x.ritmoGDia ? `🛒 ${gramasTexto(x.ritmoGDia)}/${t('dia')}` : ''].filter(Boolean),
          }}
        />
      )}
      <NotaTela>{t('Como calcula: vendido nos últimos {j} dias ÷ {j} = ritmo por dia. Estoque ÷ ritmo = em quantos dias acaba. Comprar = ritmo × {c} dias − estoque. O custo do último kg já inclui o gasto da viagem quando ele foi incorporado.', { j: c.janelaDias, c: c.cobrirDias })}</NotaTela>
    </div>
  )
}
