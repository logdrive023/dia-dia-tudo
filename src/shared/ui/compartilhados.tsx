// Peças com regra de tela usadas por várias telas: escolher pessoa (com cadastro rápido), pagamentos em várias
// moedas, fotos/comprovantes, conversor de moedas e recibo no WhatsApp.

import { useEffect, useRef, useState } from 'react'
import { formasEmUso } from '../../core/domain/formas'
import { CampoTelefone } from './campoTelefone'
import { MOEDAS, type Cotacao, converter, formatar, moeda as moedaDe, type TabelaCotacoes, valorDeUm } from '../../core/domain/dinheiro'
import { novoId } from '../../core/domain/ids'
import { dataLocal, diasEntre } from '../../core/domain/datas'
import type { CategoriaAnexo, Id, Papel } from '../../core/domain/tipos'
import { Botao, Campo, Carregando, Entrada, Janela, Pilula, Selecao, ValorInput, cx, moedaPadrao } from './base'
import { useApp, useComando, useConsulta } from './contexto'
import { useT } from './i18n'
import { VisorFotos, useEnviarFotos } from './fotos'
import { ehFoto } from '../../core/services/fotos'

// ---------- pessoa ----------

export function SeletorPessoa({ valor, onChange, papel, localId, rotulo = 'Pessoa', opcional }: { valor?: Id; onChange(id: Id | undefined): void; papel?: Papel; localId?: Id; rotulo?: string; opcional?: boolean }) {
  const t = useT()
  const { dados } = useConsulta('pessoas', { papel })
  const { executar, ocupado } = useComando()
  const [novo, setNovo] = useState(false)
  const [nome, setNome] = useState('')
  const [tel, setTel] = useState('')
  const lista = (dados ?? []).filter((p) => !localId || !p.localId || p.localId === localId)
  const salvar = async () => {
    const id = novoId()
    const r = await executar('salvarPessoa', { id, nome: nome.trim(), telefone: tel, papeis: [papel ?? 'cliente'], localId })
    if (r) {
      onChange(id)
      setNovo(false)
      setNome('')
      setTel('')
    }
  }
  // o rótulo envolve só a lista; o botão "+ Nova" e a janela ficam fora (rótulo não pode ter outros controles)
  return (
    <div>
      <div className="flex items-end gap-2">
        <Campo rotulo={rotulo} className="min-w-0 flex-1">
          <Selecao valor={valor} onChange={(v) => onChange(v || undefined)} vazio={opcional ? 'Sem nome (não fica na conta)' : 'Escolha…'} opcoes={lista.map((p) => ({ id: p.id, nome: p.nome }))} />
        </Campo>
        <Botao variante="secundario" className="min-h-11" onClick={() => setNovo(true)} aria-label={t('Cadastrar nova pessoa')}>
          + {t('Nova')}
        </Botao>
      </div>
      <Janela aberta={novo} titulo={t('Cadastro rápido')} onFechar={() => setNovo(false)} rodape={<Botao grande className="w-full" disabled={ocupado || !nome.trim()} onClick={salvar}>{t('Salvar')}</Botao>}>
        <div className="space-y-3">
          <Campo rotulo="Nome"><Entrada autoFocus value={nome} onChange={(e) => setNome(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && nome.trim() && !ocupado && salvar()} /></Campo>
          <Campo rotulo="WhatsApp (opcional)" comoDiv><CampoTelefone valor={tel} onChange={setTel} /></Campo>
        </div>
      </Janela>
    </div>
  )
}

/** Linha de tabela/lista clicável que também abre pelo teclado (Enter/Espaço). */
export function clicavel(acao?: () => void) {
  if (!acao) return {}
  return {
    role: 'link',
    tabIndex: 0,
    onClick: acao,
    onKeyDown: (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault()
        acao()
      }
    },
  }
}

// ---------- pagamentos ----------

export interface PagamentoTela {
  id: Id
  forma: string
  moeda: string
  valor?: number
  /** cotação digitada para ESTE pagamento ("6,96" = 1 US$ = 6,96 na moeda principal); sem ela vale a sugerida */
  cotacao?: string
}

/** cotação digitada: "6,96" ou "6.96" → "6,96" (inválida → undefined) */
export function lerCotacaoTexto(texto: string | undefined) {
  const s = (texto ?? '').trim()
  if (!/^\d+([.,]\d+)?$/.test(s) || !(Number(s.replace(',', '.')) > 0)) return undefined
  return s.replace('.', ',')
}
/** 6.96 → "6,96" (até 4 casas, sem separador de milhar) */
export const cotacaoTexto = (n: number) => String(Math.round(n * 10000) / 10000).replace('.', ',')

/** Cotação "1 [moeda] = X [principal]" pronta para mandar ao backend. */
export function cotacaoDigitada(moeda: string, texto: string, principal: string): Cotacao {
  return { moeda, valor: texto, sentido: 'basePorMoeda', contra: principal, data: '', uso: 'venda' }
}

/**
 * Texto da cotação de um pagamento em outra moeda: o digitado, senão o sugerido (cotação já digitada para a moeda,
 * ex. a de cobrança do modo caixa), senão a do sistema. Vazio na moeda principal.
 */
export function textoCotacaoPagamento(p: Pick<PagamentoTela, 'moeda' | 'cotacao'>, principal: string, cot: TabelaCotacoes, sugeridas: Record<string, string> = {}) {
  if (p.moeda === principal) return ''
  if (p.cotacao !== undefined) return p.cotacao
  if (sugeridas[p.moeda]) return sugeridas[p.moeda]
  const v = valorDeUm(p.moeda, principal, cot)
  return v ? cotacaoTexto(v) : ''
}

/** Câmbio em uso: 'venda' (recebo em outra moeda), 'compra' (pago em outra moeda) ou 'base' (mercado). */
export function useCotacoes(uso: 'base' | 'venda' | 'compra' = 'base') {
  const { dados } = useConsulta('configuracoes', {})
  const tabela = uso === 'venda' ? dados?.cotacoesVenda : uso === 'compra' ? dados?.cotacoesCompra : dados?.cotacoes
  return { cot: (tabela ?? {}) as TabelaCotacoes, cfg: dados?.config }
}

export function conv(v: number, de: string, para: string, cot: TabelaCotacoes) {
  try {
    return converter(v, de, para, cot)
  } catch {
    return undefined
  }
}

/**
 * Lista de pagamentos (qualquer moeda e forma). Mostra quanto falta/sobra na moeda do total.
 * cotacaoEditavel (modo caixa): cada pagamento fora da moeda principal ganha o campo "1 US$ = [6,96] Bs", que vem da
 * cotação já digitada para a moeda (cotacoesSugeridas) ou da do sistema; a conta do que falta usa a cotação de cada um.
 */
export function EditorPagamentos({ total, moedaTotal, pagamentos, onChange, permiteFiado, uso = 'venda', cotacaoEditavel, cotacoesSugeridas = {} }: { total: number; moedaTotal: string; pagamentos: PagamentoTela[]; onChange(p: PagamentoTela[]): void; permiteFiado: boolean; uso?: 'venda' | 'compra'; cotacaoEditavel?: boolean; cotacoesSugeridas?: Record<string, string> }) {
  const t = useT()
  const { cot, cfg } = useCotacoes(uso)
  const formas = formasEmUso(cfg?.formas)
  const principal = cfg?.moedaPrincipal ?? moedaPadrao()
  // tabela para converter: a do sistema + as sugeridas (ex.: a cotação de cobrança digitada) + a de cada pagamento
  const base: TabelaCotacoes = { ...cot }
  if (cotacaoEditavel)
    for (const [m, v] of Object.entries(cotacoesSugeridas)) {
      const ok = lerCotacaoTexto(v)
      if (m !== principal && ok) base[m] = cotacaoDigitada(m, ok, principal)
    }
  const tabelaDe = (p: PagamentoTela): TabelaCotacoes => {
    if (!cotacaoEditavel || p.moeda === principal) return base
    const v = lerCotacaoTexto(textoCotacaoPagamento(p, principal, cot, cotacoesSugeridas))
    return v ? { ...base, [p.moeda]: cotacaoDigitada(p.moeda, v, principal) } : base
  }
  const pago = pagamentos.reduce((s, p) => s + (p.valor ? conv(p.valor, p.moeda, moedaTotal, tabelaDe(p)) ?? 0 : 0), 0)
  const falta = total - pago
  const atualizar = (i: number, d: Partial<PagamentoTela>) => onChange(pagamentos.map((p, k) => (k === i ? { ...p, ...d } : p)))
  return (
    <div className="space-y-2">
      {pagamentos.map((p, i) => {
        const formasDaMoeda = formas.filter((f) => f.moedas.includes(p.moeda))
        return (
          <div key={p.id} className="flex flex-wrap items-center gap-2 rounded-xl border border-[var(--borda)] p-2">
            <Selecao className="w-28" valor={p.moeda} onChange={(m) => atualizar(i, { moeda: m, forma: formasEmUso(formas, m)[0]?.id ?? 'dinheiro', valor: undefined, cotacao: undefined })} opcoes={MOEDAS.filter((m) => cfg?.moedasAtivas.includes(m.codigo)).map((m) => ({ id: m.codigo, nome: `${m.simbolo} ${m.codigo}` }))} />
            <Selecao className="w-auto min-w-0 flex-1" valor={p.forma} onChange={(f) => atualizar(i, { forma: f })} opcoes={formasDaMoeda.map((f) => ({ id: f.id, nome: t(f.nome) }))} />
            <button type="button" className="h-10 w-10 text-xl sm:order-last" aria-label={t('Tirar')} onClick={() => onChange(pagamentos.filter((_, k) => k !== i))}>×</button>
            <div className="w-full sm:w-auto sm:flex-1"><ValorInput moeda={p.moeda} valor={p.valor} onChange={(v) => atualizar(i, { valor: v })} /></div>
            {cotacaoEditavel && p.moeda !== principal && MOEDAS.some((m) => m.codigo === p.moeda) && <CampoCotacao moeda={p.moeda} principal={principal} texto={textoCotacaoPagamento(p, principal, cot, cotacoesSugeridas)} onChange={(c) => atualizar(i, { cotacao: c })} />}
          </div>
        )
      })}
      <div className="flex flex-wrap gap-2">
        <Botao variante="secundario" onClick={() => onChange([...pagamentos, { id: novoId(), forma: 'dinheiro', moeda: moedaTotal, valor: falta > 0 ? falta : undefined }])}>
          + {t('Forma de pagamento')}
        </Botao>
        {falta > 0 && pagamentos.length > 0 && (
          <Botao variante="leve" onClick={() => {
            const ult = pagamentos[pagamentos.length - 1]
            const emMoeda = conv(falta, moedaTotal, ult.moeda, tabelaDe(ult)) ?? 0
            atualizar(pagamentos.length - 1, { valor: (ult.valor ?? 0) + emMoeda })
          }}>
            {t('Completar o que falta')}
          </Botao>
        )}
      </div>
      <div className={cx('rounded-xl p-3 text-sm font-semibold', Math.abs(falta) <= 1 ? 'bg-[var(--bom)]/10 text-[var(--bom)]' : falta > 0 ? 'bg-[var(--alerta)]/10 text-[var(--alerta)]' : 'bg-[var(--marca-suave)] text-[var(--marca)]')}>
        {Math.abs(falta) <= 1
          ? t('Pagamento fecha com o total ✓')
          : falta > 0
            ? permiteFiado
              ? t('Faltam {v}: fica na conta da pessoa (fiado).', { v: formatar(falta, moedaTotal) })
              : t('Faltam {v}.', { v: formatar(falta, moedaTotal) })
            : permiteFiado
              ? t('Passou {v}: fica de crédito para a pessoa.', { v: formatar(-falta, moedaTotal) })
              : t('Passou {v} do total.', { v: formatar(-falta, moedaTotal) })}
      </div>
    </div>
  )
}

/** "1 US$ = [6,96] Bs" (cotação de um pagamento ou da visão do Caixa; borda vermelha quando inválida) */
export function CampoCotacao({ moeda, principal, texto, onChange }: { moeda: string; principal: string; texto: string; onChange(t: string): void }) {
  const t = useT()
  const sm = moedaDe(moeda).simbolo
  return (
    <label className="flex w-full items-center gap-2 text-sm font-semibold">
      <span className="shrink-0">1 {sm} =</span>
      <input
        inputMode="decimal"
        aria-label={t('Cotação de {m}', { m: sm })}
        value={texto}
        onChange={(e) => onChange(e.target.value)}
        className={cx('num min-h-10 w-24 rounded-xl border bg-[var(--cartao)] px-2 text-base outline-none focus:border-[var(--marca)]', lerCotacaoTexto(texto) ? 'border-[var(--borda)]' : 'border-[var(--ruim)]')}
      />
      <span className="shrink-0">{moedaDe(principal).simbolo}</span>
    </label>
  )
}

// ---------- conversor ----------

export function ValoresConvertidos({ valor, moeda, uso = 'venda' }: { valor: number; moeda: string; uso?: 'venda' | 'compra' | 'base' }) {
  const { cot, cfg } = useCotacoes(uso)
  const outras = (cfg?.moedasAtivas ?? []).filter((m) => m !== moeda)
  return (
    <div className="flex flex-wrap gap-1">
      {outras.map((m) => {
        const v = conv(valor, moeda, m, cot)
        return v === undefined ? null : <Pilula key={m}>≈ {formatar(v, m)}</Pilula>
      })}
    </div>
  )
}

/** Abre o conversor de qualquer lugar (menu, telas). */
export function abrirConversor() {
  window.dispatchEvent(new Event('tudo:conversor'))
}

const diaMes = (d: string) => d.split('-').reverse().slice(0, 2).join('/')

/**
 * CONVERSOR DE MOEDAS (celular primeiro), em 3 partes:
 *  1 a moeda (toque) e o valor, com o cursor já no campo;
 *  2 o resultado em cada outra moeda — vazio, mostra quanto vale 1; tocar numa moeda converte a partir dela. Com valor,
 *    cada linha diz também quanto dá recebendo (câmbio de venda) e pagando (câmbio de compra), quando forem diferentes;
 *  3 o câmbio em uso: "1 US$ = Bs 11,97" com Dinâmico/Fixo de cada moeda e a data uma vez só (alerta se velha);
 *    o administrador tem o atalho "Ajustar câmbio" (Configurações › Moedas e câmbio).
 * Moeda fraca (ex.: guarani) aparece ao contrário: "Bs 1 = ₲ 163".
 */
export function Conversor() {
  const t = useT()
  const { sessao, ir } = useApp()
  const [aberto, setAberto] = useState(false)
  const [moeda, setMoeda] = useState<string>()
  const [valor, setValor] = useState<number>()
  const campo = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const f = () => (setValor(undefined), setAberto(true))
    window.addEventListener('tudo:conversor', f)
    return () => window.removeEventListener('tudo:conversor', f)
  }, [])
  const { dados } = useConsulta('configuracoes', {}, aberto)
  const principal = dados?.config.moedaPrincipal ?? moedaPadrao()
  const ativas = MOEDAS.filter((m) => dados?.config.moedasAtivas.includes(m.codigo))
  const de = moeda && ativas.some((m) => m.codigo === moeda) ? moeda : principal
  // o cursor já no valor: abrir o conversor é para digitar
  useEffect(() => {
    if (aberto && dados) campo.current?.querySelector('input')?.focus()
  }, [aberto, dados, de])
  const cot = (dados?.cotacoes ?? {}) as TabelaCotacoes
  const base = valor ?? 10 ** moedaDe(de).casas
  const em = (tab: object | undefined, para: string) => conv(base, de, para, (tab ?? {}) as TabelaCotacoes)
  const trocar = (para: string, convertido?: number) => {
    setMoeda(para)
    setValor(valor === undefined ? undefined : convertido)
  }
  // o câmbio em uso: cada moeda ativa contra a principal, com o modo e a data
  const cambios = ativas.filter((m) => m.codigo !== principal).map((m) => {
    const um = valorDeUm(m.codigo, principal, cot)
    const data = dados?.cotacoes[m.codigo]?.data ?? dados?.cotacoes[principal]?.data
    const modo = dados?.config.cambio[m.codigo]?.modo ?? 'dinamico'
    const inverso = um !== undefined && um < 0.1 ? valorDeUm(principal, m.codigo, cot) : undefined
    const texto = um === undefined ? `${m.simbolo} · ${t('sem cotação')}`
      : inverso !== undefined ? `${moedaDe(principal).simbolo} 1 = ${formatar(Math.round(inverso * 10 ** m.casas), m.codigo)}`
      : `1 ${m.simbolo} = ${formatar(Math.round(um * 10 ** moedaDe(principal).casas), principal)}`
    return { codigo: m.codigo, texto, data, modo }
  })
  const datas = ([...new Set(cambios.map((c) => c.data).filter(Boolean))] as string[]).sort()
  const dias = datas[0] ? diasEntre(datas[0], dataLocal()) : 0
  const fechar = () => setAberto(false)
  return (
    <Janela aberta={aberto} titulo={`💱 ${t('Conversor de moedas')}`} onFechar={fechar}>
      {!dados ? <Carregando /> : (
        <div className="space-y-3">
          {/* 1 a moeda e o valor */}
          <div ref={campo} className="space-y-2.5 rounded-2xl bg-[var(--marca-suave)] p-2.5">
            <div role="radiogroup" aria-label={t('Converter de')} className="grid gap-1 rounded-xl bg-[var(--cartao)]/70 p-1" style={{ gridTemplateColumns: `repeat(${ativas.length || 1}, minmax(0, 1fr))` }}>
              {ativas.map((m) => (
                <button key={m.codigo} type="button" role="radio" aria-checked={m.codigo === de} onClick={() => trocar(m.codigo, m.codigo === de ? valor : em(dados.cotacoes, m.codigo))}
                  className={cx('flex min-h-10 min-w-0 items-center justify-center gap-1 rounded-lg px-2 text-sm font-bold transition', m.codigo === de ? 'bg-[var(--marca)] text-white shadow-sm' : 'text-[var(--suave)] hover:text-[var(--texto)]')}>
                  {m.simbolo}<span className="text-[11px] font-medium opacity-75">{m.codigo}</span>
                </button>
              ))}
            </div>
            <label className="block [&_input]:min-h-14 [&_input]:text-2xl [&_input]:font-bold">
              <span className="sr-only">{t('Valor para converter')}</span>
              <ValorInput key={de} moeda={de} valor={valor} onChange={setValor} placeholder="1" />
            </label>
          </div>

          {/* 2 o resultado */}
          <section aria-live="polite" className="space-y-1.5">
            <h3 className="num px-1 text-xs font-semibold uppercase tracking-wider text-[var(--suave)]">
              {valor === undefined ? t('Quanto vale {v}', { v: `${moedaDe(de).simbolo} 1` }) : t('{v} em', { v: formatar(valor, de) })}
            </h3>
            <ul className="divide-y divide-[var(--borda)] overflow-hidden rounded-2xl border border-[var(--borda)] bg-[var(--cartao)]">
              {ativas.filter((m) => m.codigo !== de).map((m) => {
                const v = em(dados.cotacoes, m.codigo)
                const venda = em(dados.cotacoesVenda, m.codigo)
                const compra = em(dados.cotacoesCompra, m.codigo)
                const lados = valor !== undefined && (venda !== v || compra !== v)
                return (
                  <li key={m.codigo}>
                    <button type="button" onClick={() => trocar(m.codigo, v)} aria-label={`${t(m.nome)}: ${v === undefined ? t('sem cotação') : formatar(v, m.codigo)}. ${t('Converter a partir de {m}', { m: m.simbolo })}`}
                      className="flex w-full items-center gap-3 px-3 py-2.5 text-left transition hover:bg-[var(--marca-suave)]">
                      <span aria-hidden className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--marca-suave)] text-xs font-bold text-[var(--marca)]">{m.simbolo}</span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-semibold">{t(m.nome)}</span>
                        {lados && (
                          <span className="num block text-xs leading-snug text-[var(--suave)]">
                            {t('Recebendo')} {venda === undefined ? '—' : formatar(venda, m.codigo)} · {t('Pagando')} {compra === undefined ? '—' : formatar(compra, m.codigo)}
                          </span>
                        )}
                      </span>
                      <span className="num shrink-0 text-right text-xl font-bold">{v === undefined ? <span className="text-sm font-medium text-[var(--suave)]">{t('sem cotação')}</span> : formatar(v, m.codigo)}</span>
                    </button>
                  </li>
                )
              })}
            </ul>
          </section>

          {/* 3 o câmbio em uso */}
          {cambios.length > 0 && (
            <section className="rounded-2xl bg-[var(--fundo)] p-3">
              <div className="mb-2 flex items-center justify-between gap-2">
                <h3 className="num text-xs font-semibold uppercase tracking-wider text-[var(--suave)]">
                  {t('Câmbio')}{datas.length === 1 && ` · ${diaMes(datas[0])}`}
                  {dias > 7 && <span className="ml-1 normal-case tracking-normal text-[var(--alerta)]">· {t('há {n} dias', { n: dias })}</span>}
                </h3>
                {sessao.perfil === 'admin' && (
                  <button type="button" onClick={() => (fechar(), ir('config', { aba: 'moedas' }))} className="min-h-9 shrink-0 rounded-lg px-2 text-xs font-semibold text-[var(--marca)] hover:bg-[var(--marca-suave)]">
                    ⚙ {t('Ajustar câmbio')}
                  </button>
                )}
              </div>
              <ul className="space-y-1.5">
                {cambios.map((c) => (
                  <li key={c.codigo} className="flex items-center justify-between gap-2 text-sm">
                    <span className="num min-w-0 truncate font-semibold">{c.texto}{datas.length > 1 && c.data && <span className="ml-1 text-xs font-normal text-[var(--suave)]">({diaMes(c.data)})</span>}</span>
                    <Pilula pequena tom={c.modo === 'fixo' ? 'alerta' : 'marca'}>{t(c.modo === 'fixo' ? 'Fixo' : 'Dinâmico')}</Pilula>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      )}
    </Janela>
  )
}

// ---------- fotos e comprovantes ----------

/** Reduz a foto (máx. 1600 px, JPEG) antes de guardar: economiza espaço no celular. */
export async function comprimirImagem(arquivo: File, max = 1600): Promise<Blob> {
  if (!arquivo.type.startsWith('image/') || typeof createImageBitmap !== 'function') return arquivo
  try {
    const img = await createImageBitmap(arquivo)
    const escala = Math.min(1, max / Math.max(img.width, img.height))
    const canvas = document.createElement('canvas')
    canvas.width = Math.round(img.width * escala)
    canvas.height = Math.round(img.height * escala)
    canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height)
    const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, 'image/jpeg', 0.8))
    return blob && blob.size < arquivo.size ? blob : arquivo
  } catch {
    return arquivo
  }
}

/**
 * Fotos e arquivos de um registro. Com categoria de foto (pedido/produto/resultado) aparece "📷 Tirar foto" (abre a
 * câmera direto no celular). Foto é reduzida e ganha miniatura; tocar abre o visor em tela cheia. esconderFotos =
 * só os arquivos (o lote mostra as fotos no bloco próprio, com as herdadas).
 */
export function Anexos({ donoId, categorias = ['pedido', 'comprovante'], esconderFotos }: { donoId: Id; categorias?: CategoriaAnexo[]; esconderFotos?: boolean }) {
  const t = useT()
  const { backend } = useApp()
  const { dados: todos } = useConsulta('anexosDe', { donoId })
  const dados = esconderFotos ? todos?.filter((a) => !ehFoto(a)) : todos
  const [urls, setUrls] = useState<Record<string, string>>({})
  const [ver, setVer] = useState<string>()
  const [enviando, setEnviando] = useState<CategoriaAnexo | 'camera'>()
  const { enviar } = useEnviarFotos()
  const nomes: Record<CategoriaAnexo, string> = { pedido: 'Foto do pedido', produto: 'Foto do produto', comprovante: 'Comprovante', origem: 'Comprovante de origem', resultado: 'Foto do resultado', outro: 'Outro' }
  const camera = categorias.find((c) => c === 'produto' || c === 'pedido' || c === 'resultado')
  useEffect(() => {
    for (const a of dados ?? []) if (!urls[a.id] && !a.miniatura) backend.urlDoAnexo(a.id).then((u) => u && setUrls((x) => ({ ...x, [a.id]: u })))
  }, [dados, backend, urls])
  const fotos = (dados ?? []).filter((a) => a.mime.startsWith('image/'))
  const subir = async (e: React.ChangeEvent<HTMLInputElement>, c: CategoriaAnexo, qual: CategoriaAnexo | 'camera') => {
    const fs = [...(e.target.files ?? [])]
    e.target.value = ''
    if (!fs.length || enviando) return
    setEnviando(qual)
    try {
      if (await enviar(donoId, fs, c, false)) avisar()
    } finally {
      setEnviando(undefined)
    }
  }
  const { avisar: avisarApp } = useApp()
  const avisar = () => avisarApp(t('Anexado.'), 'ok')
  const estilo = (forte?: boolean) => cx('inline-flex min-h-10 items-center gap-1 rounded-xl px-3 text-sm font-semibold focus-within:ring-2 focus-within:ring-[var(--marca)] focus-within:ring-offset-2', forte ? 'bg-[var(--marca)] text-white' : 'bg-[var(--marca-suave)] text-[var(--marca)]', enviando ? 'cursor-wait opacity-60' : 'cursor-pointer')
  return (
    <div>
      <div className="flex flex-wrap gap-2">
        {camera && (
          <label aria-disabled={!!enviando} className={estilo(true)}>
            📷 {enviando === 'camera' ? t('Enviando…') : t('Tirar foto')}
            <input type="file" accept="image/*" capture="environment" className="sr-only" disabled={!!enviando} onChange={(e) => subir(e, camera, 'camera')} />
          </label>
        )}
        {categorias.map((c) => (
          <label key={c} aria-disabled={!!enviando} className={estilo()}>
            📎 {enviando === c ? t('Enviando…') : t(nomes[c])}
            <input type="file" accept="image/*,application/pdf,*/*" multiple className="sr-only" disabled={!!enviando} onChange={(e) => subir(e, c, c)} />
          </label>
        ))}
      </div>
      {!!dados?.length && (
        <ul className="mt-2 flex flex-wrap gap-2">
          {dados.map((a) => {
            const src = a.miniatura ?? urls[a.id]
            return (
              <li key={a.id}>
                <button type="button" onClick={() => setVer(a.id)} className="block h-16 w-16 overflow-hidden rounded-lg border border-[var(--borda)] text-[10px]" title={`${t(nomes[a.categoria])}: ${a.nome}`}>
                  {a.mime.startsWith('image/') && src ? <img src={src} alt={a.nome} loading="lazy" className="h-full w-full object-cover" /> : <span className="p-1">📄 {t(nomes[a.categoria])}</span>}
                </button>
              </li>
            )
          })}
        </ul>
      )}
      {ver && fotos.some((a) => a.id === ver) ? (
        <VisorFotos fotos={fotos.map((a) => ({ id: a.id, miniatura: a.miniatura, nome: a.nome, em: a.criadoEm, propria: true }))} inicio={fotos.findIndex((a) => a.id === ver)} onFechar={() => setVer(undefined)} />
      ) : (
        <Janela aberta={!!ver} titulo={t('Anexo')} onFechar={() => setVer(undefined)}>
          {ver && urls[ver] && <a href={urls[ver]} target="_blank" rel="noreferrer" className="underline">{t('Abrir arquivo')}</a>}
        </Janela>
      )}
    </div>
  )
}

// ---------- WhatsApp ----------

export function linkWhatsApp(texto: string, telefone?: string) {
  const tel = telefone?.replace(/\D/g, '') ?? ''
  return `https://wa.me/${tel}?text=${encodeURIComponent(texto)}`
}

export async function copiar(texto: string) {
  try {
    await navigator.clipboard.writeText(texto)
    return true
  } catch {
    return false
  }
}
