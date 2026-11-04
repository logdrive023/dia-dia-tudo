// VENDER — o módulo de vendas: registrar (botão "+ Nova venda") e encontrar qualquer venda já feita. Padrões de
// Shopify (pedidos em abas por situação, busca + filtros numa barra, tocar abre), Square (busca por cliente, recibo e
// item; filtros de data, forma de pagamento, funcionário) e Stripe (cada linha: valor, situação e data com nome fixo).
// Tudo com as peças do sistema: Titulo · GrupoNumeros/NumeroGrande · FiltroLista · tabela (computador) ou linha curta
// que abre no lugar (celular) · Paginacao. A lista é a MESMA consulta `vendas` que forma os números do Painel.

import { type ReactNode, useState } from 'react'
import { dataLocal } from '../core/domain/datas'
import { FiltroViagem, SelosViagem, passaViagem, viagensDasLinhas } from '../ui/seloViagem'
import { TabelaDados, SeloCodigo, corDoNome, iniciais } from '../ui/tabelaDados'
import { formatar } from '../core/domain/dinheiro'
import { Campo, Confirmar, Entrada, Pilula, Selecao, Titulo, Vazio, cx, dataBR, diaCurto, hora, moedaPadrao } from '../ui/base'
import { useApp, useComando, useConsulta, useFiltrosTela } from '../ui/contexto'
import { CampoFaixa, FiltroLista, GrupoFiltro, VazioFiltro, type FiltroAtivo } from '../ui/filtroPadrao'
import { useT } from '../ui/i18n'
import { type Acao } from '../ui/menuAcoes'
import { GrupoNumeros, NumeroGrande } from '../ui/numeroGrande'
import { Paginacao, usePaginacao } from '../ui/paginacao'
import { SeloPendencias } from '../ui/pendencias'
import { baixarCSV } from './Relatorios'

/** as abas (situação): concluídas · com pendência · EM ABERTO (começou no caixa e saiu) · canceladas · todas */
const ABAS = [{ id: '', nome: 'Concluídas' }, { id: 'pendencia', nome: 'Com pendência' }, { id: 'abertas', nome: 'Em aberto' }, { id: 'canceladas', nome: 'Canceladas' }, { id: 'todas', nome: 'Todas' }] as const
const PENDENCIAS = [{ id: 'faltaReceber', nome: 'Falta receber' }, { id: 'semComprovante', nome: 'Sem comprovante' }]
/** os filtros do endereço (para "Limpar"); a aba e a página ficam de fora */
const CHAVES = ['busca', 'de', 'ate', 'pendencia', 'forma', 'moeda', 'usuarioId', 'profissionalId', 'pessoaId', 'moduloId', 'localId', 'viagem'] as const

/** "hoje" · "ontem" · "02/11" (o dia de relance na linha do celular) */
function diaRelativo(iso: string, t: (s: string) => string) {
  const hoje = dataLocal()
  const ontem = dataLocal(new Date(Date.now() - 86400000))
  return iso.slice(0, 10) === hoje ? t('hoje') : iso.slice(0, 10) === ontem ? t('ontem') : diaCurto(iso)
}

export function ListaVendas({ novaVenda, aviso }: { novaVenda: ReactNode; aviso?: ReactNode }) {
  const t = useT()
  const { ir, ajustarParams, sessao } = useApp()
  const { p, setP, tirar } = useFiltrosTela()
  const { executar } = useComando()
  const admin = sessao.perfil === 'admin'
  const { dados: conf } = useConsulta('configuracoes', {})
  const { dados: pessoas } = useConsulta('pessoas', {})
  const { dados: locais } = useConsulta('locais', {})
  const cfg = conf?.config
  // a mesma consulta do Painel; as canceladas vêm da mesma consulta pedindo a etapa "cancelado"
  const base = { de: p('de') || undefined, ate: p('ate') || undefined, moduloId: p('moduloId') || undefined, forma: p('forma') || undefined, moeda: p('moeda') || undefined, localId: p('localId') || undefined, profissionalId: p('profissionalId') || undefined, pessoaId: p('pessoaId') || undefined, usuarioId: p('usuarioId') || undefined }
  const { dados: concluidas } = useConsulta('vendas', base)
  const { dados: canceladas } = useConsulta('vendas', { ...base, etapa: 'cancelado' })
  const [cancelar, setCancelar] = useState<string>()
  // VENDAS EM ABERTO (o servidor guarda; aqui só mostra): retomar no caixa ou descartar
  const { dados: abertas } = useConsulta('vendasAbertas', {})
  const [descartar, setDescartar] = useState<string>()

  const aba = p('aba') as (typeof ABAS)[number]['id']
  const pendencia = p('pendencia')
  const termo = p('busca').trim().toLowerCase()
  const abertasFiltradas = (abertas ?? []).filter((a) => !termo || [a.cliente, a.porNome, ...a.linhas.map((l) => `${l.codigo ?? ''} ${l.nome}`)].filter(Boolean).join(' ').toLowerCase().includes(termo))
  const ordem = p('ordem') || 'data'
  const carregando = !concluidas || !canceladas
  type V = NonNullable<typeof concluidas>[number]
  const nomeForma = (id: string) => t(cfg?.formas.find((x) => x.id === id)?.nome ?? id)
  const formas = (v: V) => [...new Set(v.pagamentos.map((x) => x.forma))].map(nomeForma).join(' + ')
  const textoBusca = (v: V) => [v.codigo, v.cliente, v.feitoPor, ...v.linhas.map((l) => l.descricao)].filter(Boolean).join(' ').toLowerCase()
  const passa = (v: V) => (!termo || textoBusca(v).includes(termo)) && (!pendencia || v.pendencias.some((x) => x.id === pendencia)) && passaViagem(p('viagem'), v.viagens)
  const viagensVendas = viagensDasLinhas([...(concluidas ?? []), ...(canceladas ?? [])].flatMap((v) => v.viagens))
  const conc = (concluidas ?? []).filter(passa)
  const canc = (canceladas ?? []).filter(passa)
  const daAba = aba === 'canceladas' ? canc : aba === 'todas' ? [...conc, ...canc] : aba === 'pendencia' ? conc.filter((v) => v.pendencias.length) : conc
  const lista = [...daAba].sort((a, b) => (ordem === 'valor' ? b.valor - a.valor : ordem === 'valorMenor' ? a.valor - b.valor : (a.data + a.criadoEm < b.data + b.criadoEm ? 1 : -1)))
  const pag = usePaginacao(lista, { reiniciar: JSON.stringify([aba, ordem, ...CHAVES.map((k) => p(k))]) })
  const moeda = p('moeda') || concluidas?.[0]?.moedaPrincipal || moedaPadrao()

  // NÚMEROS do que está filtrado (período, busca e filtros; a aba não muda os números)
  const vendido = conc.reduce((s, v) => s + v.valor, 0)
  const comPend = conc.filter((v) => v.pendencias.length)
  const faltaReceber = conc.filter((v) => v.pendencias.some((x) => x.id === 'faltaReceber')).length
  const irAba = (id: string) => ajustarParams({ aba: id || undefined, pagina: undefined })

  // FILTROS ligados (chips ✕)
  const nomePessoa = (id: string) => pessoas?.find((x) => x.id === id)?.nome ?? id
  const periodo = p('de') || p('ate') ? `📅 ${p('de') ? dataBR(p('de')) : '…'} – ${p('ate') ? dataBR(p('ate')) : '…'}` : ''
  const ativos: FiltroAtivo[] = [
    ...(periodo ? [{ k: 'de,ate', rotulo: periodo }] : []),
    ...(pendencia ? [{ k: 'pendencia', rotulo: `⚠️ ${t(PENDENCIAS.find((x) => x.id === pendencia)?.nome ?? pendencia)}` }] : []),
    ...(p('viagem') ? [{ k: 'viagem', rotulo: `✈️ ${p('viagem') === 'sem' ? t('Sem viagem') : viagensVendas.find((v) => v.id === p('viagem'))?.codigo ?? p('viagem')}` }] : []),
    ...(p('forma') ? [{ k: 'forma', rotulo: `💳 ${nomeForma(p('forma'))}` }] : []),
    ...(p('moeda') ? [{ k: 'moeda', rotulo: `💱 ${t('Só')} ${p('moeda')}` }] : []),
    ...(p('usuarioId') ? [{ k: 'usuarioId', rotulo: `👤 ${t('por')} ${nomePessoa(p('usuarioId'))}` }] : []),
    ...(p('profissionalId') ? [{ k: 'profissionalId', rotulo: `✂️ ${nomePessoa(p('profissionalId'))}` }] : []),
    ...(p('pessoaId') ? [{ k: 'pessoaId', rotulo: `🧑 ${nomePessoa(p('pessoaId'))}` }] : []),
    ...(p('moduloId') ? [{ k: 'moduloId', rotulo: t(conf?.modulos.find((m) => m.id === p('moduloId'))?.nome ?? p('moduloId')) }] : []),
    ...(p('localId') ? [{ k: 'localId', rotulo: `📍 ${locais?.find((l) => l.id === p('localId'))?.nome ?? p('localId')}` }] : []),
  ]
  const filtrando = ativos.length > 0 || !!termo
  const limpar = () => ajustarParams({ ...Object.fromEntries(CHAVES.map((k) => [k, undefined])), pagina: undefined })
  const mudar = (k: string, v: string) => ajustarParams({ [k]: v || undefined, pagina: undefined })
  const funcionarios = (pessoas ?? []).filter((u) => u.papeis.includes('funcionario'))
  const clientes = (pessoas ?? []).filter((u) => u.papeis.includes('cliente'))
  const modulosVenda = (conf?.modulos ?? []).filter((m) => cfg?.modulosAtivos.includes(m.id) && m.temVenda)

  const situacao = (v: V) => (v.etapa === 'cancelado' ? <Pilula tom="neutro">✕ {t('Cancelada')}</Pilula> : <SeloPendencias compacto pendencias={v.pendencias} moeda={v.moedaPrincipal} />)
  const acoes = (v: V): Acao[] => [
    { rotulo: 'Abrir venda', icone: '🧾', onClick: () => ir('venda', { id: v.id }) },
    ...(v.pessoaId ? [{ rotulo: 'Ver cliente', icone: '🧑', onClick: () => ir('pessoa', { id: v.pessoaId! }) }] : []),
    ...(admin && v.etapa === 'concluido' ? [{ rotulo: 'Cancelar venda', icone: '✕', perigo: true, separar: true, onClick: () => setCancelar(v.id) }] : []),
  ]
  const exportar = () => baixarCSV('vendas', lista.map((v) => ({ codigo: v.codigo ?? '', data: v.data, hora: hora(v.criadoEm), cliente: v.cliente ?? '', itens: v.linhas.map((l) => l.descricao).join(' + '), pagamento: formas(v), situacao: v.etapa === 'cancelado' ? t('Cancelada') : v.pendencias.length ? v.pendencias.map((x) => t(x.texto)).join(' · ') : t('Completa'), valor: v.valor / 100, feito_por: v.feitoPor ?? '' })))
  return (
    <div>
      {/* CABEÇALHO PADRÃO: nome · para que serve · a ação principal (+ Nova venda ▾ com os caminhos de venda) */}
      <Titulo subtitulo={t('Registre vendas e encontre qualquer uma já feita.')} acao={novaVenda}>{t('Vender')}</Titulo>
      {aviso}

      {/* NÚMEROS GRANDES (fileira padrão) do que está filtrado: tocar abre a aba correspondente */}
      <GrupoNumeros colunas={4}>
        <NumeroGrande rotulo="Vendido" icone="💰" cor="var(--marca)" valor={formatar(vendido, moeda)} selos={[{ texto: t('{n} venda(s)', { n: conc.length }), tom: 'marca' }]} ativo={!aba} onClick={() => irAba('')} carregando={carregando} />
        <NumeroGrande rotulo="Ticket médio" icone="🧾" cor="var(--bom)" valor={conc.length ? formatar(Math.round(vendido / conc.length), moeda) : '—'} selos={[{ texto: t('por venda') }]} ajuda="Vendido ÷ número de vendas. Ex.: Bs 900 em 3 vendas = Bs 300." carregando={carregando} />
        <NumeroGrande rotulo="Com pendência" icone="⚠️" cor="var(--alerta)" colorirValor={comPend.length > 0} valor={String(comPend.length)} selos={comPend.length ? [...(faltaReceber ? [{ texto: `● ${t('{n} falta receber', { n: faltaReceber })}`, tom: 'ruim' as const }] : []), { texto: t('toque para ver') }] : [{ texto: `✓ ${t('tudo em dia')}`, tom: 'bom' }]} ativo={aba === 'pendencia'} onClick={() => irAba('pendencia')} carregando={carregando} />
        <NumeroGrande rotulo="Canceladas" icone="✕" cor="var(--suave)" valor={String(canc.length)} selos={[{ texto: t('estornadas') }]} ajuda="Venda cancelada: o estoque volta e cada pagamento é estornado. Nada é apagado." ativo={aba === 'canceladas'} onClick={() => irAba('canceladas')} carregando={carregando} />
      </GrupoNumeros>

      {/* FILTRO PADRÃO: abas da situação · período · busca · ⚙ Filtros (quando · pagamento · quem · onde) → chips ✕ */}
      <FiltroLista
        className="mb-3"
        situacao={{ valor: aba, onChange: (id) => irAba(id as typeof aba), opcoes: ABAS.map((a) => ({
          id: a.id, nome: a.nome, tom: a.id === 'pendencia' || a.id === 'abertas' ? 'alerta' as const : undefined,
          n: a.id === 'abertas' ? abertas?.length : carregando ? undefined : a.id === 'canceladas' ? canc.length : a.id === 'todas' ? conc.length + canc.length : a.id === 'pendencia' ? comPend.length : conc.length,
        })) }}
        periodo={{ de: p('de'), ate: p('ate'), onChange: (de, ate) => ajustarParams({ de, ate, pagina: undefined }) }}
        extra={<FiltroViagem nasLinhas={[...(concluidas ?? []), ...(canceladas ?? [])].map((v) => v.viagens)} valor={p('viagem')} onChange={(v) => mudar('viagem', v)} />}
        busca={p('busca')} onBusca={(v) => mudar('busca', v)} placeholder="Buscar cliente, código (V-0001), item ou quem vendeu"
        ativos={ativos} onTirar={(k) => (tirar(k), setP('pagina', ''))} onLimpar={limpar}
        resultados={carregando ? undefined : lista.length} total={carregando ? undefined : (aba === 'canceladas' ? canceladas!.length : aba === 'todas' ? concluidas!.length + canceladas!.length : concluidas!.length)} unidade="venda(s)"
        detalhe={!carregando && lista.length > 0 && formatar(lista.reduce((s, v) => s + v.valor, 0), moeda)}
        exportar={{ onExportar: exportar, quantos: lista.length, unidade: 'venda(s)' }}
        painel={<>
          <GrupoFiltro titulo="Quando e o quê" icone="📅">
            <CampoFaixa rotulo="Data da venda">
              <Entrada type="date" aria-label={t('De')} value={p('de')} max={p('ate') || undefined} onChange={(e) => mudar('de', e.target.value)} />
              <Entrada type="date" aria-label={t('Até')} value={p('ate')} min={p('de') || undefined} onChange={(e) => mudar('ate', e.target.value)} />
            </CampoFaixa>
            {modulosVenda.length > 1 && <Campo rotulo="Área"><Selecao valor={p('moduloId')} onChange={(v) => mudar('moduloId', v)} vazio="Todas" opcoes={modulosVenda.map((m) => ({ id: m.id, nome: `${m.icone} ${t(m.nome)}` }))} /></Campo>}
            <Campo rotulo="Pendência"><Selecao valor={pendencia} onChange={(v) => mudar('pendencia', v)} vazio="Qualquer" opcoes={PENDENCIAS} /></Campo>
          </GrupoFiltro>
          <GrupoFiltro titulo="Pagamento" icone="💳">
            <Campo rotulo="Forma de pagamento"><Selecao valor={p('forma')} onChange={(v) => mudar('forma', v)} vazio="Todas" opcoes={(cfg?.formas ?? []).map((f) => ({ id: f.id, nome: t(f.nome) }))} /></Campo>
            {(cfg?.moedasAtivas.length ?? 0) > 1 && <Campo rotulo="Moeda recebida"><Selecao valor={p('moeda')} onChange={(v) => mudar('moeda', v)} vazio="Todas" opcoes={(cfg?.moedasAtivas ?? []).map((m) => ({ id: m, nome: m }))} /></Campo>}
          </GrupoFiltro>
          <GrupoFiltro titulo="Quem e onde" icone="👤">
            <Campo rotulo="Quem vendeu"><Selecao valor={p('usuarioId')} onChange={(v) => mudar('usuarioId', v)} vazio="Qualquer pessoa" opcoes={funcionarios.map((u) => ({ id: u.id, nome: u.nome }))} /></Campo>
            {clientes.length > 0 && <Campo rotulo="Cliente"><Selecao valor={p('pessoaId')} onChange={(v) => mudar('pessoaId', v)} vazio="Todos" opcoes={clientes.map((u) => ({ id: u.id, nome: u.nome }))} /></Campo>}
            {(locais ?? []).length > 0 && <Campo rotulo="Unidade"><Selecao valor={p('localId')} onChange={(v) => mudar('localId', v)} vazio="Todas" opcoes={(locais ?? []).map((l) => ({ id: l.id, nome: l.nome }))} /></Campo>}
          </GrupoFiltro>
        </>}
      />

      {aba === 'abertas' ? (
        // EM ABERTO: a mesma listagem padrão — quem · total / o que tem dentro · quando guardou / quem guardou
        <TabelaDados
          linhas={abertasFiltradas}
          chave={(a) => a.id}
          carregando={!abertas}
          vazio={<Vazio texto="Nenhuma venda em aberto. Começou no caixa e saiu? Ela aparece aqui para retomar." />}
          onAbrir={(a) => ir('vendaRapida', { aberta: a.id })}
          rotuloAbrir="Retomar no caixa"
          rotuloLinha={(a) => `${a.cliente ?? t('Sem cliente')} · ${a.linhas.length}`}
          acoes={(a) => [
            { rotulo: 'Retomar no caixa', icone: '🧾', onClick: () => ir('vendaRapida', { aberta: a.id }) },
            { rotulo: 'Descartar', icone: '✕', perigo: true, separar: true, onClick: () => setDescartar(a.id) },
          ]}
          colunas={[
            { id: 'quem', titulo: 'Cliente', celula: (a) => <><b className="block">{a.cliente ?? t('Sem cliente')}</b><span className="text-xs text-[var(--suave)]">{a.porNome ? t('guardada por {p}', { p: a.porNome }) : ''}</span></> },
            { id: 'itens', titulo: 'Pacotes', classe: 'max-w-72', celula: (a) => <span className="line-clamp-2">{a.linhas.map((l) => `${l.codigo ?? '—'} ${l.nome}`).join(' + ')}</span> },
            { id: 'quando', titulo: 'Guardada', classe: 'num whitespace-nowrap', celula: (a) => <>{dataBR(a.salvaEm)}<span className="block text-xs text-[var(--suave)]">{hora(a.salvaEm)}</span></> },
            { id: 'total', titulo: 'Total', direita: true, celula: (a) => <b>{a.total !== undefined && a.moedaTotal ? formatar(a.total, a.moedaTotal) : '—'}</b> },
          ]}
          celular={{
            titulo: (a) => a.cliente ?? t('Sem cliente'),
            valor: (a) => (a.total !== undefined && a.moedaTotal ? formatar(a.total, a.moedaTotal) : '—'),
            valorSub: (a) => `${dataBR(a.salvaEm).slice(0, 5)} ${hora(a.salvaEm)}`,
            resumo: (a) => a.linhas.map((l) => l.codigo ?? '—').join(', '),
            situacao: () => ({ texto: 'Em aberto', tom: 'alerta' }),
            alerta: (a) => (a.linhas.some((l) => l.saldo < l.quantidade) ? { texto: t('um pacote já saiu do estoque'), tom: 'ruim' } : undefined),
            fatos: (a) => [a.porNome && `👤 ${a.porNome}`, `📦 ${t('{n} pacote(s)', { n: a.linhas.length })}`],
          }}
        />
      ) : (
      <>
      {/* LISTAGEM PADRÃO (TabelaDados): só as colunas, as ações e o que abre; carregando/vazio/celular são dela */}
      <TabelaDados
        linhas={pag.itens}
        chave={(v) => v.id}
        carregando={carregando}
        vazio={!concluidas?.length && !canceladas?.length && !filtrando
          ? <Vazio texto="Ainda não há vendas registradas.">{novaVenda}</Vazio>
          : <VazioFiltro texto="Nenhuma venda com esse filtro." filtrando={filtrando || !!aba} onLimpar={() => (limpar(), irAba(''))} />}
        onAbrir={(v) => ir('venda', { id: v.id })}
        rotuloAbrir="Abrir venda"
        rotuloLinha={(v) => `${v.codigo ?? ''} · ${v.cliente ?? t('Sem nome')}`}
        acoes={acoes}
        realce={(v) => (v.etapa === 'cancelado' ? 'apagada' : undefined)}
        ordem={{ por: ordem.startsWith('valor') ? 'valor' : 'data', desc: ordem !== 'valorMenor' }}
        onOrdenar={(por) => mudar('ordem', por === 'data' ? '' : ordem === 'valor' ? 'valorMenor' : 'valor')}
        colunas={[
          { id: 'venda', titulo: 'Venda', celula: (v) => <><SeloCodigo codigo={v.codigo} /><b className="mt-1 block">{v.cliente ?? t('Sem nome')}</b>{v.viagens.length > 0 && <span className="mt-1 block"><SelosViagem vs={v.viagens} curto /></span>}</> },
          { id: 'data', titulo: 'Data', ordenar: 'data', classe: 'num whitespace-nowrap', celula: (v) => <>{dataBR(v.data)}<span className="block text-xs text-[var(--suave)]">{hora(v.criadoEm)}{v.feitoPor ? ` · ${v.feitoPor}` : ''}</span></> },
          { id: 'itens', titulo: 'Itens', classe: 'max-w-72', celula: (v) => <><span className="line-clamp-2">{v.linhas.map((l) => l.descricao).join(' + ')}</span><span className="text-xs text-[var(--suave)]">{t('{n} item(ns)', { n: v.linhas.length })}</span></> },
          { id: 'pagamento', titulo: 'Pagamento', classe: 'text-[var(--suave)]', celula: (v) => formas(v) || '—' },
          { id: 'situacao', titulo: 'Situação', celula: situacao },
          { id: 'valor', titulo: 'Valor', ordenar: 'valor', direita: true, celula: (v) => <b className={cx(v.etapa === 'cancelado' && 'line-through')}>{formatar(v.valor, moeda)}</b> },
        ]}
        // LINHA PADRÃO do celular (a mesma do Comprar): cliente · valor / código · situação · o que falta / quando
        celular={{
          titulo: (v) => v.cliente ?? t('Cliente sem nome'),
          avatar: (v) => (v.cliente ? { texto: iniciais(v.cliente), cor: corDoNome(v.cliente) } : { texto: '🛒' }),
          tom: (v) => (v.etapa === 'cancelado' ? 'suave' : v.pendencias.some((x) => x.id === 'faltaReceber') ? 'ruim' : 'bom'),
          valor: (v) => formatar(v.valor, moeda),
          // o que vendeu, numa linha (o 1º item + quantos mais) · quando · e só o que foge do normal (cancelada, pendência)
          resumo: (v) => `${v.linhas[0]?.descricao ?? '—'}${v.linhas.length > 1 ? ` + ${t('{n} item(ns)', { n: v.linhas.length - 1 })}` : ''}`,
          valorSub: (v) => `${diaRelativo(v.data, t)} ${hora(v.criadoEm)}`,
          codigo: (v) => v.codigo,
          situacao: (v) => {
            if (v.etapa === 'cancelado') return { texto: 'Cancelada', tom: 'suave' }
            const falta = v.pendencias.find((x) => x.id === 'faltaReceber')
            return falta ? { texto: falta.valor ? `${t('Falta receber')} ${formatar(falta.valor, moeda)}` : 'Falta receber', tom: 'ruim' } : { texto: 'Paga', tom: 'bom' }
          },
          // o resto do que falta, curto (o "falta receber" já está na situação)
          alerta: (v) => {
            const resto = v.etapa === 'cancelado' ? [] : v.pendencias.filter((x) => x.id !== 'faltaReceber')
            if (!resto.length) return undefined
            return { texto: resto.length === 1 ? (resto[0].id === 'semComprovante' ? t('sem comprovante') : t(resto[0].texto)) : t('{n} pendências', { n: resto.length }), tom: 'alerta' }
          },
          marca: (v) => <SelosViagem vs={v.viagens} curto />,
          fatos: (v) => [formas(v) && `💳 ${formas(v)}`, v.feitoPor && `👤 ${v.feitoPor}`, `📅 ${dataBR(v.data)}`],
          aberto: (v) => <>
            {v.linhas.length > 1 && <ul className="space-y-0.5">{v.linhas.map((l, k) => <li key={k} className="flex justify-between gap-3"><span className="min-w-0 truncate">{l.descricao}</span></li>)}</ul>}
            {v.etapa !== 'cancelado' && v.pendencias.length > 1 && <SeloPendencias pendencias={v.pendencias} moeda={v.moedaPrincipal} />}
          </>,
        }}
      />
      {!carregando && <Paginacao {...pag} unidade="venda(s)" />}
      </>
      )}
      {descartar && (
        <Confirmar perigo titulo="Descartar a venda em aberto?" texto="Os pacotes continuam no estoque, como estavam. Nada foi vendido." rotulo="Descartar"
          onConfirmar={() => executar('descartarVendaAberta', { id: descartar }, t('Venda em aberto descartada.'))}
          onFechar={() => setDescartar(undefined)} />
      )}

      {cancelar && (
        <Confirmar perigo pedirMotivo titulo="Cancelar venda" texto="O estoque volta e cada pagamento é estornado. Nada é apagado." rotulo="Cancelar venda"
          onConfirmar={(motivo) => executar('cancelarVenda', { id: cancelar, motivo }, t('Venda cancelada: estoque e dinheiro voltaram.'))}
          onFechar={() => setCancelar(undefined)} />
      )}
    </div>
  )
}
