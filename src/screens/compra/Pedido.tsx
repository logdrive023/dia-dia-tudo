// FICHA DA COMPRA (#/pedidos/<código>): o resumo (valores, pagamento, viagem), as linhas com conferir peso e
// corrigir valor, os anexos e as ações da etapa.
import { type ReactNode, useState } from 'react'
import { LigarCompras } from '../compra/LigarCompras'
import { PagamentoCompra, Progresso } from '../PagamentoCompra'
import { CaminhoDoCabelo } from '../../ui/caminhoCabelo'
import { CabecalhoFicha } from '../../ui/cabecalhoFicha'
import { formatar } from '../../core/domain/dinheiro'
import type { Id, Linha } from '../../core/domain/tipos'
import { Abas, Botao, Campo, Carregando, Confirmar, Entrada, GramasInput, Info, Janela, Pilula, ValorInput, cx, dataBR, gramasTexto, ErroTela } from '../../ui/base'
import { useApp, useParamTela, useComando, useConsulta } from '../../ui/contexto'
import { AbaAnexos } from '../../ui/anexos'
import { LinhaDoTempo } from '../../ui/linhaTempo'
import { SeloPendencias } from '../../ui/pendencias'
import { useT } from '../../ui/i18n'
import { Trilha } from '../../ui/trilha'
import { TrocarCodigo } from '../../ui/codigos'
import { MenuAcoes } from '../../ui/menuAcoes'
import { AvisoCompra } from '../compra/AvisoCompra'
import { ItensCompra } from '../compra/ItensCompra'
import { ParaOndeFoi } from '../compra/ParaOndeFoi'
import { TriagemCompra } from '../compra/TriagemCompra'
import { type DadosPedido, codigoDe } from '../compra/pecas'
import { CATEGORIAS_COMPRA, ENCERRADAS, encerradaSemViagem } from './comum'

/**
 * RESUMO DO PEDIDO — o que se quer saber de relance, cada coisa no seu bloco:
 *   ✈️ a VIAGEM (em destaque: código, nome, destino e o que veio nela · ou "sem viagem" + Ligar)
 *   🛒 fornecedor · 📅 quando · 👤 quem comprou · ⚖️ peso e custo/kg · 💵 pagamento (pago / falta) · 📍 etapa
 *   ⚠️ o que falta (pendências) e a observação
 */
function ResumoPedido({ dados, admin, onLigarViagem, onPagamento }: { dados: DadosPedido; admin: boolean; onLigarViagem(): void; onPagamento(): void }) {
  const t = useT()
  const { ir } = useApp()
  const c = dados.compra
  const m = c.moedaPrincipal
  const v = dados.viagem
  const falta = Math.max(0, c.totalPrincipal - dados.pago)
  const encerrado = ENCERRADAS.includes(c.etapa)
  const bloco = (icone: string, rotulo: string, valor: ReactNode, sub?: ReactNode, onClick?: () => void) => {
    const dentro = <>
      <span className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-[var(--suave)]"><span aria-hidden>{icone}</span>{t(rotulo)}</span>
      <span className="mt-1 block truncate font-bold">{valor}</span>
      {sub && <span className="num block truncate text-xs text-[var(--suave)]">{sub}</span>}
    </>
    return onClick
      ? <button type="button" onClick={onClick} className="min-w-0 rounded-xl bg-[var(--fundo)] p-3 text-left ring-1 ring-[var(--borda)] transition hover:ring-[var(--marca)]">{dentro}</button>
      : <div className="min-w-0 rounded-xl bg-[var(--fundo)] p-3 ring-1 ring-[var(--borda)]">{dentro}</div>
  }
  return (
    <section aria-label={t('Resumo do pedido')} className="space-y-3 rounded-2xl border border-[var(--borda)] bg-[var(--cartao)] p-3 shadow-sm sm:p-4">
      {/* A VIAGEM, em destaque (de onde veio esta compra) */}
      {v ? (
        <div className="flex flex-wrap items-stretch gap-2 rounded-2xl bg-[linear-gradient(135deg,rgba(14,165,233,.14),rgba(14,165,233,.04))] p-1 ring-1 ring-sky-500/30">
        <button type="button" onClick={() => ir('viagem', { id: v.id })} className="flex min-w-0 flex-[1_1_16rem] flex-wrap items-center gap-3 rounded-xl p-2 text-left transition hover:bg-sky-500/10">
          <span aria-hidden className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-sky-500 text-xl text-white shadow-sm">✈️</span>
          <span className="min-w-0 flex-1">
            <span className="block text-[11px] font-semibold uppercase tracking-wide text-sky-700 dark:text-sky-300">{t('Comprada na viagem')}</span>
            <b className="block truncate text-base"><span className="font-mono">{v.codigo}</span> · {v.nome}</b>
            <span className="num block truncate text-xs text-[var(--suave)]">{[v.destino && `📍 ${v.destino}`, v.inicio && `📅 ${dataBR(v.inicio)}${v.fim ? ` – ${dataBR(v.fim)}` : ''}`, t('nesta viagem: {n} compra(s) · {g}', { n: v.compras, g: gramasTexto(v.gramas) })].filter(Boolean).join(' · ')}</span>
          </span>
          <span className="shrink-0 text-sm font-semibold text-sky-700 dark:text-sky-300">{t('Ver a viagem')} →</span>
        </button>
        {admin && <button type="button" onClick={onLigarViagem} className="ml-auto min-h-11 whitespace-nowrap rounded-xl px-3 text-sm font-semibold text-sky-700 hover:bg-sky-500/10 dark:text-sky-300">⇄ {t('Trocar de viagem')}</button>}
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-dashed border-[var(--borda)] p-3">
          <span aria-hidden className="text-xl opacity-60">✈️</span>
          <span className="linha-texto text-sm text-[var(--suave)]">{t('Sem viagem: compra feita fora de uma viagem de compra.')}</span>
          {admin && !encerradaSemViagem(c.etapa) && <Botao variante="secundario" onClick={onLigarViagem}>✈️ {t('Ligar a uma viagem')}</Botao>}
        </div>
      )}
      {/* A TRIAGEM: feita, parcial ou falta (com o botão de separar) — sempre à vista */}
      <TriagemCompra dados={dados} admin={admin} cancelada={encerradaSemViagem(c.etapa)} />
      {/* OS FATOS, cada um no seu bloco */}
      <div className="grid grid-cols-2 gap-2 lg:grid-cols-3">
        {bloco('🛒', 'Fornecedor', dados.pessoa?.nome ?? t('Sem fornecedor'), dados.saldoConta ? (dados.saldoConta < 0 ? `${t('Devo')} ${formatar(-dados.saldoConta, m)}` : `${t('Me deve')} ${formatar(dados.saldoConta, m)}`) : undefined, dados.pessoa ? () => ir('pessoa', { id: dados.pessoa!.id }) : undefined)}
        {bloco('📅', 'Quando', dataBR(c.data), encerrado ? t(c.nomeEtapa) : t('parada há {n} dias', { n: c.diasParada }))}
        {bloco('👤', 'Quem comprou', dados.comprador?.nome ?? '—')}
        {bloco('⚖️', 'Peso', gramasTexto(dados.gramas), dados.custoKg ? `${formatar(dados.custoKg, m)}/kg` : undefined)}
        {bloco('💵', 'Pagamento', falta > 0 ? `${t('Falta')} ${formatar(falta, m)}` : `✓ ${t('Pago')}`, `${t('Total')} ${formatar(c.totalPrincipal, m)}`, onPagamento)}
        {bloco('📍', 'Etapa', t(c.nomeEtapa), <Progresso etapas={dados.etapas} atual={c.etapa} mini />)}
      </div>
      {(c.pendencias.length > 0 || c.obs) && (
        <div className="flex flex-wrap items-center gap-2 border-t border-[var(--borda)] pt-3 text-sm">
          {c.pendencias.length > 0 && <><span className="text-xs font-semibold uppercase tracking-wide text-[var(--suave)]">{t('O que falta')}</span><SeloPendencias pendencias={c.pendencias} moeda={m} /></>}
          {c.obs && <span className="min-w-0 basis-full text-[var(--suave)] break-words">📝 {c.obs}</span>}
        </div>
      )}
    </section>
  )
}

const AJUDA_VALOR =
  'Corrigir o valor (ou pôr o valor de uma compra "sem valor"): vale mesmo depois de pagar, separar ou vender. A diferença segue o cabelo: o custo dos pacotes que saíram dele e das vendas que já levaram parte. Se já lançou na conta do fornecedor, a conta acompanha. Ex.: entrou 3 kg sem valor, separou 2 + 1 kg; pôs Bs 3.000 → os pacotes ficam com Bs 2.000 e Bs 1.000.'

/** Conferência de peso (um toque, vale mesmo depois de pago): lança a diferença no lote, sem mudar o comprado. */
function ConferirPeso({ compraId, linha, onFechar }: { compraId: Id; linha: Linha; onFechar(): void }) {
  const t = useT()
  const { executar, ocupado } = useComando()
  const [pesado, setPesado] = useState<number>()
  const [motivo, setMotivo] = useState('')
  const dif = pesado !== undefined ? pesado - linha.quantidade : 0
  const pode = pesado !== undefined && !!motivo.trim() && !ocupado
  return (
    <Janela aberta titulo={<span className="flex items-center">{t('Conferência de peso')}<Info texto="Pesou na chegada e deu diferente? Ex.: comprou 10.000 g, pesou 9.850 g → 150 g de diferença." /></span>} onFechar={onFechar} rodape={
      <Botao grande className="w-full" disabled={!pode} onClick={async () => (await executar('conferirPesoCompra', { compraId, linhaId: linha.id, pesado: pesado ?? 0, motivo }, t('Diferença de peso lançada.'))) && onFechar()}>⚖ {t('Lançar diferença')}</Botao>
    }>
      <div className="space-y-3">
        <p className="text-sm">{linha.descricao} · {t('comprou')} <b className="num">{gramasTexto(linha.quantidade)}</b></p>
        <Campo rotulo="Pesou"><GramasInput valor={pesado} onChange={setPesado} /></Campo>
        {pesado !== undefined && dif !== 0 && <p className={cx('num text-sm font-semibold', dif < 0 ? 'text-[var(--ruim)]' : 'text-[var(--bom)]')}>{dif > 0 ? '+' : '−'}{gramasTexto(Math.abs(dif))} {t('de diferença')}</p>}
        <Campo rotulo="Motivo *"><Entrada value={motivo} placeholder={t('Ex.: balança da loja, veio úmido')} onChange={(e) => setMotivo(e.target.value)} /></Campo>
        <p className="text-xs text-[var(--suave)]">{t('O que foi comprado não muda: a diferença fica no histórico do lote.')}</p>
      </div>
    </Janela>
  )
}

function CorrigirValor({ compraId, linha, onFechar }: { compraId: Id; linha: Linha; onFechar(): void }) {
  const t = useT()
  const { executar, ocupado } = useComando()
  const [valor, setValor] = useState<number | undefined>(linha.total || undefined)
  const [motivo, setMotivo] = useState('')
  const pode = valor !== undefined && valor !== linha.total && !!motivo.trim() && !ocupado
  const porKg = valor && linha.quantidade ? Math.round((valor * 1000) / linha.quantidade) : 0
  return (
    <Janela aberta titulo={<span className="flex items-center">{t(linha.total ? 'Corrigir valor' : 'Pôr o valor')}<Info texto={AJUDA_VALOR} /></span>} onFechar={onFechar} rodape={
      <Botao grande className="w-full" disabled={!pode} onClick={async () => (await executar('definirValorCompra', { compraId, linhaId: linha.id, total: valor ?? 0, motivo }, t('Valor corrigido: o custo dos pacotes acompanhou.'))) && onFechar()}>✎ {t('Salvar valor')}</Botao>
    }>
      <div className="space-y-3">
        <p className="text-sm">{linha.descricao} · <b className="num">{gramasTexto(linha.quantidade)}</b> · {t('antes')}: <b className="num">{formatar(linha.total, linha.moeda)}</b></p>
        <Campo rotulo="Valor certo"><ValorInput moeda={linha.moeda} valor={valor} onChange={setValor} /></Campo>
        {porKg > 0 && <p className="num text-xs text-[var(--suave)]">= {formatar(porKg, linha.moeda)}/kg</p>}
        <Campo rotulo="Motivo *"><Entrada value={motivo} placeholder={t('Ex.: chegou a nota, valor combinado')} onChange={(e) => setMotivo(e.target.value)} /></Campo>
        <p className="text-xs text-[var(--suave)]">{t('Os pacotes e as vendas deste cabelo recebem o custo novo. Fica no histórico.')}</p>
      </div>
    </Janela>
  )
}

export function Pedido() {
  const t = useT()
  const { nav, ir, sessao, ajustarParams } = useApp()
  const id = nav.params.id as Id
  const { dados, erro } = useConsulta('pedido', { id })
  const { executar } = useComando()
  const [trocar, setTrocar] = useState(false)
  const [trocarLote, setTrocarLote] = useState<{ id: Id; codigo?: string }>()
  const [conferir, setConferir] = useState<Linha>()
  const [corrigirValor, setCorrigirValor] = useState<Linha>()
  const [ligarViagem, setLigarViagem] = useState(false)
  const [tirarViagem, setTirarViagem] = useState(false)
  // sub-abas (no endereço: #/pedidos/P1?aba=anexos): Resumo · Anexos (N) · Histórico
  const [aba, setAba] = useParamTela<'resumo' | 'pagamento' | 'anexos' | 'historico'>('aba', 'resumo')
  const { dados: anexos } = useConsulta('anexosDe', { donoId: id })
  if (erro) return <ErroTela texto={erro} />
  if (!dados) return <Carregando />
  const c = dados.compra
  const m = c.moedaPrincipal
  const admin = sessao.perfil === 'admin'
  const encerrado = ENCERRADAS.includes(c.etapa)
  const cancelada = c.etapa === 'recusado' || c.etapa === 'cancelado'
  const loteDaLinha = (l: Linha) => dados.lotes.find((x) => x.daCompra && x.linhaId === l.id)
  return (
    <div>
      {/* ONDE ESTOU: "← 🛒 Compras › Pedido P-0007" — forte, no alto (Compras leva à lista) */}
      <Trilha atual={<>{t('Pedido')} <span className="font-mono">{codigoDe(c)}</span>{dados.pessoa ? <span className="font-normal text-[var(--suave)]"> · {dados.pessoa.nome}</span> : null}</>} />

      {nav.params.registrada && !cancelada && <AvisoCompra dados={dados} onFechar={() => ajustarParams({ registrada: undefined })} />}

      {/* CABEÇALHO DE FICHA (o mesmo do pacote e da viagem): fornecedor · código + etapa · detalhes · total · ações */}
      <CabecalhoFicha
        className="mb-4"
        titulo={dados.pessoa?.nome ?? t('Sem fornecedor')}
        codigo={codigoDe(c)} anteriores={c.codigosAnteriores}
        valor={formatar(c.totalPrincipal, m)}
        valorDetalhe={<>{gramasTexto(dados.gramas)}{dados.custoKg ? ` · ${formatar(dados.custoKg, m)}/kg` : ''}</>}
        detalhes={[dataBR(c.data), dados.comprador && `${t('comprou')}: ${dados.comprador.nome}`, c.obs, !encerrado && t('parada há {n} dias', { n: c.diasParada })]}
        selos={<>
            <Pilula tom={c.etapa === 'concluido' ? 'bom' : encerrado ? 'ruim' : 'marca'}>{t(c.nomeEtapa)}</Pilula>
            <span className="text-sm text-[var(--suave)]">{dados.modulo.icone} {t(dados.modulo.nome)}</span>
            {dados.viagem && (
              <button type="button" onClick={() => ir('viagem', { id: dados.viagem!.id })} className="inline-flex min-h-8 max-w-full items-center gap-1 rounded-full bg-[var(--marca-suave)] px-2 text-xs font-semibold text-[var(--marca)] hover:brightness-95" title={t('Abrir a viagem')}>
                ✈️ <span className="truncate">{t('Viagem')} {dados.viagem.codigo}{dados.viagem.destino ? ` · ${dados.viagem.destino}` : ''}</span>
              </button>
            )}
        </>}
        acoes={
          // Repetir e Rastrear ficam só aqui (uma vez cada)
          <MenuAcoes comRotulo acoes={[
            ...(dados.pessoa ? [{ rotulo: 'Ver fornecedor', icone: '👤', onClick: () => ir('pessoa', { id: dados.pessoa!.id }) }] : []),
            ...(dados.lotes.length ? [{ rotulo: 'Rastrear: para onde foi', icone: '🔎', onClick: () => ir('rastreio', { compraId: c.id }) }] : []),
            { rotulo: 'Repetir esta compra', icone: '⟳', onClick: () => ir('novaCompra', { repetir: c.id }) },
            ...(admin ? [{ rotulo: 'Trocar código', icone: '#', onClick: () => setTrocar(true), separar: true }] : []),
            ...(admin && !encerradaSemViagem(c.etapa) ? [{ rotulo: dados.viagem ? 'Trocar de viagem' : 'Ligar a uma viagem', icone: '✈️', onClick: () => setLigarViagem(true) }] : []),
            ...(admin && dados.viagem ? [{ rotulo: 'Tirar da viagem', icone: '✈️', perigo: true, onClick: () => setTirarViagem(true) }] : []),
          ]} />
        }
      />
      {trocar && <TrocarCodigo tipo="compra" id={c.id} atual={c.codigo} onFechar={() => setTrocar(false)} />}
      {trocarLote && <TrocarCodigo tipo="lote" id={trocarLote.id} atual={trocarLote.codigo} onFechar={() => setTrocarLote(undefined)} />}
      {conferir && <ConferirPeso compraId={c.id} linha={conferir} onFechar={() => setConferir(undefined)} />}
      {corrigirValor && <CorrigirValor compraId={c.id} linha={corrigirValor} onFechar={() => setCorrigirValor(undefined)} />}
      {ligarViagem && <LigarCompras compraIds={[c.id]} onFechar={() => setLigarViagem(false)} />}
      {tirarViagem && dados.viagem && <Confirmar titulo={t('Tirar a compra da viagem {v}?', { v: dados.viagem.codigo })} texto="A compra continua existindo: só deixa de contar no resultado desta viagem. Se o gasto da viagem já estava no custo dos pacotes, ele é dividido de novo sozinho." rotulo="Tirar" onFechar={() => setTirarViagem(false)} onConfirmar={() => executar('desvincularCompra', { viagemId: dados.viagem!.id, compraId: c.id }, t('Compra tirada da viagem {v}.', { v: dados.viagem!.codigo }))} />}

      {/* ABAS (nomes iguais em toda ficha): Resumo · Pagamento (com a conta do fornecedor) · Arquivos · Histórico */}
      <Abas variante="sublinhado" atual={aba} onChange={(x) => setAba(x as typeof aba)} abas={[
        { id: 'resumo', nome: 'Resumo' },
        // o ● de cada aba é só pelo que é DELA (pago e sem foto: o ● fica em Arquivos, não em Pagamento)
        { id: 'pagamento', nome: 'Pagamento', extra: c.pendencias.some((x) => x.id === 'faltaPagar' || x.id === 'semValor') ? <span aria-hidden className="text-[var(--alerta)]">●</span> : undefined },
        { id: 'anexos', nome: 'Arquivos', extra: <>{anexos?.length ? <span className="num text-xs opacity-70">{anexos.length}</span> : null}{c.pendencias.some((x) => x.id === 'semFotos' || x.id === 'semComprovanteOrigem') && <span aria-hidden className="ml-0.5 text-[var(--alerta)]">●</span>}</> },
        { id: 'historico', nome: 'Histórico' },
      ]} />

      {aba === 'anexos' && <AbaAnexos donoId={c.id} categorias={CATEGORIAS_COMPRA} padrao="pedido" />}
      {/* UM bloco só: o caminho do cabelo (com o registro deste pedido dentro, na etapa Compra) */}
      {aba === 'historico' && <CaminhoDoCabelo de={{ compraId: c.id }} atual="compra" semCadeia={<LinhaDoTempo id={c.id} />} />}

      {aba === 'resumo' && <ResumoPedido dados={dados} admin={admin} onLigarViagem={() => setLigarViagem(true)} onPagamento={() => setAba('pagamento')} />}
      {aba === 'resumo' && (
        <div className="mt-4 grid items-start gap-4 lg:grid-cols-2">
          <ItensCompra dados={dados} admin={admin} cancelada={cancelada} onConferir={setConferir} onAjustarValor={setCorrigirValor} />
          {!cancelada && <ParaOndeFoi dados={dados} admin={admin} onTrocarLote={setTrocarLote} />}
        </div>
      )}

      {/* PAGAMENTO: um componente só (a conta deste pedido · pagar agora · a conta do fornecedor · as etapas) */}
      {(aba === 'pagamento' || (aba as string) === 'conta') && <PagamentoCompra dados={dados} comLote={(linhaId) => c.linhas.some((l) => l.id === linhaId && !!loteDaLinha(l))} />}
    </div>
  )
}
