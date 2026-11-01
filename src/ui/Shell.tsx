// Casca do app: menu agrupado e DINÂMICO (números ao vivo: vendido hoje, triagem, agenda, quem deve…),
// com explicação e exemplo em cada item. Lateral no desktop, barra inferior + "Mais" no celular.
// O menu se monta pelos módulos ativos e pelo perfil (admin vê tudo; funcionária só o dela).

import { type ReactNode, useState } from 'react'
import { formatar } from '../core/domain/dinheiro'
import { Info, cx } from './base'
import { useApp, useConsulta } from './contexto'
import { useT } from './i18n'

export interface ItemMenu {
  tela: string
  nome: string
  icone: string
  grupo: 'Hoje' | 'Operação' | 'Pessoas' | 'Gestão'
  ajuda: string
  /** só para admin */
  admin?: boolean
  /** aparece se algum módulo ativo tiver este recurso */
  precisa?: 'compra' | 'venda' | 'agenda' | 'estoque' | 'emprestimos' | 'cabelo'
}

export const MENU: ItemMenu[] = [
  { tela: 'painel', nome: 'Painel', icone: '📊', grupo: 'Hoje', admin: true, ajuda: 'Tudo do negócio num lugar; toque em qualquer número para ver de onde vem. Ex.: Faturamento Bs 12.000 → toque → a lista das vendas que somam isso.' },
  { tela: 'vender', nome: 'Vender', icone: '🛒', grupo: 'Hoje', precisa: 'venda', ajuda: 'Assistente que pergunta o necessário: é cabelo? é serviço? Ex.: 60 cm | 2.008 g × 17,5 = Bs 35.140.' },
  { tela: 'agenda', nome: 'Agenda', icone: '📅', grupo: 'Hoje', precisa: 'agenda', ajuda: 'Horários de cada profissional e unidade; avisa horário ocupado. Ex.: Sofia 15:00 Corte · Ana Paula.' },
  { tela: 'caixa', nome: 'Caixa', icone: '💵', grupo: 'Hoje', admin: true, ajuda: 'Dinheiro do dia por moeda: na mão e no banco. Ex.: ontem Bs 1.000 + hoje Bs 500 = Bs 1.500.' },
  { tela: 'comprar', nome: 'Comprar', icone: '📥', grupo: 'Operação', admin: true, precisa: 'compra', ajuda: 'Pedido de compra com fotos/PDF que passa pela triagem até o estoque. Ex.: 40 kg bruto → Chegou → Conferido → Pago → No estoque.' },
  { tela: 'estoque', nome: 'Estoque', icone: '📦', grupo: 'Operação', admin: true, precisa: 'estoque', ajuda: 'Lotes e itens, separar lote bruto e rastrear origem → destino. Ex.: 40 kg → 20 kg preto 60 cm + 19,5 kg castanho 50 cm.' },
  { tela: 'precos', nome: 'Tabelas de preço', icone: '🧮', grupo: 'Operação', admin: true, precisa: 'cabelo', ajuda: 'Grade medida × comprador com o fator por grama. Ex.: 40 cm na coluna Henrique = 3,5.' },
  { tela: 'pessoas', nome: 'Pessoas e contas', icone: '📒', grupo: 'Pessoas', ajuda: 'Clientes, fornecedores e a conta de cada um: quem me deve e a quem devo. Ex.: Henrique comprou Bs 89.420, pagou 70.000 → falta 19.420.' },
  { tela: 'equipe', nome: 'Equipe e unidades', icone: '👥', grupo: 'Pessoas', ajuda: 'Organograma por salão, salários, comissões e entradas × saídas de cada unidade. Ex.: 4 funcionárias de Bs 3.000 = Bs 12.000/mês de custo.' },
  { tela: 'emprestimos', nome: 'Empréstimos', icone: '🤝', grupo: 'Pessoas', admin: true, precisa: 'emprestimos', ajuda: 'Dinheiro emprestado e tomado, parcelas e atrasos. Ex.: Bs 28.000 em 4× com 5% ao mês = 4 × Bs 8.400.' },
  { tela: 'relatorios', nome: 'Relatórios', icone: '📑', grupo: 'Gestão', admin: true, ajuda: 'Resultado e divisão entre sócias, livro caixa, inventário, balanço e o log de quem fez o quê. Ex.: resultado Bs 9.000 ÷ 2 sócias = Bs 4.500 cada.' },
  { tela: 'config', nome: 'Configurações', icone: '⚙️', grupo: 'Gestão', admin: true, ajuda: 'Idioma, moedas e câmbio, sócias, módulos, usuários e backup. Ex.: trocar para espanhol num toque.' },
]

export const GRUPOS = ['Hoje', 'Operação', 'Pessoas', 'Gestão'] as const

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

/** Número/frase ao vivo de cada item ("direto ao ponto"). */
type Sinal = { badge?: string; tom?: 'alerta' | 'ruim' | 'marca'; linha?: string }

function useSinais(): Record<string, Sinal> {
  const { dados: r } = useConsulta('resumoMenu', {})
  const t = useT()
  if (!r) return {}
  const m = (v: number) => formatar(v, r.moeda).replace(/,\d+$/, '')
  return {
    painel: { linha: t('Hoje: {v} em {n} venda(s)', { v: m(r.totalHoje), n: r.vendasHoje }) },
    vender: { badge: r.vendasHoje ? String(r.vendasHoje) : undefined, tom: 'marca', linha: r.vendasHoje ? m(r.totalHoje) : t('nenhuma venda hoje') },
    agenda: { badge: r.agendadosHoje ? String(r.agendadosHoje) : undefined, tom: 'marca', linha: r.agendadosHoje ? t('{n} hoje', { n: r.agendadosHoje }) : t('nada hoje') },
    caixa: { linha: m(r.caixaHoje) },
    comprar: { badge: r.triagem ? String(r.triagem) : undefined, tom: 'alerta', linha: r.triagem ? t('{n} na triagem', { n: r.triagem }) : undefined },
    estoque: { badge: r.brutos ? String(r.brutos) : undefined, tom: 'alerta', linha: r.brutos ? t('{n} lote(s) para separar', { n: r.brutos }) : r.repor ? t('{n} para repor', { n: r.repor }) : undefined },
    pessoas: { linha: r.aReceber ? t('me devem {v}', { v: m(r.aReceber) }) : undefined },
    emprestimos: { badge: r.atrasadas ? String(r.atrasadas) : undefined, tom: 'ruim', linha: r.atrasadas ? t('{n} parcela(s) atrasada(s)', { n: r.atrasadas }) : undefined },
  }
}

function Selo({ texto, tom = 'marca' }: { texto?: string; tom?: 'alerta' | 'ruim' | 'marca' }) {
  if (!texto) return null
  const c = { alerta: 'bg-[var(--alerta)] text-white', ruim: 'bg-[var(--ruim)] text-white', marca: 'bg-[var(--marca)] text-white' }[tom]
  return <span className={cx('num min-w-5 rounded-full px-1.5 text-center text-[11px] font-bold leading-5', c)}>{texto}</span>
}

export function Shell({ children }: { children: ReactNode }) {
  const { nav, ir, sessao, backend, trocarSessao } = useApp()
  const t = useT()
  const menu = useMenu()
  const sinais = useSinais()
  const [mais, setMais] = useState(false)
  const { dados } = useConsulta('configuracoes', {})
  const principais = menu.slice(0, 4)
  const sair = async () => {
    await backend.sair()
    trocarSessao({ ...sessao, usuarioId: '', nome: '', login: undefined, pessoaId: undefined, localId: undefined })
  }

  const Item = ({ m, compacto }: { m: ItemMenu; compacto?: boolean }) => {
    const s = sinais[m.tela] ?? {}
    const ativo = nav.tela === m.tela
    return (
      <button
        type="button"
        onClick={() => (setMais(false), ir(m.tela))}
        aria-current={ativo ? 'page' : undefined}
        className={cx(
          'group flex w-full items-center gap-3 rounded-2xl px-3 text-left transition',
          compacto ? 'min-h-14 border border-[var(--borda)]' : 'min-h-12',
          ativo ? 'bg-[var(--marca)] text-white shadow-md' : 'hover:bg-[var(--marca-suave)]',
        )}
      >
        <span className={cx('flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-lg', ativo ? 'bg-white/20' : 'bg-[var(--fundo)]')} aria-hidden>
          {m.icone}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-semibold">{t(m.nome)}</span>
          {s.linha && <span className={cx('num block truncate text-[11px]', ativo ? 'text-white/85' : 'text-[var(--suave)]')}>{s.linha}</span>}
        </span>
        <Selo texto={s.badge} tom={ativo ? 'marca' : s.tom} />
      </button>
    )
  }

  const grupos = GRUPOS.map((g) => ({ g, itens: menu.filter((m) => m.grupo === g) })).filter((x) => x.itens.length)
  const iniciais = (sessao.nome || '?').split(' ').map((p) => p[0]).slice(0, 2).join('').toUpperCase()

  return (
    <div className="md:flex">
      {/* desktop: barra lateral */}
      <aside className="nao-imprimir sticky top-0 hidden h-screen w-72 shrink-0 flex-col border-r border-[var(--borda)] bg-[var(--cartao)] md:flex">
        <div className="flex items-center gap-3 px-4 pb-3 pt-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[var(--marca)] text-lg font-black text-white">T</div>
          <div className="min-w-0">
            <div className="text-lg font-black leading-tight">Tudo</div>
            <div className="truncate text-xs text-[var(--suave)]">{dados?.config.nomeNegocio}</div>
          </div>
        </div>
        <nav className="min-h-0 flex-1 space-y-4 overflow-y-auto px-3 pb-3">
          {grupos.map(({ g, itens }) => (
            <div key={g}>
              <div className="mb-1 px-3 text-[11px] font-bold uppercase tracking-wider text-[var(--suave)]">{t(g)}</div>
              <div className="space-y-1">
                {itens.map((m) => (
                  <div key={m.tela} className="relative flex items-center">
                    <Item m={m} />
                    <span className="absolute right-1 top-1 opacity-0 transition group-hover:opacity-100 [div:hover>&]:opacity-100">
                      <Info texto={m.ajuda} />
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </nav>
        <div className="border-t border-[var(--borda)] p-3">
          <div className="flex items-center gap-3 rounded-2xl bg-[var(--fundo)] p-2">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--marca-suave)] text-sm font-bold text-[var(--marca)]">{iniciais}</div>
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-semibold">{sessao.nome}</div>
              <div className="text-xs text-[var(--suave)]">{t(sessao.perfil === 'admin' ? 'Administrador' : 'Funcionário')}</div>
            </div>
            <button type="button" onClick={sair} className="rounded-xl px-2 py-1 text-xs font-semibold text-[var(--marca)] hover:bg-[var(--marca-suave)]">
              {t('Sair')}
            </button>
          </div>
        </div>
      </aside>

      <div className="min-w-0 flex-1">
        {backend.tipo !== 'api' && (
          <div className="nao-imprimir flex items-center justify-center gap-2 bg-[var(--marca-suave)] px-4 py-1.5 text-center text-xs text-[var(--marca)]">
            {t('Modo demonstração: os dados ficam só neste aparelho.')}
            <span className="font-semibold md:hidden">· {sessao.nome}</span>
          </div>
        )}
        <main className="mx-auto max-w-6xl px-4 pb-28 pt-4 md:pb-10">{children}</main>
      </div>

      {/* celular: barra inferior com números ao vivo */}
      <nav className="nao-imprimir fixed inset-x-0 bottom-0 z-30 grid grid-cols-5 border-t border-[var(--borda)] bg-[var(--cartao)]/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden">
        {principais.map((m) => {
          const s = sinais[m.tela] ?? {}
          const ativo = nav.tela === m.tela
          return (
            <button key={m.tela} type="button" onClick={() => ir(m.tela)} aria-current={ativo ? 'page' : undefined} className={cx('relative flex min-h-14 flex-col items-center justify-center text-[11px] font-semibold', ativo ? 'text-[var(--marca)]' : 'text-[var(--suave)]')}>
              <span className={cx('flex h-8 w-12 items-center justify-center rounded-full text-lg transition', ativo && 'bg-[var(--marca-suave)]')} aria-hidden>
                {m.icone}
              </span>
              <span className="max-w-full truncate px-1">{t(m.nome).split(' ')[0]}</span>
              {s.badge && <span className="absolute right-3 top-1"><Selo texto={s.badge} tom={s.tom} /></span>}
            </button>
          )
        })}
        <button type="button" onClick={() => setMais(true)} className="flex min-h-14 flex-col items-center justify-center text-[11px] font-semibold text-[var(--suave)]">
          <span className="flex h-8 w-12 items-center justify-center text-lg" aria-hidden>☰</span>
          {t('Mais')}
        </button>
      </nav>
      {mais && (
        <div className="fixed inset-0 z-40 bg-black/40 md:hidden" onClick={() => setMais(false)}>
          <div className="absolute inset-x-0 bottom-0 max-h-[85vh] overflow-y-auto rounded-t-3xl bg-[var(--cartao)] p-4 pb-8" onClick={(e) => e.stopPropagation()}>
            <div className="mx-auto mb-3 h-1.5 w-10 rounded-full bg-[var(--borda)]" />
            <div className="mb-3 flex items-center gap-3 rounded-2xl bg-[var(--fundo)] p-2">
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[var(--marca-suave)] text-sm font-bold text-[var(--marca)]">{iniciais}</div>
              <div className="min-w-0 flex-1 text-sm font-semibold">{sessao.nome}</div>
              <button type="button" onClick={sair} className="rounded-xl px-3 py-2 text-sm font-semibold text-[var(--marca)]">{t('Sair')}</button>
            </div>
            {grupos.map(({ g, itens }) => (
              <div key={g} className="mb-3">
                <div className="mb-1 px-1 text-[11px] font-bold uppercase tracking-wider text-[var(--suave)]">{t(g)}</div>
                <div className="grid gap-2 sm:grid-cols-2">
                  {itens.map((m) => <Item key={m.tela} m={m} compacto />)}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
