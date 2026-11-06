// VER COMO (tabela × cartões) — a escolha padrão das listagens (Comprar, Triagem, Estoque, Vender e as próximas).
// Fica no ⚙ Filtros, no grupo "Como mostrar"; é lembrada por tela, neste aparelho. Os cartões são a MESMA linha padrão
// do celular (TabelaDados `celular` + `cartoes`): nenhuma tela desenha cartão próprio. No celular é sempre a linha
// padrão, então o grupo só aparece no computador (ou quando a tela tem mais o que mostrar nele, como as colunas).
import type { ReactNode } from 'react'
import { Escolha } from './base'
import { useTelaLarga } from './estoqueUi'
import { useLembrado } from './filtros'
import { GrupoFiltro } from './filtroPadrao'

export type VisaoLista = 'tabela' | 'cartoes'

/** a visão da lista desta tela (lembrada no aparelho); no celular, `cartoes` é sempre falso (vale a linha padrão) */
export function useVisaoLista(tela: string) {
  const larga = useTelaLarga()
  const [visao, setVisao] = useLembrado<VisaoLista>(`${tela}.visao`, 'tabela')
  return { visao, setVisao, cartoes: larga && visao === 'cartoes' }
}

/** o grupo "Como mostrar" do painel de Filtros: Tabela | Cartões (computador) e o que a tela quiser juntar (ex.: colunas) */
export function GrupoVisao({ visao, onVisao, children }: { visao: VisaoLista; onVisao(v: VisaoLista): void; children?: ReactNode }) {
  const larga = useTelaLarga()
  if (!larga && !children) return null
  return (
    <GrupoFiltro titulo="Como mostrar" icone="▦">
      {larga && <div className="col-span-full [&_button]:whitespace-nowrap"><Escolha rotulo="Ver como" valor={visao} onChange={(v) => onVisao(v as VisaoLista)} opcoes={[{ id: 'tabela', nome: '☰ Tabela' }, { id: 'cartoes', nome: '▦ Cartões' }]} /></div>}
      {children}
    </GrupoFiltro>
  )
}
