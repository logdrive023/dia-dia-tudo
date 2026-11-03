// Casca do app. Padrões seguidos (pesquisa: NN/g, Material 3 navigation bar/rail, design systems de gov/Adobe/GitLab):
//  - menu VERTICAL sempre visível no desktop, em GRUPOS com título claro (reconhecer > lembrar);
//  - item = ícone de linha + nome curto + contador; nada de tooltip nem subtítulo dentro do menu (não cortar, não poluir);
//  - item ativo com 3 sinais (fundo suave + barra lateral + negrito), não só cor (WCAG 1.4.1);
//  - contador só quando há algo a fazer; cor de alerta só no que é urgente (evita "cansaço de alerta");
//  - o "como está o dia" fica num cartão único no topo, não espalhado pelos itens;
//  - desktop pode recolher para trilho de ícones (navigation rail); celular: barra com 5 destinos + "Mais".
// O menu se monta pelos módulos ativos e pelo perfil (admin vê tudo; funcionária só o dela).
// "Configurações" abre uma sublista com os grupos e as seções (vêm da mesma lista da tela: configSecoes.ts).

import { type ReactNode, useState } from 'react'
import { cx } from './base'
import { useApp, useConsulta } from './contexto'
import { useLembrado } from './filtros'
import { useT } from './i18n'
import { Icone } from './icones'
import { abrirConversor } from './compartilhados'
import { PAI } from '../app/rotas'
import { GRUPOS_CONFIG, SECOES_CONFIG } from '../screens/configSecoes'

export interface ItemMenu {
  tela: string
  nome: string
  /** nome curto para a barra do celular */
  curto?: string
  grupo: 'Dia a dia' | 'Estoque e compras' | 'Pessoas' | 'Gestão'
  /** só para admin */
  admin?: boolean
  /** aparece se algum módulo ativo tiver este recurso */
  precisa?: 'compra' | 'venda' | 'agenda' | 'estoque' | 'emprestimos' | 'cabelo'
}

export const MENU: ItemMenu[] = [
  { tela: 'painel', nome: 'Painel', grupo: 'Dia a dia', admin: true },
  { tela: 'vender', nome: 'Vender', grupo: 'Dia a dia', precisa: 'venda' },
  { tela: 'agenda', nome: 'Agenda', grupo: 'Dia a dia', precisa: 'agenda' },
  { tela: 'caixa', nome: 'Caixa', grupo: 'Dia a dia', admin: true },
  { tela: 'triagem', nome: 'Triagem', grupo: 'Estoque e compras', admin: true, precisa: 'estoque' },
  { tela: 'comprar', nome: 'Comprar', grupo: 'Estoque e compras', admin: true, precisa: 'compra' },
  // viagens de compra: admin sempre; funcionária só quando está numa viagem aberta (painel do viajante)
  { tela: 'viagens', nome: 'Viagens', grupo: 'Estoque e compras', precisa: 'compra' },
  { tela: 'estoque', nome: 'Estoque', grupo: 'Estoque e compras', admin: true, precisa: 'estoque' },
  // livro do cabelo: todos os lançamentos de gramas e o fechamento de cada compra
  { tela: 'livro', nome: 'Livro do cabelo', curto: 'Livro', grupo: 'Estoque e compras', admin: true, precisa: 'cabelo' },
  { tela: 'precos', nome: 'Tabelas de preço', curto: 'Preços', grupo: 'Estoque e compras', admin: true, precisa: 'cabelo' },
  { tela: 'pessoas', nome: 'Pessoas e contas', curto: 'Pessoas', grupo: 'Pessoas' },
  { tela: 'equipe', nome: 'Equipe e unidades', curto: 'Equipe', grupo: 'Pessoas' },
  { tela: 'emprestimos', nome: 'Empréstimos', grupo: 'Pessoas', admin: true, precisa: 'emprestimos' },
  // adiantamentos a parceiros (dinheiro para comprar cabelo): admin sempre; funcionária só quando tem um dela em andamento
  { tela: 'adiantamentos', nome: 'Adiantamentos', grupo: 'Pessoas', precisa: 'compra' },
  { tela: 'relatorios', nome: 'Relatórios', grupo: 'Gestão', admin: true },
  { tela: 'config', nome: 'Configurações', curto: 'Ajustes', grupo: 'Gestão', admin: true },
]

export const GRUPOS = ['Dia a dia', 'Estoque e compras', 'Pessoas', 'Gestão'] as const

/** Cor de cada grupo (só no quadradinho do ícone: ajuda a achar sem poluir). */
const COR_GRUPO: Record<ItemMenu['grupo'], string> = {
  'Dia a dia': '#8b5cf6',
  'Estoque e compras': '#0ea5e9',
  Pessoas: '#10b981',
  Gestão: '#f59e0b',
}

export function useMenu() {
  const { sessao } = useApp()
  const { dados } = useConsulta('configuracoes', {})
  const { dados: resumo } = useConsulta('resumoMenu', {})
  // "Viagens" para a funcionária só enquanto ela tem viagem aberta
  const semViagem = (m: ItemMenu) =>
    (m.tela !== 'viagens' || sessao.perfil === 'admin' || !!resumo?.viagensAbertas) && (m.tela !== 'adiantamentos' || sessao.perfil === 'admin' || !!resumo?.adiantamentosAbertos)
  if (!dados) return MENU.filter((m) => (!m.admin || sessao.perfil === 'admin') && semViagem(m))
  const ativos = dados.modulos.filter((m) => dados.config.modulosAtivos.includes(m.id))
  const tem = {
    compra: ativos.some((m) => m.temCompra),
    venda: ativos.some((m) => m.temVenda),
    agenda: ativos.some((m) => m.recursos?.agenda || m.id === 'salao'),
    estoque: ativos.some((m) => m.temCompra || m.recursos?.estoque),
    emprestimos: ativos.some((m) => m.telaPropria === 'emprestimos'),
    cabelo: ativos.some((m) => m.id === 'cabelo' || m.recursos?.tabelaPreco),
  }
  return MENU.filter((m) => (!m.admin || sessao.perfil === 'admin') && (!m.precisa || tem[m.precisa]) && semViagem(m))
}

/** Contador de cada item: só o que pede ação. 'urgente' = vermelho; 'atencao' = âmbar; 'info' = neutro. */
type Contador = { n: number; tom: 'urgente' | 'atencao' | 'info'; rotulo: string }

function useContadores() {
  const { dados: r } = useConsulta('resumoMenu', {})
  const t = useT()
  const c: Record<string, Contador | undefined> = {}
  if (!r) return { c, r }
  if (r.agendadosHoje) c.agenda = { n: r.agendadosHoje, tom: 'info', rotulo: t('{n} hoje', { n: r.agendadosHoje }) }
  if (r.triagem) c.comprar = { n: r.triagem, tom: 'atencao', rotulo: t('{n} na triagem', { n: r.triagem }) }
  if (r.aguardandoTriagem) c.triagem = { n: r.aguardandoTriagem, tom: 'atencao', rotulo: t('{n} aguardando triagem', { n: r.aguardandoTriagem }) }
  if (r.viagensAcimaOrcamento) c.viagens = { n: r.viagensAcimaOrcamento, tom: 'atencao', rotulo: t('{n} viagem(ns) acima do orçamento', { n: r.viagensAcimaOrcamento }) }
  else if (r.viagensAbertas) c.viagens = { n: r.viagensAbertas, tom: 'info', rotulo: t('{n} viagem(ns) aberta(s)', { n: r.viagensAbertas }) }
  if (r.repor) c.estoque = { n: r.repor, tom: 'info', rotulo: t('{n} para repor', { n: r.repor }) }
  if (r.adiantamentosAPagar) c.adiantamentos = { n: r.adiantamentosAPagar, tom: 'atencao', rotulo: t('{n} com diferença a pagar ao parceiro', { n: r.adiantamentosAPagar }) }
  else if (r.adiantamentosAbertos) c.adiantamentos = { n: r.adiantamentosAbertos, tom: 'info', rotulo: t('{n} adiantamento(s) em aberto', { n: r.adiantamentosAbertos }) }
  if (r.atrasadas) c.emprestimos = { n: r.atrasadas, tom: 'urgente', rotulo: t('{n} parcela(s) atrasada(s)', { n: r.atrasadas }) }
  return { c, r }
}

/** pontinho (celular e trilho): urgente = "!" em vermelho; atenção = ponto cheio; info = anel vazio (não só cor). */
function Selo({ c, pontinho }: { c?: Contador; pontinho?: boolean }) {
  if (!c) return null
  const urgente = c.tom === 'urgente'
  if (pontinho)
    return (
      <>
        {urgente ? (
          <span aria-hidden className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-[var(--ruim)] px-1 text-[10px] font-black leading-none text-white ring-2 ring-[var(--cartao)]">!</span>
        ) : (
          <span aria-hidden className={cx('absolute right-1 top-1 h-2.5 w-2.5 rounded-full', c.tom === 'atencao' ? 'bg-[var(--alerta)]' : 'border-2 border-[var(--suave)] bg-[var(--cartao)]')} />
        )}
        <span className="sr-only">{c.rotulo}</span>
      </>
    )
  return (
    <span className={cx('num min-w-5 text-right text-xs', urgente ? 'font-bold text-[var(--ruim)]' : 'text-[var(--suave)]')}>
      <span aria-hidden>{urgente && '! '}{c.n > 99 ? '99+' : c.n}</span>
      <span className="sr-only">{c.rotulo}</span>
    </span>
  )
}

export function Shell({ children }: { children: ReactNode }) {
  const { nav: navReal, ir, sessao, backend, trocarSessao } = useApp()
  const nav = { ...navReal, tela: PAI[navReal.tela] ?? navReal.tela }
  const t = useT()
  const menu = useMenu()
  const { c: contadores } = useContadores()
  const [mais, setMais] = useState(false)
  const [recolhido, setRecolhido] = useLembrado('menu.recolhido', false)
  const [oculto, setOculto] = useLembrado('menu.oculto', false)
  const [gruposFechados, setGruposFechados] = useLembrado<string[]>('menu.gruposFechados', [])
  const { dados } = useConsulta('configuracoes', {})
  const sair = async () => {
    await backend.sair()
    trocarSessao({ ...sessao, usuarioId: '', nome: '', login: undefined, pessoaId: undefined, localId: undefined })
  }
  const grupos = GRUPOS.map((g) => ({ g, itens: menu.filter((m) => m.grupo === g) })).filter((x) => x.itens.length)
  const iniciais = (sessao.nome || '?').split(' ').map((p) => p[0]).slice(0, 2).join('').toUpperCase()
  // celular: os 4 primeiros destinos do perfil + Comprar SEMPRE (a compra é a alma do negócio) + "Mais"
  const comprar = menu.find((m) => m.tela === 'comprar')
  const principais = [...menu.filter((m) => m !== comprar).slice(0, 4), ...(comprar ? [comprar] : [])].sort((a, b) => menu.indexOf(a) - menu.indexOf(b))
  const telaAtualNoMais = !principais.some((m) => m.tela === nav.tela)
  const noMais = menu.filter((m) => !principais.includes(m)).map((m) => contadores[m.tela]).filter(Boolean) as Contador[]
  const seloMais = noMais.length ? { ...(noMais.find((c) => c.tom === 'urgente') ?? noMais.find((c) => c.tom === 'atencao') ?? noMais[0]), rotulo: noMais.map((c) => c.rotulo).join(' · ') } : undefined

  // sublista das Configurações: aberta quando se está nelas (a pessoa pode fechar/abrir pela setinha)
  const naConfig = navReal.tela === 'config' || navReal.tela === 'configSecao'
  const [configAberta, setConfigAberta] = useState<boolean>()
  const subConfigAberta = configAberta ?? naConfig
  const secaoAtual = navReal.tela === 'configSecao' ? String(navReal.params.id ?? '') : ''
  const setaConfig = (celular?: boolean) => (
    <button
      type="button"
      onClick={() => setConfigAberta(!subConfigAberta)}
      aria-expanded={subConfigAberta}
      aria-controls={celular ? 'submenu-config-celular' : 'submenu-config'}
      aria-label={t(subConfigAberta ? 'Fechar a lista das configurações' : 'Ver tudo o que dá para configurar')}
      className={cx('absolute right-0 top-0 flex items-center justify-center rounded-xl text-[var(--suave)] hover:bg-[var(--fundo)] hover:text-[var(--texto)]', celular ? 'h-12 w-12' : 'h-11 w-10')}
    >
      <span aria-hidden className={cx('inline-block text-lg transition-transform', subConfigAberta && 'rotate-90')}>›</span>
    </button>
  )
  const subConfig = (celular?: boolean) => (
    <ul id={celular ? 'submenu-config-celular' : 'submenu-config'} className={cx('mb-1 mt-0.5 border-l-2 border-[var(--borda)]', celular ? 'ml-5 pl-2' : 'ml-[1.6rem] pl-2')}>
      {GRUPOS_CONFIG.map((g) => (
        <li key={g.id} className="mt-1 first:mt-0">
          <div className="px-2 pb-0.5 pt-1 text-[11px] font-medium text-[var(--suave)]"><span aria-hidden>{g.icone} </span>{t(g.nome)}</div>
          <ul>
            {SECOES_CONFIG.filter((x) => x.grupo === g.id).map((x) => {
              const ativa = secaoAtual === x.id
              return (
                <li key={x.id}>
                  <button
                    type="button"
                    onClick={() => (setMais(false), ir('configSecao', { id: x.id }))}
                    aria-current={ativa ? 'page' : undefined}
                    className={cx('flex w-full items-center gap-2 rounded-lg px-2 text-left', celular ? 'min-h-11 text-[15px]' : 'min-h-9 text-sm', ativa ? 'bg-[var(--marca-suave)] font-semibold text-[var(--marca)]' : 'text-[var(--texto)] hover:bg-[var(--fundo)]')}
                  >
                    <span aria-hidden className="w-5 shrink-0 text-center text-sm">{x.icone}</span>
                    <span className="min-w-0 flex-1 truncate">{t(x.nome)}</span>
                  </button>
                </li>
              )
            })}
          </ul>
        </li>
      ))}
    </ul>
  )

  const itemLateral = (m: ItemMenu) => {
    const ativo = nav.tela === m.tela
    const c = contadores[m.tela]
    const temSub = m.tela === 'config' && !recolhido
    return (
      <li key={m.tela} className={cx(temSub && 'relative')}>
        <button
          type="button"
          onClick={() => ir(m.tela)}
          aria-current={ativo && (m.tela !== 'config' || navReal.tela === 'config') ? 'page' : undefined}
          title={recolhido ? `${t(m.nome)}${c ? ` · ${c.rotulo}` : ''}` : c?.rotulo}
          className={cx(
            'relative flex min-h-11 w-full items-center gap-3 rounded-xl text-left text-[15px] transition-colors',
            recolhido ? 'justify-center px-0' : 'px-3',
            temSub && 'pr-11',
            ativo ? 'bg-[var(--marca-suave)] font-semibold text-[var(--marca)]' : 'text-[var(--texto)] hover:bg-[var(--fundo)]',
          )}
        >
          {ativo && <span className="absolute left-0 top-2 h-7 w-1 rounded-r-full bg-[var(--marca)]" aria-hidden />}
          <span className="relative flex h-8 w-8 shrink-0 items-center justify-center rounded-lg" style={{ background: `color-mix(in srgb, ${COR_GRUPO[m.grupo]} ${ativo ? 28 : 16}%, transparent)`, color: COR_GRUPO[m.grupo] }}>
            <Icone nome={m.tela} className="h-[18px] w-[18px]" />
            {recolhido && <Selo c={c} pontinho />}
          </span>
          {!recolhido && <span className="min-w-0 flex-1 truncate">{t(m.nome)}</span>}
          {!recolhido && <Selo c={c} />}
        </button>
        {temSub && setaConfig()}
        {temSub && subConfigAberta && subConfig()}
      </li>
    )
  }

  return (
    <div className="md:flex">
      {/* desktop: barra lateral (recolhe para trilho de ícones) */}
      <aside className={cx('nao-imprimir sticky top-0 hidden h-screen shrink-0 flex-col border-r border-[var(--borda)] bg-[var(--cartao)] transition-[width]', oculto ? 'md:hidden' : 'md:flex', recolhido ? 'w-[76px]' : 'w-64')}>
        <div className={cx('flex items-center gap-3 pb-4 pt-5', recolhido ? 'justify-center px-2' : 'px-5')}>
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-[var(--marca)] text-sm font-black text-white">T</div>
          {!recolhido && (
            <div className="min-w-0 flex-1">
              <div className="text-base font-black leading-tight">Tudo</div>
              <div className="truncate text-xs text-[var(--suave)]">{dados?.config.nomeNegocio}</div>
            </div>
          )}
          {!recolhido && (
            <button type="button" onClick={() => setOculto(true)} aria-label={t('Esconder menu')} title={t('Esconder menu')} className="flex h-8 w-8 items-center justify-center rounded-lg text-[var(--suave)] hover:bg-[var(--fundo)]">
              <Icone nome="recolher" className="h-4 w-4" />
            </button>
          )}
        </div>

        <nav aria-label={t('Menu principal')} className={cx('min-h-0 flex-1 overflow-y-auto pb-3', recolhido ? 'px-2' : 'px-3')}>
          {grupos.map(({ g, itens }, i) => {
            // grupo do item aberto nunca fica fechado (não perder onde está)
            const fechado = !recolhido && gruposFechados.includes(g) && !itens.some((m) => m.tela === nav.tela)
            const alerta = itens.map((m) => contadores[m.tela]).find((c) => c?.tom === 'urgente') ?? itens.map((m) => contadores[m.tela]).find(Boolean)
            return (
              <div key={g} className={cx(i > 0 && (recolhido ? 'mt-3 border-t border-[var(--borda)] pt-3' : 'mt-4'))}>
                {!recolhido && (
                  <button type="button" onClick={() => setGruposFechados(fechado ? gruposFechados.filter((x) => x !== g) : [...gruposFechados, g])} aria-expanded={!fechado} className="mb-1 flex w-full items-center gap-1 rounded-lg px-3 py-1 text-left text-xs font-medium text-[var(--suave)] hover:text-[var(--texto)]">
                    <span className={cx('inline-block transition-transform', fechado ? '' : 'rotate-90')} aria-hidden>›</span>
                    <span className="flex-1">{t(g)}</span>
                    {fechado && alerta && <Selo c={{ ...alerta, n: itens.reduce((s, m) => s + (contadores[m.tela]?.n ?? 0), 0) }} />}
                  </button>
                )}
                {!fechado && <ul className="space-y-0.5">{itens.map(itemLateral)}</ul>}
              </div>
            )
          })}
        </nav>

        <div className={cx('border-t border-[var(--borda)] p-3', recolhido && 'px-2')}>
          <div className={cx('flex items-center gap-2', recolhido && 'flex-col')}>
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--marca-suave)] text-sm font-bold text-[var(--marca)]" title={sessao.nome}>{iniciais}</div>
            {!recolhido && (
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-semibold">{sessao.nome}</div>
                <div className="text-xs text-[var(--suave)]">{t(sessao.perfil === 'admin' ? 'Administrador' : 'Funcionário')}</div>
              </div>
            )}
            <button type="button" onClick={sair} title={t('Sair')} aria-label={t('Sair')} className="flex h-9 w-9 items-center justify-center rounded-xl text-[var(--suave)] hover:bg-[var(--fundo)] hover:text-[var(--marca)]">
              <Icone nome="sair" />
            </button>
          </div>
          <button type="button" onClick={abrirConversor} title={t('Conversor de moedas')} className={cx('mt-2 flex h-9 w-full items-center gap-2 rounded-xl text-xs font-semibold text-[var(--suave)] hover:bg-[var(--fundo)]', recolhido ? 'justify-center' : 'px-3')}>
            <span aria-hidden>💱</span>
            {!recolhido && t('Conversor de moedas')}
          </button>
          <button type="button" onClick={() => setRecolhido(!recolhido)} aria-label={t(recolhido ? 'Expandir menu' : 'Recolher menu')} className="mt-2 flex h-9 w-full items-center justify-center gap-2 rounded-xl text-xs font-semibold text-[var(--suave)] hover:bg-[var(--fundo)]">
            <Icone nome={recolhido ? 'expandir' : 'recolher'} className="h-4 w-4" />
            {!recolhido && t('Recolher menu')}
          </button>
        </div>
      </aside>

      <div className="min-w-0 flex-1">
        {oculto && (
          <button type="button" onClick={() => setOculto(false)} aria-label={t('Mostrar menu')} title={t('Mostrar menu')} className="nao-imprimir fixed left-3 top-3 z-30 hidden h-10 w-10 items-center justify-center rounded-xl border border-[var(--borda)] bg-[var(--cartao)] shadow-sm hover:border-[var(--marca)] md:flex">
            <Icone nome="mais" />
          </button>
        )}
        {backend.tipo !== 'api' && (
          <div className="nao-imprimir bg-[var(--marca-suave)] px-4 py-1.5 text-center text-xs text-[var(--marca)]">{t('Modo demonstração: os dados ficam só neste aparelho.')}</div>
        )}
        <main className={cx('mx-auto px-4 pb-28 pt-4 md:pb-10', oculto ? 'max-w-7xl md:pl-16' : 'max-w-6xl')}>{children}</main>
      </div>

      {/* celular: 5 destinos, nome sempre visível, contador no canto do ícone, indicador em pílula */}
      <nav aria-label={t('Menu principal')} className="nao-imprimir fixed inset-x-0 bottom-0 z-30 grid grid-cols-5 border-t border-[var(--borda)] bg-[var(--cartao)] pb-[env(safe-area-inset-bottom)] md:hidden" style={{ gridTemplateColumns: `repeat(${principais.length + 1}, minmax(0, 1fr))` }}>
        {[...principais.map((m) => ({ m, ativo: nav.tela === m.tela })), { m: undefined, ativo: telaAtualNoMais || mais }].map(({ m, ativo }) => (
          <button
            key={m?.tela ?? 'mais'}
            type="button"
            onClick={() => (m ? ir(m.tela) : setMais(true))}
            aria-current={ativo && m ? 'page' : undefined}
            className={cx('flex min-h-16 flex-col items-center justify-center gap-1 text-xs', ativo ? 'font-bold text-[var(--marca)]' : 'font-medium text-[var(--suave)]')}
          >
            <span className={cx('relative flex h-8 w-14 items-center justify-center rounded-full transition-colors', ativo && 'bg-[var(--marca-suave)]')}>
              <Icone nome={m?.tela ?? 'mais'} className="h-6 w-6" />
              <Selo c={m ? contadores[m.tela] : seloMais} pontinho />
            </span>
            <span className="max-w-full truncate px-1">{m ? t(m.curto ?? m.nome) : t('Mais')}</span>
          </button>
        ))}
      </nav>

      {mais && (
        <div className="fixed inset-0 z-40 bg-black/40 md:hidden" onClick={() => setMais(false)}>
          <div role="dialog" aria-label={t('Menu')} className="absolute inset-x-0 bottom-0 max-h-[85vh] overflow-y-auto rounded-t-3xl bg-[var(--cartao)] px-4 pb-8 pt-3" onClick={(e) => e.stopPropagation()}>
            <div className="mx-auto mb-3 h-1.5 w-10 rounded-full bg-[var(--borda)]" />
            <div className="mb-4 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[var(--marca-suave)] font-bold text-[var(--marca)]">{iniciais}</div>
              <div className="min-w-0 flex-1">
                <div className="truncate font-semibold">{sessao.nome}</div>
                <div className="text-xs text-[var(--suave)]">{t(sessao.perfil === 'admin' ? 'Administrador' : 'Funcionário')}</div>
              </div>
              <button type="button" onClick={() => (setMais(false), abrirConversor())} aria-label={t('Conversor de moedas')} className="flex min-h-10 min-w-10 items-center justify-center rounded-xl text-lg">💱</button>
              <button type="button" onClick={sair} className="flex min-h-10 items-center gap-1 rounded-xl px-3 text-sm font-semibold text-[var(--marca)]">
                <Icone nome="sair" className="h-4 w-4" /> {t('Sair')}
              </button>
            </div>
            {grupos.map(({ g, itens }) => (
              <section key={g} className="mb-4">
                <h2 className="mb-1 px-3 text-xs font-medium text-[var(--suave)]">{t(g)}</h2>
                <ul>
                  {itens.map((m) => {
                    const ativo = nav.tela === m.tela
                    const c = contadores[m.tela]
                    const temSub = m.tela === 'config'
                    return (
                      <li key={m.tela} className={cx(temSub && 'relative')}>
                        <button
                          type="button"
                          onClick={() => (setMais(false), ir(m.tela))}
                          aria-current={ativo && (!temSub || navReal.tela === 'config') ? 'page' : undefined}
                          className={cx('flex min-h-12 w-full items-center gap-3 rounded-xl px-3 text-left', temSub && 'pr-14', ativo ? 'bg-[var(--marca-suave)] font-semibold text-[var(--marca)]' : '')}
                        >
                          <Icone nome={m.tela} className={cx('h-5 w-5', !ativo && 'text-[var(--suave)]')} />
                          <span className="flex-1">{t(m.nome)}</span>
                          <Selo c={c} />
                        </button>
                        {temSub && setaConfig(true)}
                        {temSub && subConfigAberta && subConfig(true)}
                      </li>
                    )
                  })}
                </ul>
              </section>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
