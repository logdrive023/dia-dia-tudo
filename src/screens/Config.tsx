// CONFIGURAÇÕES: geral e idioma, moedas e câmbio automático, sócias, módulos (ligar/desligar e CRIAR modalidade
// sem programar), unidades, catálogo, dados (demonstração, backup) e onde os dados ficam (local × API).

import { useEffect, useState } from 'react'
import type { BackendNoAparelho } from '../adapters/noAparelho'
import { espacoUsado, protegerDados } from '../adapters/local/indexeddb'
import { atualizarCambio } from '../app/cambio'
import { carregarDemo } from '../app/demo'
import { MOEDAS, formatar } from '../core/domain/dinheiro'
import { novoId } from '../core/domain/ids'
import type { CampoDef } from '../core/modulos'
import type { ModuloConfig } from '../core/modulosConfig'
import type { Socio } from '../core/services/contexto'
import { Abas, Botao, Campo, Carregando, Cartao, Entrada, Info, Janela, Pilula, Selecao, Titulo, ValorInput, Vazio, cx } from '../ui/base'
import { useApp, useComando, useConsulta } from '../ui/contexto'
import { useT } from '../ui/i18n'

export function Config() {
  const t = useT()
  const { nav } = useApp()
  const [aba, setAba] = useState((nav.params.aba as string) ?? 'geral')
  return (
    <div>
      <Titulo>{t('Configurações')}</Titulo>
      <Abas atual={aba} onChange={setAba} abas={[
        { id: 'geral', nome: 'Geral' },
        { id: 'moedas', nome: 'Moedas e câmbio' },
        { id: 'modulos', nome: 'Módulos' },
        { id: 'unidades', nome: 'Unidades' },
        { id: 'catalogo', nome: 'Catálogo' },
        { id: 'usuarios', nome: 'Usuários' },
        { id: 'dados', nome: 'Dados' },
      ]} />
      {aba === 'geral' && <Geral />}
      {aba === 'moedas' && <Moedas />}
      {aba === 'modulos' && <Modulos />}
      {aba === 'unidades' && <Unidades />}
      {aba === 'catalogo' && <Catalogo />}
      {aba === 'usuarios' && <Usuarios />}
      {aba === 'dados' && <Dados />}
    </div>
  )
}

function Geral() {
  const t = useT()
  const { dados } = useConsulta('configuracoes', {})
  const { executar, ocupado } = useComando()
  const [nome, setNome] = useState<string>()
  const [socios, setSocios] = useState<Socio[]>()
  if (!dados) return <Carregando />
  const c = dados.config
  const lista = socios ?? c.socios
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <Cartao titulo={t('Negócio')}>
        <div className="space-y-3">
          <Campo rotulo="Nome do negócio"><Entrada value={nome ?? c.nomeNegocio} onChange={(e) => setNome(e.target.value)} /></Campo>
          <Campo rotulo="Idioma / Idioma">
            <div className="flex gap-2">
              {(['pt', 'es'] as const).map((i) => (
                <Botao key={i} variante={c.idioma === i ? 'primario' : 'secundario'} onClick={() => executar('salvarConfig', { idioma: i })}>{i === 'pt' ? '🇧🇷 Português' : '🇧🇴 Español'}</Botao>
              ))}
            </div>
          </Campo>
          <Botao disabled={ocupado || nome === undefined} onClick={() => executar('salvarConfig', { nomeNegocio: nome }, t('Salvo.'))}>{t('Salvar')}</Botao>
        </div>
      </Cartao>
      <Cartao titulo={t('Sócias (divisão do lucro)')} ajuda="O resultado do período é dividido pelas partes (ex.: 50% + 50% = o “÷ 2” do caderno).">
        <ul className="space-y-2">
          {lista.map((s, i) => (
            <li key={s.id} className="grid grid-cols-[1fr_6rem_auto] gap-2">
              <Entrada value={s.nome} onChange={(e) => setSocios(lista.map((x, k) => (k === i ? { ...x, nome: e.target.value } : x)))} />
              <Entrada inputMode="decimal" value={String(s.parteBp / 100)} onChange={(e) => setSocios(lista.map((x, k) => (k === i ? { ...x, parteBp: Math.round(Number(e.target.value.replace(',', '.')) * 100) || 0 } : x)))} />
              <button type="button" className="px-2 text-xl" aria-label={t('Tirar')} onClick={() => setSocios(lista.filter((_, k) => k !== i))}>×</button>
            </li>
          ))}
        </ul>
        <div className="mt-2 flex gap-2">
          <Botao variante="secundario" onClick={() => setSocios([...lista, { id: novoId(), nome: '', parteBp: 0 }])}>+ {t('Sócia')}</Botao>
          <Botao disabled={!socios || ocupado} onClick={async () => (await executar('salvarConfig', { socios }, t('Salvo.'))) && setSocios(undefined)}>{t('Salvar')}</Botao>
        </div>
      </Cartao>
      <Cartao titulo={t('Formas de pagamento')} className="md:col-span-2">
        <ul className="flex flex-wrap gap-2 text-sm">{c.formas.map((f) => <li key={f.id}><Pilula tom={f.vivo ? 'bom' : 'marca'}>{f.vivo ? '💵' : '🏦'} {t(f.nome)} · {f.moedas.join(', ')}</Pilula></li>)}</ul>
      </Cartao>
    </div>
  )
}

function Moedas() {
  const t = useT()
  const { backend, avisar } = useApp()
  const { dados } = useConsulta('configuracoes', {})
  const { dados: cambio } = useConsulta('cambio', {})
  const { executar } = useComando()
  const [buscando, setBuscando] = useState(false)
  if (!dados || !cambio) return <Carregando />
  const c = dados.config
  const p = cambio.principal
  const n4 = (v?: number) => (v === undefined ? '—' : v.toLocaleString('pt-BR', { maximumFractionDigits: v >= 100 ? 2 : 4 }))
  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-2">
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
                {cambio.status.ok ? '✓' : '⚠️'} {t(cambio.status.mensagem)} · {new Date(cambio.status.em).toLocaleString('pt-BR')}
                {!cambio.status.ok && cambio.status.ultimaOk && <> · {t('última base boa')}: {new Date(cambio.status.ultimaOk).toLocaleString('pt-BR')}</>}
              </p>
            ) : <p className="text-sm text-[var(--suave)]">{t('Ainda não buscou na internet.')}</p>}
          </div>
        </Cartao>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {cambio.moedas.map((m) => <CambioMoeda key={m.moeda} m={m} principal={p} n4={n4} />)}
      </div>

      <Cartao titulo={t('Histórico de cotações')} ajuda="Toda cotação fica guardada com data e origem (internet ou digitada). Cada venda guarda a que usou: mudar o câmbio não muda o passado.">
        <ul className="max-h-64 overflow-y-auto text-sm">
          {cambio.historico.map((h) => (
            <li key={h.id} className="flex flex-wrap items-center gap-2 border-t border-[var(--borda)] py-1">
              <span className="text-xs text-[var(--suave)]">{new Date(h.em).toLocaleString('pt-BR')}</span>
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
        {m.baseData && <> · {t(m.baseFonte === 'auto' ? 'internet' : 'digitada')} {new Date(m.baseData).toLocaleString('pt-BR')}</>}
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
          {m.fixoData && <p className="col-span-2 text-xs text-[var(--suave)]">{t('Valores fixos desde')} {new Date(m.fixoData).toLocaleString('pt-BR')}</p>}
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

function Modulos() {
  const t = useT()
  const { dados } = useConsulta('configuracoes', {})
  const { executar } = useComando()
  const [criar, setCriar] = useState<ModuloConfig>()
  if (!dados) return <Carregando />
  const ativos = dados.config.modulosAtivos
  return (
    <div className="space-y-4">
      <p className="text-sm text-[var(--suave)]">{t('Ligue só o que o negócio usa: menus, painel e relatórios se ajustam sozinhos.')}</p>
      <div className="grid gap-3 md:grid-cols-2">
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

function Unidades() {
  const t = useT()
  const { dados } = useConsulta('locais', {})
  const { executar, ocupado } = useComando()
  const [ed, setEd] = useState<{ id: string; nome: string; tipo: 'salao' | 'ponto' | 'outro'; rua?: string; numero?: string; bairro?: string; cidade?: string; pais?: string; referencia?: string }>()
  return (
    <div>
      <Botao className="mb-3" onClick={() => setEd({ id: novoId(), nome: '', tipo: 'salao' })}>+ {t('Unidade / endereço')}</Botao>
      {!dados ? <Carregando /> : !dados.length ? <Vazio texto="Nenhuma unidade." /> : (
        <ul className="grid gap-2 md:grid-cols-2">{dados.map((l) => <li key={l.id}><button type="button" className="w-full rounded-xl border border-[var(--borda)] bg-[var(--cartao)] p-3 text-left" onClick={() => setEd({ ...l })}><b>{l.nome}</b> <Pilula>{t(l.tipo === 'salao' ? 'salão' : l.tipo)}</Pilula><div className="text-sm text-[var(--suave)]">{[l.rua, l.numero, l.bairro, l.cidade, l.pais].filter(Boolean).join(', ')}</div></button></li>)}</ul>
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

function Catalogo() {
  const t = useT()
  const { dados: cfg } = useConsulta('configuracoes', {})
  const mods = (cfg?.modulos ?? []).filter((m) => m.tiposItem.some((x) => !x.controlaEstoque || m.id === 'produtos' || m.personalizado) && cfg?.config.modulosAtivos.includes(m.id))
  const [moduloId, setModuloId] = useState('salao')
  const { dados } = useConsulta('catalogo', { moduloId })
  const { executar, ocupado } = useComando()
  const mod = mods.find((m) => m.id === moduloId)
  const tipo = mod?.tiposItem[0]
  const [ed, setEd] = useState<{ id: string; nome: string; preco?: number; duracaoMin?: number; retornoDias?: number; estoqueIdeal?: number; saldoInicial?: number; novo: boolean }>()
  return (
    <div>
      <div className="mb-3 flex flex-wrap gap-2">
        <Selecao className="w-auto" valor={moduloId} onChange={setModuloId} opcoes={mods.map((m) => ({ id: m.id, nome: `${m.icone} ${t(m.nome)}` }))} />
        <Botao onClick={() => setEd({ id: novoId(), nome: '', novo: true })}>+ {t(tipo?.controlaEstoque ? 'Item' : 'Serviço')}</Botao>
      </div>
      {!dados ? <Carregando /> : (
        <ul className="grid gap-2 md:grid-cols-2">{dados.map((i) => <li key={i.id}><button type="button" className="flex w-full justify-between rounded-xl border border-[var(--borda)] bg-[var(--cartao)] p-3 text-left" onClick={() => setEd({ id: i.id, nome: i.nome, preco: i.precoSugerido?.valor, duracaoMin: i.duracaoMin, retornoDias: i.retornoDias, estoqueIdeal: i.estoqueIdeal, novo: false })}><b>{i.nome}</b><span className="num">{i.precoSugerido ? formatar(i.precoSugerido.valor, i.precoSugerido.moeda) : ''}</span></button></li>)}</ul>
      )}
      {ed && tipo && (
        <Janela aberta titulo={t(ed.novo ? 'Novo' : 'Editar')} onFechar={() => setEd(undefined)} rodape={<Botao grande className="w-full" disabled={ocupado} onClick={async () => (await executar('salvarItem', { id: ed.id, moduloId, tipoItem: tipo.id, nome: ed.nome, precoSugerido: ed.preco !== undefined ? { moeda: cfg?.config.moedaPrincipal ?? 'BOB', valor: ed.preco } : undefined, duracaoMin: ed.duracaoMin, retornoDias: ed.retornoDias, estoqueIdeal: ed.estoqueIdeal, saldoInicial: ed.novo ? ed.saldoInicial : undefined }, t('Salvo.'))) && setEd(undefined)}>{t('Salvar')}</Botao>}>
          <div className="space-y-3">
            <Campo rotulo="Nome"><Entrada value={ed.nome} onChange={(e) => setEd({ ...ed, nome: e.target.value })} /></Campo>
            <Campo rotulo="Preço sugerido"><ValorInput moeda={cfg?.config.moedaPrincipal ?? 'BOB'} valor={ed.preco} onChange={(v) => setEd({ ...ed, preco: v })} /></Campo>
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
          </div>
        </Janela>
      )}
    </div>
  )
}

function Dados() {
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
    <div className="grid gap-4 md:grid-cols-2">
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
        <Cartao titulo={t('Demonstração')} className="md:col-span-2">
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
function Usuarios() {
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
        <ul className="grid gap-2 md:grid-cols-2">
          {dados.map((u) => (
            <li key={u.id}>
              <button type="button" className={cx('w-full rounded-xl border bg-[var(--cartao)] p-3 text-left', u.ativo ? 'border-[var(--borda)]' : 'border-dashed border-[var(--borda)] opacity-60')} onClick={() => setEd({ id: u.id, login: u.login, nome: u.nome, perfil: u.perfil, pessoaId: u.pessoaId, localId: u.localId, ativo: u.ativo, novo: false })}>
                <div className="flex items-center justify-between gap-2"><b>{u.nome}</b><Pilula tom={u.perfil === 'admin' ? 'marca' : 'neutro'}>{t(u.perfil === 'admin' ? 'Administrador' : 'Funcionário')}</Pilula></div>
                <div className="text-xs text-[var(--suave)]"><span className="font-mono">{u.login}</span>{u.local ? ` · ${u.local}` : ''}{u.ultimoAcesso ? ` · ${t('último acesso')} ${new Date(u.ultimoAcesso).toLocaleString('pt-BR')}` : ''}{!u.ativo ? ` · ${t('desativado')}` : ''}</div>
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
