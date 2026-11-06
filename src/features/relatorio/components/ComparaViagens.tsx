// RELATÓRIOS › VIAGENS — comparar as viagens de compra, de um jeito simples:
//  1. em cima, 4 números (viagens, kg comprados, custo médio por kg, resultado);
//  2. "Quanto custou cada kg": uma barra por viagem, CABELO + VIAGEM separados (a compra e o gasto da viagem nunca se
//     misturam sem mostrar a conta) — a mais barata ganha o ✓;
//  3. "Uma contra a outra": escolhe A e B e vê lado a lado, com a diferença e quem foi melhor em cada linha;
//  4. a lista de todas (linha padrão no celular), cada uma abre a tela da viagem.
// Os números são os MESMOS da tela da viagem (consulta `viagens`, administrador): custo/kg real = (cabelo + gastos da
// viagem) ÷ kg comprados; já voltou = receita das vendas − tudo o investido; lucro do que vendeu = receita − custo do que saiu; ROI sobre o investido.
import { useState } from 'react'
import { formatar } from '../../../core/domain/dinheiro'
import type { ResultadoConsulta } from '../../../core/services'
import { AbasSituacao } from '../../../shared/ui/filtroPadrao'
import { Carregando, Info, Selecao, Vazio, cx, dataBR } from '../../../shared/ui/base'
import { useApp, useConsulta, useParamTela } from '../../../shared/ui/contexto'
import { GrupoNumeros, NumeroGrande } from '../../../shared/ui/numeroGrande'
import { TabelaDados } from '../../../shared/ui/tabelaDados'
import { useT } from '../../../shared/ui/i18n'

type V = NonNullable<ResultadoConsulta<'viagens'>>['linhas'][number]
const kg = (g: number) => `${(g / 1000).toLocaleString(undefined, { maximumFractionDigits: 2 })} kg`
const pct = (bp?: number) => (bp === undefined ? '—' : `${(bp / 100).toLocaleString(undefined, { maximumFractionDigits: 1 })}%`)

export function ComparaViagens() {
  const t = useT()
  const { ir } = useApp()
  const { dados } = useConsulta('viagens', {})
  const [sit, setSit] = useParamTela<'' | 'encerrada' | 'aberta'>('vs', '')
  const [a, setA] = useState<string>()
  const [b, setB] = useState<string>()
  if (!dados) return <Carregando />
  const m = dados.moeda
  const v = (n: number) => formatar(n, m)
  const todas = dados.linhas.filter((x) => !x.prospeccao || x.gasto > 0)
  const lista = todas.filter((x) => !sit || x.status === sit)
  if (!todas.length) return <Vazio texto="Nenhuma viagem ainda. As viagens de compra aparecem aqui para comparar." />
  const comKg = lista.filter((x) => x.gramas > 0 && x.custoKgReal !== undefined)
  const gramas = lista.reduce((s, x) => s + x.gramas, 0)
  const investido = lista.reduce((s, x) => s + x.investido, 0)
  const resultado = lista.reduce((s, x) => s + x.resultado, 0)
  const maisBarata = [...comKg].sort((x, y) => (x.custoKgReal ?? 0) - (y.custoKgReal ?? 0))[0]
  const maxKg = Math.max(1, ...comKg.map((x) => x.custoKgReal ?? 0))
  // A e B: por padrão as duas mais recentes com compra
  const opcoes = todas.filter((x) => x.gramas > 0)
  const A = opcoes.find((x) => x.id === a) ?? opcoes[0]
  const B = opcoes.find((x) => x.id === b) ?? opcoes.find((x) => x.id !== A?.id)
  return (
    <div className="space-y-4">
      <AbasSituacao valor={sit} onChange={(x) => setSit(x as typeof sit)} opcoes={[
        { id: '', nome: 'Todas', n: todas.length },
        { id: 'encerrada', nome: 'Encerradas', n: todas.filter((x) => x.status === 'encerrada').length },
        { id: 'aberta', nome: 'Abertas', n: todas.filter((x) => x.status === 'aberta').length },
      ]} />

      <GrupoNumeros colunas={4}>
        <NumeroGrande rotulo="Viagens" icone="✈️" valor={String(lista.length)} selos={[{ texto: t('{n} com compra', { n: comKg.length }) }]} />
        <NumeroGrande rotulo="Kg comprados" icone="⚖️" valor={kg(gramas)} />
        <NumeroGrande rotulo="Custo médio por kg" icone="🏷" valor={gramas ? v(Math.round((investido * 1000) / gramas)) : '—'} ajuda="(Cabelo + gastos das viagens) ÷ kg comprados, de todas as viagens da lista." />
        <NumeroGrande rotulo="Já voltou das viagens" icone="📈" valor={v(resultado)} tom={resultado < 0 ? 'ruim' : 'bom'} ajuda="O que já voltou: receita das vendas do cabelo destas viagens − tudo o que foi investido (cabelo + gastos). Fica negativo enquanto ainda tem cabelo para vender." />
      </GrupoNumeros>

      {/* 1. QUANTO CUSTOU CADA KG — cabelo + viagem, separados */}
      {comKg.length > 0 && (
        <section className="overflow-hidden rounded-2xl border border-[var(--borda)] bg-[var(--cartao)] shadow-sm">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-[var(--borda)] px-4 py-3">
            <b>{t('Quanto custou cada kg')}</b>
            <span className="flex items-center gap-3 text-xs text-[var(--suave)]">
              <span className="inline-flex items-center gap-1.5"><span aria-hidden className="h-2.5 w-2.5 rounded-sm bg-[var(--marca)]" />{t('cabelo')}</span>
              <span className="inline-flex items-center gap-1.5"><span aria-hidden className="h-2.5 w-2.5 rounded-sm bg-[var(--alerta)]" />{t('gastos da viagem')}</span>
            </span>
            <Info texto="Custo por kg = o que se pagou pelo cabelo ÷ kg + o gasto da viagem (combustível, hospedagem…) ÷ kg. Quanto menor, melhor." />
          </div>
          <ul className="space-y-3 px-4 py-3">
            {[...comKg].sort((x, y) => (x.custoKgReal ?? 0) - (y.custoKgReal ?? 0)).map((x) => {
              const cab = x.custoKg ?? 0
              const via = x.gastoKg ?? 0
              return (
                <li key={x.id}>
                  <button type="button" onClick={() => ir('viagem', { id: x.id })} className="w-full text-left">
                    <span className="flex flex-wrap items-baseline justify-between gap-2 text-sm">
                      <span className="min-w-0"><b className="font-mono text-[var(--marca)]">{x.codigo}</b> <span className="font-semibold">{x.nome}</span>{x.id === maisBarata?.id && comKg.length > 1 && <span className="ml-2 rounded-full bg-[var(--bom)]/12 px-2 py-0.5 text-[11px] font-bold text-[var(--bom)]">✓ {t('mais barata')}</span>}</span>
                      <span className="num whitespace-nowrap"><b>{v(x.custoKgReal ?? 0)}</b><span className="text-xs text-[var(--suave)]"> /kg · {kg(x.gramas)}</span></span>
                    </span>
                    <span className="mt-1 flex h-3 overflow-hidden rounded-full bg-[var(--fundo)]" title={`${t('cabelo')} ${v(cab)}/kg + ${t('viagem')} ${v(via)}/kg`}>
                      <span className="h-full bg-[var(--marca)]" style={{ width: `${(cab / maxKg) * 100}%` }} />
                      <span className="h-full bg-[var(--alerta)]" style={{ width: `${(via / maxKg) * 100}%` }} />
                    </span>
                    <span className="num mt-0.5 block text-[11px] text-[var(--suave)]">{t('cabelo')} {v(cab)}/kg + {t('viagem')} {v(via)}/kg</span>
                  </button>
                </li>
              )
            })}
          </ul>
        </section>
      )}

      {/* 2. UMA CONTRA A OUTRA */}
      {A && B ? <Comparar A={A} B={B} opcoes={opcoes} onA={setA} onB={setB} v={v} /> : lista.length > 0 && <p className="rounded-2xl border border-dashed border-[var(--borda)] px-4 py-3 text-sm text-[var(--suave)]">⚖️ {t('Para comparar uma viagem com outra, é preciso ter pelo menos 2 viagens com compra.')}</p>}

      {/* 3. TODAS AS VIAGENS */}
      <section className="space-y-2">
        <p className="text-xs font-bold uppercase tracking-wider text-[var(--suave)]">{t('Todas as viagens')}</p>
        <TabelaDados<V>
          linhas={lista}
          chave={(x) => x.id}
          onAbrir={(x) => ir('viagem', { id: x.id })}
          colunas={[
            { id: 'viagem', titulo: 'Viagem', classe: 'w-full min-w-[12rem]', celula: (x) => <span><b className="font-mono text-[var(--marca)]">{x.codigo}</b> <span className="font-semibold">{x.nome}</span><span className="block text-xs text-[var(--suave)]">{[x.destino, dataBR(x.inicio), x.viajantes.map((y) => y.nome).join(', ')].filter(Boolean).join(' · ')}</span></span> },
            { id: 'kg', titulo: 'Comprado', direita: true, classe: 'whitespace-nowrap', celula: (x) => kg(x.gramas) },
            { id: 'gasto', titulo: 'Gastos', direita: true, classe: 'whitespace-nowrap', celula: (x) => v(x.gasto) },
            { id: 'custoKg', titulo: 'Custo/kg', direita: true, classe: 'whitespace-nowrap', celula: (x) => <b>{x.custoKgReal !== undefined ? v(x.custoKgReal) : '—'}</b> },
            { id: 'vendido', titulo: 'Vendido', direita: true, classe: 'whitespace-nowrap', celula: (x) => pct(x.pctVendidoBp) },
            { id: 'lucro', titulo: 'Lucro vendido', direita: true, classe: 'whitespace-nowrap', celula: (x) => <span className={cx('font-semibold', x.lucroVendido < 0 && 'text-[var(--ruim)]')}>{v(x.lucroVendido)}</span> },
            { id: 'resultado', titulo: 'Já voltou', direita: true, classe: 'whitespace-nowrap', celula: (x) => <span className={cx('font-bold', x.resultado < 0 ? 'text-[var(--ruim)]' : 'text-[var(--bom)]')}>{v(x.resultado)}</span> },
            { id: 'roi', titulo: 'ROI', direita: true, classe: 'whitespace-nowrap', celula: (x) => pct(x.roiBp) },
          ]}
          celular={{
            titulo: (x) => x.nome,
            valor: (x) => (x.custoKgReal !== undefined ? `${v(x.custoKgReal)}/kg` : '—'),
            valorSub: (x) => kg(x.gramas),
            codigo: (x) => x.codigo,
            situacao: (x) => ({ texto: t(x.status === 'aberta' ? 'Aberta' : 'Encerrada'), tom: x.status === 'aberta' ? 'marca' : 'suave' }),
            resumo: (x) => `${t('gastos')} ${v(x.gasto)} · ${t('lucro do que vendeu')} ${v(x.lucroVendido)}`,
            fatos: (x) => [`↩ ${t('já voltou')} ${v(x.resultado)}`, `📈 ROI ${pct(x.roiBp)}`, `🛒 ${t('{n} compra(s)', { n: x.compras })}`, `💰 ${t('vendido')} ${pct(x.pctVendidoBp)}`],
          }}
        />
      </section>
    </div>
  )
}

/** A × B lado a lado: cada linha com a diferença e quem foi melhor (menor custo, maior resultado…) */
function Comparar({ A, B, opcoes, onA, onB, v }: { A: V; B: V; opcoes: V[]; onA(id: string): void; onB(id: string): void; v(n: number): string }) {
  const t = useT()
  const linhas: { rot: string; a: number | undefined; b: number | undefined; fmt(n: number): string; melhor: 'menor' | 'maior' | '' }[] = [
    { rot: 'Kg comprados', a: A.gramas, b: B.gramas, fmt: kg, melhor: '' },
    { rot: 'Pago pelo cabelo', a: A.custoCabelo, b: B.custoCabelo, fmt: v, melhor: '' },
    { rot: 'Gastos da viagem', a: A.gasto, b: B.gasto, fmt: v, melhor: 'menor' },
    { rot: 'Custo por kg (cabelo)', a: A.custoKg, b: B.custoKg, fmt: v, melhor: 'menor' },
    { rot: 'Custo por kg (com a viagem)', a: A.custoKgReal, b: B.custoKgReal, fmt: v, melhor: 'menor' },
    { rot: 'Vendido até agora', a: A.pctVendidoBp, b: B.pctVendidoBp, fmt: (n) => pct(n), melhor: 'maior' },
    { rot: 'Receita das vendas', a: A.receita, b: B.receita, fmt: v, melhor: 'maior' },
    { rot: 'Lucro do que já vendeu', a: A.lucroVendido, b: B.lucroVendido, fmt: v, melhor: 'maior' },
    { rot: 'Já voltou (receita − investido)', a: A.resultado, b: B.resultado, fmt: v, melhor: 'maior' },
    { rot: 'ROI', a: A.roiBp, b: B.roiBp, fmt: (n) => pct(n), melhor: 'maior' },
  ]
  const opc = opcoes.map((x) => ({ id: x.id, nome: `${x.codigo} · ${x.nome}` }))
  return (
    <section className="overflow-hidden rounded-2xl border border-[var(--borda)] bg-[var(--cartao)] shadow-sm">
      <div className="border-b border-[var(--borda)] px-4 py-3">
        <b>{t('Uma contra a outra')}</b>
        <div className="mt-2 grid grid-cols-[1fr_auto_1fr] items-center gap-2">
          <Selecao valor={A.id} onChange={onA} opcoes={opc} />
          <span className="text-sm font-bold text-[var(--suave)]">×</span>
          <Selecao valor={B.id} onChange={onB} opcoes={opc} />
        </div>
      </div>
      <div className="grid grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)_minmax(0,1fr)] gap-x-3 bg-[var(--fundo)] px-4 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-[var(--suave)]">
        <span />
        <span className="truncate text-right font-mono">{A.codigo}</span>
        <span className="truncate text-right font-mono">{B.codigo}</span>
      </div>
      <ul className="divide-y divide-[var(--borda)]">
        {linhas.map((l) => {
          const ganha = l.melhor && l.a !== undefined && l.b !== undefined && l.a !== l.b ? ((l.melhor === 'menor' ? l.a < l.b : l.a > l.b) ? 'a' : 'b') : undefined
          const cel = (x: number | undefined, lado: 'a' | 'b') => <span className={cx('num whitespace-nowrap text-right text-sm', ganha === lado && 'font-bold text-[var(--bom)]')}>{x === undefined ? '—' : l.fmt(x)}{ganha === lado && ' ✓'}</span>
          return (
            <li key={l.rot} className="grid grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)_minmax(0,1fr)] items-baseline gap-x-3 px-4 py-2">
              <span className="text-sm text-[var(--suave)]">{t(l.rot)}</span>
              {cel(l.a, 'a')}
              {cel(l.b, 'b')}
            </li>
          )
        })}
      </ul>
      <p className="border-t border-[var(--borda)] px-4 py-2 text-xs text-[var(--suave)]">{t('✓ = melhor nessa linha (menor custo, maior lucro). Viagem com cabelo ainda em estoque ainda vai vender: o que já voltou tende a subir.')}</p>
    </section>
  )
}
