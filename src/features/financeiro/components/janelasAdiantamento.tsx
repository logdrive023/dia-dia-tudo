// ADIANTAMENTO › AS JANELAS DAS AÇÕES (cada uma com o seu estado; abrir de novo começa limpo):
//   JanelaEntrega   cabelo entregue → vira uma compra normal paga com o adiantamento (não sai do caixa)
//   JanelaDinheiro  receber em dinheiro (o parceiro devolve) ou pagar a diferença (a loja deve)
//   JanelaComissao  a comissão que a loja deve à pessoa paga a dívida
//   ConfirmarEncerrar com motivo; o que sobrar vira baixa
//   JanelaAdiantarMais mais dinheiro no mesmo adiantamento (e, se quiser, uma nova data limite)
//   JanelaPrazo     mudar (ou tirar) a data limite
import { useState } from 'react'
import { CATEGORIAS_CABELO } from '../../../core/areas/cabelo'
import { formatar } from '../../../core/domain/dinheiro'
import { formasEmUso } from '../../../core/domain/formas'
import { novoId } from '../../../core/domain/ids'
import type { Id } from '../../../core/domain/tipos'
import type { ResultadoConsulta } from '../../../core/services'
import { Botao, Campo, Confirmar, Entrada, Escolha, GramasInput, Janela, Selecao, ValorInput, cx, gramasTexto } from '../../../shared/ui/base'
import { useCotacoes } from '../../../shared/ui/compartilhados'
import { useComando } from '../../../shared/ui/contexto'
import { useT } from '../../../shared/ui/i18n'

export type DadosAdiantamento = ResultadoConsulta<'financiamento'>
export type AcaoAdiantamento = 'entrega' | 'receber' | 'comissao' | 'diferenca' | 'encerrar' | 'mais' | 'prazo'

interface LinhaEntrega { id: Id; medida?: number; categoria: string; gramas?: number; valor?: number }
const novaLinha = (): LinhaEntrega => ({ id: novoId(), categoria: 'Normal' })

/** "Sair sem salvar?" só quando tem algo digitado */
const sair = (mexeu: boolean, t: (s: string) => string, onFechar: () => void) => (!mexeu || window.confirm(t('Sair sem salvar?'))) && onFechar()

export function JanelaEntrega({ dados, onFechar }: { dados: DadosAdiantamento; onFechar(): void }) {
  const t = useT()
  const { executar, ocupado } = useComando()
  const [opId] = useState(() => novoId())
  const [linhas, setLinhas] = useState<LinhaEntrega[]>(() => [novaLinha()])
  const [estado, setEstado] = useState<'Bruto' | 'Separado'>('Bruto')
  const [entrarNoEstoque, setEntrar] = useState(true)
  const [obs, setObs] = useState('')
  const mp = dados.moedaPrincipal
  const total = linhas.reduce((s, l) => s + (l.valor ?? 0), 0)
  const gramas = linhas.reduce((s, l) => s + (l.gramas ?? 0), 0)
  const ok = linhas.length > 0 && linhas.every((l) => l.gramas && l.valor)
  const depois = dados.saldo - total
  const att = (i: number, p: Partial<LinhaEntrega>) => setLinhas(linhas.map((l, k) => (k === i ? { ...l, ...p } : l)))
  return (
    <Janela larga aberta titulo={`💇‍♀️ ${t('Entrega de cabelo')}`} onFechar={() => sair(total > 0, t, onFechar)} rodape={
      <div className="space-y-2">
        <div className="flex flex-wrap justify-between gap-2 text-sm">
          <span className="num">{gramasTexto(gramas)} · <b>{formatar(total, mp)}</b></span>
          <span className={cx('num font-semibold', depois < 0 && 'text-[var(--alerta)]')}>{depois >= 0 ? `${t('Falta depois')}: ${formatar(depois, mp)}` : `${t('A loja vai dever')}: ${formatar(-depois, mp)}`}</span>
        </div>
        <Botao grande className="w-full" disabled={ocupado || !ok} onClick={async () => {
          const r = await executar('registrarEntregaFinanciamento', {
            id: opId, financiamentoId: dados.financiamento.id, moduloId: 'cabelo', entrarNoEstoque, obs,
            linhas: linhas.map((l) => ({ id: l.id, quantidade: l.gramas!, moeda: mp, total: l.valor!, campos: { estado, categoria: l.categoria, comprimento: l.medida } })),
          }, t('Entrega registrada: compra criada e abatida do adiantamento.'))
          if (r) onFechar()
        }}>{t('Registrar entrega')}</Botao>
      </div>
    }>
      <div className="space-y-3">
        <p className="rounded-xl bg-[var(--fundo)] p-3 text-sm">{t('Vira uma compra normal de {nome}, paga com o adiantamento (não sai do caixa). Depois segue para a Triagem como qualquer compra.', { nome: dados.pessoa?.nome ?? '' })}</p>
        <Escolha<'Bruto' | 'Separado'> rotulo="Situação" valor={estado} onChange={setEstado} opcoes={[{ id: 'Bruto', nome: 'Bruto (misturado)' }, { id: 'Separado', nome: 'Já separado' }]} />
        <ul className="space-y-2">
          {linhas.map((l, i) => (
            <li key={l.id} className="grid grid-cols-2 gap-2 rounded-xl border border-[var(--borda)] p-2 sm:grid-cols-[6rem_8rem_1fr_1fr_auto] sm:items-end">
              <Campo rotulo="Medida (cm)"><Entrada inputMode="numeric" value={l.medida ?? ''} onChange={(e) => att(i, { medida: Number(e.target.value.replace(/\D/g, '')) || undefined })} placeholder="60" /></Campo>
              <Campo rotulo="Categoria"><Selecao valor={l.categoria} onChange={(v) => att(i, { categoria: v })} opcoes={CATEGORIAS_CABELO.map((c) => ({ id: c, nome: c }))} /></Campo>
              <Campo rotulo="Peso" comoDiv><GramasInput valor={l.gramas} onChange={(g) => att(i, { gramas: g })} /></Campo>
              <Campo rotulo="Valor" comoDiv><ValorInput moeda={mp} valor={l.valor} onChange={(v) => att(i, { valor: v })} /></Campo>
              <Botao variante="leve" className="col-span-2 sm:col-span-1" disabled={linhas.length === 1} onClick={() => setLinhas(linhas.filter((_, k) => k !== i))} aria-label={t('Tirar linha')}>✕</Botao>
            </li>
          ))}
        </ul>
        <Botao variante="secundario" onClick={() => setLinhas([...linhas, novaLinha()])}>+ {t('Outra medida')}</Botao>
        <label className="flex min-h-11 items-center gap-2 text-sm"><input type="checkbox" className="h-5 w-5" checked={entrarNoEstoque} onChange={(e) => setEntrar(e.target.checked)} /> {t('Já marcar a entrega como concluída (o cabelo vai para a Triagem de qualquer jeito)')}</label>
        <Campo rotulo="Observação (opcional)"><Entrada value={obs} onChange={(e) => setObs(e.target.value)} /></Campo>
      </div>
    </Janela>
  )
}

/** receber em dinheiro (o parceiro devolve o que não virou cabelo) ou pagar a diferença (a loja deve) */
export function JanelaDinheiro({ tipo, dados, onFechar }: { tipo: 'receber' | 'diferenca'; dados: DadosAdiantamento; onFechar(): void }) {
  const t = useT()
  const { executar, ocupado } = useComando()
  const { cfg } = useCotacoes()
  const mp = dados.moedaPrincipal
  const [opId] = useState(() => novoId())
  const [moeda, setMoeda] = useState(mp)
  const [valor, setValor] = useState<number | undefined>(tipo === 'diferenca' ? dados.aPagarParceiro : undefined)
  const [forma, setForma] = useState('dinheiro')
  const formas = formasEmUso(cfg?.formas, moeda)
  const f = dados.financiamento
  const registrar = async () => {
    const r = tipo === 'receber'
      ? await executar('receberFinanciamento', { id: opId, financiamentoId: f.id, moeda, valor: valor!, forma, obs: '' }, t('Recebimento registrado.'))
      : await executar('pagarDiferencaFinanciamento', { id: opId, financiamentoId: f.id, moeda, valor: valor!, forma }, t('Diferença paga.'))
    if (r) onFechar()
  }
  return (
    <Janela aberta titulo={t(tipo === 'receber' ? 'Receber em dinheiro' : 'Pagar diferença')} onFechar={() => sair(valor !== undefined && tipo === 'receber', t, onFechar)}
      rodape={<Botao grande className="w-full" disabled={ocupado || !valor} onClick={registrar}>{t(tipo === 'receber' ? 'Registrar' : 'Pagar')}</Botao>}>
      <div className="space-y-3">
        <p className="text-sm">{tipo === 'receber'
          ? <>{t('O parceiro devolveu o dinheiro que não virou cabelo. Falta')}: <b className="num">{formatar(dados.saldo, mp)}</b></>
          : t('O cabelo entregue passou do adiantado: a loja deve {v} ao parceiro (sai do caixa).', { v: formatar(dados.aPagarParceiro, mp) })}</p>
        <Campo rotulo="Valor" comoDiv>
          <div className="grid grid-cols-[7rem_1fr] gap-2">
            <Selecao valor={moeda} onChange={(v) => (setMoeda(v), setForma(formasEmUso(cfg?.formas, v)[0]?.id ?? 'dinheiro'))} opcoes={(cfg?.moedasAtivas ?? [mp]).map((x) => ({ id: x, nome: x }))} />
            <ValorInput moeda={moeda} valor={valor} onChange={setValor} />
          </div>
        </Campo>
        {tipo === 'receber' && moeda === mp && <Botao variante="secundario" onClick={() => setValor(dados.saldo)}>{t('Tudo o que falta')}</Botao>}
        <Campo rotulo="Forma"><Selecao valor={forma} onChange={setForma} opcoes={formas.map((x) => ({ id: x.id, nome: t(x.nome) }))} /></Campo>
      </div>
    </Janela>
  )
}

export function JanelaComissao({ dados, onFechar }: { dados: DadosAdiantamento; onFechar(): void }) {
  const t = useT()
  const { executar, ocupado } = useComando()
  const mp = dados.moedaPrincipal
  const [opId] = useState(() => novoId())
  const maximo = Math.min(dados.saldo, dados.comissaoAPagar)
  const [valor, setValor] = useState<number | undefined>(maximo)
  return (
    <Janela aberta titulo={t('Abater da comissão')} onFechar={onFechar} rodape={
      <Botao grande className="w-full" disabled={ocupado || !valor} onClick={async () => (await executar('abaterComissaoFinanciamento', { id: opId, financiamentoId: dados.financiamento.id, valor: valor!, obs: '' }, t('Abatido da comissão.'))) && onFechar()}>{t('Abater')}</Botao>
    }>
      <div className="space-y-3">
        <p className="text-sm">{t('A comissão que a loja deve a {nome} paga a dívida, sem passar pelo caixa. Conta como comissão paga.', { nome: dados.pessoa?.nome ?? '' })}</p>
        <div className="grid grid-cols-2 gap-2 text-sm">
          <div className="rounded-xl bg-[var(--fundo)] p-2">{t('Comissão a pagar')}<br /><b className="num">{formatar(dados.comissaoAPagar, mp)}</b></div>
          <div className="rounded-xl bg-[var(--fundo)] p-2">{t('Falta do adiantamento')}<br /><b className="num">{formatar(dados.saldo, mp)}</b></div>
        </div>
        <Campo rotulo="Valor" comoDiv><ValorInput moeda={mp} valor={valor} onChange={setValor} /></Campo>
        <Botao variante="secundario" onClick={() => setValor(maximo)}>{t('O máximo possível')}</Botao>
      </div>
    </Janela>
  )
}

export function ConfirmarEncerrar({ dados, onFechar }: { dados: DadosAdiantamento; onFechar(): void }) {
  const t = useT()
  const { executar } = useComando()
  const [opId] = useState(() => novoId())
  const mp = dados.moedaPrincipal
  return (
    <Confirmar
      titulo="Encerrar adiantamento"
      texto={dados.saldo > 0 ? t('Ainda falta {v}: vira baixa na conta corrente da pessoa (perda, não volta ao caixa).', { v: formatar(dados.saldo, mp) }) : dados.saldo < 0 ? t('A loja ainda deve {v} ao parceiro: a diferença vira baixa (ele abre mão).', { v: formatar(-dados.saldo, mp) }) : t('O adiantamento está quitado: fica encerrado.')}
      rotulo="Encerrar"
      perigo={dados.saldo !== 0}
      pedirMotivo
      onFechar={onFechar}
      onConfirmar={async (motivo) => { await executar('encerrarFinanciamento', { id: opId, financiamentoId: dados.financiamento.id, motivo }, t('Adiantamento encerrado.')) }}
    />
  )
}

export function JanelaAdiantarMais({ dados, onFechar }: { dados: DadosAdiantamento; onFechar(): void }) {
  const t = useT()
  const { executar, ocupado } = useComando()
  const { cfg } = useCotacoes()
  const mp = dados.moedaPrincipal
  const f = dados.financiamento
  const [opId] = useState(() => novoId())
  const [moeda, setMoeda] = useState(f.moeda)
  const [valor, setValor] = useState<number>()
  const [forma, setForma] = useState('dinheiro')
  const [prazo, setPrazo] = useState(f.prazo ?? '')
  const formas = formasEmUso(cfg?.formas, moeda)
  const registrar = async () => (await executar('reforcarFinanciamento', { id: opId, financiamentoId: f.id, moeda, valor: valor!, forma, prazo }, t('Valor a mais registrado.'))) && onFechar()
  return (
    <Janela aberta titulo={`💸 ${t('Adiantar mais')}`} onFechar={() => sair(valor !== undefined, t, onFechar)}
      rodape={<Botao grande className="w-full" disabled={ocupado || !valor} onClick={registrar}>{t('Registrar')}</Botao>}>
      <div className="space-y-3">
        <p className="text-sm">{t('Mais dinheiro para {n} comprar cabelo, no mesmo adiantamento. Sai do caixa e a dívida aumenta.', { n: dados.pessoa?.nome ?? '' })}</p>
        <Campo rotulo="Valor a mais" comoDiv>
          <div className="grid grid-cols-[7rem_1fr] gap-2">
            <Selecao valor={moeda} onChange={(v) => (setMoeda(v), setForma(formasEmUso(cfg?.formas, v)[0]?.id ?? 'dinheiro'))} opcoes={(cfg?.moedasAtivas ?? [mp]).map((x) => ({ id: x, nome: x }))} />
            <ValorInput moeda={moeda} valor={valor} onChange={setValor} />
          </div>
        </Campo>
        <Campo rotulo="Forma"><Selecao valor={forma} onChange={setForma} opcoes={formas.map((x) => ({ id: x.id, nome: t(x.nome) }))} /></Campo>
        <Campo rotulo="Data limite para entregar" ajuda="Opcional. Dá para mudar o prazo junto."><Entrada type="date" value={prazo} min={f.data} onChange={(x) => setPrazo(x.target.value)} /></Campo>
        {valor !== undefined && moeda === mp && (
          <div className="rounded-2xl bg-[var(--fundo)] p-3 text-sm">
            <p className="flex justify-between gap-3"><span>{t('Falta hoje')}</span><b className="num">{formatar(dados.saldo, mp)}</b></p>
            <p className="mt-1 flex justify-between gap-3 border-t border-[var(--borda)] pt-1 font-bold"><span>{t('Fica')}</span><span className="num">{formatar(dados.saldo + valor, mp)}</span></p>
          </div>
        )}
      </div>
    </Janela>
  )
}

export function JanelaPrazo({ dados, onFechar }: { dados: DadosAdiantamento; onFechar(): void }) {
  const t = useT()
  const { executar, ocupado } = useComando()
  const f = dados.financiamento
  const [prazo, setPrazo] = useState(f.prazo ?? '')
  const salvar = async (p: string) => (await executar('ajustarFinanciamento', { financiamentoId: f.id, prazo: p }, t('Salvo.'))) && onFechar()
  return (
    <Janela aberta titulo={`⏰ ${t('Data limite')}`} onFechar={onFechar}
      rodape={<div className="flex gap-2">
        {f.prazo && <Botao variante="secundario" disabled={ocupado} onClick={() => salvar('')}>{t('Sem data')}</Botao>}
        <Botao grande className="flex-1" disabled={ocupado || !prazo || prazo === f.prazo} onClick={() => salvar(prazo)}>{t('Salvar')}</Botao>
      </div>}>
      <Campo rotulo="Até quando entregar o cabelo" ajuda="Passou a data e ainda deve: aparece como vencido na lista e no painel."><Entrada type="date" value={prazo} min={f.data} onChange={(x) => setPrazo(x.target.value)} /></Campo>
    </Janela>
  )
}
