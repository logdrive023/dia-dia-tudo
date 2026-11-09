// MODO CAIXA (venda rápida, como caixa de loja grande): pega o pacote, passa a pistola / lê o QR / digita o código,
// o lote entra INTEIRO (saldo disponível) com o preço da tabela (medida × fator da coluna padrão ou da cliente) e
// FECHAR paga num toque. A baixa do estoque, o caixa e o histórico são os da venda normal (concluirVenda).
//
// A TELA É FEITA DE PEÇAS que conversam por aqui (a tela guarda o estado da venda; cada peça mostra e avisa):
//   BuscaPacote (ui) ── escolheu ──▶ adicionar ──▶ ItensDaVenda (a lista) ──▶ TotalVenda + FECHAR ──▶ Pagamento
//        │ leu algo que já saiu ──▶ JaSaiu (o servidor diz para onde foi; "Adicionar" o pacote em que virou)
//   CobrarEm (moeda e cotação) · OpcoesVenda (cliente, preço, desconto, quem vendeu, unidade, observação)
//   Conferir / EditarQuantidade / Pagamento (janelas) · as peças comuns ficam em ./caixa/pecas
// Celular: tudo em coluna e a barra "Total · FECHAR" presa embaixo; com espaço: venda | cobrança fixa ao lado.

import { AvisoAbaixoDoCusto } from '../../../shared/ui/abaixoDoCusto'
import { AvisoGuardado } from '../components/AvisoGuardado'
import { EscolhaPreco } from '../components/EscolhaPreco'
import { ImpostosDaOperacao, QuadroImpostosOperacao } from '../../../shared/ui/impostosOperacao'
import { Trilha } from '../../../shared/ui/trilha'
import { formatar, moeda as moedaDe } from '../../../core/domain/dinheiro'
import { Botao, Confirmar, Info, cx, gramasTexto, Titulo, Vazio } from '../../../shared/ui/base'
import { BuscaPacote } from '../components/BuscaPacote'
import { useApp, useConsulta } from '../../../shared/ui/contexto'
import { linkWhatsApp } from '../../../shared/ui/compartilhados'
import { LeitorCodigo } from '../../../shared/ui/estoqueUi'
import { useT } from '../../../shared/ui/i18n'
import { acharPorCodigo } from '../../../shared/ui/leitorPistola'
import { CHAVE_MODO_DESCONTO, Miniatura, NAO_SEPARADO, bipe } from '../components/pecas'
import { ConflitoVendaAberta, Conferir, EditarQuantidade, Pagamento } from '../components/janelas'
import { ItensDaVenda } from '../components/ItensDaVenda'
import { CobrarEm, OpcoesVenda, TotalVenda } from '../components/Cobranca'
import { AvisoLeitura, JaSaiu } from '../components/Avisos'
import { useModoCaixa } from '../hooks/useModoCaixa'
import { VendasEmAberto } from '../components/VendasEmAberto'

/** Modo caixa: a funcionária só entra se o admin liberou "Cabelo pela pistola ou QR" */
export function VendaRapida() {
  const t = useT()
  const { sessao, ir } = useApp()
  const { dados: cfg } = useConsulta('configuracoes', {})
  if (sessao.perfil !== 'admin' && cfg?.config.funcionariaNaoVende.includes('caixa'))
    return <Vazio texto={t('O Modo caixa não está liberado para você. Peça a um administrador.')}><Botao onClick={() => ir('vender')}>{t('Voltar para Vender')}</Botao></Vazio>
  return <ModoCaixa />
}

function ModoCaixa() {
  const nc = useModoCaixa()
  const { irParaAberta, t, ir, sessao, executar, ocupado, executarCfg, cfg, versoesTab, abertas, raiz, tablet, toque, vendaId, linhas, setLinhas, busca, setBusca, aviso, setAviso, conferindo, setConferindo, mais, setMais, pessoaId, setPessoaId, setColunaId, desconto, setDesconto, descontoPct, setDescontoPct, modoDesconto, setModoDesconto, setCotDigitadas, obs, setObs, setEditando, pagando, setPagando, lendo, setLendo, teclado, setTeclado, feita, setFeita, deOutraAberta, setDeOutraAberta, guardada, jaSaiu, setJaSaiu, vendedorId, setVendedorId, localId, setLocalId, campo, focar, estoque, porId, colunaDe, precoDe, vistas, moedaVenda, tbVenda, opcoesPreco, padraoVenda, clienteTemColuna, bruto, principal, moedasCobranca, mc, cotTexto, cotValida, cotSugeridas, naCobranca, escolherMoeda, pctInvalido, descontoValido, descontoCobranca, total, totalCobrado, custo, setCustoConfirmado, perguntarCusto, setPerguntarCusto, sm, adicionar, pistola, remover, abrirPagamento, retomar, outrasAbertas, pagar, vendaFeita, editandoLinha, vendedores, listaLocais, resumoOpcoes } = nc
  const opcoes = (
    <OpcoesVenda
      aberto={mais}
      onAlternar={() => setMais(!mais)}
      resumo={resumoOpcoes}
      pessoaId={pessoaId}
      onPessoa={(id) => (setPessoaId(id), setColunaId(undefined))}
      desconto={{
        modo: modoDesconto,
        onModo: (m) => { setModoDesconto(m); try { localStorage.setItem(CHAVE_MODO_DESCONTO, m) } catch { /* só nesta tela */ } },
        pct: descontoPct, onPct: setDescontoPct, valor: desconto, onValor: setDesconto, moeda: mc, simbolo: sm,
        aviso: modoDesconto === 'pct' && !!descontoValido ? t('= {v} de desconto · total {t}', { v: formatar(descontoCobranca, mc), t: formatar(totalCobrado, mc) }) : undefined,
        erro: pctInvalido ? t('Desconto de 0 a 100%.') : modoDesconto === 'valor' && !!desconto && !descontoValido ? t('Desconto maior que o total.') : undefined,
      }}
      vendedores={vendedores}
      vendedorId={vendedorId}
      onVendedor={setVendedorId}
      locais={listaLocais}
      localId={localId}
      onLocal={setLocalId}
      obs={obs}
      onObs={setObs}
    />
  )
  const cobrar = (
    <CobrarEm
      moedas={moedasCobranca.map((m) => ({ id: m, nome: moedaDe(m).simbolo }))}
      valor={mc}
      onChange={escolherMoeda}
      simbolo={sm}
      simboloPrincipal={moedaDe(principal).simbolo}
      cotacao={mc !== principal ? cotTexto : undefined}
      onCotacao={(v) => setCotDigitadas((x) => ({ ...x, [mc]: v }))}
      cotacaoValida={cotValida}
    />
  )
  const totalTexto = formatar(totalCobrado, mc)
  const equivalente = mc !== moedaVenda ? `= ${formatar(total, moedaVenda)}` : undefined
  const descontoLinha = descontoValido ? `${formatar(naCobranca(bruto), mc)} − ${formatar(descontoCobranca, mc)}` : undefined
  const podeFechar = !!vistas.length && !ocupado && cotValida
  const fotoDoAviso = aviso?.itemId && porId.get(aviso.itemId) ? <Miniatura item={porId.get(aviso.itemId)!} tamanho="h-12 w-12" /> : undefined
  const naoAvisarBruto = aviso?.ok === 'alerta' && sessao.perfil === 'admin' && cfg?.config.avisarVendaBruto !== false && aviso.itemId && NAO_SEPARADO.has(porId.get(aviso.itemId)?.status ?? '')
    ? <button type="button" onClick={() => executarCfg('salvarConfig', { avisarVendaBruto: false }, t('Pronto: não aviso mais. Dá para ligar de novo em Configurações › Geral.'))} className="shrink-0 rounded-lg px-2 py-1 text-xs font-semibold text-[var(--marca)] underline-offset-2 hover:underline">{t('Não avisar mais')}</button>
    : undefined

  return (
    <div ref={raiz} className="mx-auto max-w-7xl">
      <Trilha atual={t('Modo caixa')} onVoltar={() => ir('vender')} rotuloVoltar="Vender" />
      {/* atalhos de teclado/pistola na descrição: só no computador (no celular é ruído) */}
      <Titulo subtitulo={<><span className="md:hidden">{t('Passe a pistola ou leia o QR')}</span><span className="hidden md:inline">{t('Enter vazio = fechar · Esc = tirar o último · ↑↓ escolhe na busca')}</span></>}>{t('Modo caixa')}</Titulo>

      {feita && (
        <div role="status" className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-[var(--bom)] bg-[var(--bom)]/10 p-3">
          <span className="font-bold text-[var(--bom)]">
            {t('Venda')} {vendaFeita?.venda.codigo ?? ''} ✓ · <span className="num">{formatar(feita.total, feita.moeda)}</span>
            {feita.totalPrincipal !== undefined && <span className="num text-sm font-semibold"> (= {formatar(feita.totalPrincipal, feita.moedaPrincipal)})</span>}
            {!!feita.troco && <> · {t('troco')} <span className="num">{formatar(feita.troco, feita.moeda)}</span></>}
          </span>
          <span className="flex flex-wrap gap-2">
            <a className="inline-flex min-h-10 items-center rounded-xl bg-[#25d366] px-3 text-sm font-semibold text-white" href={linkWhatsApp(feita.texto, feita.telefone)} target="_blank" rel="noreferrer">{t('Recibo WhatsApp')}</a>
            <Botao variante="secundario" onClick={() => ir('venda', { id: feita.id })}>{t('Ver venda')}</Botao>
            <button type="button" aria-label={t('Fechar')} className="min-h-10 min-w-10 rounded-full text-lg" onClick={() => (setFeita(undefined), focar())}>×</button>
          </span>
        </div>
      )}

      {/* VENDAS EM ABERTO: as que ficaram guardadas (venda vazia aqui → dá para retomar uma delas) */}
      {!linhas.length && outrasAbertas.length > 0 && <VendasEmAberto abertas={outrasAbertas} onRetomar={retomar} />}
      {linhas.length > 0 && guardada && <AvisoGuardado className="mb-3" titulo="Venda guardada em aberto" quando={guardada} texto="Pode sair ou fechar o app: nada se perde. Ela volta aqui no Modo caixa." />}
      {deOutraAberta && (
        <ConflitoVendaAberta
          codigo={deOutraAberta.p.codigo ?? deOutraAberta.p.nome}
          quem={deOutraAberta.quem}
          saldo={deOutraAberta.p.saldo}
          guardado={deOutraAberta.guardado}
          grama={deOutraAberta.p.unidade === 'grama'}
          onFechar={() => (setDeOutraAberta(undefined), focar())}
          onIrPara={() => { const x = deOutraAberta; setDeOutraAberta(undefined); void irParaAberta(x.abertaId) }}
          onParte={async (q) => {
            const x = deOutraAberta
            setDeOutraAberta(undefined)
            const ok = await executar('reduzirNaVendaAberta', { id: x.abertaId, itemId: x.p.id, quantidade: q, para: t('outra venda no caixa') })
            if (ok) adicionar(x.p, true, q)
          }}
          onTirar={async () => {
            const x = deOutraAberta
            setDeOutraAberta(undefined)
            const ok = await executar('tirarDaVendaAberta', { id: x.abertaId, itemId: x.p.id, para: t('outra venda no caixa') })
            if (ok) adicionar(x.p, true)
          }}
        />
      )}

      {/* LAYOUT: computador/tablet largo = venda à esquerda e cobrança fixa à direita; celular = tudo em coluna e a
          barra "Total · FECHAR" presa embaixo (a coluna da direita só aparece com espaço de verdade) */}
      <div className={cx('grid items-start gap-4', tablet && 'grid-cols-[minmax(0,1fr)_19rem] xl:grid-cols-[minmax(0,1fr)_23rem]')}>
        <div className="min-w-0 space-y-3">
          <section className="rounded-2xl border border-[var(--borda)] bg-[var(--cartao)] p-3 shadow-sm">
            <BuscaPacote
              pacotes={estoque}
              valor={busca}
              onValor={(v) => (setBusca(v), setAviso(undefined), setJaSaiu(undefined))}
              onEscolher={adicionar}
              onCamera={() => setLendo(true)}
              onEnterVazio={abrirPagamento}
              onTeclaLeitor={pistola.onKeyDown}
              naVenda={new Set(linhas.map((l) => l.itemId))}
              precoTexto={(p) => { const pr = precoDe(p, p.unidade === 'grama' ? p.saldo : 1); return pr.erro ? undefined : formatar(pr.total, pr.moeda) }}
              inputRef={campo}
              inputMode={toque && !teclado ? 'none' : 'search'}
              onPointerDown={() => {
                // celular: o teclado só abre quando a pessoa toca no campo (a pistola Bluetooth digita sem ele)
                if (toque && !teclado) (campo.current?.blur(), setTeclado(true))
              }}
            >
              {jaSaiu && <JaSaiu texto={jaSaiu} onFechar={() => (setJaSaiu(undefined), focar())} onAdicionar={(id) => { const p = porId.get(id); if (p) adicionar(p) }} />}
              {aviso && !jaSaiu && <AvisoLeitura tom={aviso.ok === 'alerta' ? 'alerta' : aviso.ok ? 'ok' : 'erro'} texto={aviso.texto} foto={fotoDoAviso} acao={naoAvisarBruto} />}
            </BuscaPacote>
          </section>
          <section aria-label={t('Nesta venda')} className="rounded-2xl border border-[var(--borda)] bg-[var(--cartao)] p-3 shadow-sm">
            <h2 className="mb-1 text-base font-bold">{t('Nesta venda')} {vistas.length > 0 && <span className="text-[var(--suave)]">({vistas.length})</span>}</h2>
            <AvisoAbaixoDoCusto abaixo={custo.abaixo} moeda={principal} nomeDe={(id) => porId.get(id)?.codigo ?? porId.get(id)?.nome ?? id} />
            <ItensDaVenda
              vistas={vistas}
              onConferir={setConferindo}
              onEditar={setEditando}
              onRemover={remover}
              onPreco={(id, v) => setLinhas((ls) => ls.map((x) => (x.id === id ? { ...x, precoManual: v } : x)))}
            />
          </section>
          {/* O PREÇO DA TABELA: opcional e sempre à vista — trocar a coluna recalcula tudo na hora */}
          {tbVenda && padraoVenda && (
            <EscolhaPreco tabela={tbVenda.nome} versao={versoesTab?.[tbVenda.id]} opcoes={opcoesPreco} valor={colunaDe(tbVenda)} padrao={padraoVenda} porque={clienteTemColuna ? 'da cliente' : 'primeira coluna'}
              moeda={moedaVenda} manuais={vistas.filter((l) => l.precoManual !== undefined).length} onEscolher={setColunaId}
              // ver ou editar a tabela sem perder a venda: abre em outra aba (a venda fica aqui, guardada)
              onAbrirTabela={sessao.perfil === 'admin' ? () => window.open(`${window.location.pathname}${window.location.search}#/precos/${encodeURIComponent(tbVenda.id)}`, '_blank', 'noopener') : undefined} />
          )}
          {/* os IMPOSTOS às claras (o mesmo detalhe da janela), se ligado em Configurações › Fiscal */}
          <QuadroImpostosOperacao produto={total} moeda={principal} />
          {!tablet && <section className="rounded-2xl border border-[var(--borda)] bg-[var(--cartao)] p-3 shadow-sm">{cobrar}</section>}
          {!tablet && <section className="rounded-2xl border border-[var(--borda)] bg-[var(--cartao)] p-3 shadow-sm">{opcoes}</section>}
        </div>

        {tablet && (
          <aside aria-label={t('Cobrança')} className="h-fit space-y-3 rounded-2xl border border-[var(--borda)] bg-[var(--cartao)] p-4 shadow-sm md:sticky md:top-4">
            {/* a ordem é a do caixa: o que ainda muda (moeda, cliente, desconto…) → o total → FECHAR por último */}
            {cobrar}
            <div className="border-t border-[var(--borda)] pt-2">{opcoes}</div>
            <div className="border-t border-[var(--borda)] pt-3"><TotalVenda itens={vistas.length} total={totalTexto} equivalente={equivalente} desconto={descontoLinha} /></div>
            <ImpostosDaOperacao produto={total} moeda={principal} />
            <div className="flex items-center gap-1">
              <Botao grande className="min-h-14 flex-1 text-lg" disabled={!podeFechar} onClick={abrirPagamento}>{t('FECHAR')}</Botao>
              <Info texto="Fecha a venda: escolha como pagou e pronto. O estoque baixa sozinho e a venda fica no histórico. Ex.: Enter com o campo vazio também fecha." />
            </div>
          </aside>
        )}
      </div>

      {!tablet && (
        // "+ mais" aberto: a barra deixa de flutuar e vem DEPOIS dos campos (empurrada para baixo, nada fica coberto)
        <div className={cx('z-20 mt-3 rounded-2xl border border-[var(--marca)] bg-[var(--cartao)] px-3 py-2 shadow-lg', mais ? 'relative' : 'sticky bottom-20 md:bottom-4')}>
          <div className="flex items-center gap-3">
            <div className="min-w-0"><TotalVenda tamanho="barra" itens={vistas.length} total={totalTexto} equivalente={equivalente} /><ImpostosDaOperacao compacto produto={total} moeda={principal} /></div>
            <Botao grande className="min-h-14 flex-1 text-lg" disabled={!podeFechar} onClick={abrirPagamento}>{t('FECHAR')}</Botao>
          </div>
        </div>
      )}

      {lendo && (
        <LeitorCodigo
          abrirLote={false}
          continuo
          onFechar={() => (setLendo(false), focar())}
          onLer={(c) => {
            // CONTÍNUO: a câmera fica aberta; cada pacote lido entra na venda e aparece na lista do leitor
            const p = acharPorCodigo(estoque, c)
            if (p && linhas.some((l) => l.itemId === p.id)) return { ok: false, texto: `${p.codigo ?? c} · ${t('já está na venda')}` }
            // numa OUTRA venda em aberto: a venda pergunta (tirar de lá?) — na lista fica "confirme", não "✓"
            if (p && abertas?.some((x) => x.id !== vendaId && x.linhas.some((l) => l.itemId === p.id))) return (adicionar(p), { ok: false, texto: `${p.codigo ?? c} · ${t('está noutra venda em aberto — confirme')}` })
            if (p) return (adicionar(p), { ok: true, texto: `${p.codigo ?? c} · ${p.nome} · ${gramasTexto(p.saldo)}` })
            setJaSaiu(c)
            bipe(false)
            return { ok: false, texto: `${c} · ${t('não está disponível para vender')}` }
          }}
        />
      )}

      {conferindo && porId.get(conferindo) && (
        <Conferir item={porId.get(conferindo)!} naVenda={linhas.find((l) => l.itemId === conferindo)?.quantidade} lateral={tablet} onFechar={() => (setConferindo(undefined), focar())} />
      )}

      {editandoLinha && (
        <EditarQuantidade
          key={editandoLinha.id}
          titulo={`${editandoLinha.item.codigo ?? ''} · ${editandoLinha.item.nome}`}
          grama={editandoLinha.item.unidade === 'grama'}
          valor={editandoLinha.quantidade}
          max={editandoLinha.item.saldo}
          onSalvar={(q) => {
            setLinhas((ls) => ls.map((x) => (x.id === editandoLinha.id ? { ...x, quantidade: q } : x)))
            setEditando(undefined)
            focar()
          }}
          onFechar={() => (setEditando(undefined), focar())}
        />
      )}

      {perguntarCusto && (
        <Confirmar titulo="Vender abaixo do custo?" rotulo="Vender assim mesmo" perigo onFechar={() => setPerguntarCusto(false)}
          texto={t('{n} pacote(s) com preço abaixo do que custou. Confira a medida, a coluna da tabela e o desconto. Se for de propósito, pode seguir: fica registrado na auditoria.', { n: custo.abaixo.length })}
          onConfirmar={() => { setPerguntarCusto(false); setCustoConfirmado(custo.chave); abrirPagamento(true) }} />
      )}
      {pagando && (
        <Pagamento total={totalCobrado} moeda={mc} cotacoes={cotSugeridas} comCliente={!!pessoaId} ocupado={ocupado} onPagar={pagar} onFechar={() => (setPagando(false), focar())} />
      )}
    </div>
  )
}
