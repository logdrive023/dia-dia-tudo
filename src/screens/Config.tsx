// SEÇÕES DAS CONFIGURAÇÕES (cada uma com endereço próprio, ver configSecoes.ts): geral e idioma, sócias, formas de
// pagamento, moedas e câmbio automático, módulos (ligar/desligar e CRIAR modalidade sem programar), etapas da compra,
// atributos, unidades, catálogo, usuários, dados (demonstração, backup) e onde os dados ficam (local × API).

import { useEffect, useState } from 'react'
import type { BackendNoAparelho } from '../adapters/noAparelho'
import { espacoUsado, protegerDados } from '../adapters/local/indexeddb'
import { atualizarCambio } from '../app/cambio'
import { carregarDemo } from '../app/demo'
import { MOEDAS, formatar } from '../core/domain/dinheiro'
import { novoId } from '../core/domain/ids'
import { COMISSAO_PADRAO_BP, dividir, memoriaCalculo, pct } from '../core/domain/comissao'
import type { Item } from '../core/domain/tipos'
import { ETAPA_FINAL, type AtributosConfig, type CampoDef, type EtapaDef, type FluxoCompraConfig } from '../core/modulos'
import type { ModuloConfig } from '../core/modulosConfig'
import type { Socio } from '../core/services/contexto'
import { Botao, Campo, Carregando, Cartao, Confirmar, Entrada, Escolha, Info, Janela, Pilula, Selecao, ValorInput, Vazio, cx, loc, moedaPadrao } from '../ui/base'
import { BarraSalvar } from '../ui/barraSalvar'
import { useApp, useAvisoSaida, useComando, useConsulta, useParamTela } from '../ui/contexto'
import { useT } from '../ui/i18n'

export function Geral() {
  const t = useT()
  const { dados } = useConsulta('configuracoes', {})
  const { executar, ocupado } = useComando()
  const [nome, setNome] = useState<string>()
  const sujo = nome !== undefined && nome !== dados?.config.nomeNegocio
  useAvisoSaida(sujo)
  if (!dados) return <Carregando />
  const c = dados.config
  return (
    <div className="max-w-xl">
      <Cartao>
        <div className="space-y-4">
          <Campo rotulo="Nome do negócio"><Entrada value={nome ?? c.nomeNegocio} onChange={(e) => setNome(e.target.value)} /></Campo>
          <Campo rotulo="Idioma / Idioma" comoDiv>
            <div className="flex flex-wrap gap-2">
              {(['pt', 'es'] as const).map((i) => (
                <Botao key={i} variante={c.idioma === i ? 'primario' : 'secundario'} className="min-h-11" onClick={() => executar('salvarConfig', { idioma: i })}>{i === 'pt' ? '🇧🇷 Português' : '🇧🇴 Español'}</Botao>
              ))}
            </div>
            <p className="mt-1 text-xs text-[var(--suave)]">{t('O idioma muda na hora, para todo o sistema.')}</p>
          </Campo>
        </div>
      </Cartao>
      <BarraSalvar sujo={sujo}>
        {sujo && <Botao variante="leve" onClick={() => setNome(undefined)}>{t('Desfazer')}</Botao>}
        <Botao disabled={ocupado || !sujo} onClick={() => executar('salvarConfig', { nomeNegocio: nome }, t('Salvo.'))}>{t('Salvar')}</Botao>
      </BarraSalvar>
    </div>
  )
}

export function Socias() {
  const t = useT()
  const { dados } = useConsulta('configuracoes', {})
  const { executar, ocupado } = useComando()
  const [socios, setSocios] = useState<Socio[]>()
  useAvisoSaida(socios !== undefined)
  if (!dados) return <Carregando />
  const lista = socios ?? dados.config.socios
  const soma = lista.reduce((s, x) => s + x.parteBp, 0)
  return (
    <div className="max-w-xl">
      <Cartao titulo={t('Divisão do lucro')} ajuda="O resultado do período é dividido pelas partes (ex.: 50% + 50% = o “÷ 2” do caderno).">
        <ul className="space-y-2">
          {lista.map((s, i) => (
            <li key={s.id} className="grid grid-cols-[1fr_6rem_auto] items-center gap-2">
              <Entrada aria-label={t('Nome')} value={s.nome} onChange={(e) => setSocios(lista.map((x, k) => (k === i ? { ...x, nome: e.target.value } : x)))} />
              <Entrada aria-label="%" inputMode="decimal" value={String(s.parteBp / 100)} onChange={(e) => setSocios(lista.map((x, k) => (k === i ? { ...x, parteBp: Math.round(Number(e.target.value.replace(',', '.')) * 100) || 0 } : x)))} />
              <button type="button" className="min-h-11 min-w-11 rounded-lg text-xl" aria-label={t('Tirar')} onClick={() => setSocios(lista.filter((_, k) => k !== i))}>×</button>
            </li>
          ))}
        </ul>
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
          <Botao variante="secundario" onClick={() => setSocios([...lista, { id: novoId(), nome: '', parteBp: 0 }])}>+ {t('Sócia')}</Botao>
          <span className={cx('num text-sm', soma === 10000 ? 'text-[var(--suave)]' : 'font-semibold text-[var(--alerta)]')}>{t('Total')}: {(soma / 100).toLocaleString(loc())}%</span>
        </div>
      </Cartao>
      <BarraSalvar sujo={socios !== undefined}>
        {socios && <Botao variante="leve" onClick={() => setSocios(undefined)}>{t('Desfazer')}</Botao>}
        <Botao disabled={!socios || ocupado} onClick={async () => (await executar('salvarConfig', { socios }, t('Salvo.'))) && setSocios(undefined)}>{t('Salvar')}</Botao>
      </BarraSalvar>
    </div>
  )
}

export function FormasPagamento() {
  const t = useT()
  const { dados } = useConsulta('configuracoes', {})
  if (!dados) return <Carregando />
  return (
    <Cartao>
      <ul className="divide-y divide-[var(--borda)]">
        {dados.config.formas.map((f) => (
          <li key={f.id} className="flex min-h-12 flex-wrap items-center gap-2 py-2">
            <span aria-hidden className="text-xl">{f.vivo ? '💵' : '🏦'}</span>
            <span className="flex-1 font-semibold">{t(f.nome)}</span>
            <Pilula tom={f.vivo ? 'bom' : 'marca'}>{f.moedas.join(', ')}</Pilula>
          </li>
        ))}
      </ul>
    </Cartao>
  )
}

export function Moedas() {
  const t = useT()
  const { backend, avisar } = useApp()
  const { dados } = useConsulta('configuracoes', {})
  const { dados: cambio } = useConsulta('cambio', {})
  const { executar } = useComando()
  const [buscando, setBuscando] = useState(false)
  if (!dados || !cambio) return <Carregando />
  const c = dados.config
  const p = cambio.principal
  const n4 = (v?: number) => (v === undefined ? '—' : v.toLocaleString(loc(), { maximumFractionDigits: v >= 100 ? 2 : 4 }))
  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
        <Cartao titulo={t('Moeda principal')} ajuda="Os totais e relatórios são mostrados nela. Cada lançamento guarda a cotação do dia: o passado não muda.">
          <Selecao valor={c.moedaPrincipal} onChange={(v) => executar('salvarConfig', { moedaPrincipal: v }, t('Salvo.'))} opcoes={MOEDAS.map((m) => ({ id: m.codigo, nome: `${m.simbolo} ${m.nome} (${m.pais})` }))} />
          <div className="mt-3 flex flex-wrap gap-3">
            {MOEDAS.map((m) => (
              <label key={m.codigo} className="flex items-center gap-1 text-sm"><input type="checkbox" className="h-5 w-5" checked={c.moedasAtivas.includes(m.codigo)} onChange={(e) => executar('salvarConfig', { moedasAtivas: e.target.checked ? [...c.moedasAtivas, m.codigo] : c.moedasAtivas.filter((x) => x !== m.codigo) })} /> {m.codigo}</label>
            ))}
          </div>
        </Cartao>
        <Cartao titulo={t('Base da internet (guardada no aparelho)')} ajuda="Quando tem internet, o app busca a cotação de mercado e GUARDA aqui. Sem internet, usa a última guardada e mostra a data. Ex.: buscou às 08:00; ficou sem internet às 15:00 → as vendas usam a de 08:00.">
          <div className="space-y-2">
            <Selecao valor={c.cambioAuto} onChange={(v) => executar('salvarConfig', { cambioAuto: v as 'inicioDoDia' })} opcoes={[{ id: 'inicioDoDia', nome: t('Uma vez no começo do dia (todas as vendas do dia usam a mesma)') }, { id: 'momento', nome: t('Na hora de usar (atualiza a cada hora)') }, { id: 'desligado', nome: t('Desligado (só manual)') }]} />
            <Botao variante="secundario" disabled={buscando} onClick={async () => { setBuscando(true); const r = await atualizarCambio(backend, { forcar: true }); setBuscando(false); avisar(t(r.mensagem), r.ok ? 'ok' : 'erro') }}>⟳ {t(buscando ? 'Buscando…' : 'Buscar agora')}</Botao>
            {cambio.status ? (
              <p className={cx('rounded-xl p-2 text-sm', cambio.status.ok ? 'bg-[var(--bom)]/10 text-[var(--bom)]' : 'bg-[var(--alerta)]/10 text-[var(--alerta)]')}>
                {cambio.status.ok ? '✓' : '⚠️'} {t(cambio.status.mensagem)} · {new Date(cambio.status.em).toLocaleString(loc())}
                {!cambio.status.ok && cambio.status.ultimaOk && <> · {t('última base boa')}: {new Date(cambio.status.ultimaOk).toLocaleString(loc())}</>}
              </p>
            ) : <p className="text-sm text-[var(--suave)]">{t('Ainda não buscou na internet.')}</p>}
          </div>
        </Cartao>
      </div>

      <div className="grid gap-4 2xl:grid-cols-2">
        {cambio.moedas.map((m) => <CambioMoeda key={m.moeda} m={m} principal={p} n4={n4} />)}
      </div>

      <Cartao titulo={t('Histórico de cotações')} ajuda="Toda cotação fica guardada com data e origem (internet ou digitada). Cada venda guarda a que usou: mudar o câmbio não muda o passado.">
        <ul className="max-h-64 overflow-y-auto text-sm">
          {cambio.historico.map((h) => (
            <li key={h.id} className="flex flex-wrap items-center gap-2 border-t border-[var(--borda)] py-1">
              <span className="text-xs text-[var(--suave)]">{new Date(h.em).toLocaleString(loc())}</span>
              <span className="num">{h.texto}</span>
              <Pilula tom={h.fonte === 'auto' ? 'marca' : 'neutro'}>{t(h.fonte === 'auto' ? 'internet' : 'digitada')}</Pilula>
              {h.uso !== 'base' && <Pilula tom="alerta">{t(h.uso === 'venda' ? 'fixa · venda' : 'fixa · compra')}</Pilula>}
            </li>
          ))}
        </ul>
      </Cartao>
    </div>
  )
}

type LinhaCambio = { moeda: string; modo: 'dinamico' | 'fixo'; ajusteVendaBp: number; ajusteCompraBp: number; base?: number; venda?: number; compra?: number; baseData?: string; baseFonte: string; fixoVenda?: string; fixoCompra?: string; fixoData?: string }

/** Um cartão por moeda: Dinâmico (internet ± ajuste) ou Fixo (valores digitados), com venda e compra lado a lado. */
function CambioMoeda({ m, principal, n4 }: { m: LinhaCambio; principal: string; n4(v?: number): string }) {
  const t = useT()
  const { executar, ocupado } = useComando()
  const [modo, setModo] = useState(m.modo)
  const [ajV, setAjV] = useState(String(m.ajusteVendaBp / 100))
  const [ajC, setAjC] = useState(String(m.ajusteCompraBp / 100))
  const [fixV, setFixV] = useState(m.fixoVenda ?? '')
  const [fixC, setFixC] = useState(m.fixoCompra ?? '')
  const bp = (x: string) => Math.round(Number(x.replace(',', '.') || 0) * 100)
  const previa = (aj: string) => (m.base !== undefined ? m.base * (1 + bp(aj) / 10000) : undefined)
  const info = MOEDAS.find((x) => x.codigo === m.moeda)
  return (
    <Cartao
      titulo={<>{info?.simbolo} {info?.nome} ({m.moeda})</>}
      acao={
        <div className="flex rounded-xl bg-[var(--marca-suave)] p-1">
          {(['dinamico', 'fixo'] as const).map((x) => (
            <button key={x} type="button" onClick={() => setModo(x)} className={cx('min-h-9 rounded-lg px-3 text-sm font-semibold', modo === x ? 'bg-[var(--cartao)] text-[var(--marca)] shadow' : 'text-[var(--suave)]')}>
              {t(x === 'dinamico' ? 'Dinâmico' : 'Fixo')}
            </button>
          ))}
        </div>
      }
    >
      <p className="mb-3 text-sm text-[var(--suave)]">
        {t('Base')}: <b className="num text-[var(--texto)]">1 {m.moeda} = {n4(m.base)} {principal}</b>
        {m.baseData && <> · {t(m.baseFonte === 'auto' ? 'internet' : 'digitada')} {new Date(m.baseData).toLocaleString(loc())}</>}
        <Info texto={modo === 'dinamico' ? 'Dinâmico: venda e compra seguem a base da internet, com um ajuste em % se quiser. Ex.: base 6,96; venda −1,5% = 6,8556 (recebo dólar valendo um pouco menos); compra +1% = 7,0296.' : 'Fixo: você decide o valor e ele não muda com a internet. Ex.: para vender 1 USD = 6,90; para comprar 1 USD = 7,00.'} />
      </p>
      {modo === 'dinamico' ? (
        <div className="grid grid-cols-2 gap-3">
          <Campo rotulo="Venda: ajuste %" ajuda="Usado quando a cliente paga nesta moeda (venda, recebimento). Negativo = a moeda vale menos para você. Ex.: −1,5.">
            <Entrada inputMode="decimal" value={ajV} onChange={(e) => setAjV(e.target.value)} />
            <span className="num mt-1 block text-sm">= 1 {m.moeda} = <b>{n4(previa(ajV))}</b> {principal}</span>
          </Campo>
          <Campo rotulo="Compra: ajuste %" ajuda="Usado quando você paga nesta moeda (compra, pagamento a fornecedor). Ex.: +1.">
            <Entrada inputMode="decimal" value={ajC} onChange={(e) => setAjC(e.target.value)} />
            <span className="num mt-1 block text-sm">= 1 {m.moeda} = <b>{n4(previa(ajC))}</b> {principal}</span>
          </Campo>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          <Campo rotulo={`${t('Para vender')}: 1 ${m.moeda} =`} ajuda="Quando a cliente paga nesta moeda. Ex.: 6,90.">
            <div className="flex items-center gap-1"><Entrada inputMode="decimal" value={fixV} placeholder={n4(m.base)} onChange={(e) => setFixV(e.target.value)} /><span className="text-sm">{principal}</span></div>
          </Campo>
          <Campo rotulo={`${t('Para comprar')}: 1 ${m.moeda} =`} ajuda="Quando você paga nesta moeda. Ex.: 7,00.">
            <div className="flex items-center gap-1"><Entrada inputMode="decimal" value={fixC} placeholder={n4(m.base)} onChange={(e) => setFixC(e.target.value)} /><span className="text-sm">{principal}</span></div>
          </Campo>
          {m.fixoData && <p className="col-span-2 text-xs text-[var(--suave)]">{t('Valores fixos desde')} {new Date(m.fixoData).toLocaleString(loc())}</p>}
        </div>
      )}
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
        <span className="num text-xs text-[var(--suave)]">{t('Em uso agora')}: {t('venda')} {n4(m.venda)} · {t('compra')} {n4(m.compra)}</span>
        <Botao
          disabled={ocupado}
          onClick={() =>
            executar(
              'salvarCambio',
              modo === 'dinamico'
                ? { moeda: m.moeda, modo, ajusteVendaBp: bp(ajV), ajusteCompraBp: bp(ajC) }
                : { moeda: m.moeda, modo, fixoVenda: fixV !== m.fixoVenda ? fixV : undefined, fixoCompra: fixC !== m.fixoCompra ? fixC : undefined, idVenda: novoId(), idCompra: novoId() },
              t('Câmbio salvo.'),
            )
          }
        >
          {t('Salvar')}
        </Botao>
      </div>
    </Cartao>
  )
}

export function Modulos() {
  const t = useT()
  const { dados } = useConsulta('configuracoes', {})
  const { executar } = useComando()
  const [criar, setCriar] = useState<ModuloConfig>()
  if (!dados) return <Carregando />
  const ativos = dados.config.modulosAtivos
  return (
    <div className="space-y-4">
      <p className="text-sm text-[var(--suave)]">{t('Ligue só o que o negócio usa: menus, painel e relatórios se ajustam sozinhos.')}</p>
      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
        {dados.modulos.map((m) => (
          <Cartao key={m.id} titulo={<>{m.icone} {t(m.nome)} {m.personalizado && <Pilula tom="marca">{t('criado por você')}</Pilula>}</>} acao={
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" className="h-6 w-6" checked={ativos.includes(m.id)} onChange={(e) => executar('salvarConfig', { modulosAtivos: e.target.checked ? [...ativos, m.id] : ativos.filter((x) => x !== m.id) })} /> {t('Ligado')}</label>
          }>
            <p className="text-sm text-[var(--suave)]">{t(m.descricao)}</p>
            <div className="mt-2 flex flex-wrap gap-1 text-xs">
              {m.temCompra && <Pilula>{t('compra + triagem')}</Pilula>}
              {m.temVenda && <Pilula>{t('venda')}</Pilula>}
              {(m.recursos?.agenda || m.id === 'salao') && <Pilula>{t('agenda')}</Pilula>}
              {(m.recursos?.tabelaPreco || m.id === 'cabelo') && <Pilula>{t('tabela de preço')}</Pilula>}
              {m.telaPropria && <Pilula>{t('tela própria')}</Pilula>}
            </div>
            {m.personalizado && <Botao variante="leve" className="mt-2" onClick={() => setCriar(dados.personalizados.find((x) => x.id === m.id))}>{t('Editar')}</Botao>}
          </Cartao>
        ))}
        <button type="button" onClick={() => setCriar({ id: '', nome: '', icone: '📦', recursos: { estoque: 'peca' }, campos: [] })} className="min-h-32 rounded-2xl border-2 border-dashed border-[var(--marca)] p-4 text-left text-[var(--marca)]">
          <div className="text-2xl">＋</div>
          <div className="font-bold">{t('Criar nova modalidade')}</div>
          <div className="text-sm">{t('Ex.: óculos, roupas, aluguel, serviços gerais… escolhendo recursos que já existem.')}</div>
        </button>
      </div>
      {criar && <CriarModalidade inicial={criar} onFechar={() => setCriar(undefined)} />}
    </div>
  )
}

function CriarModalidade({ inicial, onFechar }: { inicial: ModuloConfig; onFechar(): void }) {
  const t = useT()
  const { executar, ocupado } = useComando()
  const [m, setM] = useState<ModuloConfig>(inicial)
  const [etapas, setEtapas] = useState((inicial.recursos.triagem ?? []).join(', '))
  const r = m.recursos
  const setR = (d: Partial<ModuloConfig['recursos']>) => setM({ ...m, recursos: { ...r, ...d } })
  const salvar = async () => {
    const id = m.id || m.nome.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 30)
    const ok = await executar('salvarModulo', { ...m, id, recursos: { ...r, triagem: etapas.split(',').map((x) => x.trim()).filter(Boolean) } }, t('Modalidade salva e ligada.'))
    if (ok) onFechar()
  }
  return (
    <Janela aberta larga titulo={t('Nova modalidade')} onFechar={onFechar} rodape={<Botao grande className="w-full" disabled={ocupado || !m.nome.trim()} onClick={salvar}>{t('Salvar modalidade')}</Botao>}>
      <div className="space-y-4">
        <div className="grid grid-cols-[5rem_1fr] gap-2">
          <Campo rotulo="Ícone"><Entrada value={m.icone} onChange={(e) => setM({ ...m, icone: e.target.value })} /></Campo>
          <Campo rotulo="Nome"><Entrada value={m.nome} placeholder={t('Ex.: Óculos')} onChange={(e) => setM({ ...m, nome: e.target.value })} /></Campo>
        </div>
        <Campo rotulo="Descrição"><Entrada value={m.descricao ?? ''} onChange={(e) => setM({ ...m, descricao: e.target.value })} /></Campo>
        <Cartao titulo={t('Recursos (combine os que já existem)')}>
          <div className="grid gap-3 md:grid-cols-2">
            <Campo rotulo="Estoque"><Selecao valor={r.estoque || ''} onChange={(v) => setR({ estoque: (v || false) as 'peca' })} vazio="Sem estoque (só serviço)" opcoes={[{ id: 'peca', nome: t('Em peças') }, { id: 'grama', nome: t('Em gramas (como o cabelo)') }]} /></Campo>
            {r.estoque && <Campo rotulo="Etapas da triagem na compra (separadas por vírgula)" ajuda="Depois delas vêm “Pago” e “No estoque”."><Entrada value={etapas} placeholder={t('Chegou, Conferido')} onChange={(e) => setEtapas(e.target.value)} /></Campo>}
            {r.estoque && <label className="flex items-center gap-2 text-sm"><input type="checkbox" className="h-5 w-5" checked={!!r.loteNaCompra} onChange={(e) => setR({ loteNaCompra: e.target.checked })} /> {t('Cada compra vira um lote (com rastreio)')}</label>}
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" className="h-5 w-5" checked={!!r.tabelaPreco} onChange={(e) => setR({ tabelaPreco: e.target.checked })} /> {t('Preço pela tabela medida × comprador (multiplicador do cabelo)')}</label>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" className="h-5 w-5" checked={!!r.agenda} onChange={(e) => setR({ agenda: e.target.checked })} /> {t('Atendimento com agenda, unidade e profissional (como o salão)')}</label>
          </div>
        </Cartao>
        <Cartao titulo={t('Campos próprios')}>
          <ul className="space-y-2">
            {m.campos.map((c, i) => (
              <li key={i} className="grid grid-cols-[1fr_8rem_1fr_auto] gap-2">
                <Entrada placeholder={t('Nome do campo')} value={c.nome} onChange={(e) => setM({ ...m, campos: m.campos.map((x, k) => (k === i ? { ...x, nome: e.target.value, id: x.id || e.target.value.toLowerCase().replace(/\W+/g, '') } : x)) })} />
                <Selecao valor={c.tipo} onChange={(v) => setM({ ...m, campos: m.campos.map((x, k) => (k === i ? { ...x, tipo: v as CampoDef['tipo'] } : x)) })} opcoes={[{ id: 'texto', nome: t('Texto') }, { id: 'numero', nome: t('Número') }, { id: 'lista', nome: t('Lista') }, { id: 'simNao', nome: t('Sim/Não') }]} />
                <Entrada placeholder={c.tipo === 'lista' ? t('Opções: A, B, C') : ''} disabled={c.tipo !== 'lista'} value={(c.opcoes ?? []).join(', ')} onChange={(e) => setM({ ...m, campos: m.campos.map((x, k) => (k === i ? { ...x, opcoes: e.target.value.split(',').map((o) => o.trim()).filter(Boolean) } : x)) })} />
                <button type="button" className="px-2 text-xl" aria-label={t('Tirar')} onClick={() => setM({ ...m, campos: m.campos.filter((_, k) => k !== i) })}>×</button>
              </li>
            ))}
          </ul>
          <Botao variante="secundario" className="mt-2" onClick={() => setM({ ...m, campos: [...m.campos, { id: '', nome: '', tipo: 'texto' }] })}>+ {t('Campo')}</Botao>
        </Cartao>
      </div>
    </Janela>
  )
}

// ---------- atributos do item (campos dinâmicos, sem programar) ----------

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
      <Cartao titulo={t('Atributos do sistema')} ajuda="Os marcados com 🔒 não podem ser escondidos: o nome do lote, o preço e a separação dependem deles.">
        <ul className="divide-y divide-[var(--borda)]">
          {item.padrao.map((f) => {
            const oculto = c.ocultos.includes(f.id)
            return (
              <li key={f.id} className="py-2">
                <div className="flex flex-wrap items-center gap-2">
                  <span className={cx('flex-1 font-semibold', oculto && 'text-[var(--suave)] line-through')}>{t(f.nome)}{f.unidade ? ` (${f.unidade})` : ''}</span>
                  <Pilula>{t(TIPOS_CAMPO.find((x) => x.id === f.tipo)?.nome ?? f.tipo)}</Pilula>
                  {f.fixo ? (
                    <span className="min-w-10 text-center" title={t('Não pode ser escondido')}>🔒</span>
                  ) : (
                    <label className="flex min-h-10 items-center gap-2 text-sm"><input type="checkbox" className="h-5 w-5" checked={!oculto} onChange={() => setC({ ...c, ocultos: oculto ? c.ocultos.filter((x) => x !== f.id) : [...c.ocultos, f.id] })} /> {t('Usar')}</label>
                  )}
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

export function EtapasCompra() {
  const t = useT()
  const { dados } = useConsulta('fluxosCompra', {})
  const [moduloId, setModuloId] = useParamTela('modulo', '')
  if (!dados) return <Carregando />
  if (!dados.length) return <Vazio texto="Nenhum módulo ligado faz compras." />
  const atual = dados.find((d) => d.moduloId === moduloId) ?? dados[0]
  return (
    <div className="space-y-4">
      <p className="text-sm text-[var(--suave)]">{t('Monte o caminho do pedido de compra: quantas etapas, o nome de cada uma, onde se paga e o que conta como pendência. Vale para os pedidos novos e para os que estão andando.')}</p>
      {dados.length > 1 && <Escolha rotulo="Módulo" valor={atual.moduloId} onChange={setModuloId} opcoes={dados.map((d) => ({ id: d.moduloId, nome: `${d.icone} ${t(d.nome)}` }))} />}
      <EditorFluxo key={atual.moduloId + JSON.stringify(atual.fluxo)} item={atual} />
    </div>
  )
}

type ItemFluxo = { moduloId: string; nome: string; personalizado: boolean; fluxo: Required<FluxoCompraConfig>; emUso: Record<string, number> }

function EditorFluxo({ item }: { item: ItemFluxo }) {
  const t = useT()
  const { executar, ocupado } = useComando()
  const [f, setF] = useState(item.fluxo)
  const [padrao, setPadrao] = useState(false)
  const sujo = JSON.stringify(f) !== JSON.stringify(item.fluxo)
  useAvisoSaida(sujo)
  const etapas = f.etapas
  const mudar = (i: number, d: Partial<EtapaDef>) => setF({ ...f, etapas: etapas.map((e, k) => (k === i ? { ...e, ...d } : e)) })
  const alternar = <K extends 'faz' | 'lembrar'>(i: number, campo: K, valor: string) => {
    const lista = (etapas[i][campo] ?? []) as string[]
    mudar(i, { [campo]: lista.includes(valor) ? lista.filter((x) => x !== valor) : [...lista, valor] } as Partial<EtapaDef>)
  }
  const mover = (i: number, d: -1 | 1) => {
    const n = [...etapas]
    ;[n[i], n[i + d]] = [n[i + d], n[i]]
    setF({ ...f, etapas: n })
  }
  const pagaEm = etapas.findIndex((e) => e.faz?.includes('pagamento'))
  const salvar = () => executar('salvarFluxoCompra', { moduloId: item.moduloId, fluxo: f }, t('Etapas salvas.'))
  return (
    <div>
      <div className="grid gap-4 2xl:grid-cols-[1fr_20rem]">
        <Cartao titulo={<>{t('Etapas')} {item.personalizado ? <Pilula tom="marca">{t('personalizado')}</Pilula> : <Pilula>{t('padrão do sistema')}</Pilula>}</>}>
          <ol className="space-y-3">
            {etapas.map((e, i) => {
              const final = e.id === ETAPA_FINAL
              const n = item.emUso[e.id] ?? 0
              return (
                <li key={e.id} className="rounded-2xl border border-[var(--borda)] p-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--marca-suave)] text-sm font-bold text-[var(--marca)]">{i + 1}</span>
                    <Entrada aria-label={t('Nome da etapa')} className="min-w-0 flex-1" value={e.nome} onChange={(ev) => mudar(i, { nome: ev.target.value })} />
                    {n > 0 && <Pilula tom="alerta">{t('{n} pedido(s) aqui', { n })}</Pilula>}
                    {!final && (
                      <span className="flex">
                        <button type="button" aria-label={t('Subir')} disabled={i === 0} onClick={() => mover(i, -1)} className="min-h-10 min-w-10 rounded-lg disabled:opacity-30">↑</button>
                        <button type="button" aria-label={t('Descer')} disabled={i >= etapas.length - 2} onClick={() => mover(i, 1)} className="min-h-10 min-w-10 rounded-lg disabled:opacity-30">↓</button>
                        <button type="button" aria-label={t('Tirar')} disabled={n > 0 || etapas.length <= 2} title={n > 0 ? t('Há pedidos nesta etapa') : undefined} onClick={() => setF({ ...f, etapas: etapas.filter((_, k) => k !== i) })} className="min-h-10 min-w-10 rounded-lg text-xl disabled:opacity-30">×</button>
                      </span>
                    )}
                  </div>
                  <Entrada aria-label={t('O que fazer nesta etapa')} className="mt-2 text-sm" placeholder={t('O que fazer nesta etapa (aparece no ⓘ)')} value={e.ajuda} onChange={(ev) => mudar(i, { ajuda: ev.target.value })} />
                  <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm">
                    {final ? (
                      <span className="flex min-h-10 items-center text-[var(--suave)]">📦 {t('Aqui o pedido termina e entra no estoque (sempre a última).')}</span>
                    ) : (
                      <label className="flex min-h-10 items-center gap-2"><input type="checkbox" className="h-5 w-5" checked={!!e.faz?.includes('pagamento')} disabled={pagaEm >= 0 && pagaEm !== i} onChange={() => alternar(i, 'faz', 'pagamento')} /> 💰 {t('Cobra o pagamento aqui')}</label>
                    )}
                    <label className="flex min-h-10 items-center gap-2"><input type="checkbox" className="h-5 w-5" checked={!!e.lembrar?.includes('fotos')} onChange={() => alternar(i, 'lembrar', 'fotos')} /> 📷 {t('Lembrar das fotos')}</label>
                    <label className="flex min-h-10 items-center gap-2"><input type="checkbox" className="h-5 w-5" checked={!!e.lembrar?.includes('comprovante')} onChange={() => alternar(i, 'lembrar', 'comprovante')} /> 🧾 {t('Lembrar do comprovante')}</label>
                  </div>
                </li>
              )
            })}
          </ol>
          <Botao variante="secundario" className="mt-3" disabled={etapas.length >= 10} onClick={() => setF({ ...f, etapas: [...etapas.slice(0, -1), { id: novoId().toLowerCase().slice(-10), nome: '', ajuda: '' }, etapas[etapas.length - 1]] })}>
            + {t('Etapa')}
          </Botao>
        </Cartao>
        <div className="space-y-4">
          <Cartao titulo={t('O que conta como “falta”')} ajuda="Aparece no pedido, na lista de pedidos e no “Atenção agora” do painel.">
            <div className="space-y-1 text-sm">
              <label className="flex min-h-10 items-center gap-2"><input type="checkbox" className="h-5 w-5" checked={f.pedirFotos} onChange={(e) => setF({ ...f, pedirFotos: e.target.checked })} /> {t('Sem fotos')}</label>
              <label className="flex min-h-10 items-center gap-2"><input type="checkbox" className="h-5 w-5" checked={f.pedirComprovanteOrigem} onChange={(e) => setF({ ...f, pedirComprovanteOrigem: e.target.checked })} /> {t('Sem comprovante de origem')}</label>
              <p className="pt-1 text-[var(--suave)]">💰 {t('Falta pagar: depois da etapa que cobra o pagamento.')}</p>
              <Campo rotulo="Parada na triagem depois de (dias)" className="pt-2">
                <Entrada inputMode="numeric" className="w-24" value={String(f.avisarParadaDias)} onChange={(e) => setF({ ...f, avisarParadaDias: Math.max(0, Math.round(Number(e.target.value.replace(/\D/g, '')) || 0)) })} />
              </Campo>
            </div>
          </Cartao>
          <Cartao titulo={t('Como vai ficar')}>
            <ol className="flex flex-wrap items-center gap-1 text-sm">
              {etapas.map((e, i) => (
                <li key={e.id} className="flex items-center gap-1">
                  <span className="rounded-full bg-[var(--marca-suave)] px-2 py-1 font-semibold text-[var(--marca)]">{i + 1}. {e.nome || '…'}{e.faz?.includes('pagamento') ? ' 💰' : ''}{e.id === ETAPA_FINAL ? ' 📦' : ''}</span>
                  {i < etapas.length - 1 && <span aria-hidden className="text-[var(--suave)]">→</span>}
                </li>
              ))}
            </ol>
          </Cartao>
        </div>
      </div>
      <BarraSalvar sujo={sujo}>
        {item.personalizado && !sujo && <Botao variante="leve" onClick={() => setPadrao(true)}>{t('Voltar ao padrão')}</Botao>}
        {sujo && <Botao variante="leve" onClick={() => setF(item.fluxo)}>{t('Desfazer')}</Botao>}
        <Botao disabled={!sujo || ocupado || etapas.some((e) => !e.nome.trim())} onClick={salvar}>{t('Salvar etapas')}</Botao>
      </BarraSalvar>
      {padrao && <Confirmar titulo="Voltar ao padrão?" texto="As etapas voltam a ser as do sistema. Pedidos parados numa etapa que deixa de existir impedem a troca." rotulo="Voltar ao padrão" onConfirmar={() => executar('salvarFluxoCompra', { moduloId: item.moduloId, fluxo: null }, t('Etapas do sistema de volta.'))} onFechar={() => setPadrao(false)} />}
    </div>
  )
}

export function Unidades() {
  const t = useT()
  const { dados } = useConsulta('locais', {})
  const { executar, ocupado } = useComando()
  const [ed, setEd] = useState<{ id: string; nome: string; tipo: 'salao' | 'ponto' | 'outro'; rua?: string; numero?: string; bairro?: string; cidade?: string; pais?: string; referencia?: string }>()
  return (
    <div>
      <Botao className="mb-3" onClick={() => setEd({ id: novoId(), nome: '', tipo: 'salao' })}>+ {t('Unidade / endereço')}</Botao>
      {!dados ? <Carregando /> : !dados.length ? <Vazio texto="Nenhuma unidade." /> : (
        <ul className="grid gap-2 md:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">{dados.map((l) => <li key={l.id}><button type="button" className="w-full rounded-xl border border-[var(--borda)] bg-[var(--cartao)] p-3 text-left" onClick={() => setEd({ ...l })}><b>{l.nome}</b> <Pilula>{t(l.tipo === 'salao' ? 'salão' : l.tipo)}</Pilula><div className="text-sm text-[var(--suave)]">{[l.rua, l.numero, l.bairro, l.cidade, l.pais].filter(Boolean).join(', ')}</div></button></li>)}</ul>
      )}
      {ed && (
        <Janela aberta titulo={t('Unidade')} onFechar={() => setEd(undefined)} rodape={<Botao grande className="w-full" disabled={ocupado} onClick={async () => (await executar('salvarLocal', ed, t('Salvo.'))) && setEd(undefined)}>{t('Salvar')}</Botao>}>
          <div className="grid gap-2 sm:grid-cols-2">
            <Campo rotulo="Nome"><Entrada value={ed.nome} onChange={(e) => setEd({ ...ed, nome: e.target.value })} /></Campo>
            <Campo rotulo="Tipo"><Selecao valor={ed.tipo} onChange={(v) => setEd({ ...ed, tipo: v as 'salao' })} opcoes={[{ id: 'salao', nome: t('Salão') }, { id: 'ponto', nome: t('Ponto / depósito') }, { id: 'outro', nome: t('Outro') }]} /></Campo>
            {(['rua', 'numero', 'bairro', 'cidade', 'pais', 'referencia'] as const).map((k) => <Campo key={k} rotulo={k}><Entrada value={ed[k] ?? ''} onChange={(e) => setEd({ ...ed, [k]: e.target.value })} /></Campo>)}
          </div>
        </Janela>
      )}
    </div>
  )
}

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
        <Janela aberta titulo={t(ed.novo ? 'Novo' : 'Editar')} onFechar={() => setEd(undefined)} rodape={<Botao grande className="w-full" disabled={ocupado} onClick={salvar}>{t('Salvar')}</Botao>}>
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
        </Janela>
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

export function Dados() {
  const t = useT()
  const { backend, avisar } = useApp()
  const [protegido, setProtegido] = useState<boolean>()
  const [espaco, setEspaco] = useState<{ usado: number; total: number }>()
  const [confirmar, setConfirmar] = useState<'demo' | 'zerar'>()
  const [ocupado, setOcupado] = useState(false)
  const { dados: diag } = useConsulta('diagnostico', {})
  useEffect(() => {
    if (backend.tipo === 'local') {
      protegerDados().then(setProtegido)
      espacoUsado().then(setEspaco)
    }
  }, [backend])
  const exportar = async () => {
    const b = await backend.exportar()
    const url = URL.createObjectURL(new Blob([JSON.stringify(b)], { type: 'application/json' }))
    const a = document.createElement('a')
    a.href = url
    a.download = `backup-tudo-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }
  const acao = async () => {
    setOcupado(true)
    try {
      if (confirmar === 'demo') await carregarDemo(backend as BackendNoAparelho)
      else await backend.limparTudo()
      avisar(t(confirmar === 'demo' ? 'Dados de exemplo carregados.' : 'Tudo zerado.'), 'ok')
    } catch (e) {
      avisar(e instanceof Error ? e.message : String(e), 'erro')
    } finally {
      setOcupado(false)
      setConfirmar(undefined)
    }
  }
  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
      <Cartao titulo={t('Onde os dados ficam')} ajuda="Hoje tudo fica neste aparelho (demonstração). Para ligar um servidor: VITE_STORAGE=api e VITE_API_URL — telas e regras não mudam.">
        <p className="text-sm">{t('Armazenamento')}: <Pilula tom="marca">{backend.tipo === 'local' ? t('neste aparelho (IndexedDB)') : backend.tipo === 'api' ? 'API' : t('memória')}</Pilula></p>
        {backend.tipo === 'local' && <p className="mt-1 text-sm">{t('Proteção contra limpeza do navegador')}: <Pilula tom={protegido ? 'bom' : 'alerta'}>{protegido ? t('protegido') : t('não garantido')}</Pilula></p>}
        {espaco && <p className="mt-1 text-sm">{t('Espaço usado')}: {(espaco.usado / 1e6).toFixed(1)} MB {t('de')} {(espaco.total / 1e9).toFixed(1)} GB</p>}
        <p className="mt-2 text-sm">{t('Conferência das contas')}: {diag ? <Pilula tom={diag.ok ? 'bom' : 'ruim'}>{diag.ok ? t('tudo bate ✓') : `${diag.problemas.length} ${t('problema(s)')}`}</Pilula> : '…'}</p>
        {diag && !diag.ok && <ul className="mt-1 text-xs text-[var(--ruim)]">{diag.problemas.slice(0, 5).map((p) => <li key={p}>{p}</li>)}</ul>}
      </Cartao>
      <Cartao titulo={t('Backup')}>
        <div className="flex flex-wrap gap-2">
          <Botao onClick={exportar}>⬇️ {t('Baixar backup (JSON)')}</Botao>
          <label className="inline-flex min-h-10 cursor-pointer items-center rounded-xl bg-[var(--marca-suave)] px-4 text-sm font-semibold text-[var(--marca)]">
            ⬆️ {t('Restaurar backup')}
            <input type="file" accept="application/json" className="hidden" onChange={async (e) => {
              const f = e.target.files?.[0]
              e.target.value = ''
              if (!f) return
              try {
                await backend.importar(JSON.parse(await f.text()))
                avisar(t('Backup restaurado.'), 'ok')
              } catch (err) {
                avisar(err instanceof Error ? err.message : String(err), 'erro')
              }
            }} />
          </label>
        </div>
        <p className="mt-2 text-xs text-[var(--suave)]">{t('O backup leva tudo, inclusive fotos e comprovantes. Serve também para levar a demonstração para outro aparelho.')}</p>
      </Cartao>
      {backend.tipo !== 'api' && (
        <Cartao titulo={t('Demonstração')} className="md:col-span-2 lg:col-span-1 xl:col-span-2">
          <div className="flex flex-wrap gap-2">
            <Botao onClick={() => setConfirmar('demo')}>{t('Carregar dados de exemplo')}</Botao>
            <Botao variante="perigo" onClick={() => setConfirmar('zerar')}>{t('Zerar tudo')}</Botao>
          </div>
          <p className="mt-2 text-xs text-[var(--suave)]">{t('Antes de zerar, baixe um backup se quiser voltar depois.')}</p>
        </Cartao>
      )}
      <Janela aberta={!!confirmar} titulo={t('Tem certeza?')} onFechar={() => setConfirmar(undefined)} rodape={<Botao grande variante={confirmar === 'zerar' ? 'perigo' : 'primario'} className="w-full" disabled={ocupado} onClick={acao}>{ocupado ? t('Aguarde…') : t('Sim, continuar')}</Botao>}>
        <p>{t(confirmar === 'demo' ? 'Os dados atuais serão trocados pelos dados de exemplo.' : 'Todos os dados deste aparelho serão apagados.')}</p>
      </Janela>
    </div>
  )
}


/** Usuários: quem entra no sistema, com qual perfil, ligado a qual pessoa/unidade. Toda ação fica no nome dele. */
export function Usuarios() {
  const t = useT()
  const { sessao } = useApp()
  const { dados } = useConsulta('usuarios', {})
  const { dados: pessoas } = useConsulta('pessoas', {})
  const { dados: locais } = useConsulta('locais', {})
  const { executar, ocupado } = useComando()
  const [ed, setEd] = useState<{ id: string; login: string; nome: string; perfil: 'admin' | 'funcionario'; pessoaId?: string; localId?: string; senha?: string; ativo: boolean; novo: boolean }>()
  const [minha, setMinha] = useState<{ atual: string; nova: string }>()
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <Botao onClick={() => setEd({ id: novoId(), login: '', nome: '', perfil: 'funcionario', ativo: true, novo: true })}>+ {t('Usuário')}</Botao>
        <Botao variante="secundario" onClick={() => setMinha({ atual: '', nova: '' })}>{t('Trocar minha senha')}</Botao>
      </div>
      <p className="flex items-center text-sm text-[var(--suave)]">{t('Cada ação do sistema fica registrada no nome do usuário que entrou.')}<Info texto="Administrador vê e faz tudo. Funcionário só vende/atende, vê a própria agenda, a unidade e as próprias comissões. Ex.: Sofia entra e vê só os horários dela." /></p>
      {!dados ? <Carregando /> : (
        <ul className="grid gap-2 md:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
          {dados.map((u) => (
            <li key={u.id}>
              <button type="button" className={cx('w-full rounded-xl border bg-[var(--cartao)] p-3 text-left', u.ativo ? 'border-[var(--borda)]' : 'border-dashed border-[var(--borda)] opacity-60')} onClick={() => setEd({ id: u.id, login: u.login, nome: u.nome, perfil: u.perfil, pessoaId: u.pessoaId, localId: u.localId, ativo: u.ativo, novo: false })}>
                <div className="flex items-center justify-between gap-2"><b>{u.nome}</b><Pilula tom={u.perfil === 'admin' ? 'marca' : 'neutro'}>{t(u.perfil === 'admin' ? 'Administrador' : 'Funcionário')}</Pilula></div>
                <div className="text-xs text-[var(--suave)]"><span className="font-mono">{u.login}</span>{u.local ? ` · ${u.local}` : ''}{u.ultimoAcesso ? ` · ${t('último acesso')} ${new Date(u.ultimoAcesso).toLocaleString(loc())}` : ''}{!u.ativo ? ` · ${t('desativado')}` : ''}</div>
              </button>
            </li>
          ))}
        </ul>
      )}
      {ed && (
        <Janela aberta titulo={t(ed.novo ? 'Novo usuário' : 'Editar usuário')} onFechar={() => setEd(undefined)} rodape={<Botao grande className="w-full" disabled={ocupado} onClick={async () => (await executar('salvarUsuario', { id: ed.id, login: ed.login, nome: ed.nome, perfil: ed.perfil, pessoaId: ed.pessoaId, localId: ed.localId, senha: ed.senha || undefined, ativo: ed.ativo }, t('Salvo.'))) && setEd(undefined)}>{t('Salvar')}</Botao>}>
          <div className="grid gap-3 sm:grid-cols-2">
            <Campo rotulo="Usuário (para entrar)" ajuda="Letras minúsculas, sem espaço. Ex.: sofia"><Entrada autoCapitalize="none" value={ed.login} onChange={(e) => setEd({ ...ed, login: e.target.value })} /></Campo>
            <Campo rotulo="Nome"><Entrada value={ed.nome} onChange={(e) => setEd({ ...ed, nome: e.target.value })} /></Campo>
            <Campo rotulo="Perfil"><Selecao valor={ed.perfil} onChange={(v) => setEd({ ...ed, perfil: v as 'admin' })} opcoes={[{ id: 'admin', nome: t('Administrador (tudo)') }, { id: 'funcionario', nome: t('Funcionário (só a unidade e a própria agenda)') }]} /></Campo>
            <Campo rotulo={ed.novo ? 'Senha' : 'Nova senha (deixe vazio para manter)'}><Entrada type="password" autoComplete="new-password" value={ed.senha ?? ''} onChange={(e) => setEd({ ...ed, senha: e.target.value })} /></Campo>
            <Campo rotulo="É a pessoa" ajuda="Liga o usuário à funcionária: a agenda e as comissões dela aparecem para ela."><Selecao valor={ed.pessoaId} vazio="—" onChange={(v) => setEd({ ...ed, pessoaId: v || undefined })} opcoes={(pessoas ?? []).filter((p) => p.papeis.includes('funcionario') || p.papeis.includes('profissional')).map((p) => ({ id: p.id, nome: p.nome }))} /></Campo>
            <Campo rotulo="Unidade"><Selecao valor={ed.localId} vazio="Todas" onChange={(v) => setEd({ ...ed, localId: v || undefined })} opcoes={(locais ?? []).map((l) => ({ id: l.id, nome: l.nome }))} /></Campo>
            {!ed.novo && ed.id !== sessao.usuarioId && <label className="flex items-center gap-2 text-sm"><input type="checkbox" className="h-5 w-5" checked={ed.ativo} onChange={(e) => setEd({ ...ed, ativo: e.target.checked })} /> {t('Ativo (pode entrar)')}</label>}
          </div>
        </Janela>
      )}
      {minha && (
        <Janela aberta titulo={t('Trocar minha senha')} onFechar={() => setMinha(undefined)} rodape={<Botao grande className="w-full" disabled={ocupado} onClick={async () => (await executar('trocarMinhaSenha', minha, t('Senha trocada.'))) && setMinha(undefined)}>{t('Salvar')}</Botao>}>
          <div className="space-y-3">
            <Campo rotulo="Senha atual"><Entrada type="password" autoComplete="current-password" value={minha.atual} onChange={(e) => setMinha({ ...minha, atual: e.target.value })} /></Campo>
            <Campo rotulo="Nova senha"><Entrada type="password" autoComplete="new-password" value={minha.nova} onChange={(e) => setMinha({ ...minha, nova: e.target.value })} /></Campo>
          </div>
        </Janela>
      )}
    </div>
  )
}
