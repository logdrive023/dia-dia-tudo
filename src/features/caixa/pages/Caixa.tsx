// CAIXA: o dinheiro de verdade, dia a dia. O Painel diz como o negócio vai; Vendas diz o que foi vendido; só aqui se vê todo
// dinheiro que entrou e saiu (venda, compra, despesa, retirada), se lança o que não é venda e se confere a gaveta.
//   Ordem da tela: o dia (fita) → 4 números → os movimentos do dia → fechar o dia → a conta completa (fechada).
// O caixa continua POR MOEDA (cada lançamento fica na moeda dele); o ⚙ mostra tudo numa moeda só, com a cotação digitada
// (só para ver: não muda nenhum lançamento).

import { useEffect, useState } from 'react'
import { TurnosFechados } from '../components/Turno'
import { formatar } from '../../../core/domain/dinheiro'
import { AcaoIcone } from '../../../shared/ui/acoesPagina'
import { dataCurta, dataLocal } from '../../../core/domain/datas'
import type { Id, MovCaixa } from '../../../core/domain/tipos'
import { NOMES_TIPO_CAIXA } from '../../../core/services/caixa'
import { Botao, Carregando, Confirmar, Pilula, dataBR, Titulo } from '../../../shared/ui/base'
import { useApp, useComando, useConsulta, useParamTela } from '../../../shared/ui/contexto'
import { useCotacoes } from '../../../shared/ui/compartilhados'
import { useT } from '../../../shared/ui/i18n'
import { MenuAcoes } from '../../../shared/ui/menuAcoes'
import { BOTOES, NOME_STATUS, type TipoLancar } from '../model/caixaDia'
import { FitaDias } from '../components/FitaDias'
import { DetalhesDia } from '../components/DetalhesDia'
import { FecharDia } from '../components/FecharDia'
import { MovimentosDia } from '../components/MovimentosDia'
import { ResumoCaixa } from '../components/ResumoCaixa'
import { VerEmMoeda } from '../components/VerEmMoeda'
import { useVisaoCaixa } from '../hooks/useVisaoCaixa'
import { Lancar } from '../components/Lancar'
import { Encerrar } from '../components/Encerrar'

// ---------- preferências do aparelho (moeda da visão e cotações digitadas) ----------

/** De onde veio cada lançamento (venda, compra ou empréstimo); acerto de conta não tem tela própria. */
function useOrigens(movs: MovCaixa[]) {
  const { backend } = useApp()
  const [mapa, setMapa] = useState<Record<string, { tela: string; id: Id }>>({})
  const chave = [...new Set(movs.filter((m) => m.origemId).map((m) => m.origemId!))].sort().join(',')
  useEffect(() => {
    let vivo = true
    const ids = chave ? chave.split(',') : []
    Promise.all(
      ids.map(async (id): Promise<[string, { tela: string; id: Id }] | undefined> => {
        try {
          const r = await backend.consulta('venda', { id })
          return [id, { tela: r.venda.tipo === 'compra' ? 'pedido' : 'venda', id }]
        } catch {
          /* não é venda nem compra */
        }
        try {
          await backend.consulta('emprestimo', { id })
          return [id, { tela: 'emprestimo', id }]
        } catch {
          return undefined
        }
      }),
    ).then((r) => vivo && setMapa(Object.fromEntries(r.filter((x): x is [string, { tela: string; id: Id }] => !!x))))
    return () => {
      vivo = false
    }
  }, [backend, chave])
  return mapa
}

export function Caixa() {
  const t = useT()
  const { ir } = useApp()
  const hoje = dataLocal()
  const [data, setData] = useParamTela('data', hoje)
  const { dados } = useConsulta('caixaDoDia', { data })
  const { dados: dias } = useConsulta('diasDoCaixa', {})
  const { cfg, cot } = useCotacoes()
  const { executar, ocupado } = useComando()
  const [lancar, setLancar] = useState<TipoLancar>()
  const [encerrar, setEncerrar] = useState(false)
  const [desfazer, setDesfazer] = useState<MovCaixa>()
  const [reabrir, setReabrir] = useState(false)
  const [verMoeda, setVerMoeda] = useState(false)
  const origens = useOrigens(dados?.movimentos ?? [])
  const visao = useVisaoCaixa(dados?.contas ?? [], cot)
  const nomeForma = new Map((cfg?.formas ?? []).map((f) => [f.id, f.nome]))
  if (!dados) return <Carregando />
  const aberto = dados.status !== 'encerrado'
  // o dia anterior com movimento ficou sem encerrar?
  const anterior = (dias ?? []).find((d) => d.data < data)
  const anteriorAberto = aberto && anterior?.status === 'aberto' ? anterior.data : undefined
  const verMovimentos = () => document.getElementById('cx-movimentos')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  /** linha da conta → rótulo traduzido e para onde leva */
  const linha = (l: { rotulo: string; tipo: string; valor: number }, moeda: string): { rotulo: string; abrir(): void } => {
    if (l.tipo === 'grupo') {
      for (const tipo of ['venda', 'recebimento'] as const)
        for (const forma of new Set(dados.movimentos.filter((m) => m.tipo === tipo && m.moeda === moeda).map((m) => m.forma)))
          if (l.rotulo === `${NOMES_TIPO_CAIXA[tipo]}s · ${nomeForma.get(forma) ?? forma}`)
            return { rotulo: `${t(`${NOMES_TIPO_CAIXA[tipo]}s`)} · ${t(nomeForma.get(forma) ?? forma)}`, abrir: tipo === 'venda' ? () => ir('vendas', { de: data, ate: data, forma, moeda }) : verMovimentos }
      return { rotulo: l.rotulo, abrir: verMovimentos }
    }
    const m = dados.movimentos.find((x) => x.tipo === l.tipo && x.moeda === moeda && x.delta === l.valor && x.descricao === l.rotulo)
    const o = m?.origemId ? origens[m.origemId] : undefined
    return { rotulo: l.rotulo, abrir: o ? () => ir(o.tela, { id: o.id }) : verMovimentos }
  }
  const irEncerrarAnterior = () => {
    if (!anteriorAberto) return
    setData(anteriorAberto)
    setEncerrar(true)
  }
  return (
    <div className="min-w-0">
      <Titulo
        subtitulo={<>{dataBR(data)} · <Pilula tom={aberto ? 'bom' : 'neutro'}>{t(NOME_STATUS[dados.status] ?? dados.status)}</Pilula></>}
        acao={<>
          {aberto && <MenuAcoes principal={`+ ${t('Lançar')}`} rotulo="Lançar dinheiro" pergunta="O que você quer lançar?" acoes={BOTOES.map((b) => ({ rotulo: b.nome, icone: b.icone, descricao: b.dica, onClick: () => setLancar(b.tipo) }))} />}
          {visao.moedasVer.length > 1 && <AcaoIcone icone="⚙️" rotulo="Moeda" dica="Ver tudo em outra moeda (só para ver)." ativo={verMoeda} onClick={() => setVerMoeda(!verMoeda)} />}
        </>}>
        {t('Caixa')}
      </Titulo>

      {verMoeda && <div className="mb-4"><VerEmMoeda visao={visao} onFechar={() => setVerMoeda(false)} /></div>}

      <FitaDias data={data} hoje={hoje} dias={dias ?? []} onEscolher={setData} />

      {/* aviso curto quando há o que fazer com o dia */}
      {!aberto ? (
        <Aviso texto={t('Dia encerrado')} rotulo={t('Reabrir')} disabled={ocupado} onClick={() => setReabrir(true)} />
      ) : (
        anteriorAberto && <Aviso texto={t('O dia {d} não foi encerrado', { d: dataCurta(anteriorAberto) })} rotulo={t('Encerrar')} onClick={irEncerrarAnterior} />
      )}

      {dados.alteracoesDepois.length > 0 && (
        <div className="mb-4 rounded-2xl border border-[var(--alerta)] bg-[var(--alerta)]/10 p-3 text-sm">
          <p className="font-semibold">{t('Alterado depois de encerrado')}</p>
          <p className="text-[var(--suave)]">{t('O dinheiro contado deste dia não mudou: a diferença entrou no caixa do dia da correção.')}</p>
          <ul className="mt-2 space-y-1">
            {dados.alteracoesDepois.map((a, i) => (
              <li key={i}>
                <button type="button" className="min-h-10 text-left font-semibold text-[var(--marca)] underline-offset-2 hover:underline" onClick={() => ir('venda', { id: a.origemId })}>
                  {a.codigo ?? t('Venda')}
                </button>{' '}
                · {a.descricao} · {dataBR(a.em)} · {a.porNome}
              </li>
            ))}
          </ul>
        </div>
      )}

      <ResumoCaixa visao={visao} movimentos={dados.movimentos} />

      <div className="grid min-w-0 gap-4 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)] lg:items-start">
        <MovimentosDia movimentos={dados.movimentos} origens={origens} nomeForma={nomeForma} aberto={aberto} onDesfazer={setDesfazer} />
        <div className="min-w-0 space-y-3">
          <FecharDia contas={dados.contas} aberto={aberto} ocupado={ocupado} onEncerrar={() => setEncerrar(true)} onReabrir={() => setReabrir(true)} />
          <DetalhesDia visao={visao} contas={dados.contas} movimentos={dados.movimentos} data={data} linha={linha} />
        </div>
      </div>

      {lancar && <Lancar tipoInicial={lancar} data={data} hoje={hoje} onFechar={() => setLancar(undefined)} />}
      {desfazer && (
        <Confirmar
          titulo="Desfazer lançamento?"
          texto={`${desfazer.descricao}: ${formatar(desfazer.delta, desfazer.moeda)}. ${t('Entra um lançamento inverso; o original fica no histórico.')}`}
          rotulo="Desfazer"
          perigo
          onFechar={() => setDesfazer(undefined)}
          onConfirmar={(motivo) => executar('estornarLancamento', { lancamentoId: desfazer.id, motivo: motivo || undefined }, t('Desfeito (fica no histórico).'))}
        />
      )}
      {reabrir && <Confirmar titulo="Reabrir o dia?" texto="O dia volta a aceitar lançamentos. O dinheiro contado no encerramento fica guardado." rotulo="Reabrir o dia" onFechar={() => setReabrir(false)} onConfirmar={() => executar('reabrirDia', { data }, t('Dia reaberto.'))} />}
      {/* só abre com a conta do dia certo (no "Encerrar" do aviso, a tela troca de dia antes) */}
      {encerrar && dados.data === data && <Encerrar data={data} contas={dados.contas} movimentos={dados.movimentos} onFechar={() => setEncerrar(false)} />}
      {/* os turnos de cada pessoa (conferência cega): quem contou, o esperado e a diferença */}
      <TurnosFechados />
    </div>
  )
}

/** Aviso amarelo curto com uma ação. */
function Aviso({ texto, rotulo, onClick, disabled }: { texto: string; rotulo: string; onClick(): void; disabled?: boolean }) {
  return (
    <div className="mb-4 flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-[var(--alerta)] bg-[var(--alerta)]/10 px-3 py-2 text-sm">
      <span className="font-semibold">⚠️ {texto}</span>
      <Botao variante="leve" className="min-h-10 text-[var(--alerta)]" disabled={disabled} onClick={onClick}>
        {rotulo}
      </Botao>
    </div>
  )
}
