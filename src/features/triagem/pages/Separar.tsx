// SEPARAR (#/separar?id=… ou ?ids=a,b): a separação em TRÊS passos na ordem do trabalho, todos à vista:
//   1 · Quanto vai separar   (tudo, já preenchido; "só uma parte" e "pesei e deu diferente" a um toque)
//   2 · As partes            (peso + medida/categoria/cor de cada uma; "+ outra parte"; o que não sabe → para depois)
//   3 · A perda              (calculada sozinha: entrou = partes + para depois + perda, com a barra)
// UM botão: "✂️ Separar em N pacotes". O resto (observação, rateio do custo, códigos digitados, só juntar) fica no "+ mais".
// Mesmos comandos e regras da separação antiga (triarLotes, conferirPesoCompra): só a tela ficou mais simples.
import { useCallback, useState } from 'react'
import { novoId } from '../../../core/domain/ids'
import type { Campos, Id } from '../../../core/domain/tipos'
import { fatorDaTabela } from '../../../core/services/precos'
import { Botao, BotaoExpandir, Campo, Entrada, ErroTela, GramasInput, Info, Pagina, Selecao, cx, fmt, gramasTexto } from '../../../shared/ui/base'
import { CamposDinamicos } from '../../../shared/ui/camposDinamicos'
import { CampoCodigo } from '../../../shared/ui/codigos'
import { useApp, useAvisoSaida, useComando, useConsulta } from '../../../shared/ui/contexto'
import { useT } from '../../../shared/ui/i18n'
import { useCamposModulo } from '../../estoque'
import { SecaoMistura } from '../components/pecasMistura'

const DICA_SEPARAR = 'Digite o peso e o que é cada parte; o que sobrar é perda. Ex.: 10 kg bruto → 2 kg loiro + 2 kg moreno + 6 kg para depois.'
const DICA_PERDA = 'O que não virou pacote. Ex.: separou 10.000 g, saíram 9.400 g → 600 g (6%) de perda.'
const DICA_REFERENCIA = 'Divide o custo pelo valor de mercado. Ex.: 60 cm vale mais que 30 cm, então leva mais do custo.'
const DICA_PESEI = 'Recebimento: o fornecedor disse um peso e a balança deu outro. A diferença fica na compra (dá para cobrar do fornecedor), separada da perda da triagem. Ex.: comprou 10 kg, pesou 9,6 kg → −400 g de diferença; a perda da separação conta a partir dos 9,6 kg.'

/** A rota: depois de separar volta para a Triagem (onde aparece "Próximo passo: gerar a etiqueta") ou para o pacote novo. */
export function SepararTela() {
  const { nav, voltar, ir, marcarSujo } = useApp()
  const ids = (nav.params.ids ? String(nav.params.ids).split(',') : [nav.params.id as Id]).filter(Boolean)
  const daTriagem = nav.params.volta === 'triagem'
  const seguir = (feitos: Id[]) => {
    marcarSujo(false)
    const novos = feitos.length ? feitos.join(',') : undefined
    if (daTriagem || feitos.length !== 1) ir('triagem', { novos })
    else ir('lote', { id: feitos[0], novos })
  }
  return <Separar ids={ids} onFechar={voltar} voltarRotulo={daTriagem ? 'Voltar à triagem' : undefined} onSeparou={seguir} />
}

type Parte = { id: Id; quantidade?: number; campos: Campos; ref?: string; codigo?: string }

export function Separar({ ids, onFechar, onSeparou, voltarRotulo }: { ids: Id[]; onFechar(): void; onSeparou(lotes: Id[]): void; voltarRotulo?: string }) {
  const t = useT()
  const { dados: primeiro, erro } = useConsulta('fichaItem', { id: ids[0] })
  const { dados: todos } = useConsulta('estoque', { moduloId: primeiro?.item.moduloId ?? '' }, !!primeiro)
  const campos = useCamposModulo(primeiro?.item.moduloId ?? '', primeiro?.item.tipoItem)
  const { executar, ocupado } = useComando()
  const { avisar } = useApp()
  const [id] = useState(() => novoId())
  const [usada, setUsada] = useState<number>()
  const [pesado, setPesado] = useState<number>()
  const [motivo, setMotivo] = useState('')
  const [partes, setPartes] = useState<Parte[]>([{ id: novoId(), campos: { estado: 'Separado', categoria: 'Normal' } }])
  const [depois, setDepois] = useState<{ id: Id; quantidade?: number; codigo?: string }>(() => ({ id: novoId() }))
  const [verDepois, setVerDepois] = useState(false)
  const [mais, setMais] = useState(false)
  const { dados: regrasCodigos } = useConsulta('codigos', {})
  const [digitarCodigos, setDigitarCodigos] = useState<boolean>()
  const [codigosOk, setCodigosOk] = useState<Record<Id, boolean>>({})
  const marcarCodigo = useCallback((pid: Id, ok: boolean) => setCodigosOk((m) => (m[pid] === ok ? m : { ...m, [pid]: ok })), [])
  const [porValor, setPorValor] = useState(true)
  const [coluna, setColuna] = useState<string>()
  const { dados: tabelas } = useConsulta('tabelasPreco', { moduloId: 'cabelo' })
  const tabela = tabelas?.find((x) => !x.categoria) ?? tabelas?.[0]
  useAvisoSaida(usada !== undefined || coluna !== undefined || !!depois.quantidade || partes.length > 1 || partes.some((p) => p.quantidade || p.ref || p.campos.comprimento || p.campos.cor))
  const col = coluna ?? tabela?.colunas.find((c) => /p\.?w|paragu/i.test(c.nome))?.id ?? tabela?.colunas[0]?.id
  const refDe = (p: { campos: Campos; ref?: string }) => {
    if (p.ref) return p.ref
    const med = Number(p.campos.comprimento)
    const tb = tabelas?.find((x) => (x.categoria ?? 'Normal') === String(p.campos.categoria ?? 'Normal')) ?? tabela
    return tb && med && col ? fatorDaTabela(tb, med, col).fator : undefined
  }
  if (erro) return <ErroTela texto={erro} onVoltar={onFechar} />
  if (!primeiro || (ids.length > 1 && !todos)) return null
  const lotes = ids.length > 1 ? ids.map((x) => todos!.find((i) => i.id === x)).filter((i): i is NonNullable<typeof i> => !!i) : [primeiro.item]
  const juntar = lotes.length > 1
  // pacote bruto da compra, ainda inteiro → "Pesei e deu diferente" lança a diferença na compra antes
  const compraDoLote = !juntar && primeiro.item.origem?.tipo === 'compra' && primeiro.item.saldo === primeiro.item.quantidadeInicial ? primeiro.item.origem.id : undefined
  const total = pesado ?? lotes.reduce((s, l) => s + l.saldo, 0)
  const usar = usada ?? total
  const somaPartes = partes.reduce((s, p) => s + (p.quantidade ?? 0), 0)
  const gDepois = depois.quantidade ?? 0
  const soma = somaPartes + gDepois
  const perda = Math.max(0, usar - soma)
  const passou = soma > usar
  const pctPerda = usar ? Math.round((perda * 10000) / usar) : 0
  const digitar = digitarCodigos ?? regrasCodigos?.regras.lote.modo === 'manual'
  const codigosDigitados = [...partes.map((p) => p.codigo), gDepois ? depois.codigo : undefined].map((c) => (c ?? '').trim().toUpperCase()).filter(Boolean)
  const codigosValidos = !digitar || ([...partes, ...(gDepois ? [depois] : [])].every((p) => codigosOk[p.id] !== false) && new Set(codigosDigitados).size === codigosDigitados.length)
  const exemploPeso = { g: t('Ex.: 500'), kg: t('Ex.: 0,5') }
  const att = (i: number, d: Partial<Parte>) => setPartes(partes.map((p, k) => (k === i ? { ...p, ...d, campos: { ...p.campos, ...(d.campos ?? {}) } } : p)))
  const nPacotes = partes.filter((p) => p.quantidade).length + (gDepois ? 1 : 0)
  const codigos = lotes.map((l) => l.codigo ?? '').join(' + ')
  const triar = async (comPartes: boolean) => {
    if (compraDoLote && pesado !== undefined && pesado !== primeiro.item.saldo) {
      const ok = await executar('conferirPesoCompra', { compraId: compraDoLote, itemId: primeiro.item.id, pesado, motivo: t('Pesado na triagem') })
      if (!ok) return
    }
    const r = await executar('triarLotes', {
      id,
      ids: lotes.map((l) => l.id),
      motivo,
      quantidadeUsada: comPartes ? usar : undefined,
      saidas: comPartes ? partes.filter((p) => p.quantidade).map((p) => ({ id: p.id, quantidade: p.quantidade!, campos: p.campos, valorReferencia: porValor ? refDe(p) : undefined, codigo: digitar ? p.codigo?.trim() || undefined : undefined })) : undefined,
      paraDepois: comPartes && gDepois ? { id: depois.id, quantidade: gDepois, codigo: digitar ? depois.codigo?.trim() || undefined : undefined } : undefined,
    })
    // o aviso de feito vem da resposta: se juntou com um pacote já misturado, diz que a mistura antiga foi desfeita
    if (r) avisar(r.misturasDesfeitas?.length ? t('Mistura {c} desfeita, partes juntadas e histórico atualizado.', { c: r.misturasDesfeitas.join(', ') }) : comPartes ? t('Triagem feita.') : t('Lotes juntados.'), 'ok')
    if (r) onSeparou(r.lotes)
  }
  const falta = !soma ? t('Digite o peso de pelo menos uma parte.') : passou ? t('As partes passam do que entrou em {g}.', { g: gramasTexto(soma - usar) }) : !codigosValidos ? t('Confira os códigos digitados.') : undefined

  return (
    <Pagina
      titulo={<span className="inline-flex flex-wrap items-center">{juntar ? `${t('Juntar e separar')} ${codigos}` : `${t('Separar')} ${codigos}`}<Info texto={DICA_SEPARAR} /></span>}
      subtitulo={juntar ? undefined : lotes[0].nome}
      onVoltar={onFechar}
      voltarRotulo={voltarRotulo}
      trilha={`${t(juntar ? 'Juntar e separar' : 'Separar')} ${codigos}`}
      rodape={
        <div className="flex flex-wrap items-center gap-2">
          <span className={cx('num linha-texto min-w-0 flex-1 text-xs font-semibold', falta ? 'text-[var(--suave)]' : 'text-[var(--bom)]')}>{falta ?? `✓ ${t('{n} pacote(s) novo(s) · perda {g}', { n: nPacotes, g: gramasTexto(perda) })}`}</span>
          <Botao grande className="min-w-max" disabled={ocupado || !!falta} onClick={() => triar(true)}>✂️ {nPacotes > 1 ? t('Separar em {n} pacotes', { n: nPacotes }) : t('Separar')}</Botao>
        </div>
      }
    >
      <div className="space-y-6">
        {/* 1 · QUANTO VAI SEPARAR */}
        <SecaoMistura n={1} titulo="Quanto vai separar">
          <div className="rounded-xl border border-[var(--borda)] bg-[var(--cartao)] p-3">
            <div className="num flex flex-wrap items-baseline gap-x-2">
              <span className="min-w-0 flex-1 text-sm">{juntar ? lotes.map((l) => `${l.codigo ?? ''} ${gramasTexto(l.saldo)}`).join(' + ') : <><b className="font-mono">{lotes[0].codigo}</b> · {t('tudo')}</>}</span>
              <b className="whitespace-nowrap text-2xl font-black">{gramasTexto(usar)}</b>
            </div>
            {usar !== total && <p className="num text-xs text-[var(--suave)]">{t('de {g}: o resto continua bruto para separar outro dia.', { g: gramasTexto(total) })}</p>}
          </div>
          {!juntar && (
            <div className="flex flex-wrap gap-x-4">
              <label className="flex min-h-10 items-center gap-2 text-sm font-semibold"><input type="checkbox" className="h-5 w-5" checked={usada !== undefined && usada !== total} onChange={(e) => setUsada(e.target.checked ? Math.round(total / 2) : undefined)} /> {t('Só uma parte agora')}</label>
              {compraDoLote && (
                <label className="flex min-h-10 items-center gap-2 text-sm font-semibold">
                  <input type="checkbox" className="h-5 w-5" checked={pesado !== undefined} onChange={(e) => (setPesado(e.target.checked ? lotes[0].saldo : undefined), setUsada(undefined))} />
                  {t('Pesei e deu diferente')}<Info texto={DICA_PESEI} />
                </label>
              )}
            </div>
          )}
          {pesado !== undefined && (
            <Campo rotulo="Quanto deu na balança?">
              <GramasInput valor={pesado} onChange={(v) => setPesado(v ?? 0)} />
              {pesado !== lotes[0].saldo && <span className={cx('num mt-1 block text-xs font-semibold', pesado < lotes[0].saldo ? 'text-[var(--ruim)]' : 'text-[var(--bom)]')}>{pesado > lotes[0].saldo ? '+' : '−'}{gramasTexto(Math.abs(pesado - lotes[0].saldo))} {t('de diferença (fica na compra)')}</span>}
            </Campo>
          )}
          {usada !== undefined && usada !== total && <Campo rotulo="Quanto vai separar agora?"><GramasInput valor={usar} onChange={setUsada} /></Campo>}
        </SecaoMistura>

        {/* 2 · AS PARTES: cada uma vira um pacote novo com etiqueta */}
        <SecaoMistura n={2} titulo="As partes (cada uma vira um pacote)">
          {digitar && new Set(codigosDigitados).size !== codigosDigitados.length && <p className="text-sm text-[var(--ruim)]">{t('Há dois lotes com o mesmo código.')}</p>}
          <ul className="space-y-2">
            {partes.map((p, i) => (
              <li key={p.id} className={cx('space-y-2 rounded-xl border bg-[var(--cartao)] p-3', p.quantidade ? 'border-[var(--bom)]/50' : 'border-[var(--borda)]')}>
                <div className="flex items-center gap-2">
                  <span aria-hidden className={cx('flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold', p.quantidade ? 'bg-[var(--bom)] text-white' : 'bg-[var(--fundo)] text-[var(--suave)]')}>{p.quantidade ? '✓' : i + 1}</span>
                  <b className="min-w-0 flex-1 text-sm">{t('Parte {n}', { n: i + 1 })}</b>
                  {partes.length > 1 && <button type="button" onClick={() => setPartes(partes.filter((_, k) => k !== i))} aria-label={t('Tirar a parte {n}', { n: i + 1 })} className="h-10 w-10 shrink-0 rounded-lg text-[var(--ruim)] hover:bg-[var(--fundo)]">✕</button>}
                </div>
                <Campo rotulo="Peso"><GramasInput valor={p.quantidade} placeholder={exemploPeso} onChange={(q) => att(i, { quantidade: q })} /></Campo>
                <CamposDinamicos campos={campos} valores={p.campos} onChange={(v) => att(i, { campos: v })} pular={['estado']} principais={['comprimento', 'categoria', 'cor']} />
                {mais && porValor && <Campo rotulo="Valor de referência" ajuda="Vem da tabela (medida × coluna escolhida). Pode mudar."><Entrada inputMode="decimal" value={p.ref ?? ''} placeholder={refDe(p) ?? '?'} onChange={(e) => att(i, { ref: e.target.value })} /></Campo>}
                {digitar && <CampoCodigo tipo="lote" rotulo="Código deste lote" valor={p.codigo ?? ''} onChange={(v) => att(i, { codigo: v })} contexto={{ paiId: juntar ? undefined : lotes[0].id, posicao: i }} onEstado={(ok) => marcarCodigo(p.id, ok)} />}
              </li>
            ))}
          </ul>
          <div className="flex flex-wrap gap-2">
            <Botao variante="secundario" className="min-w-max flex-1" onClick={() => setPartes([...partes, { id: novoId(), campos: { ...partes[partes.length - 1]?.campos, comprimento: undefined } }])}>+ {t('Outra parte')}</Botao>
            {!verDepois && !gDepois && <Botao variante="leve" className="min-w-max flex-1" onClick={() => setVerDepois(true)}>❓ {t('Não sei o que é: para depois')}</Botao>}
          </div>
          {(verDepois || gDepois > 0) && (
            <div className="space-y-2 rounded-xl border border-dashed border-[#a78bfa] p-3">
              <p className="text-sm"><b>❓ {t('Para depois')}</b> <span className="text-[var(--suave)]">· {t('não é perda: volta para separar outro dia (aba Para depois).')}</span></p>
              <div className="grid grid-cols-[1fr_auto] items-end gap-2 sm:max-w-sm">
                <Campo rotulo="Peso"><GramasInput valor={depois.quantidade} placeholder={exemploPeso} onChange={(q) => setDepois({ ...depois, quantidade: q })} /></Campo>
                <Botao variante="leve" disabled={usar - somaPartes <= 0} onClick={() => setDepois({ ...depois, quantidade: usar - somaPartes })}>{t('Tudo o que sobrou')}</Botao>
              </div>
              {digitar && gDepois > 0 && <CampoCodigo tipo="lote" rotulo="Código deste lote" valor={depois.codigo ?? ''} onChange={(v) => setDepois({ ...depois, codigo: v })} contexto={{ paiId: juntar ? undefined : lotes[0].id, posicao: partes.length }} onEstado={(ok) => marcarCodigo(depois.id, ok)} />}
            </div>
          )}
        </SecaoMistura>

        {/* 3 · A PERDA: calculada sozinha (a barra: partes · para depois · perda) */}
        <SecaoMistura n={3} titulo="A perda (calculada sozinha)" extra={<Info texto={DICA_PERDA} />}>
          <div className="num rounded-xl border border-[var(--borda)] bg-[var(--cartao)] p-3 text-sm">
            <div aria-hidden className="mb-2 flex h-3 w-full gap-px overflow-hidden rounded-full bg-[var(--fundo)]">
              <span style={{ flexGrow: somaPartes, flexBasis: 0, background: 'var(--bom)' }} />
              {gDepois > 0 && <span style={{ flexGrow: gDepois, flexBasis: 0, background: '#a78bfa' }} />}
              {perda > 0 && <span style={{ flexGrow: perda, flexBasis: 0, minWidth: 3, background: 'var(--alerta)' }} />}
            </div>
            <p className="flex flex-wrap gap-x-3 gap-y-1">
              <span>{t('Entrou')} <b>{gramasTexto(usar)}</b></span>
              <span className="text-[var(--bom)]">= {t('partes')} <b>{gramasTexto(somaPartes)}</b></span>
              {gDepois > 0 && <span className="text-[#7c3aed]">+ {t('para depois')} <b>{gramasTexto(gDepois)}</b></span>}
              <span className={passou ? 'text-[var(--ruim)]' : perda > 0 ? 'text-[var(--alerta)]' : 'text-[var(--bom)]'}>{passou ? <>⚠️ {t('passou')} <b>+{gramasTexto(soma - usar)}</b></> : <>+ {t('perda')} <b>{gramasTexto(perda)} ({fmt(pctPerda, 'percentual')})</b></>}</span>
            </p>
          </div>
        </SecaoMistura>

        {/* + MAIS: o que quase ninguém mexe */}
        <div>
          <BotaoExpandir aberto={mais} onClick={() => setMais(!mais)} className="-ml-2">{t('+ mais')} <span className="font-normal text-[var(--suave)]">({t(juntar ? 'observação, custo, códigos, só juntar' : 'observação, custo e códigos')})</span></BotaoExpandir>
          {mais && (
            <div className="mt-2 space-y-3 rounded-xl bg-[var(--fundo)] p-3 text-sm">
              <Campo rotulo="Observação (fica no histórico)"><Entrada value={motivo} placeholder={t('Ex.: mesma qualidade, lavar junto')} onChange={(e) => setMotivo(e.target.value)} /></Campo>
              <div>
                <label className="flex items-center gap-2 font-semibold"><input type="checkbox" className="h-5 w-5" checked={porValor} onChange={(e) => setPorValor(e.target.checked)} /> {t('Dividir o custo pelo valor de referência (recomendado)')}<Info texto={DICA_REFERENCIA} /></label>
                <p className="mt-1 text-xs text-[var(--suave)]">{t('Sem isso, o custo é dividido pelo peso de cada parte.')}</p>
                {porValor && tabela && <div className="mt-2"><Selecao valor={col} onChange={setColuna} opcoes={tabela.colunas.map((c) => ({ id: c.id, nome: `${t('Preço de referência')}: ${c.nome}` }))} /></div>}
              </div>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-[var(--suave)]">{t('Código dos lotes que saem')}: <b className="text-[var(--texto)]">{t(digitar ? 'digitado' : 'automático')}</b></span>
                <Botao variante="leve" onClick={() => setDigitarCodigos(!digitar)}>{digitar ? t('Usar os automáticos') : `✎ ${t('Digitar os códigos')}`}</Botao>
              </div>
              {juntar && (
                <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[var(--borda)] pt-3">
                  <span className="linha-texto text-[var(--suave)]">{t('Só juntar agora: vira 1 pacote com o peso somado; separa depois.')}</span>
                  <Botao variante="secundario" disabled={ocupado} onClick={() => triar(false)}>🔗 {t('Só juntar')}</Botao>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </Pagina>
  )
}
