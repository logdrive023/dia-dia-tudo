// ETAPAS DA TRIAGEM (Configurações): cada negócio monta o seu quadro — colunas, ordem, cor, explicação e o que cada
// uma faz (entrada das compras, pronto para venda, separar ao entrar, lembrar fotos). "Vendido" é sempre a última.

import { useState } from 'react'
import { novoId } from '../../../core/domain/ids'
import { COLUNA_LAVAGEM, COLUNA_VENDIDO, type ColunaTriagem } from '../../../core/services/triagem'
import { Botao, Cartao, Carregando, Confirmar, Entrada, Escolha, Info, Pilula, Vazio, cx } from '../../../shared/ui/base'

const DICA_LAVAGEM = 'Opcional. Se lavar, digite o peso depois. Ex.: 6.000 g → 5.700 g (−300 g).'
import { BarraSalvar } from '../components/BarraSalvar'
import { useApp, useAvisoSaida, useComando, useConsulta, useParamTela } from '../../../shared/ui/contexto'
import { useT } from '../../../shared/ui/i18n'

const CORES = ['#f59e0b', '#8b5cf6', '#0ea5e9', '#ec4899', '#14b8a6', '#16a34a', '#ef4444', '#94a3b8']

export function EtapasTriagem() {
  const t = useT()
  const { dados } = useConsulta('fluxosTriagem', {})
  const [moduloId, setModuloId] = useParamTela('modulo', '')
  if (!dados) return <Carregando />
  if (!dados.length) return <Vazio texto="Nenhum módulo ligado tem triagem de lotes." />
  const atual = dados.find((d) => d.moduloId === moduloId) ?? dados[0]
  return (
    <div className="space-y-4">
      <p className="text-sm text-[var(--suave)]">{t('Monte o quadro da triagem do seu jeito: quantas colunas, o nome, a cor e o que cada uma faz. Os lotes andam livremente entre elas; tudo fica no histórico.')}</p>
      {dados.length > 1 && <Escolha rotulo="Módulo" valor={atual.moduloId} onChange={setModuloId} opcoes={dados.map((d) => ({ id: d.moduloId, nome: `${d.icone} ${t(d.nome)}` }))} />}
      <EditorTriagem key={atual.moduloId + JSON.stringify(atual.colunas)} item={atual} />
    </div>
  )
}

type Item = { moduloId: string; personalizado: boolean; colunas: ColunaTriagem[]; emUso: Record<string, number> }

function EditorTriagem({ item }: { item: Item }) {
  const t = useT()
  const { ir } = useApp()
  const { executar, ocupado } = useComando()
  const [cs, setCs] = useState(item.colunas)
  const [padrao, setPadrao] = useState(false)
  const sujo = JSON.stringify(cs) !== JSON.stringify(item.colunas)
  useAvisoSaida(sujo)
  const mudar = (i: number, d: Partial<ColunaTriagem>) => setCs(cs.map((c, k) => (k === i ? { ...c, ...d } : c)))
  const unica = (i: number, campo: 'entrada') => setCs(cs.map((c, k) => ({ ...c, [campo]: k === i || undefined })))
  const mover = (i: number, d: -1 | 1) => {
    const n = [...cs]
    ;[n[i], n[i + d]] = [n[i + d], n[i]]
    setCs(n)
  }
  const meio = cs.filter((c) => c.id !== COLUNA_VENDIDO)
  const problema = cs.some((c) => !c.nome.trim())
    ? 'Toda coluna precisa de nome.'
    : meio.filter((c) => c.entrada).length !== 1
      ? 'Escolha uma coluna de entrada.'
      : !meio.some((c) => c.pronto)
        ? 'Pelo menos uma coluna precisa ser “pronto para venda”.'
        : undefined
  const salvar = () => executar('salvarFluxoTriagem', { moduloId: item.moduloId, colunas: cs }, t('Colunas salvas.'))
  return (
    <div>
      <div className="grid gap-4 2xl:grid-cols-[1fr_22rem]">
        <Cartao titulo={<>{t('Colunas')} {item.personalizado ? <Pilula tom="marca">{t('personalizado')}</Pilula> : <Pilula>{t('padrão do sistema')}</Pilula>}</>}>
          <ol className="space-y-3">
            {cs.map((c, i) => {
              const vendido = c.id === COLUNA_VENDIDO
              const n = item.emUso[c.id] ?? 0
              return (
                <li key={c.id} className="rounded-2xl border border-[var(--borda)] p-3" style={{ borderLeft: `6px solid ${c.cor ?? 'var(--borda)'}` }}>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--marca-suave)] text-sm font-bold text-[var(--marca)]">{i + 1}</span>
                    <Entrada aria-label={t('Nome da coluna')} className="min-w-0 flex-1" value={c.nome} onChange={(e) => mudar(i, { nome: e.target.value })} />
                    {n > 0 && <Pilula tom="alerta">{t('{n} lote(s) aqui', { n })}</Pilula>}
                    {!vendido && (
                      <span className="flex">
                        <button type="button" aria-label={t('Subir')} disabled={i === 0} onClick={() => mover(i, -1)} className="min-h-10 min-w-10 rounded-lg disabled:opacity-30">↑</button>
                        <button type="button" aria-label={t('Descer')} disabled={i >= cs.length - 2} onClick={() => mover(i, 1)} className="min-h-10 min-w-10 rounded-lg disabled:opacity-30">↓</button>
                        <button type="button" aria-label={t('Tirar')} disabled={n > 0 || cs.length <= 2} title={n > 0 ? t('Há lotes nesta coluna: mova antes') : undefined} onClick={() => setCs(cs.filter((_, k) => k !== i))} className="min-h-10 min-w-10 rounded-lg text-xl disabled:opacity-30">×</button>
                      </span>
                    )}
                  </div>
                  <Entrada aria-label={t('Explicação da coluna')} className="mt-2 text-sm" placeholder={t('O que acontece nesta coluna (aparece quando está vazia)')} value={c.ajuda ?? ''} onChange={(e) => mudar(i, { ajuda: e.target.value })} />
                  <div role="radiogroup" aria-label={t('Cor')} className="mt-2 flex flex-wrap items-center gap-1">
                    <span className="mr-1 text-xs text-[var(--suave)]">{t('Cor')}</span>
                    {CORES.map((cor) => (
                      <button key={cor} type="button" role="radio" aria-checked={c.cor === cor} aria-label={cor} onClick={() => mudar(i, { cor })} className={cx('h-8 w-8 rounded-full border-2', c.cor === cor ? 'border-[var(--texto)]' : 'border-transparent')} style={{ background: cor }} />
                    ))}
                  </div>
                  <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm">
                    {vendido ? (
                      <span className="flex min-h-10 items-center text-[var(--suave)]">💰 {t('Automática: lotes que acabaram com venda (sempre a última).')}</span>
                    ) : (
                      <>
                        <label className="flex min-h-10 items-center gap-2"><input type="radio" name="entrada" className="h-5 w-5" checked={!!c.entrada} onChange={() => unica(i, 'entrada')} /> 📥 {t('Entrada: os lotes das compras caem aqui')}</label>
                        <label className="flex min-h-10 items-center gap-2"><input type="checkbox" className="h-5 w-5" checked={!!c.pronto} onChange={(e) => mudar(i, { pronto: e.target.checked || undefined })} /> 💰 {t('Pronto para venda (mostra preço e “Vender”)')}</label>
                        <label className="flex min-h-10 items-center gap-2"><input type="checkbox" className="h-5 w-5" checked={!!c.separarAoEntrar} onChange={(e) => mudar(i, { separarAoEntrar: e.target.checked || undefined })} /> ✂️ {t('Separar ao entrar (abre a separação)')}</label>
                        <label className="flex min-h-10 items-center gap-2"><input type="checkbox" className="h-5 w-5" checked={!!c.lembrarFotos} onChange={(e) => mudar(i, { lembrarFotos: e.target.checked || undefined })} /> 📷 {t('Lembrar das fotos')}</label>
                        <label className="flex min-h-10 items-center gap-2"><input type="checkbox" className="h-5 w-5" checked={!!c.exigirFoto} onChange={(e) => mudar(i, { exigirFoto: e.target.checked || undefined })} /> 📸 {t('Exigir foto do lote para sair desta coluna')}</label>
                        <span className="flex min-h-10 items-center gap-2"><label className="flex items-center gap-2"><input type="checkbox" className="h-5 w-5" checked={!!c.pedirPeso} onChange={(e) => mudar(i, { pedirPeso: e.target.checked || undefined })} /> ⚖️ {t('Pedir o peso depois ao sair (lavagem)')}</label><Info texto={DICA_LAVAGEM} /></span>
                      </>
                    )}
                  </div>
                </li>
              )
            })}
          </ol>
          <Botao variante="secundario" className="mt-3" disabled={cs.length >= 10} onClick={() => setCs([...cs.slice(0, -1), { id: novoId().toLowerCase().slice(-10), nome: '', cor: CORES[cs.length % CORES.length] }, cs[cs.length - 1]])}>
            + {t('Coluna')}
          </Botao>
          {/* lavar é opcional: quem lava liga a coluna (depois da entrada) */}
          {!cs.some((c) => c.id === COLUNA_LAVAGEM.id || c.pedirPeso) && (
            <span className="ml-2 inline-flex items-center">
              <Botao variante="leve" className="mt-3" disabled={cs.length >= 10} onClick={() => { const k = Math.max(0, cs.findIndex((c) => c.entrada)) + 1; setCs([...cs.slice(0, k), { ...COLUNA_LAVAGEM }, ...cs.slice(k)]) }}>
                + 🫧 {t('Lavagem/limpeza (opcional)')}
              </Botao>
              <Info texto={DICA_LAVAGEM} />
            </span>
          )}
        </Cartao>
        <div className="space-y-4">
          <Cartao titulo={t('Como vai ficar')}>
            <div className="flex gap-2 overflow-x-auto pb-1">
              {cs.map((c) => (
                <div key={c.id} className="w-32 shrink-0 rounded-xl bg-[var(--fundo)] p-2">
                  <div className="flex items-start gap-1 text-xs font-bold leading-tight"><span aria-hidden className="mt-0.5 h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: c.cor ?? 'var(--marca)' }} />{c.nome || '…'}</div>
                  <div className="mt-1 text-[10px] text-[var(--suave)]">{[c.entrada && '📥', c.pronto && '💰', c.separarAoEntrar && '✂️', c.lembrarFotos && '📷', c.exigirFoto && '📸', c.pedirPeso && '⚖️'].filter(Boolean).join(' ')}</div>
                  <div className="mt-2 h-6 rounded-lg border border-dashed border-[var(--borda)]" />
                </div>
              ))}
            </div>
          </Cartao>
          <Botao variante="leve" onClick={() => ir('triagem')}>🧺 {t('Abrir a triagem')}</Botao>
        </div>
      </div>
      <BarraSalvar sujo={sujo} aviso={problema ? <span className="text-[var(--alerta)]">⚠️ {t(problema)}</span> : undefined}>
        {item.personalizado && !sujo && <Botao variante="leve" onClick={() => setPadrao(true)}>{t('Voltar ao padrão')}</Botao>}
        {sujo && <Botao variante="leve" onClick={() => setCs(item.colunas)}>{t('Desfazer')}</Botao>}
        <Botao disabled={!sujo || ocupado || !!problema} onClick={salvar}>{t('Salvar colunas')}</Botao>
      </BarraSalvar>
      {padrao && <Confirmar titulo="Voltar ao padrão?" texto="As colunas voltam a ser as do sistema. Lotes numa coluna que deixa de existir impedem a troca." rotulo="Voltar ao padrão" onConfirmar={() => executar('salvarFluxoTriagem', { moduloId: item.moduloId, colunas: null }, t('Colunas do sistema de volta.'))} onFechar={() => setPadrao(false)} />}
    </div>
  )
}
