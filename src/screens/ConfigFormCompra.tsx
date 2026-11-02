// FORMULÁRIO DE COMPRA: o administrador monta a tela de nova compra — o que aparece, a ordem (↑ ↓), o que já vem aberto
// (o resto vira "+ Adicionar …"), o que é obrigatório, os valores que já vêm preenchidos (módulo, coluna, moeda, tipo
// de código, medidas favoritas, estados na chegada) e o jeito (uma página simples ou passo a passo). Prévia ao vivo.

import { useMemo, useState } from 'react'
import { MOEDAS } from '../core/domain/dinheiro'
import type { ModoCompra } from '../core/services/codigos'
import { CAMPOS_FORM, type CampoForm, FORM_COMPRA_PADRAO, type FormCompraConfig } from '../core/services/formCompra'
import { Botao, Campo, Carregando, Cartao, Confirmar, Entrada, ErroTela, Escolha, Selecao, cx } from '../ui/base'
import { BarraSalvar } from '../ui/barraSalvar'
import { useApp, useAvisoSaida, useComando, useConsulta } from '../ui/contexto'
import { useT } from '../ui/i18n'

const igual = (a?: FormCompraConfig, b?: FormCompraConfig) => JSON.stringify(a) === JSON.stringify(b)

export function ConfigFormCompra() {
  const t = useT()
  const { sessao } = useApp()
  const admin = sessao.perfil === 'admin'
  const { dados: salvo, erro } = useConsulta('formCompra', {}, admin)
  const { dados: cfg } = useConsulta('configuracoes', {})
  const { dados: tabelas } = useConsulta('tabelasPreco', { moduloId: 'cabelo' })
  const { executar, ocupado } = useComando()
  const [rasc, setRasc] = useState<FormCompraConfig>()
  const [padrao, setPadrao] = useState(false)
  const atual = rasc ?? salvo
  const mudou = !!rasc && !igual(rasc, salvo)
  useAvisoSaida(mudou)
  const [medidasTxt, setMedidasTxt] = useState<string>()
  const [novoEstado, setNovoEstado] = useState('')
  const tabela = useMemo(() => tabelas?.find((x) => !x.categoria) ?? tabelas?.[0], [tabelas])
  if (!admin) return <p className="text-sm text-[var(--suave)]">{t('Só o administrador muda o formulário de compra.')}</p>
  if (erro) return <ErroTela texto={erro} onVoltar={() => history.back()} />
  if (!atual || !cfg) return <Carregando />

  const mudar = (d: Partial<FormCompraConfig>) => setRasc({ ...atual, ...d })
  const mudarCampo = (i: number, d: Partial<CampoForm>) => {
    const campos = atual.campos.map((c, k) => (k === i ? { ...c, ...d } : c)).map((c) => ({ ...c, obrigatorio: c.visivel && c.obrigatorio, aberto: c.id === 'itens' || (c.visivel && (c.aberto || c.obrigatorio)) }))
    mudar({ campos })
  }
  const mover = (i: number, d: -1 | 1) => {
    const j = i + d
    if (j < 0 || j >= atual.campos.length) return
    const campos = [...atual.campos]
    ;[campos[i], campos[j]] = [campos[j], campos[i]]
    mudar({ campos })
  }
  const padroes = (d: Partial<FormCompraConfig['padroes']>) => mudar({ padroes: { ...atual.padroes, ...d } })
  const salvar = async () => {
    const r = await executar('salvarFormCompra', { form: atual }, t('Formulário de compra salvo.'))
    if (r) (setRasc(undefined), setMedidasTxt(undefined))
  }
  const modulos = cfg.modulos.filter((m) => m.temCompra && cfg.config.modulosAtivos.includes(m.id))
  const textoMedidas = medidasTxt ?? atual.medidas.join(', ')
  const lerMedidas = (s: string) => [...new Set(s.split(/[^\d]+/).map(Number).filter((n) => Number.isInteger(n) && n > 0 && n <= 300))].sort((a, b) => a - b)
  const addEstado = () => {
    const e = novoEstado.trim()
    if (!e || atual.estados.some((x) => x.toLowerCase() === e.toLowerCase())) return
    mudar({ estados: [...atual.estados, e] })
    setNovoEstado('')
  }

  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_22rem]">
      <div className="min-w-0 space-y-4">
        <Cartao titulo={t('Jeito da tela')}>
          <Escolha rotulo="Jeito da tela" valor={atual.layout} onChange={(layout) => mudar({ layout })} opcoes={[{ id: 'simples', nome: 'Simples (uma página)' }, { id: 'passos', nome: 'Passo a passo' }]} />
          <p className="mt-2 text-xs text-[var(--suave)]">{t(atual.layout === 'simples' ? 'Tudo numa página: o que não está aberto vira "+ Adicionar …".' : 'Um passo por vez (na ordem dos campos). Dá para registrar de qualquer passo quando o obrigatório está preenchido.')}</p>
        </Cartao>

        <Cartao titulo={t('Campos')} ajuda="A ordem da lista é a ordem na tela. Aberto = já aparece; fechado = vira um botão + que abre com um toque. Obrigatório = não registra sem ele.">
          <ul className="divide-y divide-[var(--borda)]">
            {atual.campos.map((c, i) => {
              const def = CAMPOS_FORM[c.id]
              return (
                <li key={c.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2">
                  <div className="flex shrink-0 gap-1">
                    <button type="button" aria-label={`${t('Subir')} ${t(def.nome)}`} disabled={i === 0} onClick={() => mover(i, -1)} className="h-11 w-11 rounded-xl border border-[var(--borda)] disabled:opacity-30">↑</button>
                    <button type="button" aria-label={`${t('Descer')} ${t(def.nome)}`} disabled={i === atual.campos.length - 1} onClick={() => mover(i, 1)} className="h-11 w-11 rounded-xl border border-[var(--borda)] disabled:opacity-30">↓</button>
                  </div>
                  <b className={cx('min-w-0 flex-1 basis-32 truncate', !c.visivel && 'text-[var(--suave)] line-through')}>{t(def.nome)}</b>
                  <div className="flex flex-wrap gap-x-3 text-sm">
                    <Marca rotulo="Aparece" marcado={c.visivel} desligado={!def.podeEsconder} onChange={(v) => mudarCampo(i, { visivel: v })} />
                    <Marca rotulo="Aberto" marcado={c.aberto} desligado={!c.visivel || c.id === 'itens' || c.obrigatorio} onChange={(v) => mudarCampo(i, { aberto: v })} />
                    {def.podeObrigar && <Marca rotulo="Obrigatório" marcado={c.obrigatorio} desligado={!c.visivel} onChange={(v) => mudarCampo(i, { obrigatorio: v })} />}
                  </div>
                </li>
              )
            })}
          </ul>
          <p className="mt-2 text-xs text-[var(--suave)]">{t('"O que veio" sempre aparece. Atributos extras: aberto = cada linha já mostra os atributos.')}</p>
        </Cartao>

        <Cartao titulo={t('Já vem preenchido')}>
          <div className="grid gap-3 sm:grid-cols-2">
            {modulos.length > 1 && (
              <Campo rotulo="O que está comprando?">
                <Selecao valor={atual.padroes.moduloId ?? ''} vazio="O primeiro da lista" onChange={(v) => padroes({ moduloId: v || undefined })} opcoes={modulos.map((m) => ({ id: m.id, nome: `${m.icone} ${t(m.nome)}` }))} />
              </Campo>
            )}
            {tabela && (
              <Campo rotulo="Coluna da tabela">
                <Selecao valor={atual.padroes.colunaId ?? ''} vazio="A do fornecedor (senão a primeira)" onChange={(v) => padroes({ colunaId: v || undefined })} opcoes={tabela.colunas.map((c) => ({ id: c.id, nome: c.nome }))} />
              </Campo>
            )}
            <Campo rotulo="Moeda">
              <Selecao valor={atual.padroes.moeda ?? ''} vazio="A principal" onChange={(v) => padroes({ moeda: v || undefined })} opcoes={MOEDAS.filter((m) => cfg.config.moedasAtivas.includes(m.codigo)).map((m) => ({ id: m.codigo, nome: `${m.simbolo} ${m.codigo}` }))} />
            </Campo>
            <Campo rotulo="Tipo de código" ajuda="O que vem marcado em cada compra (dá para trocar na hora). Vazio = a regra de Configurações › Códigos.">
              <Selecao valor={atual.padroes.modoCodigo ?? ''} vazio="A regra de Códigos" onChange={(v) => padroes({ modoCodigo: (v || undefined) as ModoCompra | undefined })} opcoes={[{ id: 'incremental', nome: 'Incremental' }, { id: 'porPessoa', nome: 'Por pessoa' }, { id: 'manual', nome: 'Manual' }]} />
            </Campo>
            <Campo rotulo="Linha de cabelo começa como">
              <Selecao valor={atual.padroes.modoLinha} onChange={(v) => padroes({ modoLinha: v === 'tabela' ? 'tabela' : 'bruto' })} opcoes={[{ id: 'bruto', nome: 'Bruto' }, { id: 'tabela', nome: 'Pela tabela' }]} />
            </Campo>
            <Campo rotulo="Medidas favoritas (cm)" ajuda="Viram botões rápidos na linha pela tabela. Ex.: 40, 45, 50, 55, 60">
              <Entrada inputMode="numeric" value={textoMedidas} onChange={(e) => (setMedidasTxt(e.target.value), mudar({ medidas: lerMedidas(e.target.value) }))} onBlur={() => setMedidasTxt(undefined)} />
            </Campo>
          </div>
        </Cartao>

        <Cartao titulo={t('Estado na chegada')} ajuda="As opções que aparecem para marcar como o material chegou.">
          <div className="flex flex-wrap gap-2">
            {atual.estados.map((e) => (
              <span key={e} className="inline-flex min-h-11 items-center gap-1 rounded-full border border-[var(--borda)] pl-3 text-sm">
                {t(e)}
                <button type="button" aria-label={`${t('Tirar')} ${t(e)}`} className="h-11 w-10 rounded-full text-lg" onClick={() => mudar({ estados: atual.estados.filter((x) => x !== e) })}>×</button>
              </span>
            ))}
          </div>
          <div className="mt-2 flex gap-2">
            <Entrada aria-label={t('Novo estado na chegada')} placeholder={t('Ex.: Molhado')} maxLength={40} value={novoEstado} onChange={(e) => setNovoEstado(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addEstado())} />
            <Botao variante="secundario" className="min-h-11 shrink-0" disabled={!novoEstado.trim()} onClick={addEstado}>+ {t('Adicionar')}</Botao>
          </div>
        </Cartao>

        <BarraSalvar sujo={mudou}>
          <Botao variante="leve" disabled={ocupado} onClick={() => setPadrao(true)}>{t('Voltar ao padrão')}</Botao>
          <Botao variante="leve" disabled={!mudou} onClick={() => (setRasc(undefined), setMedidasTxt(undefined))}>{t('Desfazer')}</Botao>
          <Botao grande disabled={ocupado || !mudou} onClick={salvar}>{t('Salvar')}</Botao>
        </BarraSalvar>
        {padrao && <Confirmar titulo="Voltar ao padrão?" texto="O formulário volta a ser o simples: fornecedor, o que veio e o total; o resto a um toque." rotulo="Voltar ao padrão" onConfirmar={async () => { if (await executar('salvarFormCompra', { form: null }, t('Formulário padrão de volta.'))) setRasc(undefined) }} onFechar={() => setPadrao(false)} />}
      </div>

      <aside className="h-fit xl:sticky xl:top-4">
        <Cartao titulo={t('Prévia')}>
          <Previa f={atual} />
        </Cartao>
      </aside>
    </div>
  )
}

function Marca({ rotulo, marcado, desligado, onChange }: { rotulo: string; marcado: boolean; desligado?: boolean; onChange(v: boolean): void }) {
  const t = useT()
  return (
    <label className={cx('flex min-h-11 items-center gap-2', desligado ? 'opacity-50' : 'cursor-pointer')}>
      <input type="checkbox" className="h-5 w-5" checked={marcado} disabled={desligado} onChange={(e) => onChange(e.target.checked)} />
      {t(rotulo)}
    </label>
  )
}

/** Como a tela de nova compra vai ficar (desenho simplificado, sem dados). */
function Previa({ f }: { f: FormCompraConfig }) {
  const t = useT()
  const visiveis = f.campos.filter((c) => c.visivel && c.id !== 'atributos')
  const PASSO: Record<string, string> = { fornecedor: 'Fornecedor', codigo: 'Fornecedor', comprador: 'Fornecedor', coluna: 'Fornecedor', itens: 'O que veio', estado: 'Estado', obs: 'Estado', fotos: 'Fotos', viagem: 'Fornecedor' }
  const passos = f.layout === 'passos' ? [...new Set(visiveis.map((c) => PASSO[c.id])), 'Revisar'] : []
  const blocos: (CampoForm | CampoForm[])[] = []
  for (const c of visiveis) {
    const ult = blocos[blocos.length - 1]
    if (c.aberto) blocos.push(c)
    else if (Array.isArray(ult)) ult.push(c)
    else blocos.push([c])
  }
  const attr = f.campos.find((c) => c.id === 'atributos')
  return (
    <div className="space-y-2 rounded-xl bg-[var(--fundo)] p-2 text-xs" aria-label={t('Prévia')}>
      <b className="block text-sm">{t('Nova compra')}</b>
      {passos.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {passos.map((p, i) => <span key={p} className={cx('rounded-full px-2 py-0.5 font-semibold', i === 0 ? 'bg-[var(--marca)] text-white' : 'border border-[var(--borda)] text-[var(--suave)]')}>{i + 1} {t(p)}</span>)}
        </div>
      )}
      {blocos.map((b) =>
        Array.isArray(b) ? (
          <div key={b.map((c) => c.id).join()} className="flex flex-wrap gap-1">
            {b.map((c) => <span key={c.id} className="rounded-full border border-dashed border-[var(--borda)] px-2 py-1 font-semibold text-[var(--marca)]">+ {t(CAMPOS_FORM[c.id].nome)}</span>)}
          </div>
        ) : (
          <div key={b.id} className="rounded-lg border border-[var(--borda)] bg-[var(--cartao)] p-2">
            <span className="font-semibold">{t(CAMPOS_FORM[b.id].nome)}{b.obrigatorio && <span className="text-[var(--ruim)]"> *</span>}</span>
            {b.id === 'itens' ? (
              <div className="mt-1 space-y-1">
                <div className="flex flex-wrap gap-1">{f.medidas.slice(0, 8).map((m) => <span key={m} className="num rounded border border-[var(--borda)] px-1">{m}</span>)}</div>
                <div className="h-5 rounded bg-[var(--fundo)]" />
                {attr?.visivel && <span className="text-[var(--suave)]">{attr.aberto ? '▾' : '▸'} {t('Atributos')}</span>}
              </div>
            ) : b.id === 'estado' ? (
              <div className="mt-1 flex flex-wrap gap-1">{f.estados.slice(0, 6).map((e) => <span key={e} className="rounded-full border border-[var(--borda)] px-1.5">{t(e)}</span>)}</div>
            ) : (
              <div className="mt-1 h-5 rounded bg-[var(--fundo)]" />
            )}
          </div>
        ),
      )}
      <div className="flex items-center justify-between rounded-lg bg-[var(--cartao)] p-2">
        <span className="num font-black">{t('Total')}</span>
        <span className="rounded-lg bg-[var(--marca)] px-2 py-1 font-semibold text-white">{t('Registrar pedido')}</span>
      </div>
      {igual(f, FORM_COMPRA_PADRAO) && <p className="text-[var(--suave)]">{t('Este é o formulário padrão.')}</p>}
    </div>
  )
}
