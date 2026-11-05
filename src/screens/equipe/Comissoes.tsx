// COMISSÕES (Equipe › Comissões) — os números do período em cima (a pagar · ganho · pago), um CARTÃO por profissional
// (avatar, atendimentos, a barra do ganho já pago, o "a pagar" em destaque, Pagar e Ver histórico) e o HISTÓRICO
// (ganhos venda a venda com a conta, e os pagamentos), filtrável por pessoa. A busca do filtro da tela vale aqui.
import { useState } from 'react'
import { formasEmUso } from '../../core/domain/formas'
import { memoriaCalculo } from '../../core/domain/comissao'
import { formatar } from '../../core/domain/dinheiro'
import { Botao, Campo, Carregando, Entrada, Info, Janela, Pilula, Selecao, ValorInput, Vazio, cx, dataBR, moedaPadrao } from '../../ui/base'
import { useApp, useComando, useConsulta, useParamTela } from '../../ui/contexto'
import { novoId } from '../../core/domain/ids'
import { useT } from '../../ui/i18n'
import { GrupoNumeros, NumeroGrande } from '../../ui/numeroGrande'
import { corDoNome, iniciais } from '../../ui/tabelaDados'
import { Avatar, semAcento } from './pecas'

export function Comissoes({ de, ate, busca = '' }: { de: string; ate: string; busca?: string }) {
  const t = useT()
  const { sessao, ir } = useApp()
  const admin = sessao.perfil === 'admin'
  const [pessoaFiltro, setPessoaFiltro] = useParamTela('pessoaId', '')
  const pessoaId = pessoaFiltro || undefined
  const { dados } = useConsulta('comissoes', { de, ate, pessoaId })
  const [pagar, setPagar] = useState<{ id: string; nome: string; aPagar: number }>()
  if (!dados) return <Carregando />
  const m = dados.moeda
  const b = semAcento(busca.trim())
  const pessoas = dados.porPessoa.filter((x) => !b || semAcento(x.nome).includes(b))
  const ganho = dados.porPessoa.reduce((s, x) => s + x.ganhoPeriodo, 0)
  const pago = dados.porPessoa.reduce((s, x) => s + x.pagoPeriodo, 0)
  const extrato = dados.extrato.filter((e) => !b || semAcento(`${e.descricao} ${'cliente' in e ? e.cliente ?? '' : ''}`).includes(b))
  const filtrada = pessoaId ? dados.porPessoa.find((x) => x.pessoaId === pessoaId) : undefined
  return (
    <div className="space-y-4">
      <GrupoNumeros colunas={3} celular={3}>
        <NumeroGrande rotulo="A pagar" valor={formatar(dados.aPagar, m)} icone="⏳" tom={dados.aPagar > 0 ? 'alerta' : undefined} sub={t('desde sempre')} ajuda="Ganho = soma das comissões das vendas (desde sempre). Pago = pagamentos de comissão lançados. Ex.: ganhou Bs 1.200, já recebeu Bs 800 → a pagar Bs 400." />
        <NumeroGrande rotulo="Ganho no período" valor={formatar(ganho, m)} icone="✂️" tom={ganho ? 'bom' : undefined} />
        <NumeroGrande rotulo="Pago no período" valor={formatar(pago, m)} icone="💵" />
      </GrupoNumeros>

      {!dados.porPessoa.length ? <Vazio texto="Nenhuma comissão ainda." /> : !pessoas.length ? <Vazio texto="Ninguém com esse nome." /> : (
        <ul className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
          {pessoas.map((x) => {
            const sel = pessoaId === x.pessoaId
            const total = x.ganhoPeriodo || 1
            return (
              <li key={x.pessoaId} className={cx('flex flex-col gap-3 rounded-2xl border bg-[var(--cartao)] p-3 shadow-sm', sel ? 'border-[var(--marca)] ring-2 ring-[var(--marca)]/20' : 'border-[var(--borda)]')}>
                <div className="flex items-center gap-3">
                  <Avatar nome={x.nome} />
                  <span className="min-w-0 flex-1">
                    <b className="block truncate">{x.nome}</b>
                    <span className="num block text-xs text-[var(--suave)]">✂️ {x.atendimentos} {t('atend.')} · {t('ganhou')} {formatar(x.ganhoPeriodo, m)}</span>
                  </span>
                  <span className="shrink-0 text-right">
                    <span className="block text-[11px] font-semibold uppercase tracking-wide text-[var(--suave)]">{t('A pagar')}</span>
                    <b className={cx('num block text-lg leading-tight', x.aPagar > 0 ? 'text-[var(--alerta)]' : 'text-[var(--bom)]')}>{x.aPagar > 0 ? formatar(x.aPagar, m) : `✓ ${t('em dia')}`}</b>
                  </span>
                </div>
                {/* quanto do ganho do período já foi pago */}
                {x.ganhoPeriodo > 0 && (
                  <div>
                    <div className="flex h-2 overflow-hidden rounded-full bg-[var(--fundo)]" title={t('Pago do ganho no período')}>
                      <div className="bg-[var(--bom)]" style={{ width: `${Math.min(100, (x.pagoPeriodo / total) * 100)}%` }} />
                    </div>
                    <p className="num mt-1 text-xs text-[var(--suave)]">{t('Pago no período')}: {formatar(x.pagoPeriodo, m)}</p>
                  </div>
                )}
                <div className="mt-auto flex flex-wrap gap-2">
                  {admin && x.aPagar > 0 && <Botao className="flex-1" onClick={() => setPagar({ id: x.pessoaId, nome: x.nome, aPagar: x.aPagar })}>💵 {t('Pagar')}</Botao>}
                  <Botao variante="secundario" className="flex-1" aria-pressed={sel} onClick={() => setPessoaFiltro(sel ? '' : x.pessoaId)}>{t(sel ? 'Ver de todas' : 'Ver histórico')}</Botao>
                </div>
              </li>
            )
          })}
        </ul>
      )}

      <section aria-label={t('Histórico')} className="rounded-2xl border border-[var(--borda)] bg-[var(--cartao)] shadow-sm">
        <header className="flex flex-wrap items-center gap-2 border-b border-[var(--borda)] px-4 py-3">
          <h2 className="font-bold">{t('Histórico (ganhos e pagamentos)')}</h2>
          {filtrada && (
            <button type="button" onClick={() => setPessoaFiltro('')} className="inline-flex min-h-8 items-center gap-1 rounded-full bg-[var(--marca-suave)] px-2.5 text-xs font-semibold text-[var(--marca)]">
              {filtrada.nome} <span aria-hidden>✕</span>
            </button>
          )}
          <span className="num ml-auto text-xs text-[var(--suave)]">{extrato.length}</span>
        </header>
        {!extrato.length ? <div className="p-4"><Vazio compacto texto="Nada no período." /></div> : (
          <ul className="divide-y divide-[var(--borda)]">
            {extrato.slice(0, 200).map((e, i) => {
              const ganhoE = e.tipo === 'ganho'
              const corpo = (
                <>
                  <span aria-hidden className={cx('flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-base', ganhoE ? 'bg-[var(--bom)]/12' : 'bg-[var(--ruim)]/10')}>{ganhoE ? '✂️' : '💵'}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm"><b className="num">{dataBR(e.data)}</b> · {e.descricao}{ganhoE && e.cliente ? ` · ${e.cliente}` : ''}{ganhoE && e.corrigida && <> <Pilula tom="alerta" pequena>{t('corrigida')}</Pilula></>}</span>
                    <span className="num block text-xs text-[var(--suave)]">
                      {ganhoE
                        ? memoriaCalculo({ totalPrincipal: e.valorLinha, insumoPrincipal: e.insumo, insumos: e.insumos, comissaoBp: e.bp, comissaoPrincipal: e.valor, comissaoRegra: e.regra, baseComissao: e.base, parteSalao: e.parteSalao }, m, t)
                        : `${t('pagamento')} · ${formatar(e.valorMoeda, e.moeda)}`}
                    </span>
                  </span>
                  <b className={cx('num shrink-0', ganhoE ? 'text-[var(--bom)]' : 'text-[var(--ruim)]')}>{ganhoE ? '+' : '−'}{formatar(e.valor, m)}</b>
                </>
              )
              return (
                <li key={i}>
                  {ganhoE
                    ? <button type="button" onClick={() => ir('venda', { id: e.vendaId })} className="flex w-full items-center gap-3 px-4 py-2.5 text-left hover:bg-[var(--fundo)]">{corpo}</button>
                    : <div className="flex items-center gap-3 px-4 py-2.5">{corpo}</div>}
                </li>
              )
            })}
          </ul>
        )}
      </section>
      {pagar && <PagarComissao {...pagar} onFechar={() => setPagar(undefined)} />}
    </div>
  )
}

function PagarComissao({ id: pessoaId, nome, aPagar, onFechar }: { id: string; nome: string; aPagar: number; onFechar(): void }) {
  const t = useT()
  const { dados: cfg } = useConsulta('configuracoes', {})
  const { executar, ocupado } = useComando()
  const [id] = useState(() => novoId())
  const [valor, setValor] = useState<number | undefined>(aPagar)
  const [forma, setForma] = useState('dinheiro')
  const [ref, setRef] = useState('')
  const moeda = cfg?.config.moedaPrincipal ?? moedaPadrao()
  const fechar = () => ((valor === aPagar && !ref.trim()) || window.confirm(t('Sair sem salvar?'))) && onFechar()
  const cor = corDoNome(nome)
  return (
    <Janela aberta titulo={`${t('Pagar comissão')} · ${nome}`} onFechar={fechar} rodape={<Botao grande className="w-full" disabled={ocupado || !valor} onClick={async () => (await executar('pagarComissao', { id, pessoaId, valor: valor!, moeda, forma, referencia: ref }, t('Comissão paga (sai do caixa e abate do a pagar).'))) && onFechar()}>{t('Pagar')}</Botao>}>
      <div className="space-y-3">
        <div className="flex items-center gap-3 rounded-2xl bg-[var(--fundo)] p-3">
          <span aria-hidden className="flex h-10 w-10 items-center justify-center rounded-full text-sm font-bold" style={{ background: `color-mix(in srgb, ${cor} 18%, transparent)`, color: cor }}>{iniciais(nome)}</span>
          <span className="flex-1 text-sm">{t('A pagar')} <Info texto="Pode pagar tudo ou uma parte; o resto continua a pagar. Ex.: a pagar Bs 400, pagou Bs 300 → fica Bs 100." /></span>
          <b className="num text-lg text-[var(--alerta)]">{formatar(aPagar, moeda)}</b>
        </div>
        <Campo rotulo="Valor"><ValorInput moeda={moeda} valor={valor} onChange={setValor} /></Campo>
        <Campo rotulo="Forma"><Selecao valor={forma} onChange={setForma} opcoes={formasEmUso(cfg?.config.formas, moeda).map((f) => ({ id: f.id, nome: t(f.nome) }))} /></Campo>
        <Campo rotulo="Referência (opcional)"><Entrada value={ref} placeholder={t('Ex.: comissões da quinzena')} onChange={(e) => setRef(e.target.value)} /></Campo>
      </div>
    </Janela>
  )
}
