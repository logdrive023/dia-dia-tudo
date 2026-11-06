// CONFIGURAÇÕES › Atributos: os campos de cada tipo de item (EditorAtributos).
// Uma seção = um arquivo (a lista das seções e onde cada uma aparece fica em ../configSecoes.ts).
import { useState } from 'react'
import { type AtributosConfig, type CampoDef } from '../../../core/modulos'
import { Botao, Campo, Carregando, Cartao, Entrada, Escolha, Pilula, Selecao, Vazio, cx } from '../../../shared/ui/base'
import { BarraSalvar } from '../../../shared/ui/barraSalvar'
import { useAvisoSaida, useComando, useConsulta, useParamTela } from '../../../shared/ui/contexto'
import { useT } from '../../../shared/ui/i18n'
import { Chave } from '../../../shared/ui/interruptor'

export function Atributos() {
  const t = useT()
  const { dados } = useConsulta('atributosItem', {})
  const [tipo, setTipo] = useParamTela('tipo', '')
  if (!dados) return <Carregando />
  const atual = dados.find((d) => `${d.moduloId}:${d.tipoId}` === tipo) ?? dados[0]
  if (!atual) return <Vazio texto="Nenhum tipo de item com estoque." />
  return (
    <div className="space-y-4">
      <p className="text-sm text-[var(--suave)]">{t('Os atributos aparecem na compra, no lote, no estoque e nos filtros. Crie os que o negócio usa (ex.: química, espessura do fio, região), esconda os que não usa e ajuste as opções das listas.')}</p>
      {dados.length > 1 && <Escolha rotulo="Tipo de item" valor={`${atual.moduloId}:${atual.tipoId}`} onChange={setTipo} opcoes={dados.map((d) => ({ id: `${d.moduloId}:${d.tipoId}`, nome: d.nome }))} />}
      <EditorAtributos key={`${atual.moduloId}:${atual.tipoId}:${JSON.stringify(atual.config)}`} item={atual} />
    </div>
  )
}

const TIPOS_CAMPO = [{ id: 'texto', nome: 'Texto' }, { id: 'numero', nome: 'Número' }, { id: 'lista', nome: 'Lista' }, { id: 'simNao', nome: 'Sim/Não' }]

function EditorAtributos({ item }: { item: { moduloId: string; tipoId: string; padrao: CampoDef[]; config: AtributosConfig } }) {
  const t = useT()
  const { executar, ocupado } = useComando()
  const [c, setC] = useState(item.config)
  const sujo = JSON.stringify(c) !== JSON.stringify(item.config)
  useAvisoSaida(sujo)
  const mudarExtra = (i: number, d: Partial<CampoDef>) => setC({ ...c, extras: c.extras.map((x, k) => (k === i ? { ...x, ...d } : x)) })
  const opcoesTexto = (lista?: string[]) => (lista ?? []).join(', ')
  const lerOpcoes = (txt: string) => txt.split(',').map((o) => o.trim())
  return (
    <div className="grid gap-4 2xl:grid-cols-2">
      <Cartao titulo={t('Atributos do sistema')} ajuda="Desligue o que o negócio não usa: some da compra, do lote e dos filtros. Os marcados com 🔒 ficam sempre ligados: o nome do lote, o preço e a separação dependem deles.">
        <ul className="divide-y divide-[var(--borda)]">
          {item.padrao.map((f) => {
            const oculto = c.ocultos.includes(f.id)
            return (
              <li key={f.id} className="py-2">
                <div className="flex flex-wrap items-center gap-2">
                  <span className={cx('flex-1 font-semibold', oculto && 'text-[var(--suave)] line-through')}>{t(f.nome)}{f.unidade ? ` (${f.unidade})` : ''}</span>
                  <Pilula>{t(TIPOS_CAMPO.find((x) => x.id === f.tipo)?.nome ?? f.tipo)}</Pilula>
                  {f.fixo && <span className="text-xs text-[var(--suave)]">🔒 {t('sempre usado')}</span>}
                  <Chave ligado={!oculto} travado={f.fixo} rotulo={f.nome} onChange={() => setC({ ...c, ocultos: oculto ? c.ocultos.filter((x) => x !== f.id) : [...c.ocultos, f.id] })} />
                </div>
                {f.tipo === 'lista' && !oculto && (
                  <Campo rotulo="Opções (separadas por vírgula)" className="mt-2">
                    <Entrada value={opcoesTexto(c.opcoes[f.id] ?? f.opcoes)} onChange={(e) => setC({ ...c, opcoes: { ...c.opcoes, [f.id]: lerOpcoes(e.target.value) } })} />
                  </Campo>
                )}
              </li>
            )
          })}
        </ul>
      </Cartao>
      <Cartao titulo={t('Atributos criados por você')}>
        {!c.extras.length && <Vazio texto="Nenhum ainda. Ex.: Química (sim/não), Espessura do fio (lista: fino, médio, grosso), Região (texto)." />}
        <ul className="space-y-3">
          {c.extras.map((f, i) => (
            <li key={i} className="rounded-2xl border border-[var(--borda)] p-3">
              <div className="grid grid-cols-[1fr_8rem_auto] gap-2">
                <Entrada aria-label={t('Nome do atributo')} placeholder={t('Nome do atributo')} value={f.nome} onChange={(e) => mudarExtra(i, { nome: e.target.value })} />
                <Selecao valor={f.tipo} onChange={(v) => mudarExtra(i, { tipo: v as CampoDef['tipo'] })} opcoes={TIPOS_CAMPO} />
                <button type="button" aria-label={t('Tirar')} className="min-h-10 min-w-10 rounded-lg text-xl" onClick={() => setC({ ...c, extras: c.extras.filter((_, k) => k !== i) })}>×</button>
              </div>
              <div className="mt-2 grid gap-2 sm:grid-cols-2">
                {f.tipo === 'lista' && <Campo rotulo="Opções (separadas por vírgula)" className="sm:col-span-2"><Entrada value={opcoesTexto(f.opcoes)} placeholder={t('Ex.: fino, médio, grosso')} onChange={(e) => mudarExtra(i, { opcoes: lerOpcoes(e.target.value) })} /></Campo>}
                {f.tipo === 'numero' && <Campo rotulo="Unidade"><Entrada value={f.unidade ?? ''} placeholder={t('Ex.: cm, mm, %')} onChange={(e) => mudarExtra(i, { unidade: e.target.value })} /></Campo>}
                <Campo rotulo="Explicação (aparece no ⓘ)"><Entrada value={f.ajuda ?? ''} onChange={(e) => mudarExtra(i, { ajuda: e.target.value })} /></Campo>
                <label className="flex min-h-10 items-center gap-2 self-end text-sm"><input type="checkbox" className="h-5 w-5" checked={!!f.obrigatorio} onChange={(e) => mudarExtra(i, { obrigatorio: e.target.checked })} /> {t('Obrigatório na compra')}</label>
              </div>
            </li>
          ))}
        </ul>
        <Botao variante="secundario" className="mt-3" onClick={() => setC({ ...c, extras: [...c.extras, { id: '', nome: '', tipo: 'texto' }] })}>+ {t('Atributo')}</Botao>
      </Cartao>
      <div className="2xl:col-span-2">
        <BarraSalvar sujo={sujo}>
          {sujo && <Botao variante="leve" onClick={() => setC(item.config)}>{t('Desfazer')}</Botao>}
          <Botao disabled={!sujo || ocupado} onClick={() => executar('salvarAtributos', { moduloId: item.moduloId, tipoId: item.tipoId, ...c }, t('Atributos salvos.'))}>{t('Salvar atributos')}</Botao>
        </BarraSalvar>
      </div>
    </div>
  )
}

// ---------- etapas da compra (cada negócio monta a sua triagem) ----------
