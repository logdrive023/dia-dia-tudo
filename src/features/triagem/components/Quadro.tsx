// TRIAGEM › QUADRO: as colunas das etapas (arrastar entre elas), o cartão de cada lote, "ver vendidos" e a janela do
// peso depois de lavar. Recebe tudo por props; a tela decide o que fazer.
import { type DragEvent, type ReactNode, useState } from 'react'
import { formatar } from '../../../core/domain/dinheiro'
import type { Id } from '../../../core/domain/tipos'
import { COLUNA_VENDIDO, type ColunaTriagem } from '../../../core/services/triagem'
import { Botao, Campo, GramasInput, Info, Janela, Pilula, cx, dataBR, fmt, gramasTexto, moedaPadrao } from '../../../shared/ui/base'
import { useT } from '../../../shared/ui/i18n'
import { type Acao, MenuAcoes } from '../../../shared/ui/menuAcoes'
import { CadeiaChips } from '../../../shared/ui/rastreioTotal'
import { LinkTirarFoto, MiniaturaLote, marcadorLote } from '../../../shared/ui/fotos'
import { SeloEtiqueta } from '../../../shared/ui/etiquetas'
import { NAO_ID, type Dados, type Lote } from '../model/comum'

const MAX_COLUNA = 20

const corDe = (c?: ColunaTriagem) => c?.cor ?? 'var(--marca)'

const DICA_LAVAGEM = 'Opcional. Se lavar, digite o peso depois. Ex.: 6.000 g → 5.700 g (−300 g).'

export function Coluna({ col, lotes, children, alvo, lista, rodape, ...zona }: { col: ColunaTriagem; lotes: Lote[]; children(ls: Lote[]): ReactNode; alvo?: boolean; lista?: boolean; rodape?: ReactNode; onDragOver?(e: DragEvent): void; onDragLeave?(): void; onDrop?(e: DragEvent): void }) {
  const t = useT()
  const [mais, setMais] = useState(false)
  const visiveis = mais ? lotes : lotes.slice(0, MAX_COLUNA)
  const vazio = col.ajuda || (col.entrada ? 'Os lotes brutos das compras caem aqui.' : col.pronto ? 'Lotes prontos para vender aparecem aqui.' : col.id === COLUNA_VENDIDO ? 'Lotes que acabaram nos últimos 30 dias aparecem aqui.' : 'Arraste lotes para cá.')
  return (
    <section
      aria-label={t(col.nome)}
      {...zona}
      className={cx('min-w-0 rounded-2xl border-2 p-2 transition', lista ? '' : 'w-[17rem] shrink-0 bg-[var(--fundo)] xl:w-auto xl:min-w-[17rem] xl:flex-1', alvo ? 'border-dashed border-[var(--marca)] bg-[var(--marca-suave)]' : 'border-transparent')}
    >
      <header className="mb-2 flex items-start gap-2 px-1">
        <span aria-hidden className="mt-1 h-3 w-3 shrink-0 rounded-full" style={{ background: corDe(col) }} />
        <h2 className="min-w-0 flex-1 font-bold leading-tight">{t(col.nome)}{col.pronto && <span className="ml-1 text-xs font-semibold text-[var(--bom)]">💰</span>}</h2>
        <span className="num shrink-0 whitespace-nowrap text-sm text-[var(--suave)]">{lotes.length} · {gramasTexto(lotes.reduce((s, l) => s + l.saldo, 0))}</span>
      </header>
      {!lotes.length ? (
        <p className="rounded-xl border border-dashed border-[var(--borda)] p-4 text-center text-sm text-[var(--suave)]">{t(vazio)}</p>
      ) : (
        <ul className={cx(lista ? 'grid gap-2 sm:grid-cols-2' : 'space-y-2')}>{children(visiveis)}</ul>
      )}
      {lotes.length > MAX_COLUNA && (
        <button type="button" onClick={() => setMais(!mais)} className="mt-2 min-h-10 w-full rounded-xl text-sm font-semibold text-[var(--marca)] hover:bg-[var(--marca-suave)]">{mais ? t('Mostrar menos') : t('Ver mais ({n})', { n: lotes.length - MAX_COLUNA })}</button>
      )}
      {rodape}
    </section>
  )
}

export function VerVendidos({ dados, todos, onTodos }: { dados: Dados; todos: boolean; onTodos(v: boolean): void }) {
  const t = useT()
  if (!todos && !dados.vendidosOcultos) return null
  return (
    <button type="button" onClick={() => onTodos(!todos)} className="mt-2 min-h-10 w-full rounded-xl text-sm font-semibold text-[var(--marca)] hover:bg-[var(--marca-suave)]">
      {todos ? t('Só os últimos 30 dias') : t('Ver mais ({n} mais antigos)', { n: dados.vendidosOcultos })}
    </button>
  )
}

export function CartaoLote(p: {
  l: Lote
  col?: ColunaTriagem
  marcado: boolean
  arrastavel: boolean
  ocupado: boolean
  acao?: { rotulo: string; f(): void }
  selecionavel: boolean
  menu: Acao[]
  onMarcar(v: boolean): void
  onArrastar(e: DragEvent): void
  onSoltar(): void
  onAbrir(): void
}) {
  const t = useT()
  const { l, col } = p
  const m = moedaPadrao()
  const vendido = l.fase === COLUNA_VENDIDO
  const pct = l.preco && l.margem !== undefined && l.preco.valorPrincipal ? Math.round((l.margem * 10000) / l.preco.valorPrincipal) : undefined
  return (
    <li
      draggable={p.arrastavel}
      onDragStart={p.onArrastar}
      onDragEnd={p.onSoltar}
      className={cx('min-w-0 list-none rounded-2xl border bg-[var(--cartao)] p-3 shadow-sm transition', p.marcado ? 'border-[var(--marca)] ring-2 ring-[var(--marca)]' : 'border-[var(--borda)]', p.arrastavel && 'cursor-grab active:cursor-grabbing', vendido && 'opacity-75')}
    >
      <div className="flex items-center gap-2">
        {!vendido && p.selecionavel && <input type="checkbox" className="h-5 w-5 shrink-0" checked={p.marcado} onChange={(e) => p.onMarcar(e.target.checked)} aria-label={t('Selecionar {c}', { c: l.codigo ?? l.nome })} />}
        <span className="flex min-w-0 flex-1 flex-wrap items-center gap-1">
          <span className="font-mono text-xs text-[var(--suave)]">{l.codigo}</span>
          {l.unificado > 0 && <Pilula tom="marca">🔗 {t('{n} lotes', { n: l.unificado })}</Pilula>}
          {l.campos.estado === NAO_ID && <Pilula tom="alerta">❓ {t('Não identificado')}</Pilula>}
          {l.atrasado && <Pilula tom="ruim">⏳ {t('{n} d', { n: l.dias })}</Pilula>}
          {!vendido && <SeloEtiqueta id={l.id} impressaEm={l.etiqueta.impressaEm} por={l.etiqueta.por} via={l.etiqueta.via} />}
        </span>
        <span className="num shrink-0 whitespace-nowrap text-xl font-black">{gramasTexto(l.saldo)}</span>
        <MenuAcoes acoes={p.menu} />
      </div>
      <div className="mt-1 flex items-start gap-2">
        <MiniaturaLote itemId={l.id} foto={l.foto} marcador={marcadorLote(l.campos, l.nome)} />
        <button type="button" onClick={p.onAbrir} className="block min-w-0 flex-1 text-left font-semibold leading-tight break-words hover:underline">{l.nome}</button>
      </div>
      <div className="mt-1 space-y-0.5 text-xs text-[var(--suave)]">
        <CadeiaChips cadeia={l.cadeia} />
        {(l.pai || l.unificadoDe?.length) && <p className="break-words">{l.pai ? `${t('separado de')} ${l.pai.codigo ?? '?'}` : `${t('unificado de')} ${l.unificadoDe!.map((x) => x.codigo ?? '?').join(' + ')}`}</p>}
        <p className="num">
          {vendido ? `${t('vendido em')} ${dataBR(l.vendidoEm)}` : col?.pronto ? `${t('desde')} ${dataBR(l.desde)}` : t('há {n} dia(s) nesta coluna', { n: l.dias })}
          {l.custoKg !== undefined && !col?.pronto && !vendido && ` · ${formatar(l.custoKg, m)}/kg`}
        </p>
        {l.obs && <p className="italic">“{l.obs}”</p>}
        {col?.exigirFoto && !l.fotosProprias && !vendido ? (
          <p className="font-semibold text-[var(--ruim)]"><LinkTirarFoto itemId={l.id}>📷 {t('Foto obrigatória para sair daqui: tirar agora')}</LinkTirarFoto></p>
        ) : col?.lembrarFotos && !l.fotosProprias && !vendido ? (
          <p className="font-semibold text-[var(--alerta)]"><LinkTirarFoto itemId={l.id}>📷 {t('Lembre das fotos: tirar agora')}</LinkTirarFoto></p>
        ) : null}
      </div>
      {col?.pronto && (
        <div className="mt-2 rounded-xl bg-[var(--fundo)] p-2">
          {l.preco ? (
            <>
              <p className="num text-sm"><b className="whitespace-nowrap text-base">{formatar(l.preco.valor, l.preco.moeda)}</b> <span className="whitespace-nowrap text-xs text-[var(--suave)]">{gramasTexto(l.saldo)} × {l.preco.fator} · {l.preco.coluna}</span></p>
              {l.margem !== undefined && <p className={cx('num text-xs font-semibold', l.margem < 0 ? 'text-[var(--ruim)]' : 'text-[var(--bom)]')}>{t('Margem')} <span className="whitespace-nowrap">{formatar(l.margem, m)}</span>{pct !== undefined && <span className="whitespace-nowrap"> ({fmt(pct, 'percentual')})</span>}</p>}
            </>
          ) : (
            <p className="text-xs font-semibold text-[var(--alerta)]">⚠️ {l.semPreco === 'medida' ? t('sem medida: edite para ter preço') : t('sem preço na tabela')}</p>
          )}
        </div>
      )}
      {p.acao && (
        <div className="mt-2 flex">
          <Botao className="min-w-0 flex-1 break-words" disabled={p.ocupado} onClick={p.acao.f}>{t(p.acao.rotulo)}</Botao>
        </div>
      )}
    </li>
  )
}

/** Saiu da lavagem: peso depois de cada lote (opcional). A diferença vira "perda de lavagem" no livro (antes → depois). */
export function PesoDepois({ lotes, destino, ocupado, onFechar, onMover }: { lotes: Lote[]; destino: string; ocupado: boolean; onFechar(): void; onMover(pesos: Record<Id, number | undefined>): void }) {
  const t = useT()
  const [pesos, setPesos] = useState<Record<Id, number | undefined>>({})
  return (
    <Janela aberta titulo={<span className="inline-flex items-center">{t('Peso depois da lavagem')}<Info texto={DICA_LAVAGEM} /></span>} onFechar={onFechar} rodape={
      <div className="flex gap-2">
        <Botao variante="leve" className="flex-1" disabled={ocupado} onClick={() => onMover({})}>{t('Pular')}</Botao>
        <Botao grande className="flex-1" disabled={ocupado} onClick={() => onMover(pesos)}>→ {destino}</Botao>
      </div>
    }>
      <div className="space-y-3">
        <p className="text-sm text-[var(--suave)]">{t('Opcional: pese de novo e a diferença fica registrada como perda de lavagem.')}</p>
        {lotes.map((l) => (
          <Campo key={l.id} rotulo={`${l.codigo ?? l.nome} · ${t('antes')} ${gramasTexto(l.saldo)}`}>
            <GramasInput valor={pesos[l.id]} onChange={(g) => setPesos({ ...pesos, [l.id]: g })} />
            {pesos[l.id] !== undefined && pesos[l.id]! < l.saldo && <span className="num mt-1 block text-sm text-[var(--ruim)]">{gramasTexto(l.saldo)} → {gramasTexto(pesos[l.id]!)} (−{gramasTexto(l.saldo - pesos[l.id]!)})</span>}
          </Campo>
        ))}
      </div>
    </Janela>
  )
}
