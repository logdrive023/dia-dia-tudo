// CAMINHO DO CABELO — o histórico ÚNICO do sistema (Compra, Triagem, Estoque/pacote e Venda usam este, e só este).
// Um componente só, grande, que responde "por onde este cabelo passou e para onde vai":
//   0. A SITUAÇÃO AGORA numa frase ("Agora: no estoque · 3 de 5 com etiqueta · 2 vendas") — o que se quer saber primeiro;
//   1. AS 5 ETAPAS, na ordem do negócio — 🛒 Compra → 📦 Estoque (entra bruto) → ✂️ Triagem → 🏷 Etiqueta → 💰 Venda:
//      ✓ verde = já passou (com o resumo) · destaque "você está aqui" = a etapa desta tela · tracejado = ainda vai passar.
//      Todos os códigos à vista (nada de "+2"); o desta tela vem marcado. Um clique no código abre aquele registro.
//   2. OS FILTROS por etapa (Tudo · Compra · Triagem · Estoque · Venda, com quantos registros cada): tocar numa etapa
//      (no filtro ou no próprio círculo) mostra só o que aconteceu nela.
//   3. O DETALHE de cada etapa, ocupando o espaço que precisar: o registro completo da compra, a conta da triagem
//      (entrou → saiu, perda, quem), o histórico em gramas do pacote, as etiquetas (quais faltam, imprimir) e a venda.
// Boas práticas seguidas: estados completo/atual/não iniciado com nomes curtos (Carbon), situação atual em linguagem
// simples no topo e códigos sempre clicáveis (Baymard), lista vertical com data e título no detalhe.
// O CAMINHO DESTE REGISTRO em destaque: só o que levou até ele e o que veio dele (a venda V-4 mostra P-1 → L-1 → T-1 →
// L-2, L-3 → V-4). O resto da família (outros pacotes do mesmo cabelo, outras vendas) fica recolhido em "outros do
// mesmo cabelo ▾". O registro completo (linha do tempo) só do registro DESTA tela; os outros são uma linha que abre.
// Dados: a consulta "genealogia" (a mesma do rastreio em gramas) + os registros de cada etapa. Quem não é administrador
// não vê a cadeia (o rastreio é do administrador): vê só o registro da própria tela (\`semCadeia\`).

import { type ReactNode, useState } from 'react'
import type { Id } from '../../core/domain/tipos'
import type { ResultadoConsulta } from '../../core/services'
import { cx, dataBR, gramasTexto, pctBp } from './base'
import { useApp, useConsulta, useParamTela } from './contexto'
import { HistoricoPacote } from './historicoPacote'
import { useT } from './i18n'
import { LinhaDoTempo } from './linhaTempo'

export type EtapaCabelo = 'compra' | 'triagem' | 'estoque' | 'etiqueta' | 'venda'

const ICONE: Record<EtapaCabelo, string> = { compra: '🛒', triagem: '✂️', estoque: '📦', etiqueta: '🏷', venda: '💰' }
const NOME: Record<EtapaCabelo, string> = { compra: 'Compra', triagem: 'Triagem', estoque: 'Estoque', etiqueta: 'Etiqueta', venda: 'Venda' }

export function CaminhoDoCabelo({ de, atual, compacto, semCadeia, className }: {
  /** de onde olhar a cadeia: a compra, o pacote, a venda ou a triagem */
  de: { compraId: Id } | { itemId: Id } | { vendaId: Id } | { triagemId: Id }
  /** a etapa desta tela (fica em destaque) */
  atual: EtapaCabelo
  /** só as etapas (sem filtros nem detalhe): dentro de um cartão de lista */
  compacto?: boolean
  /** o que mostrar quando não há cadeia para ver (quem não é administrador): o registro desta tela */
  semCadeia?: ReactNode
  className?: string
}) {
  const t = useT()
  const { ir } = useApp()
  const { dados: g } = useConsulta('genealogia', de)
  const [filtroUrl, setFiltro] = useParamTela('etapa', '')
  const filtro = filtroUrl as EtapaCabelo | ''
  if (!g) return semCadeia ? <section className={cx('rounded-2xl border border-[var(--borda)] bg-[var(--cartao)] p-3 shadow-sm sm:p-4', className)}>{semCadeia}</section> : null
  const itemDaTela = 'itemId' in de ? de.itemId : undefined
  const vendaDaTela = 'vendaId' in de ? de.vendaId : undefined
  const compraDaTela = 'compraId' in de ? de.compraId : undefined
  const proprio = caminhoProprio(g, de)
  const meu = (id: Id) => proprio.has(id)
  const compras = g.compras.filter((c) => meu(c.id))
  const triagens = g.triagens.filter((x) => meu(x.id))
  const lotes = g.lotes.filter((l) => !l.bruto && meu(l.id))
  // a compra entra no estoque como BRUTO (o primeiro registro do estoque); os que já foram triados ficam com "já triado"
  const brutos = g.lotes.filter((l) => l.bruto && meu(l.id))
  const noEstoque = [...brutos, ...lotes]
  // vendas: a desta tela primeiro
  const vendas = [...g.vendas.filter((v) => meu(v.id))].sort((a, b) => Number(b.id === vendaDaTela) - Number(a.id === vendaDaTela))
  // o resto da família (recolhido)
  const outros = {
    compra: g.compras.filter((c) => !meu(c.id)).map((c) => ({ id: c.id, codigo: c.codigo, info: [c.fornecedor, c.data && dataBR(c.data)].filter(Boolean).join(' · '), valor: gramasTexto(c.g), abrir: () => ir('pedido', { id: c.id }) })),
    estoque: g.lotes.filter((l) => !meu(l.id)).map((l) => ({ id: l.id, codigo: l.codigo, info: l.nome, valor: l.saldo > 0 ? gramasTexto(l.saldo) : t('sem saldo'), abrir: () => ir('lote', { id: l.id }) })),
    triagem: g.triagens.filter((x) => !meu(x.id)).map((x) => ({ id: x.id, codigo: x.codigo, info: x.por, abrir: () => ir('triagem', { aba: 'triagens', t: x.id }) })),
    etiqueta: [] as ItemEtapa[],
    venda: g.vendas.filter((v) => !meu(v.id)).map((v) => ({ id: v.id, codigo: v.codigo, info: [v.cliente, v.data && dataBR(v.data)].filter(Boolean).join(' · '), valor: gramasTexto(v.g), abrir: () => ir('venda', { id: v.id }) })),
  } satisfies Record<EtapaCabelo, ItemEtapa[]>
  const vendaAqui = vendaDaTela ? g.vendas.find((v) => v.id === vendaDaTela) : undefined
  const loteAqui = itemDaTela ? g.lotes.find((l) => l.id === itemDaTela) : undefined
  /** o que entrou de verdade no estoque como bruto (o comprado menos a conferência de peso) */
  const entrouBruto = (l: (typeof g.lotes)[number]) => l.entrou - Math.max(0, l.ajustes)
  const comprado = compras.reduce((s, c) => s + c.g, 0) || g.totais.entrou
  const veioSeparado = !triagens.length && lotes.length > 0
  const comSaldo = lotes.filter((l) => l.saldo > 0)
  const semEtiqueta = comSaldo.filter((l) => !l.etiquetaEm)
  const etapas: { id: EtapaCabelo; feito: boolean; resumo: string; detalhe?: string; n: number; itens: { id: Id; codigo?: string; desta?: boolean; info?: string; valor?: string; abrir(): void }[] }[] = [
    {
      id: 'compra', feito: compras.length > 0, n: compras.length,
      resumo: compras.length ? `${gramasTexto(comprado)}${compras.some((c) => c.fornecedor) ? ` · ${[...new Set(compras.map((c) => c.fornecedor).filter(Boolean))].join(', ')}` : ''}` : t('ainda não'),
      detalhe: compras[0]?.data ? dataBR(compras[0].data) : undefined,
      itens: compras.map((c) => ({ id: c.id, codigo: c.codigo, desta: 'compraId' in de && de.compraId === c.id, info: [c.fornecedor, c.data && dataBR(c.data)].filter(Boolean).join(' · '), valor: gramasTexto(c.g), abrir: () => ir('pedido', { id: c.id }) })),
    },
    {
      id: 'estoque', feito: noEstoque.length > 0, n: noEstoque.length,
      resumo: lotes.length ? `${t('{n} pacote(s)', { n: noEstoque.length })} · ${t('{g} agora', { g: gramasTexto(noEstoque.reduce((s, l) => s + Math.max(0, l.saldo), 0)) })}` : brutos.some((l) => l.saldo > 0) ? `${gramasTexto(brutos.reduce((s, l) => s + l.saldo, 0))} ${t('bruto · aguardando triagem')}` : t('ainda não'),
      detalhe: brutos.length ? t('entrou bruto: {g}', { g: gramasTexto(brutos.reduce((s, l) => s + entrouBruto(l), 0)) }) : undefined,
      itens: [...noEstoque].sort((a, b) => Number(b.id === itemDaTela) - Number(a.id === itemDaTela)).map((l) => ({ id: l.id, codigo: l.codigo, desta: l.id === itemDaTela, info: l.bruto ? `${t('entrou bruto')} · ${t(l.saldo > 0 ? 'aguardando triagem' : 'já triado')}` : l.nome, valor: l.saldo > 0 ? gramasTexto(l.saldo) : l.bruto ? gramasTexto(entrouBruto(l)) : t('sem saldo'), abrir: () => ir('lote', { id: l.id }) })),
    },
    {
      id: 'triagem', feito: triagens.length > 0 || veioSeparado, n: triagens.length,
      resumo: triagens.length
        ? `${gramasTexto(triagens.reduce((s, x) => s + x.entradas.reduce((a, e) => a + e.g, 0), 0))} → ${gramasTexto(triagens.reduce((s, x) => s + x.saidas.reduce((a, e) => a + e.g, 0), 0))}`
        : veioSeparado ? t('já veio separado da compra') : t('ainda não separado'),
      detalhe: triagens.length ? [`${t('perda')} ${pctBp(triagens[0].perdaPct)}`, triagens[0].por, triagens[0].em && dataBR(triagens[0].em)].filter(Boolean).join(' · ') : veioSeparado ? t('por medida, pela tabela') : undefined,
      itens: triagens.length
        ? triagens.map((x) => ({ id: x.id, codigo: x.codigo, desta: 'triagemId' in de && de.triagemId === x.id, info: [x.por, `${t('perda')} ${pctBp(x.perdaPct)}`].filter(Boolean).join(' · '), valor: `${gramasTexto(x.entradas.reduce((a, e) => a + e.g, 0))} → ${gramasTexto(x.saidas.reduce((a, e) => a + e.g, 0))}`, abrir: () => ir('triagem', { aba: 'triagens', t: x.id }) }))
        : veioSeparado ? compras.map((c) => ({ id: `sep-${c.id}`, codigo: c.codigo, info: t('separado por medida na compra (pela tabela)'), valor: t('ver a compra'), abrir: () => ir('pedido', { id: c.id }) })) : [],
    },
    {
      id: 'etiqueta', feito: comSaldo.length > 0 ? semEtiqueta.length === 0 : lotes.length > 0, n: lotes.filter((l) => l.etiquetaEm).length,
      resumo: !lotes.length ? t('ainda não') : comSaldo.length ? (semEtiqueta.length ? t('{c} de {n} com etiqueta', { c: comSaldo.length - semEtiqueta.length, n: comSaldo.length }) : t('todos com etiqueta')) : lotes.some((l) => l.etiquetaEm) ? t('{n} etiqueta(s) impressa(s)', { n: lotes.filter((l) => l.etiquetaEm).length }) : t('saiu sem etiqueta (já vendido)'),
      detalhe: semEtiqueta.length ? t('falta imprimir {n}', { n: semEtiqueta.length }) : undefined,
      itens: lotes.map((l) => ({ id: l.id, codigo: l.codigo, desta: l.id === itemDaTela, info: l.etiquetaEm ? `${l.nome} · ${t('impressa')} ${dataBR(l.etiquetaEm)}${l.etiquetaPor ? ` · ${l.etiquetaPor}` : ''}` : l.nome, valor: l.etiquetaEm ? `✓ ${t('etiqueta')}` : l.saldo > 0 ? `🖨 ${t('imprimir')}` : t('sem saldo'), abrir: () => (l.etiquetaEm || l.saldo <= 0 ? ir('lote', { id: l.id }) : ir('etiquetas', { f: 'todas', sel: l.id })) })),
    },
    {
      id: 'venda', feito: vendas.length > 0, n: vendas.length,
      resumo: vendas.length ? `${t('{n} venda(s)', { n: vendas.length })} · ${gramasTexto(vendas.reduce((s, v) => s + v.g, 0))}` : t('ainda não vendido'),
      detalhe: vendas.length ? [...new Set(vendas.map((v) => v.cliente).filter(Boolean))].slice(0, 3).join(', ') || undefined : undefined,
      itens: vendas.map((v) => ({ id: v.id, codigo: v.codigo, desta: v.id === vendaDaTela, info: [v.cliente, v.data && dataBR(v.data)].filter(Boolean).join(' · '), valor: gramasTexto(v.g), abrir: () => ir('venda', { id: v.id }) })),
    },
  ]
  const mostrar = (e: EtapaCabelo) => !filtro || filtro === e

  return (
    // DUAS PARTES SEPARADAS (dois cartões com espaço entre eles): as etapas e o detalhe — antes era um bloco só e o
    // detalhe "colava" na última etapa
    <div className={cx('space-y-4', className)}>
    <section aria-label={t('Caminho do cabelo')} className="overflow-hidden rounded-2xl border border-[var(--borda)] bg-[var(--cartao)] shadow-sm">
      {/* 1. AS ETAPAS */}
      <div className="bg-[linear-gradient(180deg,var(--marca-suave),transparent)] px-3 pb-6 pt-4 sm:px-5 sm:pb-8 sm:pt-5">
        <div className="mb-4 flex flex-wrap items-baseline gap-x-2">
          <h2 className="text-base font-bold sm:text-lg">🧬 {t('Caminho do cabelo')}</h2>
          <span className="text-xs text-[var(--suave)]">{t('por onde ele passou e para onde vai · toque num código para abrir')}</span>
        </div>
        {/* 0. A SITUAÇÃO AGORA, em uma frase */}
        <p className="num mb-4 rounded-xl bg-[var(--cartao)] px-3 py-2 text-sm shadow-sm ring-1 ring-[var(--borda)]">
          <b>{t('Agora')}:</b> {(vendaAqui
            ? [vendaAqui.cliente ? t('vendido para {c}', { c: vendaAqui.cliente }) : t('vendido (sem cliente)'), `${gramasTexto(vendaAqui.g)} ${t('de')} ${vendaAqui.lotes.map((l) => l.codigo ?? '—').join(', ')}`]
            : loteAqui
              ? [loteAqui.saldo > 0 ? t('{g} neste pacote', { g: gramasTexto(loteAqui.saldo) }) : t('pacote vazio'), loteAqui.bruto ? t('esperando triagem') : loteAqui.etiquetaEm ? t('com etiqueta') : t('sem etiqueta'), vendas.length ? t('{n} venda(s)', { n: vendas.length }) : t('nada vendido ainda')]
              : [
                  noEstoque.some((l) => l.saldo > 0) ? t('{g} no estoque', { g: gramasTexto(noEstoque.reduce((s, l) => s + Math.max(0, l.saldo), 0)) }) : vendas.length ? t('tudo vendido') : t('sem saldo'),
                  lotes.length ? (semEtiqueta.length ? t('{n} sem etiqueta', { n: semEtiqueta.length }) : t('etiquetas em dia')) : t('ainda não separado'),
                  vendas.length ? t('{n} venda(s)', { n: vendas.length }) : t('nada vendido ainda'),
                ]).join(' · ')}
        </p>
        <ol className="space-y-0">
          {etapas.map((e, k) => {
            const aqui = e.id === atual
            const estado = aqui ? 'aqui' : e.feito ? 'feito' : 'falta'
            const ligadoProximo = etapas[k + 1] && (etapas[k + 1].feito || etapas[k + 1].id === atual)
            return (
              <li key={e.id} className="relative flex gap-3 pb-5 last:pb-0 sm:gap-4">
                {k < etapas.length - 1 && <span aria-hidden className={cx('absolute left-[23px] top-12 h-[calc(100%-3rem)]', ligadoProximo ? 'w-1 bg-[var(--bom)]' : 'w-0 border-l-2 border-dashed border-[var(--borda)]')} />}
                {/* o círculo é também o filtro da etapa */}
                <button type="button" onClick={() => !compacto && setFiltro(filtro === e.id ? '' : e.id)} aria-pressed={!compacto ? filtro === e.id : undefined} aria-label={`${t(NOME[e.id])} · ${t(estado === 'aqui' ? 'você está aqui' : estado === 'feito' ? 'já passou' : 'ainda vai passar')}`}
                  className={cx('relative z-10 flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-xl transition', compacto ? 'cursor-default' : 'hover:scale-105',
                    estado === 'aqui' ? 'bg-[linear-gradient(135deg,var(--marca),color-mix(in_srgb,var(--marca)_70%,#ec4899))] text-white shadow-[0_0_0_5px_var(--marca-suave)]' : estado === 'feito' ? 'bg-[var(--bom)] text-white shadow-sm' : 'border-2 border-dashed border-[var(--borda)] bg-[var(--cartao)] grayscale',
                    filtro === e.id && 'ring-2 ring-[var(--texto)] ring-offset-2')}>
                  {estado === 'feito' ? '✓' : ICONE[e.id]}
                </button>
                {/* a etapa que JÁ ACONTECEU (ou a desta tela) é um cartão próprio — cada uma se distingue da outra mesmo
                    com muitas; a que AINDA VAI PASSAR é só uma linha apagada (não disputa a atenção) */}
                {estado === 'falta' && !e.itens.length ? (
                  <p className="num flex min-h-12 min-w-0 flex-1 flex-wrap items-center gap-x-2 gap-y-0.5 text-sm text-[var(--suave)]">
                    <b>{t(NOME[e.id])}</b>
                    <span className="rounded-full bg-[var(--fundo)] px-2 py-0.5 text-[11px] font-bold">{t('ainda vai passar')}</span>
                    {e.n > 0 && <span>· {e.resumo}</span>}
                  </p>
                ) : (
                <div className={cx('min-w-0 flex-1 rounded-xl bg-[var(--cartao)] p-3 shadow-sm ring-1', estado === 'aqui' ? 'ring-2 ring-[var(--marca)]/60' : estado === 'falta' ? 'border border-dashed border-[var(--borda)] shadow-none ring-0' : 'ring-[var(--borda)]')}>
                  <p className="flex flex-wrap items-center gap-1.5">
                    <b className={cx('text-base', estado === 'falta' && 'text-[var(--suave)]')}>{ICONE[e.id]} {t(NOME[e.id])}</b>
                    <span className={cx('rounded-full px-2 py-0.5 text-[11px] font-bold', estado === 'aqui' ? 'bg-[var(--marca)] text-white' : estado === 'feito' ? 'bg-[var(--bom)]/12 text-[var(--bom)]' : 'bg-[var(--fundo)] text-[var(--suave)]')}>
                      {t(estado === 'aqui' ? 'você está aqui' : estado === 'feito' ? 'já passou' : 'ainda vai passar')}
                    </span>
                  </p>
                  <p className={cx('num mt-1 text-sm', estado === 'falta' ? 'text-[var(--suave)]' : 'font-semibold')}>{e.resumo}</p>
                  {e.detalhe && <p className="num mt-0.5 text-xs text-[var(--suave)]">{e.detalhe}</p>}
                  {e.itens.length > 0 && <ListaItens itens={e.itens} />}
                  {!compacto && outros[e.id].length > 0 && <Outros itens={outros[e.id]} />}
                </div>
                )}
              </li>
            )
          })}
        </ol>
      </div>
    </section>

      {!compacto && <section aria-label={t('Detalhe de cada etapa')} className="overflow-hidden rounded-2xl border border-[var(--borda)] bg-[var(--cartao)] shadow-sm">
        {/* 2. O DETALHE: um cartão próprio, com o título dizendo o que é e a escolha da etapa logo em cima (só as que têm
            registro; o resto some — nada de "Compra 0") */}
        <div className="border-b border-[var(--borda)] px-3 pb-3 pt-4 sm:px-5">
          <div className="mb-2 flex flex-wrap items-baseline gap-x-2">
            <h3 className="text-base font-bold">📋 {t('Detalhe de cada etapa')}</h3>
            <span className="text-xs text-[var(--suave)]">{t('escolha uma etapa para ver só ela')}</span>
          </div>
          <div role="radiogroup" aria-label={t('Ver o detalhe de')} className="sem-barra -mx-1 flex gap-1 overflow-x-auto rounded-xl bg-[var(--fundo)] p-1">
            {[{ id: '' as const, nome: t('Tudo'), n: etapas.reduce((s, e) => s + e.n, 0) }, ...etapas.filter((e) => e.n > 0 || filtro === e.id).map((e) => ({ id: e.id, nome: `${ICONE[e.id]} ${t(NOME[e.id])}`, n: e.n }))].map((f) => (
              <button key={f.id || 'tudo'} type="button" role="radio" aria-checked={filtro === f.id} onClick={() => setFiltro(f.id)}
                className={cx('inline-flex min-h-10 shrink-0 items-center gap-1.5 rounded-lg px-3 text-sm font-semibold transition', filtro === f.id ? 'bg-[var(--cartao)] text-[var(--marca)] shadow' : 'text-[var(--suave)] hover:text-[var(--texto)]')}>
                {f.nome}<span className={cx('num rounded-full px-1.5 text-[11px]', filtro === f.id ? 'bg-[var(--marca-suave)]' : 'bg-[var(--cartao)]')}>{f.n}</span>
              </button>
            ))}
          </div>
        </div>

        {/* 3. O DETALHE DE CADA ETAPA (só as do filtro) */}
        <div className="space-y-4 bg-[var(--fundo)] p-3 sm:p-5">
          {mostrar('compra') && (
            <Bloco icone="🛒" titulo="Compra" vazio={!compras.length && t('Ainda não há compra ligada a este cabelo.')}>
              {compras.map((c, k) => (
                <div key={c.id} className="space-y-3">
                  <Cabeca codigo={c.codigo} nome={c.fornecedor} data={c.data && dataBR(c.data)} valor={gramasTexto(c.g)} onAbrir={() => ir('pedido', { id: c.id })} rotulo="Abrir pedido" destaque={'compraId' in de && de.compraId === c.id} />
                  {c.id === compraDaTela && <LinhaDoTempo id={c.id} prefixo={`cc${k}`} simples />}
                </div>
              ))}
            </Bloco>
          )}
          {mostrar('estoque') && (
            <Bloco icone="📦" titulo="Estoque" vazio={!noEstoque.length && t('Ainda não há pacote no estoque.')}>
              {itemDaTela ? (
                <div className="space-y-2">
                  <p className="text-xs font-semibold uppercase tracking-wide text-[var(--suave)]">{t('Este pacote, grama a grama')}</p>
                  <HistoricoPacote id={itemDaTela} />
                </div>
              ) : null}
              {noEstoque.filter((l) => l.id !== itemDaTela).length > 0 && (
                <ul className="divide-y divide-[var(--borda)] overflow-hidden rounded-xl border border-[var(--borda)]">
                  {noEstoque.filter((l) => l.id !== itemDaTela).map((l) => (
                    <li key={l.id}>
                      <button type="button" onClick={() => ir('lote', { id: l.id })} className="num flex min-h-12 w-full flex-wrap items-center gap-x-3 gap-y-0.5 px-3 py-2 text-left text-sm hover:bg-[var(--fundo)]">
                        <b className="font-mono text-[var(--marca)]">{l.codigo ?? '—'}</b>
                        <span className="min-w-0 flex-1 truncate">{l.nome}</span>
                        <span className="text-xs text-[var(--suave)]">{t('entrou')} {gramasTexto(l.bruto ? entrouBruto(l) : l.entrou)} · {t('vendeu')} {gramasTexto(l.vendido)}</span>
                        <b>{gramasTexto(l.saldo)}</b>
                        <span aria-hidden className="text-[var(--suave)]">›</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </Bloco>
          )}
          {mostrar('triagem') && (
            <Bloco icone="✂️" titulo="Triagem" vazio={!triagens.length && (veioSeparado ? t('Não passou por triagem: já veio separado por medida na compra (pela tabela).') : t('Ainda não foi separado. Quando separar, a conta aparece aqui.'))}>
              {triagens.map((x) => (
                <div key={x.id} className="rounded-xl border border-[var(--borda)] p-3">
                  <Cabeca codigo={x.codigo} nome={x.por} data={x.em && dataBR(x.em)} destaque={'triagemId' in de && de.triagemId === x.id} onAbrir={() => ir('triagem', { aba: 'triagens', t: x.id })} rotulo="Abrir triagem" />
                  <div className="num mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
                    <span>{t('Entrou')} <b>{gramasTexto(x.entradas.reduce((a, e) => a + e.g, 0))}</b></span>
                    <span aria-hidden className="text-[var(--suave)]">→</span>
                    <span>{t('Saiu')} <b className="text-[var(--bom)]">{gramasTexto(x.saidas.reduce((a, e) => a + e.g, 0))}</b></span>
                    <span className="rounded-full bg-[var(--alerta)]/12 px-2 py-0.5 text-xs font-bold text-[var(--alerta)]">{t('perda')} {pctBp(x.perdaPct)} · {gramasTexto(x.perda)}</span>
                  </div>
                  <p className="mt-2 flex flex-wrap items-center gap-1 text-xs text-[var(--suave)]">
                    {t('Entrou')}: {x.entradas.map((e) => <Codigo key={e.id} codigo={e.codigo} onClick={() => ir('lote', { id: e.id })} />)}
                    <span className="mx-1">→</span>
                    {t('Virou')}: {x.saidas.map((e) => <Codigo key={e.id} codigo={e.codigo} onClick={() => ir('lote', { id: e.id })} />)}
                  </p>
                </div>
              ))}
            </Bloco>
          )}
          {mostrar('etiqueta') && (
            <Bloco icone="🏷" titulo="Etiqueta" vazio={!lotes.length && t('Ainda não há pacote para etiquetar.')}>
              <ul className="divide-y divide-[var(--borda)] overflow-hidden rounded-xl border border-[var(--borda)]">
                {lotes.map((l) => (
                  <li key={l.id} className="num flex min-h-12 flex-wrap items-center gap-x-3 gap-y-0.5 px-3 py-2 text-sm">
                    <button type="button" onClick={() => ir('lote', { id: l.id })} className={cx('rounded-md px-1.5 py-0.5 font-mono font-bold', l.id === itemDaTela ? 'bg-[var(--marca)] text-white' : 'bg-[var(--marca-suave)] text-[var(--marca)]')}>{l.codigo ?? '—'}</button>
                    <span className="min-w-0 flex-1 truncate">{l.nome}</span>
                    {l.etiquetaEm
                      ? <span className="text-xs font-semibold text-[var(--bom)]">✓ {t('impressa')} {dataBR(l.etiquetaEm)}{l.etiquetaPor ? ` · ${l.etiquetaPor}` : ''}</span>
                      : l.saldo > 0 ? <span className="text-xs font-semibold text-[var(--alerta)]">🏷 {t('sem etiqueta')}</span> : <span className="text-xs text-[var(--suave)]">{t('sem saldo')}</span>}
                  </li>
                ))}
              </ul>
              {semEtiqueta.length > 0 && <button type="button" onClick={() => ir('etiquetas', { f: 'todas', sel: semEtiqueta.map((l) => l.id).join(',') })} className="min-h-11 rounded-xl bg-[var(--marca)] px-4 text-sm font-semibold text-white hover:brightness-110">🖨 {t(semEtiqueta.length === 1 ? 'Imprimir a que falta' : 'Imprimir as {n} que faltam', { n: semEtiqueta.length })}</button>}
            </Bloco>
          )}
          {mostrar('venda') && (
            <Bloco icone="💰" titulo="Venda" vazio={!vendas.length && t('Ainda não foi vendido.')}>
              {vendas.map((v, k) => (
                <div key={v.id} className="space-y-3">
                  <Cabeca codigo={v.codigo} nome={v.cliente} data={v.data && dataBR(v.data)} valor={gramasTexto(v.g)} onAbrir={v.id === vendaDaTela ? undefined : () => ir('venda', { id: v.id })} rotulo="Abrir venda" destaque={v.id === vendaDaTela} />
                  {/* o registro completo só da venda desta tela; as outras numa linha (um toque abre) */}
                  {v.id === vendaDaTela && <LinhaDoTempo id={v.id} prefixo={`cv${k}`} simples />}
                </div>
              ))}
            </Bloco>
          )}
        </div>
      </section>}
    </div>
  )
}

type ItemEtapa = { id: Id; codigo?: string; desta?: boolean; info?: string; valor?: string; abrir(): void }

/**
 * O CAMINHO PRÓPRIO do registro (ids): o que levou até ele (para trás) e o que saiu dele (para a frente).
 *  · compra → tudo o que veio dela   · pacote → de onde veio + para onde foi   · triagem → as entradas para trás e as
 *    saídas para a frente   · venda → só de onde veio (as outras vendas do mesmo pacote NÃO são o caminho dela)
 */
export function caminhoProprio(g: NonNullable<ResultadoConsulta<'genealogia'>>, de: { compraId: Id } | { itemId: Id } | { vendaId: Id } | { triagemId: Id }) {
  const lote = new Map(g.lotes.map((l) => [l.id, l]))
  const triagem = new Map(g.triagens.map((x) => [x.id, x]))
  const compra = new Map(g.compras.map((c) => [c.id, c]))
  const venda = new Map(g.vendas.map((v) => [v.id, v]))
  const ids = new Set<Id>()
  // visitados À PARTE por sentido e por tipo: a triagem da UNIFICAÇÃO tem o MESMO id do pacote misturado — misturar os
  // dois num conjunto só fazia o caminho parar no meio (a mistura aparecia sem compra de origem)
  const atrasL = new Set<Id>()
  const frenteL = new Set<Id>()
  const vistasT = new Set<Id>()
  const tras = (id: Id) => {
    if (atrasL.has(id)) return
    atrasL.add(id)
    ids.add(id)
    const l = lote.get(id)
    // de onde veio: triagem (as entradas dela), outro pacote (segue até a compra dele) ou a compra
    if (l) for (const x of l.de) {
      if (x.tipo === 'triagem') { const k = 'T:' + x.id; if (!vistasT.has(k)) { vistasT.add(k); ids.add(x.id); for (const e of triagem.get(x.id)?.entradas ?? []) tras(e.id) } }
      else if (lote.has(x.id)) tras(x.id)
      else ids.add(x.id)
    }
  }
  const frente = (id: Id) => {
    if (frenteL.has(id)) return
    frenteL.add(id)
    ids.add(id)
    const c = compra.get(id)
    if (c) for (const x of c.lotes) frente(x.id)
    const l = lote.get(id)
    if (l) for (const x of l.para) {
      if (x.tipo === 'triagem') { const k = 'F:' + x.id; if (!vistasT.has(k)) { vistasT.add(k); ids.add(x.id); for (const s of triagem.get(x.id)?.saidas ?? []) frente(s.id) } }
      else ids.add(x.id)
    }
  }
  if ('compraId' in de) frente(de.compraId)
  else if ('itemId' in de) { tras(de.itemId); frente(de.itemId) }
  else if ('vendaId' in de) { ids.add(de.vendaId); for (const l of venda.get(de.vendaId)?.lotes ?? []) tras(l.id) }
  else { ids.add(de.triagemId); const x = triagem.get(de.triagemId); for (const e of x?.entradas ?? []) tras(e.id); for (const s of x?.saidas ?? []) frente(s.id) }
  return ids
}

/** a lista de registros de uma etapa (código · o que é · quanto ›) */
function ListaItens({ itens, apagado }: { itens: ItemEtapa[]; apagado?: boolean }) {
  const t = useT()
  return (
    <ul className={cx('mt-2.5 divide-y divide-[var(--borda)] overflow-hidden rounded-xl border border-[var(--borda)] bg-[var(--cartao)]', apagado && 'opacity-80')}>
      {itens.map((x) => (
        <li key={x.id}>
          <button type="button" onClick={x.abrir} title={t('Abrir')} className={cx('num flex min-h-11 w-full items-center gap-2 px-3 py-1.5 text-left text-sm transition hover:bg-[var(--marca-suave)]', x.desta && 'bg-[var(--marca-suave)]')}>
            <b className={cx('shrink-0 rounded-md px-1.5 py-0.5 font-mono text-xs', x.desta ? 'bg-[var(--marca)] text-white' : apagado ? 'bg-[var(--fundo)] text-[var(--suave)]' : 'bg-[var(--marca-suave)] text-[var(--marca)]')}>{x.codigo ?? '—'}</b>
            <span className="min-w-0 flex-1 truncate text-[var(--suave)]">{x.desta && <b className="mr-1 text-[var(--marca)]">{t('este')} ·</b>}{x.info}</span>
            {x.valor && <b className="shrink-0 whitespace-nowrap">{x.valor}</b>}
            <span aria-hidden className="shrink-0 text-[var(--suave)]">›</span>
          </button>
        </li>
      ))}
    </ul>
  )
}

/** "outros do mesmo cabelo (N) ▾": a família que não é o caminho deste registro, fechada por padrão */
function Outros({ itens }: { itens: ItemEtapa[] }) {
  const t = useT()
  const [aberto, setAberto] = useState(false)
  return (
    <div className="mt-1.5">
      <button type="button" aria-expanded={aberto} onClick={() => setAberto(!aberto)} className="-ml-2 inline-flex min-h-9 items-center gap-1 rounded-lg px-2 text-xs font-semibold text-[var(--suave)] hover:bg-[var(--cartao)] hover:text-[var(--marca)]">
        {t('outros do mesmo cabelo ({n})', { n: itens.length })}<span aria-hidden className={cx('transition-transform', aberto && 'rotate-180')}>▾</span>
      </button>
      {aberto && <ListaItens itens={itens} apagado />}
    </div>
  )
}

function Bloco({ icone, titulo, vazio, children }: { icone: string; titulo: string; vazio?: string | false; children: ReactNode }) {
  const t = useT()
  return (
    <section aria-label={t(titulo)} className="overflow-hidden rounded-2xl border border-[var(--borda)] bg-[var(--cartao)] shadow-sm">
      <h3 className="flex items-center gap-2.5 border-b border-[var(--borda)] px-4 py-3 text-base font-bold"><span aria-hidden className="flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--fundo)]">{icone}</span>{t(titulo)}</h3>
      <div className="p-4">
        {vazio ? <p className="text-sm text-[var(--suave)]">{vazio}</p> : <div className="space-y-4">{children}</div>}
      </div>
    </section>
  )
}

/** Cabeça de um registro (compra, venda) dentro da etapa: código · quem (em destaque) · data · quanto — cada um no seu lugar. */
function Cabeca({ codigo, nome, data, valor, onAbrir, rotulo, destaque }: { codigo?: string; nome?: string; data?: string | false; valor?: string; onAbrir?(): void; rotulo: string; destaque?: boolean }) {
  const t = useT()
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-xl bg-[var(--fundo)] px-3 py-2 ring-1 ring-[var(--borda)]">
      <b className={cx('shrink-0 rounded-lg px-2 py-0.5 font-mono text-sm', destaque ? 'bg-[var(--marca)] text-white' : 'bg-[var(--marca-suave)] text-[var(--marca)]')}>{codigo ?? '—'}</b>
      <span className="min-w-0 flex-[1_1_8rem]">
        <b className="block truncate">{nome || '—'}</b>
        {(data || destaque) && <span className="num block text-xs text-[var(--suave)]">{data}{destaque && <b className="text-[var(--marca)]">{data ? ' · ' : ''}{t('este')}</b>}</span>}
      </span>
      {valor && <b className="num shrink-0 text-lg">{valor}</b>}
      {onAbrir && <button type="button" onClick={onAbrir} className="-mr-1 min-h-10 shrink-0 rounded-lg px-2 text-sm font-semibold text-[var(--marca)] hover:bg-[var(--cartao)]">{t(rotulo)} →</button>}
    </div>
  )
}

function Codigo({ codigo, onClick }: { codigo?: string; onClick(): void }) {
  return <button type="button" onClick={onClick} className="rounded-md bg-[var(--marca-suave)] px-1.5 py-0.5 font-mono font-bold text-[var(--marca)] hover:brightness-95">{codigo ?? '—'}</button>
}
