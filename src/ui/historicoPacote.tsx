// HISTÓRICO DO PACOTE: um só lugar com tudo o que entrou e saiu do pacote, no formato do caixa do dia — agrupado por
// dia (mais novo em cima), com o saldo do começo e do fim do dia; cada movimento com antes → depois, hora, quem fez e a
// referência clicável; "detalhes" abre a ficha (na entrada da triagem, as compras de origem com os gramas de cada uma).

import { useState } from 'react'
import type { Id } from '../core/domain/tipos'
import type { MovHistorico } from '../core/services/livro'
import { Carregando, cx, gramasTexto, hora, sinalGramas, Pilula, Vazio } from './base'
import { AntesDepois, BlocoDetalhe, BotaoReferencia, CabecalhoDia, CartaoEvento, DetalhesEvento, ListaEventos, SeloEvento, type TomEvento } from './cartaoEvento'
import { useApp, useConsulta } from './contexto'
import { useT } from './i18n'

/** ícone e cor por tipo (os mesmos do Livro do cabelo): bater o olho e saber o que foi */
const ICONE: Record<string, string> = { entrada: '🛒', venda: '💰', triagemSaida: '✂️', triagemEntrada: '✂️', diferenca: '⚖️', lavagem: '💧', perda: '⚠️', ajuste: '✎', evento: '🏷' }
const TOM: Record<string, TomEvento> = { entrada: 'bom', venda: 'ruim', triagemSaida: 'marca', triagemEntrada: 'marca', diferenca: 'alerta', lavagem: 'alerta', perda: 'alerta', ajuste: 'alerta', evento: 'suave' }

export function HistoricoPacote({ id }: { id: Id }) {
  const t = useT()
  const { dados } = useConsulta('historicoPacote', { itemId: id })
  const [tudo, setTudo] = useState(false)
  if (!dados) return <Carregando />
  if (!dados.dias.length) return <Vazio compacto texto="Nada registrado ainda." />
  // hoje sem movimento não vira um bloco vazio: o saldo de agora vai numa linha no alto
  const comMov = dados.dias.filter((d) => d.movs.length > 0)
  const dias = tudo ? comMov : comMov.slice(0, 7)
  return (
    // cada dia é um bloco próprio: cabeçalho com a data e "começou → terminou" (onde o dia começa e termina) e,
    // dentro, os movimentos do dia — entre um dia e outro, espaço e borda
    <div className="space-y-5">
      <p className="num flex items-center justify-between rounded-xl bg-[var(--marca-suave)] px-3 py-2 text-sm"><b>{t('Agora')}</b><b>{gramasTexto(dados.item!.saldo)}</b></p>
      {dias.map((d) => {
        const fim = d.aberto ? dados.item!.saldo : d.fim
        const mudou = fim - d.inicio
        return (
          <section key={d.data} aria-label={d.data}>
            <CabecalhoDia
              data={d.data}
              quantos={d.movs.length}
              direita={
                <span className="num flex items-center gap-2 text-sm">
                  <Pilula pequena tom={d.aberto ? 'marca' : 'suave'}>{t(d.aberto ? 'aberto' : 'encerrado')}</Pilula>
                  <span><span className="text-[var(--suave)]">{gramasTexto(d.inicio)} → </span><b>{gramasTexto(fim)}</b></span>
                  {mudou !== 0 && <span className={cx('text-xs font-semibold', mudou < 0 ? 'text-[var(--ruim)]' : 'text-[var(--bom)]')}>({sinalGramas(mudou)})</span>}
                </span>
              }
            />
            {d.movs.length ? (
              <ListaEventos>{d.movs.map((m) => <Movimento key={m.id} m={m} pacote={{ id, codigo: dados.item?.codigo }} />)}</ListaEventos>
            ) : (
              <p className="rounded-2xl border border-dashed border-[var(--borda)] px-3 py-2 text-sm text-[var(--suave)]">{t('Sem movimento neste dia.')}</p>
            )}
          </section>
        )
      })}
      {!tudo && comMov.length > dias.length && (
        <button type="button" onClick={() => setTudo(true)} className="min-h-10 text-sm font-semibold text-[var(--marca)]">{t('Ver tudo ({n})', { n: comMov.length })}</button>
      )}
    </div>
  )
}

function Movimento({ m, pacote }: { m: MovHistorico; pacote: { id: Id; codigo?: string } }) {
  const t = useT()
  const { ir } = useApp()
  const [aberto, setAberto] = useState(false)
  // referência OBRIGATÓRIA: o que não traz (eventos como "etiqueta impressa") aponta para a etiqueta deste pacote
  const ref = m.ref ?? { tela: 'etiquetas' as const, params: { f: 'todas', sel: pacote.id }, rotulo: ` ${pacote.codigo ?? ''}`.trim() }
  const abrirRef = () => ir(ref.tela, ref.params)
  return (
    <CartaoEvento
      icone={ICONE[m.tipo] ?? '•'}
      tom={TOM[m.tipo] ?? 'suave'}
      titulo={m.titulo}
      selos={[
        <SeloEvento key="h" icone="🕒">{hora(m.em)}</SeloEvento>,
        m.por && <SeloEvento key="p" icone="👤">{m.por}</SeloEvento>,
        m.delta !== 0 && <SeloEvento key="s" icone="⚖️">{gramasTexto(m.antes)} → {gramasTexto(m.depois)}</SeloEvento>,
      ]}
      valor={m.delta !== 0 ? sinalGramas(m.delta) : undefined}
      valorTom={m.delta < 0 ? 'ruim' : 'bom'}
      referencia={{ rotulo: ref.rotulo, abrir: abrirRef }}
      aberto={aberto}
      onAlternar={() => setAberto(!aberto)}
    >
      <DetalhesEvento>
        {m.delta !== 0 && (
          <BlocoDetalhe rotulo="O que mudou" largo>
            <AntesDepois antes={gramasTexto(m.antes)} mudou={sinalGramas(m.delta)} depois={gramasTexto(m.depois)} negativo={m.delta < 0} />
          </BlocoDetalhe>
        )}
        {!!m.fontes?.length && (
          <BlocoDetalhe rotulo="Entrou de" largo>
            <div className="flex flex-wrap gap-1.5">
              {m.fontes.map((f) => <BotaoReferencia key={f.id} icone="📦" onClick={() => ir('lote', { id: f.id })}>{f.codigo ?? '?'} · <span className="num">{gramasTexto(f.g)}</span></BotaoReferencia>)}
            </div>
          </BlocoDetalhe>
        )}
        {m.origem && (
          <BlocoDetalhe rotulo="Origem" largo>
            {!m.origem.length ? '—' : (
              <ul className="divide-y divide-[var(--borda)]">
                {m.origem.map((o) => (
                  <li key={o.compraId} className="py-1.5 first:pt-0 last:pb-0">
                    <button type="button" onClick={() => ir('pedido', { id: o.compraId })} className="flex w-full items-baseline justify-between gap-3 text-left hover:underline">
                      <span>🛒 {t('da compra')} <b className="font-mono">{o.codigo ?? '?'}</b>{o.fornecedor ? ` · ${o.fornecedor}` : ''}</span>
                      <b className="num shrink-0">{gramasTexto(o.gramas)}</b>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </BlocoDetalhe>
        )}
        <BlocoDetalhe rotulo="Tipo"><b>{t(m.nomeTipo)}</b></BlocoDetalhe>
        <BlocoDetalhe rotulo="Quem">{m.por ?? '—'}</BlocoDetalhe>
        {m.descricao && <BlocoDetalhe rotulo="Descrição" largo>{m.descricao}</BlocoDetalhe>}
        <BlocoDetalhe rotulo="Referências" largo><BotaoReferencia onClick={abrirRef}>{ref.rotulo}</BotaoReferencia></BlocoDetalhe>
      </DetalhesEvento>
    </CartaoEvento>
  )
}
