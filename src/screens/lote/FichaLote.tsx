// FICHA DO LOTE (#/lote?id=): o pacote inteiro — resumo, rastreabilidade, detalhes, etiqueta e ações — e a janela
// de editar os atributos.
import { type ReactNode, useState } from 'react'
import { pacotesFinais } from '../../core/services/leitura'
import { CaminhoDoCabelo } from '../../ui/caminhoCabelo'
import { CabecalhoFicha } from '../../ui/cabecalhoFicha'
import { formatar } from '../../core/domain/dinheiro'
import type { Campos, Id } from '../../core/domain/tipos'
import type { CampoDef } from '../../core/modulos'
import { Abas, Botao, Campo, Carregando, Cartao, Entrada, Info, Janela, Vazio, cx, dataBR, fmt, ErroTela, moedaPadrao, TituloSecao } from '../../ui/base'
import { useApp, useAvisoSaida, useComando, useConsulta, useParamTela } from '../../ui/contexto'
import { AbaAnexos } from '../../ui/anexos'
import { CamposDinamicos, resumoCampos } from '../../ui/camposDinamicos'
import { BarraFluxo, StatusBadge } from '../../ui/estoqueUi'
import { HistoricoPacote } from '../../ui/historicoPacote'
import { LinhaDaVida } from '../../ui/linhaVida'
import { MenuAcoes, acoesLote } from '../../ui/menuAcoes'
import { TrocarCodigo } from '../../ui/codigos'
import { useT } from '../../ui/i18n'
import { Trilha } from '../../ui/trilha'
import { ResumoEstoque, ResumoTriagem } from '../lote/ResumoLote'
import { FotosDoLote, MiniaturaLote, marcadorLote } from '../../ui/fotos'
import { AvisoPacotesNovos, RefazerEtiqueta, VerEtiqueta } from '../../ui/etiquetas'
import { ReservarLote, SeloReserva, reservado } from '../../ui/reserva'
import { ehBruto, useCamposModulo } from '../estoque/comum'
import { Ajustar } from '../estoque/janelas'

/** Todas as situações do pacote, na ordem da vida dele (vai no ⓘ ao lado da situação). */
const AJUDA_SITUACAO = 'Bruto: chegou da compra, ainda não foi separado. Preparando: bruto numa etapa da triagem (ex.: lavagem). Não identificado: ficou para depois na separação. Disponível: separado e inteiro, pronto para vender. Parcial: já vendeu uma parte e ainda tem peso. Esgotado: não tem mais peso (vendido ou separado em outros pacotes). Ex.: entrou 18 kg, vendeu 9,7 kg = Parcial (8,3 kg).'

/** PRONTUÁRIO do lote: entrada (compra) → triagem (separação) → destino (vendas), atributos, arquivos e linha do tempo. */
export function FichaLote() {
  const t = useT()
  const { nav, ir, voltar, sessao } = useApp()
  const admin = sessao.perfil === 'admin'
  const id = nav.params.id as Id
  const { dados, erro } = useConsulta('fichaItem', { id })
  const { dados: gen } = useConsulta('genealogia', { itemId: id }, admin)
  const campos = useCamposModulo(dados?.item.moduloId ?? '', dados?.item.tipoItem)
  const [ajustar, setAjustar] = useState(false)
  const [editar, setEditar] = useState(false)
  const [trocar, setTrocar] = useState(false)
  const [reservar, setReservar] = useState(false)
  const [refazer, setRefazer] = useState(false)
  const [aba, setAba] = useParamTela<'resumo' | 'detalhes' | 'historico' | 'fotos'>('aba', 'resumo')
  // ?etiqueta=ver: a etiqueta deste pacote à vista (vem do "Ver etiqueta" da triagem/estoque)
  const [verEtq, setVerEtq] = useParamTela('etiqueta', '')
  if (erro) return <ErroTela texto={erro} onVoltar={voltar} />
  if (!dados) return <Carregando />
  const i = dados.item
  const fu = i.unidade === 'grama' ? 'gramas' : 'numero'
  const q = (n: number) => fmt(n, fu)
  const m = moedaPadrao()
  const f = dados.fluxo
  const atributos = resumoCampos(campos, i.campos)
  const bruto = ehBruto(dados.status)
  const separar = () => ir('separar', { id: i.id })
  // Vender do pacote = modo caixa com o pacote já dentro (total na hora, fecha com um toque na forma de pagamento);
  // o formulário longo de Vender continua no menu
  const vender = () => ir('vendaRapida', { lote: i.id })
  const verRastreio = () => ir('rastreio', { itemId: i.id })
  // PRÓXIMO PASSO (um só, destacado): bruto → Separar; vendável → Vender; acabou → ver para onde foi
  // separações que saíram deste pacote (ele é a entrada) → os pacotes novos
  const viraram = i.saldo > 0 ? [] : (gen?.triagens ?? []).filter((x) => x.separou && x.entradas.some((e) => e.id === i.id) && x.saidas.length > 0)
  // os pacotes de AGORA em que ele virou, mesmo depois de juntar e separar de novo (a mesma regra do caixa)
  const finais = i.saldo > 0 || !gen ? [] : pacotesFinais(gen, i.id)
  // só foi separado (nada vendido direto dele): vendido/lucro aqui seriam sempre 0 e confundem
  const soSeparado = f.separado > 0 && !dados.vendido
  const podeReservar = i.saldo > 0 && !bruto
  const proximo = !admin ? undefined : i.saldo > 0 && bruto ? { rotulo: '✂️ Separar', f: separar } : i.saldo > 0 ? { rotulo: '💰 Vender', f: vender } : finais.length ? undefined : { rotulo: '📊 Ver para onde foi', f: verRastreio }
  return (
    <div className="space-y-4">
      <Trilha atual={i.codigo ?? i.nome} />
      <AvisoPacotesNovos />
      {/* CABEÇALHO DE FICHA (o mesmo do pedido e da viagem): foto · nome · código + situação · detalhes · ações */}
      <CabecalhoFicha
        midia={<MiniaturaLote itemId={i.id} foto={dados.fotoPrincipal} marcador={marcadorLote(i.campos, i.nome)} tamanho="ficha" iconeSemFoto />}
        titulo={i.nome}
        codigo={i.codigo} anteriores={i.codigosAnteriores}
        selos={<>
          <span className="inline-flex items-center"><StatusBadge status={dados.status} /><Info texto={AJUDA_SITUACAO} /></span>
          {reservado(i) && <button type="button" onClick={() => setReservar(true)}><SeloReserva i={i} /></button>}
        </>}
        detalhes={[`${t('desde')} ${dataBR(i.criadoEm)}`, dados.dna.compras[0]?.fornecedor?.nome]}
        acoes={<>
          {/* NA LINHA só o que mais se usa: o principal (Vender ou Separar), Etiqueta e Reservar; o resto fica no "Mais ⋯".
              No celular os secundários ficam só com o ícone (o nome vai no title/leitor de tela) */}
          {proximo && <Botao className="min-w-0 flex-1 sm:flex-none" onClick={proximo.f}>{t(proximo.rotulo)}</Botao>}
          {admin && <Botao variante="secundario" className="shrink-0 px-3" title={t(i.etiquetaImpressaEm ? 'Ver etiqueta' : 'Imprimir etiqueta')} aria-label={t(i.etiquetaImpressaEm ? 'Ver etiqueta' : 'Imprimir etiqueta')} onClick={() => (i.etiquetaImpressaEm ? setVerEtq('ver') : ir('etiquetas', { f: 'todas', sel: i.id }))}>🏷<span className="hidden sm:inline"> {t('Etiqueta')}</span></Botao>}
          {podeReservar && <Botao variante="secundario" className="shrink-0 px-3" title={t(reservado(i) ? 'Mudar ou tirar reserva' : 'Reservar para uma cliente')} aria-label={t(reservado(i) ? 'Mudar ou tirar reserva' : 'Reservar para uma cliente')} onClick={() => setReservar(true)}>🔒<span className="hidden sm:inline"> {t(reservado(i) ? 'Reserva' : 'Reservar')}</span></Botao>}
          <MenuAcoes comRotulo className="shrink-0" acoes={acoesLote(
            { id: i.id, saldo: i.saldo, compras: dados.dna.compras.map((c) => ({ id: c.id, codigo: c.codigo, fornecedor: c.fornecedor?.nome, fornecedorId: c.fornecedor?.id })), origens: dados.pai ? [dados.pai] : dados.dna.unificacao?.fontes, vendavel: !bruto, etiquetaImpressa: !!i.etiquetaImpressaEm, reservado: reservado(i) },
            { ir, t, admin, semAbrir: true, rotuloVender: 'Vender (formulário completo)', sem: ['Imprimir etiqueta', ...(admin ? ['Ver etiqueta'] : []), ...(podeReservar ? ['Reservar para uma cliente', 'Mudar ou tirar reserva'] : []), ...(bruto ? ['Separar'] : [])], onAjustar: () => setAjustar(true), onTrocarCodigo: () => setTrocar(true), onRefazerEtiqueta: () => setRefazer(true), onReservar: () => setReservar(true), extras: [
              ...(admin ? [{ rotulo: 'Editar atributos', icone: '✎', onClick: () => setEditar(true), separar: true }] : []),
              ...(bruto && i.saldo > 0 ? [{ rotulo: 'Abrir na triagem', icone: '🧺', onClick: () => ir('triagem') }] : []),
            ] },
          )} />
        </>}
      />
      {/* JÁ SEPARADO (bruto que zerou): a primeira coisa é em que pacotes ele virou, com o atalho para cada um */}
      {finais.length > 0 && (
        <section aria-label={t('Virou')} className="rounded-2xl border-2 border-[var(--marca)] bg-[var(--marca-suave)] p-3">
          <p className="text-sm font-bold">✂️ {t('Este pacote já foi separado')}{viraram.length === 1 ? ` · ${viraram[0].codigo}` : ''}</p>
          <ul className="mt-2 grid gap-2 sm:grid-cols-2">
            {finais.map((s) => (
              <li key={s.id}>
                <button type="button" onClick={() => ir('lote', { id: s.id })} className="flex min-h-12 w-full items-center justify-between gap-2 rounded-xl bg-[var(--cartao)] px-3 text-left shadow-sm hover:ring-2 hover:ring-[var(--marca)]">
                  <span className="min-w-0"><b className="font-mono">📦 {s.codigo ?? '—'}</b>{s.via && <span className="block text-xs font-normal text-[var(--suave)]">{t('passou por {c}', { c: s.via })}</span>}</span>
                  <span className="num shrink-0 font-semibold">{s.saldo > 0 ? q(s.saldo) : t('sem saldo')} ›</span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* ABAS: Resumo (a vida do pacote + números) · Detalhes · Histórico · Fotos e arquivos — como no pedido */}
      <Abas variante="sublinhado" atual={aba} onChange={(a) => setAba(a as typeof aba)} abas={[
        { id: 'resumo', nome: 'Resumo' },
        { id: 'detalhes', nome: 'Detalhes' },
        { id: 'historico', nome: 'Histórico' },
        { id: 'fotos', nome: 'Arquivos', extra: dados.fotos.length ? <span className="num text-xs opacity-70">{dados.fotos.length}</span> : undefined },
      ]} />
      {aba === 'historico' ? (
        // UM bloco só: o caminho do cabelo (o histórico em gramas deste pacote fica dentro, na etapa Estoque)
        <CaminhoDoCabelo de={{ itemId: i.id }} atual={bruto ? 'triagem' : 'estoque'} semCadeia={<HistoricoPacote id={i.id} />} />
      ) : aba === 'fotos' ? (
        <div className="space-y-4">
          <Cartao titulo={`${t('Fotos do lote')}${dados.fotos.length ? ` · ${dados.fotos.length}` : ''}`}><FotosDoLote itemId={i.id} codigo={i.codigo} /></Cartao>
          <AbaAnexos donoId={i.id} categorias={['outro']} />
        </div>
      ) : aba === 'resumo' ? (
      // RESUMO conforme a ETAPA do cabelo (a mesma linguagem; a prioridade muda): bruto = avaliar e classificar;
      // separado = disponibilidade, onde está e rastreabilidade — screens/lote/ResumoLote.tsx
      bruto
        ? <ResumoTriagem dados={dados} gen={gen} campos={campos} onRastreio={verRastreio} onEtiqueta={() => (i.etiquetaImpressaEm ? setVerEtq('ver') : ir('etiquetas', { f: 'todas', sel: i.id }))} />
        : <ResumoEstoque dados={dados} gen={gen} campos={campos} onRastreio={verRastreio} onEtiqueta={() => (i.etiquetaImpressaEm ? setVerEtq('ver') : ir('etiquetas', { f: 'todas', sel: i.id }))} />
      ) : <>
      {/* DETALHES: números completos, caminho, cada grama e atributos */}
      <section aria-label={t('Números')} className="space-y-2">
        <TituloSecao>{t('Números')}</TituloSecao>
        <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
          <Cartao><div className="text-xs text-[var(--suave)]">{t('Agora')}</div><div className="num whitespace-nowrap text-lg font-bold sm:text-xl">{q(i.saldo)}</div>{f.inicial !== i.saldo && <div className="num text-xs text-[var(--suave)]">{t('entrou')} {q(f.inicial)}</div>}</Cartao>
          <Cartao><div className="text-xs text-[var(--suave)]">{t('Custo do lote')}</div><div className="num whitespace-nowrap text-lg font-bold sm:text-xl">{formatar(i.custoPrincipal ?? 0, m)}</div>{soSeparado && <div className="text-xs text-[var(--suave)]">{t('dividido entre os pacotes')}</div>}</Cartao>
          {!soSeparado && <BotaoNumero rotulo={t('Vendido')} onClick={verRastreio}>{formatar(dados.vendido, m)}</BotaoNumero>}
          {!soSeparado && <BotaoNumero rotulo={t('Lucro (vendido − custo)')} onClick={verRastreio} className={dados.lucro < 0 ? 'text-[var(--ruim)]' : 'text-[var(--bom)]'}>{formatar(dados.lucro, m)}</BotaoNumero>}
        </div>
      </section>

      {/* LINHA DA VIDA: cada grama (barra) + a timeline compra → triagem → etiqueta → vendas/separações, cada passo clicável */}
      <Cartao titulo={`${t('Linha da vida do pacote')} · ${t('entrou')} ${q(f.inicial)}`} ajuda="De onde veio e para onde foi cada grama, na ordem. Ex.: 18 kg entrou · V-0006 −1,5 kg · separado em L-0025 3 kg (60 cm). Toque num passo para abrir.">
        {i.unidade === 'grama' && (
          <div className="mb-3">
            <BarraFluxo total={f.inicial} partes={[
              { nome: 'Vendido', valor: f.vendido, cor: 'var(--bom)' },
              { nome: 'Separado em lotes', valor: f.separado, cor: 'var(--marca)' },
              ...(f.unificado ? [{ nome: 'Unificado em outro lote', valor: f.unificado, cor: '#8b5cf6' }] : []),
              { nome: 'Perda', valor: f.perda, cor: 'var(--ruim)' },
              { nome: 'Em estoque', valor: f.saldo, cor: 'var(--alerta)' },
            ].filter((x) => x.valor > 0)} />
          </div>
        )}
        {gen ? <LinhaDaVida gen={gen} item={i} /> : <Carregando />}
        <button type="button" onClick={() => ir('rastreio', { itemId: i.id })} className="mt-2 min-h-10 text-sm font-semibold text-[var(--marca)] hover:underline">🔎 {t('Rastreio completo (todas as compras e pacotes ligados)')}</button>
      </Cartao>

      <Cartao titulo={t('Atributos')} acao={admin && campos.length > 0 ? <Botao variante="secundario" onClick={() => setEditar(true)}>✎ {t('Editar atributos')}</Botao> : undefined}>
        {!atributos.length ? <Vazio compacto texto="Nenhum atributo preenchido." /> : (
          <dl className="grid grid-cols-[auto,1fr] gap-x-3 gap-y-1 text-sm">
            {atributos.map((a) => <div key={a.id} className="contents"><dt className="text-[var(--suave)]">{t(a.nome)}</dt><dd className="font-semibold break-words">{t(a.valor)}</dd></div>)}
          </dl>
        )}
      </Cartao>
      </>}
      {/* janelas do ⋯ (valem em qualquer aba) */}
      {ajustar && <Ajustar itemId={i.id} onFechar={() => setAjustar(false)} />}
      {editar && <EditarAtributos id={i.id} campos={campos} valores={i.campos} onFechar={() => setEditar(false)} />}
      {trocar && <TrocarCodigo tipo="lote" id={i.id} atual={i.codigo} onFechar={() => setTrocar(false)} />}
      {reservar && <ReservarLote id={i.id} codigo={i.codigo} atual={i.reserva} onFechar={() => setReservar(false)} />}
      {refazer && <RefazerEtiqueta id={i.id} codigo={i.codigo} onFechar={() => setRefazer(false)} />}
      {verEtq && <VerEtiqueta id={i.id} admin={admin} onFechar={() => setVerEtq('')} />}
    </div>
  )
}

/** Editar atributos do lote (admin): só o que mudou vai para o comando; o log guarda antes → depois. */
export function EditarAtributos({ id, campos, valores, onFechar }: { id: Id; campos: CampoDef[]; valores: Campos; onFechar(): void }) {
  const t = useT()
  const { executar, ocupado } = useComando()
  const [v, setV] = useState<Campos>(valores)
  const [motivo, setMotivo] = useState('')
  const mudou = Object.fromEntries(campos.filter((c) => String(v[c.id] ?? '') !== String(valores[c.id] ?? '')).map((c) => [c.id, v[c.id] ?? null]))
  const n = Object.keys(mudou).length
  useAvisoSaida(n > 0)
  return (
    <Janela aberta larga titulo={t('Editar atributos')} onFechar={onFechar} rodape={
      <Botao grande className="w-full" disabled={ocupado || !n} onClick={async () => (await executar('editarAtributosLote', { id, campos: mudou, motivo }, t('Atributos salvos.'))) && onFechar()}>{t('Salvar')}</Botao>
    }>
      <div className="space-y-3">
        <CamposDinamicos campos={campos} valores={v} onChange={setV} />
        <Campo rotulo="Motivo (fica no histórico)"><Entrada value={motivo} onChange={(e) => setMotivo(e.target.value)} /></Campo>
        <p className="text-xs text-[var(--suave)]">{t('Se mudar um atributo que faz parte do nome, o nome do lote muda junto.')}</p>
      </div>
    </Janela>
  )
}

/** Número que leva à origem (toque abre de onde ele vem). */
function BotaoNumero({ rotulo, children, onClick, className }: { rotulo: ReactNode; children: ReactNode; onClick(): void; className?: string }) {
  return (
    <button type="button" onClick={onClick} className="min-w-0 rounded-2xl border border-[var(--borda)] bg-[var(--cartao)] p-3 text-left shadow-sm hover:border-[var(--marca)] sm:p-4">
      <span className="block text-xs text-[var(--suave)]">{rotulo}</span>
      <span className={cx('num block whitespace-nowrap text-lg font-bold sm:text-xl', className)}>{children}</span>
    </button>
  )
}
