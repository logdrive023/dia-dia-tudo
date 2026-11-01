// Casca do app. Padrões seguidos (pesquisa: NN/g, Material 3 navigation bar/rail, design systems de gov/Adobe/GitLab):
//  - menu VERTICAL sempre visível no desktop, em GRUPOS com título claro (reconhecer > lembrar);
//  - item = ícone de linha + nome curto + contador; nada de tooltip nem subtítulo dentro do menu (não cortar, não poluir);
//  - item ativo com 3 sinais (fundo suave + barra lateral + negrito), não só cor (WCAG 1.4.1);
//  - contador só quando há algo a fazer; cor de alerta só no que é urgente (evita "cansaço de alerta");
//  - o "como está o dia" fica num cartão único no topo, não espalhado pelos itens;
//  - desktop pode recolher para trilho de ícones (navigation rail); celular: barra com 5 destinos + "Mais".
// O menu se monta pelos módulos ativos e pelo perfil (admin vê tudo; funcionária só o dela).

import { type ReactNode, useState } from 'react'
import { cx } from './base'
import { useApp, useConsulta } from './contexto'
import { useLembrado } from './filtros'
import { useT } from './i18n'
import { Icone } from './icones'

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
  { tela: 'comprar', nome: 'Comprar', grupo: 'Estoque e compras', admin: true, precisa: 'compra' },
  { tela: 'estoque', nome: 'Estoque', grupo: 'Estoque e compras', admin: true, precisa: 'estoque' },
  { tela: 'precos', nome: 'Tabelas de preço', curto: 'Preços', grupo: 'Estoque e compras', admin: true, precisa: 'cabelo' },
  { tela: 'pessoas', nome: 'Pessoas e contas', curto: 'Pessoas', grupo: 'Pessoas' },
  { tela: 'equipe', nome: 'Equipe e unidades', curto: 'Equipe', grupo: 'Pessoas' },
  { tela: 'emprestimos', nome: 'Empréstimos', grupo: 'Pessoas', admin: true, precisa: 'emprestimos' },
  { tela: 'relatorios', nome: 'Relatórios', grupo: 'Gestão', admin: true },
  { tela: 'config', nome: 'Configurações', curto: 'Ajustes', grupo: 'Gestão', admin: true },
]

export const GRUPOS = ['Dia a dia', 'Estoque e compras', 'Pessoas', 'Gestão'] as const

export function useMenu() {
  const { sessao } = useApp()
  const { dados } = useConsulta('configuracoes', {})
  if (!dados) return MENU.filter((m) => !m.admin || sessao.perfil === 'admin')
  const ativos = dados.modulos.filter((m) => dados.config.modulosAtivos.includes(m.id))
  const tem = {
    compra: ativos.some((m) => m.temCompra),
    venda: ativos.some((m) => m.temVenda),
    agenda: ativos.some((m) => m.recursos?.agenda || m.id === 'salao'),
    estoque: ativos.some((m) => m.temCompra || m.recursos?.estoque),
    emprestimos: ativos.some((m) => m.telaPropria === 'emprestimos'),
    cabelo: ativos.some((m) => m.id === 'cabelo' || m.recursos?.tabelaPreco),
  }
  return MENU.filter((m) => (!m.admin || sessao.perfil === 'admin') && (!m.precisa || tem[m.precisa]))
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
  if (r.brutos) c.estoque = { n: r.brutos, tom: 'atencao', rotulo: t('{n} lote(s) para separar', { n: r.brutos }) }
  else if (r.repor) c.estoque = { n: r.repor, tom: 'info', rotulo: t('{n} para repor', { n: r.repor }) }
  if (r.atrasadas) c.emprestimos = { n: r.atrasadas, tom: 'urgente', rotulo: t('{n} parcela(s) atrasada(s)', { n: r.atrasadas }) }
  return { c, r }
}

function Selo({ c, pontinho }: { c?: Contador; pontinho?: boolean }) {
  if (!c) return null
  const urgente = c.tom === 'urgente'
  if (pontinho) return <span className={cx('absolute right-2 top-2 h-2 w-2 rounded-full', urgente ? 'bg-[var(--ruim)]' : 'bg-[var(--suave)]')} />
  return <span className={cx('num min-w-5 text-right text-xs', urgente ? 'font-bold text-[var(--ruim)]' : 'text-[var(--suave)]')}>{c.n > 99 ? '99+' : c.n}</span>
}

export function Shell({ children }: { children: ReactNode }) {
  const { nav, ir, sessao, backend, trocarSessao } = useApp()
  const t = useT()
  const menu = useMenu()
  const { c: contadores } = useContadores()
  const [mais, setMais] = useState(false)
  const [recolhido, setRecolhido] = useLembrado('menu.recolhido', false)
  const { dados } = useConsulta('configuracoes', {})
  const sair = async () => {
    await backend.sair()
    trocarSessao({ ...sessao, usuarioId: '', nome: '', login: undefined, pessoaId: undefined, localId: undefined })
  }
  const grupos = GRUPOS.map((g) => ({ g, itens: menu.filter((m) => m.grupo === g) })).filter((x) => x.itens.length)
  const iniciais = (sessao.nome || '?').split(' ').map((p) => p[0]).slice(0, 2).join('').toUpperCase()
  // celular: os 4 primeiros destinos do perfil + "Mais"
  const principais = menu.slice(0, 4)
  const telaAtualNoMais = !principais.some((m) => m.tela === nav.tela)

  const itemLateral = (m: ItemMenu) => {
    const ativo = nav.tela === m.tela
    const c = contadores[m.tela]
    return (
      <li key={m.tela}>
        <button
          type="button"
          onClick={() => ir(m.tela)}
          aria-current={ativo ? 'page' : undefined}
          title={recolhido ? `${t(m.nome)}${c ? ` · ${c.rotulo}` : ''}` : c?.rotulo}
          className={cx(
            'relative flex min-h-11 w-full items-center gap-3 rounded-xl text-left text-[15px] transition-colors',
            recolhido ? 'justify-center px-0' : 'px-3',
            ativo ? 'bg-[var(--marca-suave)] font-semibold text-[var(--marca)]' : 'text-[var(--texto)] hover:bg-[var(--fundo)]',
          )}
        >
          {ativo && <span className="absolute left-0 top-2 h-7 w-1 rounded-r-full bg-[var(--marca)]" aria-hidden />}
          <Icone nome={m.tela} className={cx('h-5 w-5 shrink-0', !ativo && 'text-[var(--suave)]')} />
          {!recolhido && <span className="min-w-0 flex-1 truncate">{t(m.nome)}</span>}
          {recolhido ? <Selo c={c} pontinho /> : <Selo c={c} />}
        </button>
      </li>
    )
  }

  return (
    <div className="md:flex">
      {/* desktop: barra lateral (recolhe para trilho de ícones) */}
      <aside className={cx('nao-imprimir sticky top-0 hidden h-screen shrink-0 flex-col border-r border-[var(--borda)] bg-[var(--cartao)] transition-[width] md:flex', recolhido ? 'w-[76px]' : 'w-64')}>
        <div className={cx('flex items-center gap-3 pb-4 pt-5', recolhido ? 'justify-center px-2' : 'px-5')}>
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-[var(--marca)] text-sm font-black text-white">T</div>
          {!recolhido && (
            <div className="min-w-0 flex-1">
              <div className="text-base font-black leading-tight">Tudo</div>
              <div className="truncate text-xs text-[var(--suave)]">{dados?.config.nomeNegocio}</div>
            </div>
          )}
        </div>

        <nav aria-label={t('Menu principal')} className={cx('min-h-0 flex-1 overflow-y-auto pb-3', recolhido ? 'px-2' : 'px-3')}>
          {grupos.map(({ g, itens }, i) => (
            <div key={g} className={cx(i > 0 && (recolhido ? 'mt-3 border-t border-[var(--borda)] pt-3' : 'mt-5'))}>
              {!recolhido && <h2 className="mb-1 px-3 text-xs font-medium text-[var(--suave)]">{t(g)}</h2>}
              <ul className="space-y-0.5">{itens.map(itemLateral)}</ul>
            </div>
          ))}
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
          <button type="button" onClick={() => setRecolhido(!recolhido)} aria-label={t(recolhido ? 'Expandir menu' : 'Recolher menu')} className="mt-2 flex h-9 w-full items-center justify-center gap-2 rounded-xl text-xs font-semibold text-[var(--suave)] hover:bg-[var(--fundo)]">
            <Icone nome={recolhido ? 'expandir' : 'recolher'} className="h-4 w-4" />
            {!recolhido && t('Recolher menu')}
          </button>
        </div>
      </aside>

      <div className="min-w-0 flex-1">
        {backend.tipo !== 'api' && (
          <div className="nao-imprimir bg-[var(--marca-suave)] px-4 py-1.5 text-center text-xs text-[var(--marca)]">{t('Modo demonstração: os dados ficam só neste aparelho.')}</div>
        )}
        <main className="mx-auto max-w-6xl px-4 pb-28 pt-4 md:pb-10">{children}</main>
      </div>

      {/* celular: 5 destinos, nome sempre visível, contador no canto do ícone, indicador em pílula */}
      <nav aria-label={t('Menu principal')} className="nao-imprimir fixed inset-x-0 bottom-0 z-30 grid grid-cols-5 border-t border-[var(--borda)] bg-[var(--cartao)] pb-[env(safe-area-inset-bottom)] md:hidden">
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
              {m && contadores[m.tela] && <Selo c={contadores[m.tela]} pontinho />}
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
                    return (
                      <li key={m.tela}>
                        <button
                          type="button"
                          onClick={() => (setMais(false), ir(m.tela))}
                          aria-current={ativo ? 'page' : undefined}
                          className={cx('flex min-h-12 w-full items-center gap-3 rounded-xl px-3 text-left', ativo ? 'bg-[var(--marca-suave)] font-semibold text-[var(--marca)]' : '')}
                        >
                          <Icone nome={m.tela} className={cx('h-5 w-5', !ativo && 'text-[var(--suave)]')} />
                          <span className="flex-1">{t(m.nome)}</span>
                          <Selo c={c} />
                        </button>
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
