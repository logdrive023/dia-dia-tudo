// CONFIGURAÇÕES › Catálogo: serviços e produtos, preço, comissão e insumos (RegraComissaoSalao).
// Uma seção = um arquivo (a lista das seções e onde cada uma aparece fica em ../configSecoes.ts).
import { useState } from 'react'
import { formatar } from '../../core/domain/dinheiro'
import { novoId } from '../../core/domain/ids'
import { COMISSAO_PADRAO_BP, dividir, memoriaCalculo, pct } from '../../core/domain/comissao'
import type { Item } from '../../core/domain/tipos'
import { Botao, Campo, Carregando, Cartao, Entrada, Escolha, Pilula, Selecao, ValorInput, moedaPadrao } from '../../ui/base'
import { useApp, useComando, useConsulta } from '../../ui/contexto'
import { useT } from '../../ui/i18n'
import { JanelaCadastro } from '../../ui/janelaCadastro'

export function Catalogo() {
  const t = useT()
  const { dados: cfg } = useConsulta('configuracoes', {})
  const mods = (cfg?.modulos ?? []).filter((m) => m.tiposItem.some((x) => !x.controlaEstoque || m.id === 'produtos' || m.personalizado) && cfg?.config.modulosAtivos.includes(m.id))
  const [moduloId, setModuloId] = useState('salao')
  const { dados } = useConsulta('catalogo', { moduloId })
  const { executar, ocupado } = useComando()
  const { avisar } = useApp()
  const mod = mods.find((m) => m.id === moduloId)
  const tipo = mod?.tiposItem[0]
  const moeda = cfg?.config.moedaPrincipal ?? moedaPadrao()
  const servico = !!tipo && tipo.unidade === 'servico'
  const categorias = (tipo?.campos.find((c) => c.id === 'categoria')?.opcoes ?? []) as string[]
  const [ed, setEd] = useState<{
    id: string
    nome: string
    preco?: number
    moedaPreco?: string
    duracaoMin?: number
    retornoDias?: number
    estoqueIdeal?: number
    saldoInicial?: number
    novo: boolean
    categoria?: string
    regra: 'padrao' | 'propria'
    comissaoPct: string
    insumoMoeda: string
    insumos: { nome: string; valor?: number }[]
    /** o item como estava quando o formulário abriu (outra pessoa mudou depois = recusa, não desfaz a mudança dela) */
    antes?: Item
  }>()
  const padraoBp = cfg?.config.comissaoPadraoBp ?? COMISSAO_PADRAO_BP
  const abrir = (i?: Item) =>
    setEd(
      i
        ? {
            id: i.id,
            nome: i.nome,
            preco: i.precoSugerido?.valor,
            moedaPreco: i.precoSugerido?.moeda,
            duracaoMin: i.duracaoMin,
            retornoDias: i.retornoDias,
            estoqueIdeal: i.estoqueIdeal,
            novo: false,
            antes: i,
            categoria: (i.campos.categoria as string | undefined) ?? '',
            regra: i.comissaoBp !== undefined ? 'propria' : 'padrao',
            comissaoPct: i.comissaoBp !== undefined ? String(i.comissaoBp / 100).replace('.', ',') : '',
            insumoMoeda: i.insumo?.moeda ?? moeda,
            insumos: i.insumo?.valor ? (i.insumo.itens?.length ? i.insumo.itens.map((x) => ({ ...x })) : [{ nome: t('Insumos'), valor: i.insumo.valor }]) : [],
          }
        : { id: novoId(), nome: '', novo: true, categoria: '', regra: 'padrao', comissaoPct: '', insumoMoeda: moeda, insumos: [] },
    )
  const salvar = async () => {
    if (!ed || !tipo) return
    const n = Number(ed.comissaoPct.replace(',', '.'))
    const insumos = ed.insumos.filter((x) => x.valor)
    const r = await executar(
      'salvarItem',
      {
        id: ed.id,
        moduloId,
        tipoItem: tipo.id,
        nome: ed.nome,
        precoSugerido: ed.preco !== undefined ? { moeda: ed.moedaPreco ?? moeda, valor: ed.preco } : undefined,
        duracaoMin: ed.duracaoMin,
        retornoDias: ed.retornoDias,
        estoqueIdeal: ed.estoqueIdeal,
        saldoInicial: ed.novo ? ed.saldoInicial : undefined,
        antes: ed.novo ? undefined : ed.antes,
        ...(servico
          ? {
              campos: { categoria: ed.categoria || undefined },
              comissaoBp: ed.regra === 'propria' && ed.comissaoPct.trim() && Number.isFinite(n) ? Math.round(n * 100) : undefined,
              insumo: insumos.length ? { moeda: ed.insumoMoeda, valor: 0, itens: insumos.map((x) => ({ nome: x.nome, valor: x.valor! })) } : undefined,
            }
          : {}),
      },
      t('Salvo.'),
    )
    if (r) setEd(undefined)
  }
  const somaInsumos = ed?.insumos.reduce((s, x) => s + (x.valor ?? 0), 0) ?? 0
  return (
    <div>
      <div className="mb-3 flex flex-wrap gap-2">
        <Selecao className="w-auto" valor={moduloId} onChange={setModuloId} opcoes={mods.map((m) => ({ id: m.id, nome: `${m.icone} ${t(m.nome)}` }))} />
        <Botao onClick={() => abrir()}>+ {t(tipo?.controlaEstoque ? 'Item' : 'Serviço')}</Botao>
        {moduloId === 'salao' && (
          <Botao variante="secundario" disabled={ocupado} onClick={async () => {
            const r = await executar('restaurarBibliotecaServicos', {})
            if (r) avisar(r.criados.length ? `${t('Serviços adicionados')}: ${r.criados.join(', ')}` : t('A biblioteca já está toda no catálogo.'), 'ok')
          }}>{t('Restaurar biblioteca padrão')}</Botao>
        )}
      </div>
      {moduloId === 'salao' && cfg && <RegraComissaoSalao padraoBp={padraoBp} funcionariaMuda={!!cfg.config.comissaoFuncionarioMuda} />}
      {!dados ? <Carregando /> : (
        <ul className="grid gap-2 md:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
          {dados.map((i) => (
            <li key={i.id}>
              <button type="button" className="w-full rounded-xl border border-[var(--borda)] bg-[var(--cartao)] p-3 text-left" onClick={() => abrir(i)}>
                <span className="flex justify-between gap-2"><b>{i.nome}</b><span className="num">{i.precoSugerido ? formatar(i.precoSugerido.valor, i.precoSugerido.moeda) : ''}</span></span>
                {i.unidade === 'servico' && (
                  <span className="mt-1 flex flex-wrap gap-1 text-xs">
                    {i.duracaoMin ? <Pilula>{i.duracaoMin} min</Pilula> : null}
                    <Pilula tom={i.comissaoBp !== undefined ? 'marca' : 'neutro'}>{t('Comissão')} {i.comissaoBp !== undefined ? pct(i.comissaoBp) : `${t('padrão')} ${pct(padraoBp)}`}</Pilula>
                    {i.insumo?.valor ? <Pilula tom="alerta">{t('Insumos')} {formatar(i.insumo.valor, i.insumo.moeda)}{i.insumo.itens?.length ? ` (${i.insumo.itens.map((x) => x.nome).join(' + ')})` : ''}</Pilula> : null}
                    {i.campos.revisar ? <Pilula tom="ruim">{t('Revisar')} · {t('criado por')} {String(i.campos.criadoPorNome ?? '')}</Pilula> : null}
                  </span>
                )}
              </button>
            </li>
          ))}
        </ul>
      )}
      {ed && tipo && (
        <JanelaCadastro titulo={tipo.controlaEstoque ? (ed.novo ? 'Novo item' : 'Editar item') : ed.novo ? 'Novo serviço' : 'Editar serviço'} onFechar={() => setEd(undefined)} onSalvar={salvar} ocupado={ocupado} podeSalvar={!!ed.nome.trim()}>
          <div className="space-y-3">
            <Campo rotulo="Nome"><Entrada value={ed.nome} onChange={(e) => setEd({ ...ed, nome: e.target.value })} /></Campo>
            <Campo rotulo="Preço sugerido"><ValorInput moeda={ed.moedaPreco ?? moeda} valor={ed.preco} onChange={(v) => setEd({ ...ed, preco: v })} /></Campo>
            {!tipo.controlaEstoque ? (
              <div className="grid grid-cols-2 gap-2">
                <Campo rotulo="Duração (min)"><Entrada inputMode="numeric" value={ed.duracaoMin ?? ''} onChange={(e) => setEd({ ...ed, duracaoMin: Number(e.target.value) || undefined })} /></Campo>
                <Campo rotulo="Retorno em dias" ajuda="Ex.: manutenção do mega hair a cada 45 dias: o painel avisa quando a cliente passar do prazo."><Entrada inputMode="numeric" value={ed.retornoDias ?? ''} onChange={(e) => setEd({ ...ed, retornoDias: Number(e.target.value) || undefined })} /></Campo>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                <Campo rotulo="Estoque ideal"><Entrada inputMode="numeric" value={ed.estoqueIdeal ?? ''} onChange={(e) => setEd({ ...ed, estoqueIdeal: Number(e.target.value) || undefined })} /></Campo>
                {ed.novo && <Campo rotulo="Quantidade inicial"><Entrada inputMode="numeric" value={ed.saldoInicial ?? ''} onChange={(e) => setEd({ ...ed, saldoInicial: Number(e.target.value) || undefined })} /></Campo>}
              </div>
            )}
            {servico && (
              <>
                {categorias.length > 0 && <Campo rotulo="Tipo"><Selecao valor={ed.categoria} onChange={(v) => setEd({ ...ed, categoria: v })} vazio="—" opcoes={categorias.map((c) => ({ id: c, nome: t(c) }))} /></Campo>}
                <Campo rotulo="Comissão da profissional" comoDiv ajuda="Padrão = vale a % da profissional (se tiver) ou a padrão do salão. Própria = vale para este serviço com qualquer profissional. No atendimento o administrador ainda pode ajustar a linha.">
                  <Escolha<'padrao' | 'propria'> rotulo="Comissão da profissional" valor={ed.regra} onChange={(v) => setEd({ ...ed, regra: v })} opcoes={[{ id: 'padrao', nome: 'Padrão' }, { id: 'propria', nome: '% própria' }]} />
                  {ed.regra === 'propria' && <Entrada className="mt-2" inputMode="decimal" aria-label={t('Comissão (%)')} placeholder="50" value={ed.comissaoPct} onChange={(e) => setEd({ ...ed, comissaoPct: e.target.value })} />}
                </Campo>
                <div>
                  <span className="mb-1 block text-sm font-semibold text-[var(--suave)]">{t('Insumos do salão (custo fixo)')}</span>
                  <p className="mb-2 text-xs text-[var(--suave)]">{t('Saem do valor ANTES da comissão. Ex.: Tintura Bs 300 − Tinta 15 − Água oxigenada 5 = base 280 → 140 salão · 140 profissional.')}</p>
                  <ul className="space-y-2">
                    {ed.insumos.map((x, k) => (
                      <li key={k} className="grid grid-cols-[1fr_8rem_auto] items-center gap-2">
                        <Entrada aria-label={t('Insumo')} value={x.nome} placeholder={t('Ex.: Tinta')} onChange={(e) => setEd({ ...ed, insumos: ed.insumos.map((y, j) => (j === k ? { ...y, nome: e.target.value } : y)) })} />
                        <ValorInput moeda={ed.insumoMoeda} valor={x.valor} onChange={(v) => setEd({ ...ed, insumos: ed.insumos.map((y, j) => (j === k ? { ...y, valor: v } : y)) })} />
                        <button type="button" aria-label={t('Tirar')} className="min-h-10 min-w-10 rounded-full text-lg hover:bg-[var(--marca-suave)]" onClick={() => setEd({ ...ed, insumos: ed.insumos.filter((_, j) => j !== k) })}>×</button>
                      </li>
                    ))}
                  </ul>
                  <div className="mt-1 flex flex-wrap items-center justify-between gap-2">
                    <Botao variante="leve" onClick={() => setEd({ ...ed, insumos: [...ed.insumos, { nome: '', valor: undefined }] })}>+ {t('Insumo')}</Botao>
                    {somaInsumos > 0 && <span className="num text-sm font-semibold">{t('Total')}: {formatar(somaInsumos, ed.insumoMoeda)}</span>}
                  </div>
                  {ed.preco !== undefined && (
                    <p className="num mt-2 rounded-xl bg-[var(--fundo)] p-2 text-xs">
                      🧮 {memoriaCalculo((() => {
                        const n = Number(ed.comissaoPct.replace(',', '.'))
                        const bp = ed.regra === 'propria' && ed.comissaoPct.trim() && Number.isFinite(n) ? Math.round(n * 100) : padraoBp
                        const d = dividir(ed.preco, somaInsumos, bp)
                        return { totalPrincipal: ed.preco, insumoPrincipal: somaInsumos, insumos: ed.insumos.filter((x) => x.valor).map((x) => ({ nome: x.nome || t('Insumos'), valorPrincipal: x.valor! })), comissaoBp: bp, comissaoPrincipal: d.comissao, comissaoRegra: ed.regra === 'propria' ? ('servico' as const) : ('padrao' as const), baseComissao: d.base, parteSalao: d.parteSalao }
                      })(), ed.moedaPreco ?? moeda, t)}
                    </p>
                  )}
                </div>
                {!ed.novo && dados?.find((i) => i.id === ed.id)?.campos.revisar && (
                  <Botao variante="secundario" onClick={async () => (await executar('revisarServico', { id: ed.id }, t('Marcado como revisado.'))) && setEd(undefined)}>✓ {t('Marcar como revisado')}</Botao>
                )}
              </>
            )}
          </div>
        </JanelaCadastro>
      )}
    </div>
  )
}

/** Comissão padrão do salão (50/50) e se a funcionária pode mudar o % no atendimento. */
function RegraComissaoSalao({ padraoBp, funcionariaMuda }: { padraoBp: number; funcionariaMuda: boolean }) {
  const t = useT()
  const { executar, ocupado } = useComando()
  const [texto, setTexto] = useState(String(padraoBp / 100).replace('.', ','))
  const [muda, setMuda] = useState(funcionariaMuda)
  const n = Number(texto.replace(',', '.'))
  const valido = texto.trim() !== '' && Number.isFinite(n) && n >= 0 && n <= 100
  const mudou = (valido && Math.round(n * 100) !== padraoBp) || muda !== funcionariaMuda
  return (
    <Cartao className="mb-3" titulo={t('Comissão do salão')} ajuda="Ordem: ajuste na linha do atendimento › % própria do serviço › % da profissional › padrão do salão. Insumos saem antes da divisão.">
      <div className="grid gap-3 sm:grid-cols-2">
        <Campo rotulo="Comissão padrão (%)" ajuda="50 = metade para o salão, metade para a profissional.">
          <Entrada inputMode="decimal" value={texto} onChange={(e) => setTexto(e.target.value)} />
        </Campo>
        <Campo rotulo="Quem muda o % no atendimento?" comoDiv>
          <Escolha<'admin' | 'todos'> rotulo="Quem muda o % no atendimento?" valor={muda ? 'todos' : 'admin'} onChange={(v) => setMuda(v === 'todos')} opcoes={[{ id: 'admin', nome: 'Só o administrador' }, { id: 'todos', nome: 'Funcionárias também' }]} />
        </Campo>
      </div>
      <p className="mt-2 text-xs text-[var(--suave)]">{t('Insumos: a funcionária pode pôr a mais (com motivo); baixar abaixo do catálogo só o administrador.')}</p>
      {mudou && (
        <Botao className="mt-2" disabled={ocupado || !valido} onClick={() => executar('salvarConfig', { comissaoPadraoBp: Math.round(n * 100), comissaoFuncionarioMuda: muda }, t('Salvo.'))}>{t('Salvar')}</Botao>
      )}
    </Cartao>
  )
}
