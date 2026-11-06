// O RESUMO DA FICHA DO PACOTE em dois momentos do mesmo cabelo — a MESMA linguagem, a prioridade de cada etapa:
//   · TRIAGEM (bruto · preparando · não identificado): avaliar e classificar — o que se sabe do cabelo, onde está no
//     processo, o resultado da separação e o próximo passo.
//   · ESTOQUE (separado: disponível · parcial · esgotado): controlar — está disponível? reservado? onde está no quadro,
//     a etiqueta confere? quanto vendeu e o lucro; e a rastreabilidade.
// Compartilhado (o mesmo nas duas): a faixa "Agora" (FaixaSituacao), os números (GrupoNumeros/NumeroGrande do sistema)
// e a vida do pacote (compra → triagem → etiqueta → venda). Próprio de cada uma: o que vai na faixa e nos números, e a
// avaliação (só na triagem). Nada de componente genérico com condicionais: cada resumo é uma composição curta.
import type { ReactNode } from 'react'
import { formatar } from '../../../core/domain/dinheiro'
import type { CampoDef } from '../../../core/modulos'
import type { ResultadoConsulta } from '../../../core/services'
import { cx, dataBR, fmt, moedaPadrao } from '../../../shared/ui/base'
import { useApp } from '../../../shared/ui/contexto'
import { GrupoNumeros, NumeroGrande } from '../../../shared/ui/numeroGrande'
import { useT } from '../../../shared/ui/i18n'

type Ficha = ResultadoConsulta<'fichaItem'>
type Gen = ResultadoConsulta<'genealogia'> | undefined

export interface ResumoLoteProps {
  dados: Ficha
  gen: Gen
  campos: CampoDef[]
  onEtiqueta(): void
  onRastreio(): void
}

/* ─────────────── COMPARTILHADO ─────────────── */

/**
 * A FAIXA "AGORA": uma frase grande do estado (o que importa nesta etapa) e, embaixo, 2–3 fatos curtos (rótulo: valor).
 * `tom` só pinta a faixa da esquerda e o título quando pede atenção — a mesma cara nas duas telas.
 */
function FaixaSituacao({ titulo, fatos, tom }: { titulo: ReactNode; fatos: { rotulo: string; valor: ReactNode; alerta?: boolean }[]; tom?: 'alerta' | 'bom' | 'marca' }) {
  const t = useT()
  const cor = tom === 'alerta' ? 'var(--alerta)' : tom === 'bom' ? 'var(--bom)' : 'var(--marca)'
  return (
    <section aria-label={t('Agora')} className="relative overflow-hidden rounded-2xl border border-[var(--borda)] bg-[var(--cartao)] p-4 shadow-sm">
      <span aria-hidden className="absolute inset-y-0 left-0 w-1" style={{ background: cor }} />
      <p className="text-xs font-semibold uppercase tracking-wide text-[var(--suave)]">{t('Agora')}</p>
      <p className="mt-0.5 text-lg font-bold leading-snug" style={tom === 'alerta' ? { color: cor } : undefined}>{titulo}</p>
      {fatos.length > 0 && (
        <dl className="mt-3 grid gap-x-6 gap-y-2 sm:grid-cols-3">
          {fatos.map((f) => (
            <div key={f.rotulo} className="min-w-0">
              <dt className="text-xs text-[var(--suave)]">{t(f.rotulo)}</dt>
              <dd className={cx('num text-sm font-semibold', f.alerta && 'text-[var(--alerta)]')}>{f.valor}</dd>
            </div>
          ))}
        </dl>
      )}
    </section>
  )
}

/** título pequeno de cada bloco do resumo (o mesmo nas duas telas) */
function TituloBloco({ children, sub }: { children: ReactNode; sub?: string }) {
  const t = useT()
  return <p className="mb-2 flex flex-wrap items-baseline gap-x-2"><b className="text-sm">{children}</b>{sub && <span className="text-xs text-[var(--suave)]">{t(sub)}</span>}</p>
}

/**
 * A VIDA DO PACOTE em 4 passos: 🛒 Compra → ✂️ Triagem → 🏷 Etiqueta → 💰 Venda. Cada passo leva ao registro; o que ainda
 * não aconteceu fica apagado. Pacote que já veio separado na compra (pela tabela) diz isso na Triagem, em vez de
 * "ainda não" (não vai passar por lá).
 */
export function VidaDoPacote({ dados, gen, onEtiqueta }: { dados: Ficha; gen: Gen; onEtiqueta(): void }) {
  const t = useT()
  const { ir } = useApp()
  const i = dados.item
  const compras = dados.dna.compras
  const triagem = gen?.triagens.find((x) => x.saidas.some((s) => s.id === i.id)) ?? gen?.triagens.find((x) => x.entradas.some((e) => e.id === i.id))
  const meu = gen?.lotes.find((l) => l.id === i.id)
  const vendas = (meu?.para ?? []).filter((p) => p.tipo === 'venda').map((p) => ({ ...p, cliente: gen?.vendas.find((v) => v.id === p.id)?.cliente }))
  const c = compras[0]
  const bruto = dados.status === 'bruto' || dados.status === 'preparando' || dados.status === 'naoIdentificado'
  const veioSeparado = !triagem && !bruto && i.origem?.tipo === 'compra'
  const passo = (p: { icone: string; nome: string; feito: boolean; titulo?: string; sub?: string; onClick?(): void }) => (
    <button type="button" disabled={!p.onClick} onClick={p.onClick}
      className={cx('flex min-h-20 min-w-0 flex-col justify-between rounded-2xl border p-3 text-left transition', p.feito ? 'border-[var(--borda)] bg-[var(--cartao)] shadow-sm hover:border-[var(--marca)]' : 'border-dashed border-[var(--borda)] text-[var(--suave)]')}>
      <span className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-[var(--suave)]"><span aria-hidden className="text-base">{p.icone}</span>{t(p.nome)}</span>
      <span className="min-w-0">
        <b className={cx('block truncate text-base', p.feito ? 'font-mono text-[var(--marca)]' : 'font-normal')}>{p.titulo ?? t('ainda não')}</b>
        {p.sub && <span className="block truncate text-xs text-[var(--suave)]">{p.sub}</span>}
      </span>
    </button>
  )
  return (
    <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
      {passo({ icone: '🛒', nome: 'Compra', feito: !!c, titulo: c?.codigo ?? undefined, sub: [c?.fornecedor?.nome, compras.length > 1 ? `+${compras.length - 1}` : ''].filter(Boolean).join(' · ') || undefined, onClick: c ? () => ir('pedido', { id: c.id }) : undefined })}
      {passo({ icone: '✂️', nome: 'Triagem', feito: !!triagem, titulo: triagem?.codigo ?? (veioSeparado ? t('não precisou') : undefined), sub: triagem ? `${dataBR(triagem.em)}${triagem.por ? ` · ${triagem.por}` : ''}` : veioSeparado ? t('veio separado na compra') : undefined, onClick: triagem ? () => ir('triagem', { aba: 'triagens', t: triagem.id }) : undefined })}
      {passo({ icone: '🏷', nome: 'Etiqueta', feito: !!i.etiquetaImpressaEm, titulo: i.etiquetaImpressaEm ? `${i.codigo ?? ''}${(i.etiquetaVia ?? 1) > 1 ? ` · ${t('{n}ª via', { n: i.etiquetaVia! })}` : ''}` : t('Sem etiqueta'), sub: i.etiquetaImpressaEm ? `${dataBR(i.etiquetaImpressaEm)}${i.etiquetaImpressaPor ? ` · ${i.etiquetaImpressaPor}` : ''}` : t('Toque para imprimir'), onClick: onEtiqueta })}
      {passo({ icone: '💰', nome: 'Venda', feito: vendas.length > 0, titulo: vendas[0]?.codigo, sub: vendas.length ? [vendas[0].cliente, vendas.length > 1 ? `+${vendas.length - 1}` : ''].filter(Boolean).join(' · ') || undefined : undefined, onClick: vendas.length ? () => ir('venda', { id: vendas[0].id }) : undefined })}
    </div>
  )
}

const diasTexto = (n: number, t: ReturnType<typeof useT>) => (n === 0 ? t('hoje') : n === 1 ? t('há 1 dia') : t('há {n} dias', { n }))
const porKg = (custo: number, g: number) => (g > 0 ? Math.round((custo * 1000) / g) : 0)

/* ─────────────── TRIAGEM: avaliar e classificar ─────────────── */

export function ResumoTriagem({ dados, gen, campos, onEtiqueta, onRastreio }: ResumoLoteProps) {
  const t = useT()
  const i = dados.item
  const m = moedaPadrao()
  const q = (n: number) => fmt(n, i.unidade === 'grama' ? 'gramas' : 'numero')
  const etapa = dados.etapa
  const parado = !!etapa && etapa.dias > dados.limites.triagemParadaDias
  const titulo = dados.status === 'naoIdentificado' ? t('Ficou para depois na separação')
    : dados.status === 'preparando' ? t('Em preparação: {e}', { e: t(etapa?.nome ?? '') })
    : dados.separacoes.length ? t('Separado em parte — ainda sobra cabelo bruto') : t('Esperando separar')
  // A AVALIAÇÃO: cada característica do cabelo, com o que ainda falta definir (vem na separação)
  const avaliacao = campos.map((c) => {
    const v = i.campos[c.id]
    const vazio = v === undefined || v === null || v === ''
    return { id: c.id, nome: c.nome, valor: vazio ? undefined : c.tipo === 'simNao' ? (v ? t('sim') : t('não')) : `${t(String(v))}${c.unidade ? ` ${c.unidade}` : ''}` }
  })
  const definidos = avaliacao.filter((a) => a.valor)
  const faltam = avaliacao.filter((a) => !a.valor)
  const inicial = dados.fluxo.inicial
  return (
    <div className="space-y-4">
      <FaixaSituacao tom={parado ? 'alerta' : 'marca'} titulo={titulo} fatos={[
        ...(etapa ? [{ rotulo: 'Etapa da triagem', valor: t(etapa.nome) }, { rotulo: 'Nesta etapa', valor: <>{diasTexto(etapa.dias, t)}{parado ? ` · ⏰ ${t('parado')}` : ''}</>, alerta: parado }] : []),
        { rotulo: 'Próximo passo', valor: dados.status === 'preparando' ? t('terminar a preparação e separar') : t('separar por medida (✂️ Separar)') },
      ]} />

      {/* A AVALIAÇÃO DO CABELO: o que já se sabe (em destaque) e o que a separação vai definir */}
      <section aria-label={t('Avaliação do cabelo')} className="rounded-2xl border border-[var(--borda)] bg-[var(--cartao)] p-4 shadow-sm">
        <TituloBloco sub="o que já se sabe deste cabelo">🔎 {t('Avaliação do cabelo')}</TituloBloco>
        {definidos.length > 0 ? (
          <dl className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {definidos.map((a) => (
              <div key={a.id} className="min-w-0 rounded-xl bg-[var(--fundo)] px-3 py-2">
                <dt className="truncate text-xs text-[var(--suave)]">{t(a.nome)}</dt>
                <dd className="truncate text-base font-bold">{a.valor}</dd>
              </div>
            ))}
          </dl>
        ) : <p className="text-sm text-[var(--suave)]">{t('Nada avaliado ainda.')}</p>}
        {faltam.length > 0 && <p className="mt-2 text-xs text-[var(--suave)]">{t('A definir na separação')}: {faltam.map((a) => t(a.nome)).join(' · ')}</p>}
        {i.faseTriagem?.obs && <p className="mt-2 rounded-lg bg-[var(--fundo)] px-3 py-2 text-sm">📝 {i.faseTriagem.obs}</p>}
      </section>

      {/* O RESULTADO DA TRIAGEM: peso que virou pacote, perda, quem e quando (ou o que vai aparecer aqui) */}
      <section aria-label={t('Resultado da triagem')} className="rounded-2xl border border-[var(--borda)] bg-[var(--cartao)] p-4 shadow-sm">
        <TituloBloco sub="o que a separação deu">✂️ {t('Resultado da triagem')}</TituloBloco>
        {dados.separacoes.length ? (
          <ul className="space-y-2">
            {dados.separacoes.map((s) => (
              <li key={s.id} className="num flex flex-wrap items-center gap-x-3 gap-y-1 rounded-xl bg-[var(--fundo)] px-3 py-2 text-sm">
                <span>{q(s.pesoBruto)} <span aria-hidden className="text-[var(--suave)]">→</span> <b className="text-[var(--bom)]">{q(s.pesoLiquido)}</b></span>
                <span className="rounded-full bg-[var(--alerta)]/12 px-2 py-0.5 text-xs font-bold text-[var(--alerta)]">{t('perda')} {(s.perdaPct / 100).toLocaleString()}% · {q(s.perda)}</span>
                <span className="text-xs text-[var(--suave)]">{t('{n} pacote(s)', { n: s.partes.length })} · {dataBR(s.em)}{s.por ? ` · ${s.por}` : ''}</span>
              </li>
            ))}
          </ul>
        ) : <p className="text-sm text-[var(--suave)]">{t('Ainda não separado. Ao separar, aparecem aqui o peso que virou pacote, a perda e quem separou.')}</p>}
      </section>

      {/* NÚMEROS da avaliação: peso e custo (o custo por kg ajuda a decidir o preço); vendido/lucro só se vendeu bruto */}
      <GrupoNumeros colunas={dados.vendido > 0 ? 4 : 2}>
        <NumeroGrande icone="⚖️" rotulo="Peso agora" valor={q(i.saldo)} sub={inicial !== i.saldo ? `${t('entrou')} ${q(inicial)}` : undefined} />
        <NumeroGrande icone="💵" rotulo="Custo do lote" valor={formatar(i.custoPrincipal ?? 0, m)} sub={i.unidade === 'grama' && inicial ? `${formatar(porKg(i.custoPrincipal ?? 0, inicial), m)} / kg` : undefined} />
        {dados.vendido > 0 && <NumeroGrande icone="💰" rotulo="Vendido (bruto)" valor={formatar(dados.vendido, m)} onClick={onRastreio} />}
        {dados.vendido > 0 && <NumeroGrande rotulo="Lucro (vendido − custo)" valor={formatar(dados.lucro, m)} tom={dados.lucro < 0 ? 'ruim' : 'bom'} onClick={onRastreio} />}
      </GrupoNumeros>

      <section aria-label={t('A vida do pacote')}>
        <TituloBloco sub="toque num passo para abrir">🧬 {t('A vida do pacote')}</TituloBloco>
        <VidaDoPacote dados={dados} gen={gen} onEtiqueta={onEtiqueta} />
      </section>
    </div>
  )
}

/* ─────────────── ESTOQUE: disponibilidade, onde está e rastreabilidade ─────────────── */

export function ResumoEstoque({ dados, gen, onEtiqueta, onRastreio }: ResumoLoteProps) {
  const t = useT()
  const i = dados.item
  const m = moedaPadrao()
  const q = (n: number) => fmt(n, i.unidade === 'grama' ? 'gramas' : 'numero')
  const f = dados.fluxo
  const r = i.reserva
  const desde = i.criadoEm
  const dias = dados.etapa?.dias ?? 0
  const parado = i.saldo > 0 && !dados.vendido && dias > dados.limites.loteParadoDias
  // a frase do estado, do ponto de vista de quem vai vender
  const titulo = i.saldo <= 0 ? t('Esgotado — não tem mais cabelo neste pacote')
    : r ? t('🔒 Reservado para {c}{ate}', { c: r.para, ate: r.ate ? ` ${t('até')} ${dataBR(r.ate)}` : '' })
    : dados.status === 'parcial' ? t('Disponível em parte: {g} de {total}', { g: q(i.saldo), total: q(f.inicial) })
    : t('Disponível para vender')
  const etiqueta = !i.etiquetaImpressaEm ? { valor: t('sem etiqueta'), alerta: i.saldo > 0 } : dados.etiquetaVelha ? { valor: t('peso mudou — reimprimir'), alerta: true } : { valor: t('confere com o peso'), alerta: false }
  // nada vendido direto dele (só separado, ou ainda não vendeu): vendido/lucro seriam 0 — a Venda "ainda não" já diz isso
  const soSeparado = f.separado > 0 && !dados.vendido
  const vendeu = dados.vendido > 0
  return (
    <div className="space-y-4">
      <FaixaSituacao tom={i.saldo <= 0 ? undefined : parado ? 'alerta' : 'bom'} titulo={titulo} fatos={[
        ...(dados.etapa && i.saldo > 0 ? [{ rotulo: 'Onde está (quadro)', valor: t(dados.etapa.nome) }] : []),
        { rotulo: 'Etiqueta', valor: etiqueta.valor, alerta: etiqueta.alerta },
        { rotulo: 'No estoque desde', valor: <>{dataBR(desde)}{i.saldo > 0 ? ` · ${diasTexto(dias, t)}` : ''}{parado ? ` · ⏰ ${t('parado')}` : ''}</>, alerta: parado },
      ]} />

      {/* NÚMEROS da gestão: quanto tem para vender, quanto saiu, custo e lucro (tocar abre o rastreio) */}
      <GrupoNumeros colunas={vendeu ? 4 : 2}>
        <NumeroGrande icone="📦" rotulo={r ? 'Reservado' : 'Disponível'} valor={q(i.saldo)} tom={i.saldo > 0 && !r ? 'bom' : undefined} sub={f.inicial !== i.saldo ? `${t('entrou')} ${q(f.inicial)}` : undefined} />
        {vendeu && <NumeroGrande icone="💰" rotulo="Vendido" valor={formatar(dados.vendido, m)} sub={f.vendido ? q(f.vendido) : undefined} onClick={onRastreio} />}
        <NumeroGrande icone="💵" rotulo="Custo do lote" valor={formatar(i.custoPrincipal ?? 0, m)} sub={soSeparado ? t('dividido entre os pacotes') : i.unidade === 'grama' && f.inicial ? `${formatar(porKg(i.custoPrincipal ?? 0, f.inicial), m)} / kg` : undefined} />
        {vendeu && <NumeroGrande rotulo="Lucro (vendido − custo)" valor={formatar(dados.lucro, m)} tom={dados.lucro < 0 ? 'ruim' : 'bom'} onClick={onRastreio} />}
      </GrupoNumeros>

      {/* RASTREABILIDADE: de onde veio e para onde foi — cada passo abre o registro */}
      <section aria-label={t('Rastreabilidade')}>
        <TituloBloco sub="de onde veio e para onde foi · toque para abrir">🧬 {t('Rastreabilidade')}</TituloBloco>
        <VidaDoPacote dados={dados} gen={gen} onEtiqueta={onEtiqueta} />
      </section>
    </div>
  )
}
