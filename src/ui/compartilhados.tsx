// Peças com regra de tela usadas por várias telas: escolher pessoa (com cadastro rápido), pagamentos em várias
// moedas, fotos/comprovantes, conversor de moedas e recibo no WhatsApp.

import { useEffect, useState } from 'react'
import { MOEDAS, converter, formatar, type TabelaCotacoes } from '../core/domain/dinheiro'
import { novoId } from '../core/domain/ids'
import type { CategoriaAnexo, Id, Papel } from '../core/domain/tipos'
import { Botao, Campo, Entrada, Janela, Pilula, Selecao, ValorInput, cx } from './base'
import { useApp, useComando, useConsulta } from './contexto'
import { useT } from './i18n'

// ---------- pessoa ----------

export function SeletorPessoa({ valor, onChange, papel, localId, rotulo = 'Pessoa', opcional }: { valor?: Id; onChange(id: Id | undefined): void; papel?: Papel; localId?: Id; rotulo?: string; opcional?: boolean }) {
  const t = useT()
  const { dados } = useConsulta('pessoas', { papel })
  const { executar } = useComando()
  const [novo, setNovo] = useState(false)
  const [nome, setNome] = useState('')
  const [tel, setTel] = useState('')
  const lista = (dados ?? []).filter((p) => !localId || !p.localId || p.localId === localId)
  return (
    <Campo rotulo={rotulo}>
      <div className="flex gap-2">
        <Selecao className="flex-1" valor={valor} onChange={(v) => onChange(v || undefined)} vazio={opcional ? 'Sem nome (não fica na conta)' : 'Escolha…'} opcoes={lista.map((p) => ({ id: p.id, nome: p.nome }))} />
        <Botao variante="secundario" onClick={() => setNovo(true)} aria-label={t('Cadastrar nova pessoa')}>
          + {t('Nova')}
        </Botao>
      </div>
      <Janela
        aberta={novo}
        titulo={t('Cadastro rápido')}
        onFechar={() => setNovo(false)}
        rodape={
          <Botao
            grande
            className="w-full"
            onClick={async () => {
              const id = novoId()
              const r = await executar('salvarPessoa', { id, nome, telefone: tel, papeis: [papel ?? 'cliente'], localId })
              if (r) {
                onChange(id)
                setNovo(false)
                setNome('')
                setTel('')
              }
            }}
          >
            {t('Salvar')}
          </Botao>
        }
      >
        <div className="space-y-3">
          <Campo rotulo="Nome"><Entrada autoFocus value={nome} onChange={(e) => setNome(e.target.value)} /></Campo>
          <Campo rotulo="WhatsApp (opcional)"><Entrada inputMode="tel" value={tel} onChange={(e) => setTel(e.target.value)} placeholder="+591 7…" /></Campo>
        </div>
      </Janela>
    </Campo>
  )
}

// ---------- pagamentos ----------

export interface PagamentoTela {
  id: Id
  forma: string
  moeda: string
  valor?: number
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

/** Lista de pagamentos (qualquer moeda e forma). Mostra quanto falta/sobra na moeda do total. */
export function EditorPagamentos({ total, moedaTotal, pagamentos, onChange, permiteFiado, uso = 'venda' }: { total: number; moedaTotal: string; pagamentos: PagamentoTela[]; onChange(p: PagamentoTela[]): void; permiteFiado: boolean; uso?: 'venda' | 'compra' }) {
  const t = useT()
  const { cot, cfg } = useCotacoes(uso)
  const formas = cfg?.formas ?? []
  const pago = pagamentos.reduce((s, p) => s + (p.valor ? conv(p.valor, p.moeda, moedaTotal, cot) ?? 0 : 0), 0)
  const falta = total - pago
  const atualizar = (i: number, d: Partial<PagamentoTela>) => onChange(pagamentos.map((p, k) => (k === i ? { ...p, ...d } : p)))
  return (
    <div className="space-y-2">
      {pagamentos.map((p, i) => {
        const formasDaMoeda = formas.filter((f) => f.moedas.includes(p.moeda))
        return (
          <div key={p.id} className="flex flex-wrap items-center gap-2 rounded-xl border border-[var(--borda)] p-2">
            <Selecao className="w-28" valor={p.moeda} onChange={(m) => atualizar(i, { moeda: m, forma: formas.find((f) => f.moedas.includes(m))?.id ?? 'dinheiro', valor: undefined })} opcoes={MOEDAS.filter((m) => cfg?.moedasAtivas.includes(m.codigo)).map((m) => ({ id: m.codigo, nome: `${m.simbolo} ${m.codigo}` }))} />
            <Selecao className="w-auto min-w-0 flex-1" valor={p.forma} onChange={(f) => atualizar(i, { forma: f })} opcoes={formasDaMoeda.map((f) => ({ id: f.id, nome: t(f.nome) }))} />
            <button type="button" className="h-10 w-10 text-xl sm:order-last" aria-label={t('Tirar')} onClick={() => onChange(pagamentos.filter((_, k) => k !== i))}>×</button>
            <div className="w-full sm:w-auto sm:flex-1"><ValorInput moeda={p.moeda} valor={p.valor} onChange={(v) => atualizar(i, { valor: v })} /></div>
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
            const emMoeda = conv(falta, moedaTotal, ult.moeda, cot) ?? 0
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

export function Conversor() {
  const t = useT()
  const [aberto, setAberto] = useState(false)
  useEffect(() => {
    const f = () => setAberto(true)
    window.addEventListener('tudo:conversor', f)
    return () => window.removeEventListener('tudo:conversor', f)
  }, [])
  const [moeda, setMoeda] = useState('BOB')
  const [valor, setValor] = useState<number>()
  const { dados } = useConsulta('configuracoes', {})
  return (
    <>

      <Janela aberta={aberto} titulo={t('Conversor de moedas')} onFechar={() => setAberto(false)}>
        <div className="space-y-3">
          <div className="grid grid-cols-[7rem_1fr] gap-2">
            <Selecao valor={moeda} onChange={setMoeda} opcoes={MOEDAS.filter((m) => dados?.config.moedasAtivas.includes(m.codigo)).map((m) => ({ id: m.codigo, nome: `${m.simbolo} ${m.codigo}` }))} />
            <ValorInput moeda={moeda} valor={valor} onChange={setValor} />
          </div>
          {valor !== undefined && (
            <ul className="space-y-1">
              {MOEDAS.filter((m) => m.codigo !== moeda && dados?.config.moedasAtivas.includes(m.codigo)).map((m) => {
                const v = (tab?: object) => conv(valor, moeda, m.codigo, (tab ?? {}) as TabelaCotacoes)
                const venda = v(dados?.cotacoesVenda)
                const compra = v(dados?.cotacoesCompra)
                return (
                  <li key={m.codigo} className="rounded-xl bg-[var(--fundo)] p-3">
                    <div className="num flex justify-between text-lg font-bold"><span>{m.nome}</span><span>{v(dados?.cotacoes) === undefined ? '—' : formatar(v(dados?.cotacoes)!, m.codigo)}</span></div>
                    {(venda !== v(dados?.cotacoes) || compra !== v(dados?.cotacoes)) && (
                      <div className="num flex justify-between text-xs text-[var(--suave)]"><span>{t('venda')} {venda === undefined ? '—' : formatar(venda, m.codigo)}</span><span>{t('compra')} {compra === undefined ? '—' : formatar(compra, m.codigo)}</span></div>
                    )}
                  </li>
                )
              })}
            </ul>
          )}
          <p className="text-xs text-[var(--suave)]">
            {Object.values(dados?.cotacoes ?? {}).filter(Boolean).map((c) => `${c!.moeda}: ${c!.valor} (${c!.data.split('-').reverse().join('/')})`).join(' · ')}
          </p>
        </div>
      </Janela>
    </>
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

export function Anexos({ donoId, categorias = ['pedido', 'comprovante'] }: { donoId: Id; categorias?: CategoriaAnexo[] }) {
  const t = useT()
  const { backend, avisar } = useApp()
  const { dados } = useConsulta('anexosDe', { donoId })
  const [urls, setUrls] = useState<Record<string, string>>({})
  const [ver, setVer] = useState<string>()
  const nomes: Record<CategoriaAnexo, string> = { pedido: 'Foto do pedido', produto: 'Foto do produto', comprovante: 'Comprovante', origem: 'Comprovante de origem', resultado: 'Foto do resultado', outro: 'Outro' }
  useEffect(() => {
    for (const a of dados ?? []) if (!urls[a.id]) backend.urlDoAnexo(a.id).then((u) => u && setUrls((x) => ({ ...x, [a.id]: u })))
  }, [dados, backend, urls])
  return (
    <div>
      <div className="flex flex-wrap gap-2">
        {categorias.map((c) => (
          <label key={c} className="inline-flex min-h-10 cursor-pointer items-center gap-1 rounded-xl bg-[var(--marca-suave)] px-3 text-sm font-semibold text-[var(--marca)]">
            📎 {t(nomes[c])}
            <input
              type="file"
              accept="image/*,application/pdf,*/*"
              className="hidden"
              onChange={async (e) => {
                const f = e.target.files?.[0]
                e.target.value = ''
                if (!f) return
                try {
                  const blob = await comprimirImagem(f)
                  await backend.anexar({ id: novoId(), donoId, categoria: c, nome: f.name, arquivo: blob })
                  avisar(t('Anexado.'), 'ok')
                } catch (err) {
                  avisar(err instanceof Error ? err.message : String(err), 'erro')
                }
              }}
            />
          </label>
        ))}
      </div>
      {!!dados?.length && (
        <ul className="mt-2 flex flex-wrap gap-2">
          {dados.map((a) => (
            <li key={a.id}>
              <button type="button" onClick={() => setVer(a.id)} className="block h-16 w-16 overflow-hidden rounded-lg border border-[var(--borda)] text-[10px]" title={`${t(nomes[a.categoria])}: ${a.nome}`}>
                {a.mime.startsWith('image/') && urls[a.id] ? <img src={urls[a.id]} alt={a.nome} className="h-full w-full object-cover" /> : <span className="p-1">📄 {t(nomes[a.categoria])}</span>}
              </button>
            </li>
          ))}
        </ul>
      )}
      <Janela aberta={!!ver} titulo={t('Anexo')} onFechar={() => setVer(undefined)}>
        {ver && urls[ver] && (dados?.find((a) => a.id === ver)?.mime.startsWith('image/') ? <img src={urls[ver]} alt="" className="w-full rounded-xl" /> : <a href={urls[ver]} target="_blank" rel="noreferrer" className="underline">{t('Abrir arquivo')}</a>)}
      </Janela>
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
