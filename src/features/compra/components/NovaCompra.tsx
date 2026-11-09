// NOVA COMPRA (#/pedidos/novo): o formulário da compra (fornecedor, linhas de cabelo ou itens, valores, pagamento,
// anexos), com o que falta para salvar. Um componente só, de propósito: as partes dividem muito estado (ver relatório
// da refatoração antes de quebrar).
import { Fragment, type ReactNode } from 'react'
import { formasEmUso } from '../../../core/domain/formas'
import { ImpostosDaOperacao } from '../../../shared/ui/impostosOperacao'
import { AcaoIcone } from '../../../shared/ui/acoesPagina'
import { formatar } from '../../../core/domain/dinheiro'
import type { Id, Transacao } from '../../../core/domain/tipos'
import { CAMPOS_FORM, type CampoFormId, FORM_COMPRA_PADRAO, type FormCompraConfig } from '../../../core/services/formCompra'
import { Botao, Campo, Carregando, Cartao, Confirmar, Info, Selecao, cx, dataBR, gramasTexto, Titulo } from '../../../shared/ui/base'
import { useApp, useConsulta } from '../../../shared/ui/contexto'
import { SeletorPessoa, ValoresConvertidos } from '../../../shared/ui/compartilhados'
import { AnexosCurtos } from '../../../shared/ui/anexos'
import { useT } from '../../../shared/ui/i18n'
import { Trilha } from '../../../shared/ui/trilha'
import { CampoCodigoCompra } from '../../../shared/ui/codigos'
import { BuscaPessoa } from '../../../shared/ui/buscaPessoa'
import { Passo } from '../../../shared/ui/passoAPasso'
import { CATEGORIAS_COMPRA } from '../model/comum'
import { deLinhas } from '../model/linhaNova'
import { useNovaCompra } from '../hooks/useNovaCompra'
import { LinhaCompra } from './LinhaCompra'

/** Tela de NOVA COMPRA (também usada para "repetir" uma compra: os campos vêm preenchidos). O jeito da tela vem de Configurações › Formulário de compra. */
export function NovaCompraTela() {
  const { nav } = useApp()
  const { dados: cfg } = useConsulta('configuracoes', {})
  const { dados: form, erro: erroForm } = useConsulta('formCompra', {})
  const repetir = nav.params.repetir as Id | undefined
  const { dados: base } = useConsulta('compra', { id: repetir ?? '' }, !!repetir)
  const f = form ?? (erroForm ? FORM_COMPRA_PADRAO : undefined)
  if (!cfg || !f || (repetir && !base)) return <Carregando />
  const modulos = cfg.modulos.filter((m) => m.temCompra && cfg.config.modulosAtivos.includes(m.id))
  return <NovaCompra key={repetir ?? 'nova'} modulos={modulos} base={base?.compra} form={f} />
}

function NovaCompra({ modulos, base, form }: { modulos: { id: string; nome: string; icone: string }[]; base?: Transacao; form: FormCompraConfig }) {
  const nc = useNovaCompra({ modulos, base, form })
  const { ordemPassos, t, ir, admin, ocupado, id, obrig, moduloId, ehCabelo, modulo, pessoaId, compradorId, setCompradorId, moeda, regraCompra, setModoEscolhido, modoCodigo, codigo, setCodigo, marcarCodigo, porComprador, codigoMostrado, obs, setObs, estado, setEstado, viagensAbertas, viagemEscolhida, setViagemEscolhida, viagemSugerida, motivoViagem, setAbertos, viagemId, viagemAtual, nomeViagem, tentou, passosAbertos, alternarPasso, irPasso, setLinhaAberta, novaLinha, linhas, setLinhas, cfgApp, formaPaga, setFormaPaga, conta, anexos, tabela, etapasFluxo, recentes, siglas, ultima, setColuna, colunaUsual, col, nomeColuna, totalLinha, total, pagas, totalPago, todasPagas, pesoTotal, custoKg, descLinha, faltasLinha, mostrarCodigo, faltas, pode, comRevisar, campos, caixa, abrir, estaAberto, trocando, setPessoaId, trocarModulo, confirmarTroca, fecharTroca, salvar, aoTeclar } = nc
  // o botão não descreve o erro: aponta para ele (os campos que faltam ficam em vermelho ao tocar; a lista fica no title)
  const rotuloFalta = faltas.length ? t(faltas.length === 1 ? 'Preencha o que falta' : 'Preencha o que falta ({n})', { n: faltas.length }) : ''
  const botaoRegistrar = (extra?: string) => (
    <Botao grande aria-disabled={!pode} disabled={ocupado} onClick={salvar} className={cx('leading-tight', !pode && 'opacity-60', extra)} title={faltas.join(', ')}>
      {pode ? t('Registrar pedido') : rotuloFalta}
    </Botao>
  )

  // ---------- cada campo ----------
  const sigla = pessoaId ? siglas[pessoaId] : undefined
  const saldo = conta?.saldo ?? 0
  const detalheFornecedor = pessoaId ? (
    <div className="mt-0.5 flex flex-wrap items-center gap-x-3 text-xs">
      {sigla && <span className="rounded bg-[var(--cartao)] px-1.5 py-0.5 font-mono font-bold text-[var(--marca)]">{sigla}</span>}
      {conta && <span className={cx('font-semibold', saldo < 0 ? 'text-[var(--ruim)]' : saldo > 0 ? 'text-[var(--bom)]' : 'text-[var(--suave)]')}>{saldo < 0 ? `${t('Devo')} ${formatar(-saldo, conta.moeda)}` : saldo > 0 ? `${t('Me deve')} ${formatar(saldo, conta.moeda)}` : t('Conta em dia')}</span>}
      {ultima && (
        <a href={`#/pedidos/${encodeURIComponent(ultima.id)}`} target="_blank" rel="noreferrer" className="inline-flex min-h-11 items-center text-[var(--suave)] hover:text-[var(--marca)] hover:underline">
          {t('Última')}: {dataBR(ultima.data)} · {gramasTexto(ultima.linhas.reduce((s, l) => s + l.quantidade, 0))} · {formatar(ultima.totalPrincipal, ultima.moedaPrincipal)} ↗
        </a>
      )}
      {ultima && ultima.moduloId === moduloId && (
        <button type="button" className="min-h-11 font-semibold text-[var(--marca)]" onClick={() => setLinhas(deLinhas(ultima.linhas, ehCabelo))}>⟳ {t('Repetir a última')}</button>
      )}
    </div>
  ) : undefined



  // PASSOS: 1 Fornecedor · 2 O que veio · 3 Detalhes (o resto, aberto ou no "+") · [4 Revisar]
  const PRINCIPAIS: CampoFormId[] = ['fornecedor', 'itens']
  const numeroDe: Partial<Record<CampoFormId, number>> = {}
  for (const c of campos) if (PRINCIPAIS.includes(c.id) && estaAberto(c.id)) numeroDe[c.id] = Object.keys(numeroDe).length + 1
  // DETALHES: cada campo aberto pelo "+" tem ✕ (fecha e limpa) e um exemplo do que é; obrigatório e o que a regra
  // abriu sozinho (quem comprou para o código por pessoa, viagem sugerida) ficam sem ✕
  const EXEMPLO: Partial<Record<CampoFormId, string>> = {
    codigo: 'Ex.: P-0008 (incremental) · M3 (sigla da Maria + 3ª compra dela) · ou um código digitado à mão.',
    coluna: 'Ex.: coluna P.W. → 60 cm | 2.008 g × 17,5 = Bs 35.140. Muda o preço das linhas pela tabela.',
    comprador: 'Ex.: Paula comprou na viagem → a compra fica no nome dela (código por pessoa e o que ela trouxe).',
    estado: 'Ex.: Úmido · Embaraçado → fica no histórico e explica a perda na triagem.',
    obs: 'Ex.: veio em 3 sacos, 1 com fios mais curtos.',
    fotos: 'Ex.: foto do pedido, do cabelo e o comprovante de origem (nota ou recibo de quem vendeu).',
    viagem: 'Ex.: viagem a Cochabamba → os gastos da viagem são divididos entre as compras dela.',
  }
  const forcado = (c: CampoFormId) => (c === 'comprador' && porComprador)
  const fechar = (c: CampoFormId) => {
    setAbertos((s) => { const n = new Set(s); n.delete(c); return n })
    if (c === 'comprador') setCompradorId(undefined)
    else if (c === 'estado') setEstado([])
    else if (c === 'obs') setObs('')
    else if (c === 'viagem') setViagemEscolhida('') // '' = sem viagem (undefined traria a sugestão de volta na hora)
    else if (c === 'codigo') (setCodigo(''), setModoEscolhido(form.padroes.modoCodigo))
    else if (c === 'coluna') setColuna(undefined)
  }
  const fechoEExemplo = (c: CampoFormId) => (!numeroDe[c] ? { exemplo: EXEMPLO[c], onFechar: !obrig(c) && !forcado(c) ? () => fechar(c) : undefined } : {})
  const campoTela = (c: CampoFormId): ReactNode => {
    switch (c) {
      case 'fornecedor':
        return (
          <Bloco obrigatorio={obrig(c)} campo={c} numero={numeroDe[c]} plano={!numeroDe[c]} {...fechoEExemplo(c)}>
            <BuscaPessoa rotulo={obrig('fornecedor') ? 'De quem? *' : 'De quem?'} valor={pessoaId} onChange={setPessoaId} papel="fornecedor" recentes={recentes} siglas={siglas} detalhe={detalheFornecedor} erro={tentou && obrig('fornecedor') && !pessoaId ? `${t('Falta')}: ${t('fornecedor')}` : undefined} />
          </Bloco>
        )
      case 'itens':
        return (
          <Bloco obrigatorio={obrig(c)} campo={c} numero={numeroDe[c]} plano={!numeroDe[c]} {...fechoEExemplo(c)} titulo="O que veio" acao={<span className="num text-sm font-bold">{formatar(total, moeda)}</span>}>
            <div className="space-y-2">
              {linhas.map((l, i) => <LinhaCompra key={l.id} nc={nc} l={l} i={i} />)}
              <Botao variante="secundario" className="min-h-11 w-full sm:w-auto" onClick={() => { const n = novaLinha(ehCabelo, linhas[linhas.length - 1]); setLinhas([...linhas, n]); setLinhaAberta(n.id) }}>+ {t('Outra linha')}</Botao>
            </div>
          </Bloco>
        )
      case 'codigo':
        return (
          <Bloco obrigatorio={obrig(c)} campo={c} numero={numeroDe[c]} plano={!numeroDe[c]} {...fechoEExemplo(c)} titulo="Código do pedido" acao={<Info texto="Como este pedido vai ser chamado (e os lotes dele). Escolha o tipo só para esta compra; a regra fica em Configurações › Códigos." />}>
            <CampoCodigoCompra
              modo={modoCodigo}
              onModo={(m) => (setModoEscolhido(m), setCodigo(''))}
              valor={codigo}
              onChange={setCodigo}
              contexto={{ pessoaId, compradorId }}
              onEstado={marcarCodigo}
              semPessoa={(regraCompra?.base === 'comprador' ? !compradorId : !pessoaId) ? (regraCompra?.base === 'comprador' ? 'Sem quem comprou: sai o incremental.' : 'Sem fornecedor: sai o incremental.') : undefined}
            />
          </Bloco>
        )
      case 'coluna':
        return (
          <Bloco obrigatorio={obrig(c)} campo={c} numero={numeroDe[c]} plano={!numeroDe[c]} {...fechoEExemplo(c)} titulo="Coluna da tabela" acao={<Info texto="Compra pela tabela: medida | gramas × fator da coluna do fornecedor. Vem a coluna ligada ao fornecedor (ou a da última compra dele)." />}>
            <Selecao valor={col} onChange={setColuna} opcoes={(tabela?.colunas ?? []).map((x) => ({ id: x.id, nome: x.id === colunaUsual ? `${x.nome} · ${t('do fornecedor')}` : x.nome }))} />
          </Bloco>
        )
      case 'comprador':
        return (
          <Bloco obrigatorio={obrig(c)} campo={c} numero={numeroDe[c]} plano={!numeroDe[c]} {...fechoEExemplo(c)}>
            <SeletorPessoa rotulo={obrig('comprador') || porComprador ? 'Quem comprou? *' : 'Quem comprou?'} valor={compradorId} onChange={setCompradorId} papel="funcionario" opcional={!obrig('comprador') && !porComprador} />
            <Falta se={tentou && obrig('comprador') && !compradorId} texto={t('quem comprou')} />
          </Bloco>
        )
      case 'estado':
        return (
          <Bloco obrigatorio={obrig(c)} campo={c} numero={numeroDe[c]} plano={!numeroDe[c]} {...fechoEExemplo(c)} titulo="Estado na chegada">
            <div className="flex flex-wrap gap-2">
              {form.estados.map((e) => (
                <button key={e} type="button" aria-pressed={estado.includes(e)} onClick={() => setEstado(estado.includes(e) ? estado.filter((x) => x !== e) : [...estado, e])} className={cx('min-h-11 rounded-full border px-3 text-sm', estado.includes(e) ? 'border-[var(--marca)] bg-[var(--marca)] font-semibold text-white' : 'border-[var(--borda)] hover:border-[var(--marca)]')}>
                  {t(e)}
                </button>
              ))}
            </div>
            <Falta se={tentou && obrig('estado') && !estado.length} texto={t('estado na chegada')} />
          </Bloco>
        )
      case 'obs':
        return (
          <Bloco obrigatorio={obrig(c)} campo={c} numero={numeroDe[c]} plano={!numeroDe[c]} {...fechoEExemplo(c)} titulo="Observação">
            <textarea rows={2} aria-label={t('Observação')} value={obs} onChange={(e) => setObs(e.target.value)} placeholder={t('Ex.: veio em 3 sacos, 1 com fios mais curtos.')} className="w-full rounded-xl border border-[var(--borda)] bg-[var(--cartao)] p-3 text-base outline-none focus:border-[var(--marca)]" />
            <Falta se={tentou && obrig('obs') && !obs.trim()} texto={t('observação')} />
          </Bloco>
        )
      case 'fotos':
        return (
          <Bloco obrigatorio={obrig(c)} campo={c} numero={numeroDe[c]} plano={!numeroDe[c]} {...fechoEExemplo(c)} titulo="Fotos e arquivos">
            <AnexosCurtos donoId={id} categorias={CATEGORIAS_COMPRA} padrao="pedido" />
            <Falta se={tentou && obrig('fotos') && !anexos?.length} texto={t('fotos')} />
          </Bloco>
        )
      case 'viagem':
        return (
          <Bloco obrigatorio={obrig(c)} campo={c} numero={numeroDe[c]} plano={!numeroDe[c]} {...fechoEExemplo(c)} titulo="Viagem" acao={<Info texto="Compra feita numa viagem de compra: os gastos da viagem são divididos entre as compras dela e o resultado da viagem conta com esta." />}>
            <Selecao valor={viagemId ?? ''} onChange={(v) => (setViagemEscolhida(v), setAbertos((s) => new Set(s).add('viagem')))} vazio={t('Sem viagem')} opcoes={viagensAbertas.map((v) => ({ id: v.id, nome: nomeViagem(v) }))} />
            {viagemSugerida && viagemId === viagemSugerida.id && viagemEscolhida === undefined
              ? <p className="mt-1 text-xs text-[var(--suave)]">{t(motivoViagem === 'unica' ? 'Ligada à única viagem aberta. Não foi nessa viagem? Escolha “Sem viagem”.' : 'Escolhida porque quem comprou está nesta viagem.')}</p>
              : !viagemId && <p className="mt-1 text-xs text-[var(--suave)]">{t('Comprou numa viagem? Escolha aqui. Esqueceu? Dá para ligar depois, em Compras.')}</p>}
            <Falta se={tentou && obrig('viagem') && !viagemId} texto={t('viagem')} />
          </Bloco>
        )
      default:
        return null
    }
  }
  /** rótulo do "+" de um campo fechado (com o valor que já vale, quando tem) */
  const rotuloFechado = (c: CampoFormId) => {
    if (c === 'codigo') return `# ${codigoMostrado ?? t('Código do pedido')}`
    if (c === 'coluna') return `${t('Coluna')}: ${nomeColuna ?? '—'}`
    if (c === 'fotos') return `+ ${t('Fotos')}${anexos?.length ? ` (${anexos.length})` : ''}`
    if (c === 'estado') return `+ ${t('Estado na chegada')}`
    if (c === 'obs') return `+ ${t('Observação')}`
    return `+ ${t(CAMPOS_FORM[c].nome)}`
  }

  // DETALHES em duas partes fixas (nada "pula para o meio"): em cima, os campos ABERTOS, cada um no seu cartão e na
  // ordem do formulário; embaixo, num bloco só, os "+" do que ainda não foi usado. Abrir um campo leva ele para cima.
  const principais: ReactNode[] = []
  const partes: ReactNode[] = []
  const abertosDet: ReactNode[] = []
  const fechados: CampoFormId[] = []
  const principalDe: Partial<Record<CampoFormId, ReactNode>> = {}
  for (const c of campos) {
    if (numeroDe[c.id]) (principais.push(<Fragment key={c.id}>{campoTela(c.id)}</Fragment>), (principalDe[c.id] = campoTela(c.id)))
    else if (estaAberto(c.id)) abertosDet.push(<Fragment key={c.id}>{campoTela(c.id)}</Fragment>)
    else fechados.push(c.id)
  }
  if (abertosDet.length) partes.push(<div key="abertos" className="space-y-2">{abertosDet}</div>)
  if (fechados.length)
    partes.push(
      <div key="mais" className="rounded-xl border border-dashed border-[var(--borda)] p-3">
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--suave)]">{t(abertosDet.length ? 'Adicionar mais' : 'Adicionar ao pedido')}</p>
        <div className="flex flex-wrap gap-2">
          {fechados.map((c) => (
            <button key={c} type="button" data-campo-fechado={c} onClick={() => abrir(c)} className={cx('min-h-11 max-w-full truncate rounded-full border bg-[var(--cartao)] px-4 text-sm font-semibold', c === 'codigo' ? 'font-mono' : '', 'border-[var(--borda)] text-[var(--marca)] hover:border-[var(--marca)] hover:bg-[var(--marca-suave)]')}>
              {c === 'comprador' && compradorId ? <NomeComprador id={compradorId} /> : rotuloFechado(c)}
            </button>
          ))}
        </div>
      </div>,
    )
  const detalhesObrigatorios = campos.some((c) => !numeroDe[c.id] && c.obrigatorio)
  // PASSO A PASSO (aprendido no Separar): cada passo fecha numa linha com o resumo; o aberto explica para que serve
  const nomeForn = pessoaId ? (ultima?.pessoa ?? conta?.pessoa?.nome) : undefined
  const linhasResumo = linhas.map((l) => ({ id: l.id, texto: descLinha(l), qtd: ehCabelo ? gramasTexto(l.quantidade ?? 0) : String(l.quantidade ?? 0), valor: totalLinha(l) }))
  const nomeFornecedor = ultima?.pessoa ?? (pessoaId ? conta?.pessoa?.nome : undefined)
  const linhasOk = linhas.length > 0 && linhas.every((l, i) => !faltasLinha(l, i).length)
  const preenchidosDetalhe = [
    mostrarCodigo && codigoMostrado ? `# ${codigoMostrado}` : '',
    viagemAtual ? `✈️ ${viagemAtual.codigo}` : '',
    estado.length ? estado.map((x) => t(x)).join(', ') : '',
    obs.trim() ? `“${obs.trim()}”` : '',
    anexos?.length ? `📎 ${anexos.length}` : '',
  ].filter(Boolean)
  const faltaDetalhe = faltas.some((x) => ![t('fornecedor'), t('o que veio')].includes(x) && !linhas.some((l, i) => faltasLinha(l, i).includes(x)))
  // O QUE JÁ FOI PAGO (só aparece com alguma linha marcada "já paga"): quanto, de quantas linhas e em que forma
  const blocoJaPaga = pagas.length > 0 && (
    <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2 rounded-xl border-2 border-[var(--bom)] bg-[var(--bom)]/5 p-3 text-sm">
      <span className="min-w-0 flex-1">
        <b className="num block text-[var(--bom)]">✓ {t('Já pago')}: {formatar(totalPago, moeda)}</b>
        <span className="text-xs text-[var(--suave)]">{todasPagas ? t('todas as linhas: o pedido entra pago e concluído') : t('{n} de {m} linha(s) · o resto ({v}) fica para pagar no pedido', { n: pagas.length, m: linhas.length, v: formatar(Math.max(0, total - totalPago), moeda) })}</span>
      </span>
      {totalPago > 0 && (
        <label className="flex items-center gap-2 text-sm">
          <span className="text-[var(--suave)]">{t('Pago em')}</span>
          <Selecao className="w-auto" valor={formaPaga} onChange={setFormaPaga} opcoes={formasEmUso(cfgApp?.config.formas, moeda).map((f) => ({ id: f.id, nome: t(f.nome) }))} />
        </label>
      )}
    </div>
  )
  const listaPassos: { id: CampoFormId | 'detalhes' | 'revisar'; titulo: string; resumo: ReactNode; ajuda: string; exemplo?: string; feito: boolean; opcional?: boolean; falta?: boolean; conteudo: ReactNode }[] = [
    ...(principalDe.fornecedor ? [{
      id: 'fornecedor' as const, titulo: 'Fornecedor', opcional: !obrig('fornecedor'), feito: !!pessoaId, falta: tentou && obrig('fornecedor') && !pessoaId,
      resumo: nomeForn ? [nomeForn, sigla, conta ? (saldo < 0 ? `${t('Devo')} ${formatar(-saldo, conta.moeda)}` : saldo > 0 ? `${t('Me deve')} ${formatar(saldo, conta.moeda)}` : t('Conta em dia')) : ''].filter(Boolean).join(' · ') : t('ninguém escolhido'),
      ajuda: 'De quem você comprou. Mostra a sigla, quanto você deve a ela e a última compra (dá para repetir).',
      exemplo: 'Ex.: Helena · HE · Devo Bs 1.000 → ⟳ Repetir a última',
      conteudo: principalDe.fornecedor,
    }] : []),
    ...(principalDe.itens ? [{
      id: 'itens' as const, titulo: 'Itens da compra', feito: linhasOk, falta: tentou && !linhasOk,
      resumo: `${t('{n} linha(s)', { n: linhas.length })} · ${ehCabelo ? gramasTexto(pesoTotal) : `${linhas.length} ${t('item(ns)')}`} · ${formatar(total, moeda)}${linhas.some((l) => l.campos.semValor) ? ` · ${t('{n} sem valor', { n: linhas.filter((l) => l.campos.semValor).length })}` : ''}${pagas.length ? ` · ✓ ${t('{n} já paga(s)', { n: pagas.length })}` : ''}`,
      ajuda: ehCabelo ? 'O cabelo que chegou: cada linha vira um pacote que vai para a triagem. Bruto = veio misturado (separa depois). Pela tabela = já veio por medida.' : 'O que chegou: cada linha é um produto, com a quantidade e o custo.',
      exemplo: ehCabelo ? 'Ex.: 10 kg bruto por Bs 30.000 · ou · 60 cm | 2 kg × 17,5 = Bs 35.000' : 'Ex.: 12 × shampoo a Bs 45 = Bs 540',
      conteudo: <>{principalDe.itens}{blocoJaPaga}</>,
    }] : []),
    ...(partes.length ? [{
      id: 'detalhes' as const, titulo: 'Detalhes', opcional: !detalhesObrigatorios, feito: preenchidosDetalhe.length > 0 && !faltaDetalhe, falta: tentou && faltaDetalhe,
      // com viagem em andamento e nenhuma escolhida, o resumo do passo já diz "sem viagem" (dá para ver sem abrir)
      resumo: [viagensAbertas.length > 0 && !viagemId ? `✈️ ${t('sem viagem')}` : '', preenchidosDetalhe.join(' · ')].filter(Boolean).join(' · ') || t('nada — toque para abrir'),
      ajuda: 'Só se precisar: quem comprou, código, viagem, estado na chegada, fotos e observação. Toque no + do que quiser.',
      exemplo: 'Ex.: + Fotos para anexar a foto do pedido · + Estado na chegada: Úmido',
      conteudo: <div className="space-y-3">{partes}</div>,
    }] : []),
    ...(comRevisar ? [{
      id: 'revisar' as const, titulo: 'Revisar e registrar', feito: pode, falta: tentou && !pode,
      resumo: pode ? t('tudo certo para registrar') : t('Falta preencher: {x}', { x: faltas[0] ?? '' }),
      ajuda: 'Confira o pedido inteiro antes de registrar: fornecedor, o que veio, valores e detalhes.',
      exemplo: 'Ex.: Helena · Bruto 10 kg · Bs 30.000 → Registrar pedido',
      conteudo: (
        <ul className="divide-y divide-[var(--borda)] rounded-xl bg-[var(--cartao)] px-3 text-sm">
          {mostrarCodigo && <li className="flex justify-between gap-3 py-2"><span className="text-[var(--suave)]">{t('Código do pedido')}</span><b className="font-mono">{codigoMostrado ?? '…'}</b></li>}
          <li className="flex justify-between gap-3 py-2"><span className="text-[var(--suave)]">{t('Tipo')}</span><b>{modulo?.icone} {t(modulo?.nome ?? moduloId)}</b></li>
          <li className="flex justify-between gap-3 py-2"><span className="text-[var(--suave)]">{t('Fornecedor')}</span><b>{nomeFornecedor ?? t('Sem fornecedor')}</b></li>
          {viagemAtual && <li className="flex justify-between gap-3 py-2"><span className="text-[var(--suave)]">{t('Viagem')}</span><b className="min-w-0 truncate">✈️ {nomeViagem(viagemAtual)}</b></li>}
          {linhasResumo.map((l) => (
            <li key={l.id} className="flex justify-between gap-3 py-2"><span className="min-w-0 truncate">{l.texto}</span><span className="num shrink-0">{l.qtd} · <b>{formatar(l.valor ?? 0, moeda)}</b></span></li>
          ))}
          {(estado.length > 0 || obs.trim()) && <li className="py-2"><span className="text-[var(--suave)]">{t('Estado na chegada')}:</span> {[...estado.map((x) => t(x)), obs.trim()].filter(Boolean).join(' · ')}</li>}
        </ul>
      ),
    }] : []),
  ]
  ordemPassos.current = listaPassos.map((p) => p.id)
  const corpo: ReactNode = (
    <ol className="space-y-3" aria-label={t('Passos da compra')}>
      {listaPassos.map((p, k) => (
        <Passo key={p.id} n={k + 1} de={listaPassos.length} titulo={p.titulo} resumo={p.resumo} ajuda={p.ajuda} exemplo={p.exemplo} feito={p.feito} opcional={p.opcional} falta={p.falta} aberto={passosAbertos.has(k + 1)} onAlternar={() => alternarPasso(k + 1)}>
          {p.conteudo}
          {k < listaPassos.length - 1 && <div className="flex justify-end"><Botao variante="secundario" onClick={() => irPasso(k + 2)}>{t('Próximo')}: {t(listaPassos[k + 1].titulo)} →</Botao></div>}
        </Passo>
      ))}
    </ol>
  )


  return (
    <div>
      <Trilha atual={t(base ? 'Repetir compra' : 'Nova compra')} />
      <Titulo subtitulo={t('De quem, o que veio e os detalhes. Ao registrar, o cabelo entra na fila para separar por tamanho e cor (Triagem).')} acao={admin && <AcaoIcone icone="⚙️" rotulo="Personalizar" dica="Escolher os campos e o jeito do formulário de compra (vale para todos)." lado="direita" onClick={() => ir('config', { aba: 'formCompra' })} />}>
        {t(base ? 'Repetir compra' : 'Nova compra')}
      </Titulo>

      {trocando && (
        <Confirmar
          titulo={trocando.tipo === 'fornecedor' ? 'Trocar o fornecedor?' : 'Trocar o que está comprando?'}
          texto={trocando.tipo === 'fornecedor' ? 'Trocar o fornecedor apaga o que foi preenchido. Continuar?' : 'Trocar o que está comprando apaga o que foi preenchido. Continuar?'}
          rotulo="Continuar"
          onConfirmar={confirmarTroca}
          onFechar={fecharTroca}
        />
      )}

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div ref={caixa} onKeyDown={aoTeclar} className="min-w-0 space-y-3">
          {modulos.length > 1 && (
            modulos.length <= 4 ? (
              <div role="radiogroup" aria-label={t('O que está comprando?')} className="grid grid-cols-[repeat(auto-fit,minmax(min(8.5rem,100%),1fr))] gap-2">
                {modulos.map((m) => (
                  <button key={m.id} type="button" role="radio" aria-checked={m.id === moduloId} onClick={() => trocarModulo(m.id)} className={cx('flex min-h-14 min-w-0 items-center gap-2 rounded-2xl border-2 px-2 py-2 text-left text-sm font-semibold', m.id === moduloId ? 'border-[var(--marca)] bg-[var(--marca-suave)] text-[var(--marca)]' : 'border-[var(--borda)] bg-[var(--cartao)] hover:border-[var(--marca)]')}>
                    <span className="text-2xl" aria-hidden>{m.icone}</span>
                    <span className="min-w-0 break-words leading-tight">{t(m.nome)}</span>
                  </button>
                ))}
              </div>
            ) : (
              <Campo rotulo="O que está comprando?"><Selecao valor={moduloId} onChange={trocarModulo} opcoes={modulos.map((m) => ({ id: m.id, nome: `${m.icone} ${t(m.nome)}` }))} /></Campo>
            )
          )}

          {corpo}

          {/* celular: total e o botão principal sempre à mão */}
          <div className="sticky bottom-[calc(4.75rem_+_env(safe-area-inset-bottom))] z-10 flex items-center gap-2 rounded-2xl border border-[var(--borda)] bg-[var(--cartao)] p-2 pl-3 shadow-lg md:bottom-4 lg:hidden">
            <div className="min-w-0 flex-1">
              <div className="num truncate text-lg font-black leading-tight">{formatar(total, moeda)}</div>
              {/* peso total · custo médio por kg (cabelo) — o que diz se a compra vale a pena */}
              <div className="num truncate text-xs text-[var(--suave)]">{ehCabelo ? gramasTexto(pesoTotal) : `${linhas.length} ${t('item(ns)')}`}{custoKg !== undefined ? ` · ${formatar(custoKg, moeda)}/kg` : ''}{codigoMostrado && mostrarCodigo ? ` · ${codigoMostrado}` : ''}</div>
              <ImpostosDaOperacao compacto compra={total} moeda={moeda} />
            </div>
            {botaoRegistrar('max-w-[60%] shrink-0 px-4 text-sm')}
          </div>
        </div>

        {/* resumo fixo ao lado (desktop) */}
        <aside className="hidden h-fit lg:sticky lg:top-4 lg:block">
          <Cartao titulo={t('Resumo do pedido')}>
            <dl className="space-y-2 text-sm">
              {mostrarCodigo && <div className="flex justify-between gap-2"><dt className="text-[var(--suave)]">{t('Código')}</dt><dd className="truncate font-mono font-bold text-[var(--marca)]">{codigoMostrado ?? '…'}</dd></div>}
              <div className="flex justify-between gap-2"><dt className="text-[var(--suave)]">{t('Fornecedor')}</dt><dd className="truncate font-semibold">{nomeFornecedor ?? '—'}</dd></div>
              {viagemAtual && <div className="flex justify-between gap-2"><dt className="text-[var(--suave)]">{t('Viagem')}</dt><dd className="truncate font-semibold">✈️ {nomeViagem(viagemAtual)}</dd></div>}
            </dl>
            <ul className="my-3 space-y-1 border-y border-[var(--borda)] py-2 text-sm">
              {linhasResumo.map((l, i) => (
                <li key={l.id} className="flex justify-between gap-2">
                  <span className="min-w-0 truncate"><span className="text-[var(--suave)]">{i + 1}.</span> {l.texto}</span>
                  <span className="num shrink-0 text-right">{l.qtd} · {l.valor !== undefined ? formatar(l.valor, moeda) : '—'}</span>
                </li>
              ))}
            </ul>
            <dl className="space-y-1 text-sm">
              {ehCabelo && <div className="flex justify-between"><dt className="text-[var(--suave)]">{t('Peso')}</dt><dd className="num">{gramasTexto(pesoTotal)}</dd></div>}
              {custoKg !== undefined && <div className="flex justify-between"><dt className="text-[var(--suave)]">{t('Custo por kg')}</dt><dd className="num">{formatar(custoKg, moeda)}</dd></div>}
              <div className="flex justify-between border-t border-[var(--borda)] pt-2 text-lg font-black"><dt>{t('Total')}</dt><dd className="num">{formatar(total, moeda)}</dd></div>
              {total > 0 && <div className="flex justify-end"><ValoresConvertidos valor={total} moeda={moeda} uso="compra" /></div>}
            </dl>
            <ImpostosDaOperacao className="mt-3" compra={total} moeda={moeda} />
            <div className="mt-4 flex flex-col gap-2">
              {botaoRegistrar('w-full')}
            </div>
            {!pode && tentou && faltas.length > 1 && <p className="mt-2 text-xs text-[var(--ruim)]">{t('Falta')}: {faltas.join(', ')}</p>}
            <p className="mt-2 text-xs text-[var(--suave)]">{ehCabelo ? `${t('Ao registrar, o cabelo já fica na Triagem, esperando para separar.')} ` : ''}{t('Pagamento e entrega')}: {etapasFluxo.map((e) => t(e.nome)).join(' → ')}.</p>
            <p className="mt-1 hidden text-xs text-[var(--suave)] lg:block">{t('Enter: próximo campo · Ctrl+Enter: registrar')}</p>
          </Cartao>
        </aside>
      </div>
    </div>
  )
}

/** Um campo do formulário de compra (cartão com título; * quando obrigatório). */
/**
 * Um campo da nova compra. `onFechar`: ✕ no canto (campo opcional aberto pelo "+": fecha e limpa o que tinha).
 * `exemplo`: uma linha "Ex.: …" embaixo, dizendo para que serve em um caso real.
 */
function Bloco({ campo, titulo, obrigatorio, children, acao, numero, plano, onFechar, exemplo }: { campo: CampoFormId; titulo?: string; obrigatorio?: boolean; children: ReactNode; acao?: ReactNode; numero?: number; plano?: boolean; onFechar?(): void; exemplo?: string }) {
  const t = useT()
  if (plano && (onFechar || exemplo))
    return (
      <section data-campo={campo} className="relative rounded-xl border border-[var(--borda)] bg-[var(--cartao)] p-3 shadow-sm">
        <div className={cx('mb-2 flex items-center gap-2', !titulo && !acao && onFechar && 'absolute right-2 top-2 mb-0')}>
          {titulo && <h2 className="flex min-w-0 flex-1 items-center text-sm font-bold">{t(titulo)}{obrigatorio && <span className="text-[var(--ruim)]"> *</span>}{exemplo && !acao && <Info texto={exemplo} />}</h2>}
          {acao}
          {onFechar && <button type="button" onClick={onFechar} aria-label={`${t('Tirar')} ${t(titulo ?? CAMPOS_FORM[campo].nome)}`} title={t('Tirar este campo (limpa o que foi preenchido)')} className="ml-auto flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-lg text-[var(--suave)] hover:bg-[var(--fundo)] hover:text-[var(--ruim)]">✕</button>}
        </div>
        <div className={cx(!titulo && !acao && onFechar && 'pr-10')}>{children}</div>
        {exemplo && (!titulo || acao) && <p className="mt-2 text-xs text-[var(--suave)]">{t(exemplo)}</p>}
      </section>
    )
  // campo principal (numerado): já está dentro do passo, que tem o número e o título — só o conteúdo
  if (numero) return <section data-campo={campo}>{children}</section>
  return (
    <section data-campo={campo} className={plano ? 'rounded-xl bg-[var(--cartao)] p-3' : 'rounded-2xl border border-[var(--borda)] bg-[var(--cartao)] p-3 sm:p-4'}>
      {(titulo || acao) && (
        <div className={cx('flex flex-wrap items-center justify-between gap-2', numero ? 'mb-3' : 'mb-2')}>
          <h2 className={cx('flex items-center gap-2 font-bold', numero ? 'text-base' : 'text-sm')}>{numero && <NumeroSecao n={numero} />}<span>{titulo && t(titulo)}{titulo && obrigatorio && <span className="text-[var(--ruim)]"> *</span>}</span></h2>
          {acao}
        </div>
      )}
      {children}
    </section>
  )
}

/** Número da seção da nova compra (1 De quem · 2 O que veio · 3 Detalhes). */
function NumeroSecao({ n }: { n: number }) {
  return <span aria-hidden className="num flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-sm font-black text-white bg-[var(--marca)]">{n}</span>
}

/** "Falta: …" embaixo do campo (aparece depois da primeira tentativa de registrar). */
export function Falta({ se, texto }: { se: boolean; texto: string }) {
  const t = useT()
  return se ? <p data-falta className="mt-1 text-xs font-semibold text-[var(--ruim)]">{t('Falta')}: {texto}</p> : null
}

function NomeComprador({ id }: { id: Id }) {
  const t = useT()
  const { dados } = useConsulta('pessoas', { papel: 'funcionario' })
  return <>{t('Quem comprou')}: {dados?.find((p) => p.id === id)?.nome ?? '…'}</>
}
