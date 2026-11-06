// CONFIGURAÇÕES › Etapas da compra: o caminho do pedido de cada módulo (EditorFluxo).
// Uma seção = um arquivo (a lista das seções e onde cada uma aparece fica em ../configSecoes.ts).
import { useState } from 'react'
import { novoId } from '../../../core/domain/ids'
import { ETAPA_FINAL, type EtapaDef, type FluxoCompraConfig } from '../../../core/modulos'
import { Botao, Campo, Carregando, Cartao, Confirmar, Entrada, Escolha, Pilula, Vazio } from '../../../shared/ui/base'
import { BarraSalvar } from '../../../shared/ui/barraSalvar'
import { useAvisoSaida, useComando, useConsulta, useParamTela } from '../../../shared/ui/contexto'
import { useT } from '../../../shared/ui/i18n'

export function EtapasCompra() {
  const t = useT()
  const { dados } = useConsulta('fluxosCompra', {})
  const [moduloId, setModuloId] = useParamTela('modulo', '')
  if (!dados) return <Carregando />
  if (!dados.length) return <Vazio texto="Nenhum módulo ligado faz compras." />
  const atual = dados.find((d) => d.moduloId === moduloId) ?? dados[0]
  return (
    <div className="space-y-4">
      <p className="text-sm text-[var(--suave)]">{t('Monte o caminho do pedido de compra: quantas etapas, o nome de cada uma, onde se paga e o que conta como pendência. Vale para os pedidos novos e para os que estão andando.')}</p>
      {dados.length > 1 && <Escolha rotulo="Módulo" valor={atual.moduloId} onChange={setModuloId} opcoes={dados.map((d) => ({ id: d.moduloId, nome: `${d.icone} ${t(d.nome)}` }))} />}
      <EditorFluxo key={atual.moduloId + JSON.stringify(atual.fluxo)} item={atual} />
    </div>
  )
}

type ItemFluxo = { moduloId: string; nome: string; personalizado: boolean; fluxo: Required<FluxoCompraConfig>; emUso: Record<string, number> }

function EditorFluxo({ item }: { item: ItemFluxo }) {
  const t = useT()
  const { executar, ocupado } = useComando()
  const [f, setF] = useState(item.fluxo)
  const [padrao, setPadrao] = useState(false)
  const sujo = JSON.stringify(f) !== JSON.stringify(item.fluxo)
  useAvisoSaida(sujo)
  const etapas = f.etapas
  const mudar = (i: number, d: Partial<EtapaDef>) => setF({ ...f, etapas: etapas.map((e, k) => (k === i ? { ...e, ...d } : e)) })
  const alternar = <K extends 'faz' | 'lembrar'>(i: number, campo: K, valor: string) => {
    const lista = (etapas[i][campo] ?? []) as string[]
    mudar(i, { [campo]: lista.includes(valor) ? lista.filter((x) => x !== valor) : [...lista, valor] } as Partial<EtapaDef>)
  }
  const mover = (i: number, d: -1 | 1) => {
    const n = [...etapas]
    ;[n[i], n[i + d]] = [n[i + d], n[i]]
    setF({ ...f, etapas: n })
  }
  const pagaEm = etapas.findIndex((e) => e.faz?.includes('pagamento'))
  const salvar = () => executar('salvarFluxoCompra', { moduloId: item.moduloId, fluxo: f }, t('Etapas salvas.'))
  return (
    <div>
      <div className="grid gap-4 2xl:grid-cols-[1fr_20rem]">
        <Cartao titulo={<>{t('Etapas')} {item.personalizado ? <Pilula tom="marca">{t('personalizado')}</Pilula> : <Pilula>{t('padrão do sistema')}</Pilula>}</>}>
          <ol className="space-y-3">
            {etapas.map((e, i) => {
              const final = e.id === ETAPA_FINAL
              const n = item.emUso[e.id] ?? 0
              return (
                <li key={e.id} className="rounded-2xl border border-[var(--borda)] p-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--marca-suave)] text-sm font-bold text-[var(--marca)]">{i + 1}</span>
                    <Entrada aria-label={t('Nome da etapa')} className="min-w-0 flex-1" value={e.nome} onChange={(ev) => mudar(i, { nome: ev.target.value })} />
                    {n > 0 && <Pilula tom="alerta">{t('{n} pedido(s) aqui', { n })}</Pilula>}
                    {!final && (
                      <span className="flex">
                        <button type="button" aria-label={t('Subir')} disabled={i === 0} onClick={() => mover(i, -1)} className="min-h-10 min-w-10 rounded-lg disabled:opacity-30">↑</button>
                        <button type="button" aria-label={t('Descer')} disabled={i >= etapas.length - 2} onClick={() => mover(i, 1)} className="min-h-10 min-w-10 rounded-lg disabled:opacity-30">↓</button>
                        <button type="button" aria-label={t('Tirar')} disabled={n > 0 || etapas.length <= 2} title={n > 0 ? t('Há pedidos nesta etapa') : undefined} onClick={() => setF({ ...f, etapas: etapas.filter((_, k) => k !== i) })} className="min-h-10 min-w-10 rounded-lg text-xl disabled:opacity-30">×</button>
                      </span>
                    )}
                  </div>
                  <Entrada aria-label={t('O que fazer nesta etapa')} className="mt-2 text-sm" placeholder={t('O que fazer nesta etapa (aparece no ⓘ)')} value={e.ajuda} onChange={(ev) => mudar(i, { ajuda: ev.target.value })} />
                  <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm">
                    {final ? (
                      <span className="flex min-h-10 items-center text-[var(--suave)]">📦 {t('Aqui o pedido termina e entra no estoque (sempre a última).')}</span>
                    ) : (
                      <label className="flex min-h-10 items-center gap-2"><input type="checkbox" className="h-5 w-5" checked={!!e.faz?.includes('pagamento')} disabled={pagaEm >= 0 && pagaEm !== i} onChange={() => alternar(i, 'faz', 'pagamento')} /> 💰 {t('Cobra o pagamento aqui')}</label>
                    )}
                    <label className="flex min-h-10 items-center gap-2"><input type="checkbox" className="h-5 w-5" checked={!!e.lembrar?.includes('fotos')} onChange={() => alternar(i, 'lembrar', 'fotos')} /> 📷 {t('Lembrar das fotos')}</label>
                    <label className="flex min-h-10 items-center gap-2"><input type="checkbox" className="h-5 w-5" checked={!!e.lembrar?.includes('comprovante')} onChange={() => alternar(i, 'lembrar', 'comprovante')} /> 🧾 {t('Lembrar do comprovante')}</label>
                  </div>
                </li>
              )
            })}
          </ol>
          <Botao variante="secundario" className="mt-3" disabled={etapas.length >= 10} onClick={() => setF({ ...f, etapas: [...etapas.slice(0, -1), { id: novoId().toLowerCase().slice(-10), nome: '', ajuda: '' }, etapas[etapas.length - 1]] })}>
            + {t('Etapa')}
          </Botao>
        </Cartao>
        <div className="space-y-4">
          <Cartao titulo={t('O que conta como “falta”')} ajuda="Aparece no pedido, na lista de pedidos e no “Atenção agora” do painel.">
            <div className="space-y-1 text-sm">
              <label className="flex min-h-10 items-center gap-2"><input type="checkbox" className="h-5 w-5" checked={f.pedirFotos} onChange={(e) => setF({ ...f, pedirFotos: e.target.checked })} /> {t('Sem fotos')}</label>
              <label className="flex min-h-10 items-center gap-2"><input type="checkbox" className="h-5 w-5" checked={f.pedirComprovanteOrigem} onChange={(e) => setF({ ...f, pedirComprovanteOrigem: e.target.checked })} /> {t('Sem comprovante de origem')}</label>
              <p className="pt-1 text-[var(--suave)]">💰 {t('Falta pagar: depois da etapa que cobra o pagamento.')}</p>
              <Campo rotulo="Parada na triagem depois de (dias)" className="pt-2">
                <Entrada inputMode="numeric" className="w-24" value={String(f.avisarParadaDias)} onChange={(e) => setF({ ...f, avisarParadaDias: Math.max(0, Math.round(Number(e.target.value.replace(/\D/g, '')) || 0)) })} />
              </Campo>
            </div>
          </Cartao>
          <Cartao titulo={t('Como vai ficar')}>
            <ol className="flex flex-wrap items-center gap-1 text-sm">
              {etapas.map((e, i) => (
                <li key={e.id} className="flex items-center gap-1">
                  <span className="rounded-full bg-[var(--marca-suave)] px-2 py-1 font-semibold text-[var(--marca)]">{i + 1}. {e.nome || '…'}{e.faz?.includes('pagamento') ? ' 💰' : ''}{e.id === ETAPA_FINAL ? ' 📦' : ''}</span>
                  {i < etapas.length - 1 && <span aria-hidden className="text-[var(--suave)]">→</span>}
                </li>
              ))}
            </ol>
          </Cartao>
        </div>
      </div>
      <BarraSalvar sujo={sujo}>
        {item.personalizado && !sujo && <Botao variante="leve" onClick={() => setPadrao(true)}>{t('Voltar ao padrão')}</Botao>}
        {sujo && <Botao variante="leve" onClick={() => setF(item.fluxo)}>{t('Desfazer')}</Botao>}
        <Botao disabled={!sujo || ocupado || etapas.some((e) => !e.nome.trim())} onClick={salvar}>{t('Salvar etapas')}</Botao>
      </BarraSalvar>
      {padrao && <Confirmar titulo="Voltar ao padrão?" texto="As etapas voltam a ser as do sistema. Pedidos parados numa etapa que deixa de existir impedem a troca." rotulo="Voltar ao padrão" onConfirmar={() => executar('salvarFluxoCompra', { moduloId: item.moduloId, fluxo: null }, t('Etapas do sistema de volta.'))} onFechar={() => setPadrao(false)} />}
    </div>
  )
}
