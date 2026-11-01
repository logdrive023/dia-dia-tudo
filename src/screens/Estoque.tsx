// ESTOQUE: lotes/itens com saldo, filtros por medida e categoria, SEPARAR lote bruto em N lotes, ajustar,
// ficha do lote (de onde veio, para onde foi) e RASTREIO compra → vendas.

import { useState } from 'react'
import { formatar } from '../core/domain/dinheiro'
import { novoId } from '../core/domain/ids'
import type { Campos, Id } from '../core/domain/tipos'
import type { NoRastreio } from '../core/services/estoque'
import { fatorDaTabela } from '../core/services/precos'
import { Abas, Botao, Campo, Carregando, Cartao, Entrada, GramasInput, Janela, Pilula, Selecao, Titulo, Vazio, cx, dataBR, fmt, gramasTexto } from '../ui/base'
import { useApp, useComando, useConsulta } from '../ui/contexto'
import { Anexos } from '../ui/compartilhados'
import { LinhaDoTempo } from '../ui/linhaTempo'
import { useT } from '../ui/i18n'

const CATS = ['Normal', 'Tinte', 'CH', 'CH+', 'Rojo', 'Quemado', 'Menudo', 'Entresaque']

export function Estoque() {
  const t = useT()
  const { nav, ir } = useApp()
  const { dados: cfg } = useConsulta('configuracoes', {})
  const modulos = (cfg?.modulos ?? []).filter((m) => cfg?.config.modulosAtivos.includes(m.id) && m.tiposItem.some((x) => x.controlaEstoque))
  const [modulo, setModulo] = useState<string>((nav.params.modulo as string) ?? 'cabelo')
  const [busca, setBusca] = useState('')
  const [categoria, setCategoria] = useState('')
  const [soBrutos, setSoBrutos] = useState(!!nav.params.bruto)
  const [separar, setSeparar] = useState<Id>()
  const [ajustar, setAjustar] = useState<Id>()
  const { dados } = useConsulta('estoque', { moduloId: modulo, somenteComSaldo: !nav.params.repor })
  const lista = (dados ?? [])
    .filter((i) => !soBrutos || i.campos.estado === 'Bruto')
    .filter((i) => !categoria || String(i.campos.categoria || 'Normal') === categoria)
    .filter((i) => !nav.params.repor || i.repor > 0)
    .filter((i) => !busca || `${i.codigo} ${i.nome}`.toLowerCase().includes(busca.toLowerCase()))
  const total = lista.reduce((s, i) => s + i.saldo, 0)
  const unidade = lista[0]?.unidade ?? (modulo === 'cabelo' ? 'grama' : 'peca')
  const porMedida = new Map<string, number>()
  if (modulo === 'cabelo') for (const i of lista) porMedida.set(String(i.campos.comprimento ?? '—'), (porMedida.get(String(i.campos.comprimento ?? '—')) ?? 0) + i.saldo)

  return (
    <div>
      <Titulo subtitulo={t('Cada número é a soma dos movimentos: nada some, tudo tem histórico.')}>{t('Estoque')}</Titulo>
      <Abas atual={modulo} onChange={setModulo} abas={modulos.map((m) => ({ id: m.id, nome: `${m.icone} ${t(m.nome)}` }))} />
      <div className="mb-3 flex flex-wrap gap-2">
        <Entrada className="w-auto flex-1" placeholder={t('Buscar por código ou nome')} value={busca} onChange={(e) => setBusca(e.target.value)} />
        {modulo === 'cabelo' && (
          <>
            <Selecao className="w-auto" valor={categoria} onChange={setCategoria} vazio="Todas as categorias" opcoes={CATS.map((c) => ({ id: c, nome: c }))} />
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" className="h-5 w-5" checked={soBrutos} onChange={(e) => setSoBrutos(e.target.checked)} /> {t('Só brutos (para separar)')}</label>
          </>
        )}
      </div>
      <div className="mb-3 grid grid-cols-2 gap-2 md:grid-cols-4">
        <Cartao><div className="text-xs text-[var(--suave)]">{t('Total')}</div><div className="num text-xl font-bold">{fmt(total, unidade === 'grama' ? 'gramas' : 'numero')}</div></Cartao>
        <Cartao><div className="text-xs text-[var(--suave)]">{t('Lotes / itens')}</div><div className="num text-xl font-bold">{lista.length}</div></Cartao>
        {[...porMedida].sort((a, b) => Number(a[0]) - Number(b[0])).slice(0, 2).map(([m, g]) => (
          <Cartao key={m}><div className="text-xs text-[var(--suave)]">{m} cm</div><div className="num text-xl font-bold">{gramasTexto(g)}</div></Cartao>
        ))}
      </div>
      {modulo === 'cabelo' && porMedida.size > 0 && (
        <div className="mb-3 flex flex-wrap gap-1">
          {[...porMedida].sort((a, b) => Number(a[0]) - Number(b[0])).map(([m, g]) => <Pilula key={m} tom="marca">{m} cm · {gramasTexto(g)}</Pilula>)}
        </div>
      )}
      {!dados ? (
        <Carregando />
      ) : !lista.length ? (
        <Vazio texto="Nada no estoque com esse filtro." />
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-[var(--borda)] bg-[var(--cartao)]">
          <table className="w-full text-sm">
            <thead><tr className="text-left text-xs text-[var(--suave)]"><th className="p-2">{t('Código')}</th><th className="p-2">{t('Lote / item')}</th><th className="p-2 text-right">{t('Agora')}</th><th className="hidden p-2 text-right md:table-cell">{t('Custo')}</th><th className="p-2" /></tr></thead>
            <tbody>
              {lista.map((i) => (
                <tr key={i.id} className="border-t border-[var(--borda)]">
                  <td className="p-2 font-mono text-xs">{i.codigo ?? '—'}</td>
                  <td className="p-2">
                    <button type="button" className="text-left font-semibold text-[var(--marca)] underline" onClick={() => ir('lote', { id: i.id })}>{i.nome}</button>
                    <div className="text-xs text-[var(--suave)]">{dataBR(i.criadoEm)}{i.campos.estado === 'Bruto' && <> · <Pilula tom="alerta">{t('Bruto')}</Pilula></>}{i.repor > 0 && <> · <Pilula tom="alerta">{t('repor')} {i.repor}</Pilula></>}</div>
                  </td>
                  <td className="num p-2 text-right font-bold">{fmt(i.saldo, i.unidade === 'grama' ? 'gramas' : 'numero')}{i.quantidadeInicial ? <div className="text-xs font-normal text-[var(--suave)]">{t('de')} {fmt(i.quantidadeInicial, i.unidade === 'grama' ? 'gramas' : 'numero')}</div> : null}</td>
                  <td className="num hidden p-2 text-right md:table-cell">{i.custoPrincipal && i.quantidadeInicial ? formatar(Math.round((i.custoPrincipal * i.saldo) / i.quantidadeInicial), 'BOB') : '—'}</td>
                  <td className="p-2 text-right">
                    <div className="flex justify-end gap-1">
                      {i.unidade === 'grama' && <Botao variante="secundario" onClick={() => setSeparar(i.id)}>{t('Separar')}</Botao>}
                      <Botao variante="leve" onClick={() => setAjustar(i.id)}>{t('Ajustar')}</Botao>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {separar && <Separar loteId={separar} onFechar={() => setSeparar(undefined)} />}
      {ajustar && <Ajustar itemId={ajustar} onFechar={() => setAjustar(undefined)} />}
    </div>
  )
}

/** Separar um lote (ex.: 40 kg bruto → 20 kg preto 60 cm + 19,5 kg castanho 50 cm; o resto é perda). */
function Separar({ loteId, onFechar }: { loteId: Id; onFechar(): void }) {
  const t = useT()
  const { dados } = useConsulta('fichaItem', { id: loteId })
  const { executar, ocupado } = useComando()
  const [id] = useState(() => novoId())
  const [usada, setUsada] = useState<number>()
  const [partes, setPartes] = useState<{ id: Id; quantidade?: number; campos: Campos; ref?: string }[]>([{ id: novoId(), campos: { estado: 'Separado', categoria: 'Normal' } }])
  const [porValor, setPorValor] = useState(true)
  const [coluna, setColuna] = useState<string>()
  const { dados: tabelas } = useConsulta('tabelasPreco', { moduloId: 'cabelo' })
  const tabela = tabelas?.find((x) => !x.categoria) ?? tabelas?.[0]
  const col = coluna ?? tabela?.colunas.find((c) => /p\.?w|paragu/i.test(c.nome))?.id ?? tabela?.colunas[0]?.id
  const refDe = (p: { campos: Campos; ref?: string }) => {
    if (p.ref) return p.ref
    const med = Number(p.campos.comprimento)
    const tb = tabelas?.find((x) => (x.categoria ?? 'Normal') === String(p.campos.categoria ?? 'Normal')) ?? tabela
    return tb && med && col ? fatorDaTabela(tb, med, col).fator : undefined
  }
  if (!dados) return null
  const lote = dados.item
  const usar = usada ?? lote.saldo
  const soma = partes.reduce((s, p) => s + (p.quantidade ?? 0), 0)
  const att = (i: number, d: Partial<(typeof partes)[number]>) => setPartes(partes.map((p, k) => (k === i ? { ...p, ...d, campos: { ...p.campos, ...(d.campos ?? {}) } } : p)))
  return (
    <Janela
      aberta
      larga
      titulo={`${t('Separar')} ${lote.codigo ?? ''} · ${lote.nome}`}
      onFechar={onFechar}
      rodape={
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className={cx('text-sm font-semibold', soma > usar ? 'text-[var(--ruim)]' : 'text-[var(--suave)]')}>
            {t('Partes')}: {gramasTexto(soma)} · {t('perda')}: {gramasTexto(Math.max(0, usar - soma))}
          </span>
          <Botao grande disabled={ocupado || !soma || soma > usar} onClick={async () => {
            const r = await executar('separarLote', { id, loteId, quantidadeUsada: usar, saidas: partes.filter((p) => p.quantidade).map((p) => ({ id: p.id, quantidade: p.quantidade!, campos: p.campos, valorReferencia: porValor ? refDe(p) : undefined })) }, t('Lote separado.'))
            if (r) onFechar()
          }}>{t('Separar')}</Botao>
        </div>
      }
    >
      <div className="space-y-3">
        <p className="text-sm text-[var(--suave)]">{t('Tem')} <b>{gramasTexto(lote.saldo)}</b>. {t('O custo é dividido pelo peso de cada parte; o que sobrar é perda.')}</p>
        <Campo rotulo="Quanto deste lote vai separar?"><GramasInput valor={usar} onChange={setUsada} /></Campo>
        <div className="rounded-xl bg-[var(--fundo)] p-3 text-sm">
          <label className="flex items-center gap-2 font-semibold"><input type="checkbox" className="h-5 w-5" checked={porValor} onChange={(e) => setPorValor(e.target.checked)} /> {t('Dividir o custo pelo valor de mercado (recomendado)')}</label>
          <p className="mt-1 text-xs text-[var(--suave)]">{t('Cabelo longo vale mais, então leva mais do custo. Pelo peso, o curto parece dar prejuízo e o longo lucro demais.')}</p>
          {porValor && tabela && <div className="mt-2"><Selecao valor={col} onChange={setColuna} opcoes={tabela.colunas.map((c) => ({ id: c.id, nome: `${t('Preço de referência')}: ${c.nome}` }))} /></div>}
        </div>
        {partes.map((p, i) => (
          <div key={p.id} className="grid grid-cols-2 gap-2 rounded-xl border border-[var(--borda)] p-2 md:grid-cols-6">
            <Campo rotulo="Medida (cm)"><Entrada inputMode="numeric" value={String(p.campos.comprimento ?? '')} onChange={(e) => att(i, { campos: { comprimento: Number(e.target.value) || undefined } })} /></Campo>
            <Campo rotulo="Categoria"><Selecao valor={String(p.campos.categoria ?? 'Normal')} onChange={(v) => att(i, { campos: { categoria: v } })} opcoes={CATS.map((c) => ({ id: c, nome: c }))} /></Campo>
            <Campo rotulo="Cor"><Selecao valor={String(p.campos.cor ?? '')} vazio="—" onChange={(v) => att(i, { campos: { cor: v } })} opcoes={['Preto', 'Castanho escuro', 'Castanho', 'Castanho claro', 'Loiro', 'Ruivo', 'Grisalho'].map((c) => ({ id: c, nome: c }))} /></Campo>
            <Campo rotulo="Peso"><GramasInput valor={p.quantidade} onChange={(q) => att(i, { quantidade: q })} /></Campo>
            {porValor && <Campo rotulo="Valor de referência" ajuda="Vem da tabela (medida × coluna escolhida). Pode mudar."><Entrada inputMode="decimal" value={p.ref ?? ''} placeholder={refDe(p) ?? '?'} onChange={(e) => att(i, { ref: e.target.value })} /></Campo>}
            <div className="flex items-end"><Botao variante="leve" onClick={() => setPartes(partes.filter((_, k) => k !== i))}>{t('Tirar')}</Botao></div>
          </div>
        ))}
        <Botao variante="secundario" onClick={() => setPartes([...partes, { id: novoId(), campos: { ...partes[partes.length - 1]?.campos, comprimento: undefined } }])}>+ {t('Outra parte')}</Botao>
      </div>
    </Janela>
  )
}

function Ajustar({ itemId, onFechar }: { itemId: Id; onFechar(): void }) {
  const t = useT()
  const { dados } = useConsulta('fichaItem', { id: itemId })
  const { executar, ocupado } = useComando()
  const [novo, setNovo] = useState<number>()
  const [motivo, setMotivo] = useState<'ajuste' | 'perda'>('ajuste')
  const [desc, setDesc] = useState('')
  if (!dados) return null
  return (
    <Janela aberta titulo={`${t('Ajustar')} · ${dados.item.nome}`} onFechar={onFechar} rodape={<Botao grande className="w-full" disabled={ocupado || novo === undefined} onClick={async () => (await executar('ajustarEstoque', { itemId, novoSaldo: novo!, motivo, descricao: desc }, t('Estoque ajustado.'))) && onFechar()}>{t('Salvar')}</Botao>}>
      <div className="space-y-3">
        <p className="text-sm">{t('Agora')}: <b>{fmt(dados.item.saldo, dados.item.unidade === 'grama' ? 'gramas' : 'numero')}</b></p>
        <Abas atual={motivo} onChange={(v) => setMotivo(v as typeof motivo)} abas={[{ id: 'ajuste', nome: 'Contei e é outro número' }, { id: 'perda', nome: 'Perda / quebra' }]} />
        <Campo rotulo="Quantidade certa">{dados.item.unidade === 'grama' ? <GramasInput valor={novo} onChange={setNovo} /> : <Entrada inputMode="numeric" onChange={(e) => setNovo(Number(e.target.value))} />}</Campo>
        <Campo rotulo="Motivo"><Entrada value={desc} onChange={(e) => setDesc(e.target.value)} /></Campo>
      </div>
    </Janela>
  )
}

/** Ficha do lote: o que é, de onde veio, para onde foi cada grama, lucro, arquivos e linha do tempo. */
export function FichaLote() {
  const t = useT()
  const { nav, ir, voltar } = useApp()
  const id = nav.params.id as Id
  const { dados } = useConsulta('fichaItem', { id })
  if (!dados) return <Carregando />
  const i = dados.item
  const fu = i.unidade === 'grama' ? 'gramas' : 'numero'
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2"><Botao variante="leve" onClick={voltar}>← {t('Voltar')}</Botao></div>
      <Titulo subtitulo={`${i.codigo ?? ''} · ${t('desde')} ${dataBR(i.criadoEm)}`} acao={<Botao variante="secundario" onClick={() => ir('rastreio', { itemId: i.id })}>🔎 {t('Rastrear origem e destino')}</Botao>}>{i.nome}</Titulo>
      <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
        <Cartao><div className="text-xs text-[var(--suave)]">{t('Agora')}</div><div className="num text-xl font-bold">{fmt(i.saldo, fu)}</div></Cartao>
        <Cartao><div className="text-xs text-[var(--suave)]">{t('Custo do lote')}</div><div className="num text-xl font-bold">{formatar(i.custoPrincipal ?? 0, 'BOB')}</div></Cartao>
        <Cartao><div className="text-xs text-[var(--suave)]">{t('Vendido')}</div><div className="num text-xl font-bold">{formatar(dados.vendido, 'BOB')}</div></Cartao>
        <Cartao><div className="text-xs text-[var(--suave)]">{t('Lucro (vendido − custo)')}</div><div className={cx('num text-xl font-bold', dados.lucro < 0 ? 'text-[var(--ruim)]' : 'text-[var(--bom)]')}>{formatar(dados.lucro, 'BOB')}</div></Cartao>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <Cartao titulo={t('Ficha')}>
          <dl className="grid grid-cols-2 gap-1 text-sm">
            {Object.entries(i.campos).filter(([k, v]) => v !== undefined && v !== '' && !['separacaoId', 'tabelaId', 'colunaId', 'calculo'].includes(k)).map(([k, v]) => (
              <div key={k} className="contents"><dt className="text-[var(--suave)]">{t(k)}</dt><dd className="font-semibold">{String(v)}</dd></div>
            ))}
            {dados.fornecedor && <><dt className="text-[var(--suave)]">{t('Fornecedor')}</dt><dd className="font-semibold">{dados.fornecedor.nome}</dd></>}
          </dl>
        </Cartao>
        <Cartao titulo={t('Para onde foi')}>
          {!dados.saidas.length ? <Vazio texto="Nenhuma venda deste lote ainda." /> : (
            <ul className="space-y-1 text-sm">
              {dados.saidas.map((s, k) => (
                <li key={k} className="flex justify-between border-b border-[var(--borda)] py-1">
                  <button type="button" className="text-left underline" onClick={() => ir('venda', { id: s.vendaId })}>{dataBR(s.data)} · {s.cliente ?? t('cliente')}</button>
                  <span className="num">{fmt(s.quantidade, fu)} · {formatar(s.totalPrincipal, 'BOB')}</span>
                </li>
              ))}
            </ul>
          )}
          {dados.derivados.length > 0 && <p className="mt-2 text-sm">{t('Virou os lotes')}: {dados.derivados.map((d) => <button key={d.id} type="button" className="mr-2 underline" onClick={() => ir('lote', { id: d.id })}>{d.codigo} {d.nome}</button>)}</p>}
        </Cartao>
        <Cartao titulo={t('Fotos e arquivos')}><Anexos donoId={i.id} categorias={['produto', 'outro']} /></Cartao>
        <Cartao titulo={t('Movimentos')}>
          <ul className="max-h-72 space-y-1 overflow-y-auto text-sm">
            {dados.movimentos.map((m) => (
              <li key={m.id} className="flex justify-between gap-2 border-b border-[var(--borda)] py-1">
                <span>{dataBR(m.data)} · {t(m.motivo)} {m.descricao ? `· ${m.descricao}` : ''}</span>
                <span className={cx('num shrink-0', m.delta < 0 ? 'text-[var(--ruim)]' : 'text-[var(--bom)]')}>{m.delta > 0 ? '+' : ''}{fmt(m.delta, fu)}</span>
              </li>
            ))}
          </ul>
        </Cartao>
      </div>
      <Cartao titulo={t('Linha do tempo')}><LinhaDoTempo id={i.id} /></Cartao>
    </div>
  )
}

/** RASTREIO: da compra até cada venda parcial, em árvore. */
export function Rastreio() {
  const t = useT()
  const { nav, ir, voltar } = useApp()
  const { dados } = useConsulta('rastreio', { compraId: nav.params.compraId as Id | undefined, itemId: nav.params.itemId as Id | undefined })
  if (!dados) return <Carregando />
  const r = dados.resumo
  return (
    <div className="space-y-4">
      <Botao variante="leve" onClick={voltar}>← {t('Voltar')}</Botao>
      <Titulo subtitulo={dados.compra ? `${t('Compra de')} ${dados.fornecedor ?? '—'} · ${dataBR(dados.compra.data)}` : undefined}>{t('Rastreio: origem → destino')}</Titulo>
      <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
        {[
          ['Comprado', gramasTexto(r.comprado)],
          ['Vendido', gramasTexto(r.vendido)],
          ['Em estoque', gramasTexto(r.emEstoque)],
          ['Perda na separação', gramasTexto(r.perdaNaSeparacao)],
          ['Custo da compra', formatar(r.custoCompra, 'BOB')],
          ['Receita', formatar(r.receita, 'BOB')],
          ['Lucro realizado', formatar(r.lucroRealizado, 'BOB')],
          ['Vendas parciais', String(r.vendas)],
        ].map(([n, v]) => (
          <Cartao key={n}><div className="text-xs text-[var(--suave)]">{t(n)}</div><div className="num text-lg font-bold">{v}</div></Cartao>
        ))}
      </div>
      <Cartao titulo={t('Árvore')}>
        {dados.arvore.map((n) => <No key={n.item.id} n={n} nivel={0} onLote={(id) => ir('lote', { id })} onVenda={(id) => ir('venda', { id })} />)}
      </Cartao>
      {dados.compra && <Cartao titulo={t('Linha do tempo da compra')}><LinhaDoTempo id={dados.compra.id} /></Cartao>}
    </div>
  )
}

function No({ n, nivel, onLote, onVenda }: { n: NoRastreio; nivel: number; onLote(id: Id): void; onVenda(id: Id): void }) {
  const t = useT()
  const [aberto, setAberto] = useState(true)
  return (
    <div className={cx(nivel > 0 && 'ml-4 border-l-2 border-[var(--borda)] pl-3')}>
      <div className="my-2 rounded-xl bg-[var(--fundo)] p-2">
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" onClick={() => setAberto(!aberto)} aria-label={t('Abrir/fechar')} className="w-6">{aberto ? '▾' : '▸'}</button>
          <button type="button" className="font-semibold text-[var(--marca)] underline" onClick={() => onLote(n.item.id)}>{n.item.codigo} · {n.item.nome}</button>
          <Pilula>{t('entrou')} {gramasTexto(n.entrada)}</Pilula>
          {n.separado > 0 && <Pilula tom="marca">{t('separado')} {gramasTexto(n.separado)}</Pilula>}
          {n.vendido > 0 && <Pilula tom="bom">{t('vendido')} {gramasTexto(n.vendido)}</Pilula>}
          <Pilula>{t('agora')} {gramasTexto(n.saldo)}</Pilula>
          <span className="num ml-auto text-sm">{t('lucro')} <b>{formatar(n.lucro, 'BOB')}</b></span>
        </div>
        {aberto && n.vendas.length > 0 && (
          <ul className="ml-8 mt-1 space-y-1 text-sm">
            {n.vendas.map((v, k) => (
              <li key={k}>
                <button type="button" className="underline" onClick={() => onVenda(v.vendaId)}>{dataBR(v.data)} · {v.cliente ?? '—'}</button>
                <span className="num text-[var(--suave)]"> · {v.calculo || `${gramasTexto(v.quantidade)} = ${formatar(v.total, v.moeda)}`}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
      {aberto && n.filhos.map((f) => <No key={f.item.id} n={f} nivel={nivel + 1} onLote={onLote} onVenda={onVenda} />)}
    </div>
  )
}
