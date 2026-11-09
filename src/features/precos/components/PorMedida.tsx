// PREÇOS › ABA TABELA › "Ver: Por medida" (só no celular, com 3+ compradores): um cartão por medida com a lista de
// compradores e o preço de cada um — a mesma edição célula a célula da grade, só que na vertical.
import { Botao, cx } from '../../../shared/ui/base'
import { useT } from '../../../shared/ui/i18n'
import { MenuAcoes, type Acao } from '../../../shared/ui/menuAcoes'
import { chave, precosDaMedida } from '../model/tabelaPrecoEdicao'
import { type Rascunho } from '../model/tipos'
import { Celula, type CelulaCtl } from './GradeEditavel'

export interface PorMedidaProps {
  g: Rascunho
  /** a versão publicada (para destacar o que mudou); tabela nova → undefined */
  base?: Rascunho
  celula: CelulaCtl
  acoesMedida(l: number): Acao[]
  onMedida(): void
}

export function PorMedida({ g, base, celula, acoesMedida, onMedida }: PorMedidaProps) {
  const t = useT()
  return (
    <div className="space-y-3 md:hidden">
      {g.linhas.map((l) => (
        <section key={l} className={cx('rounded-2xl border bg-[var(--cartao)] p-3', base && !base.linhas.includes(l) ? 'border-[var(--bom)]' : 'border-[var(--borda)]')}>
          <div className="mb-1 flex items-center justify-between">
            <h2 className="text-lg font-bold">{l} cm <span className="text-xs font-normal text-[var(--suave)]">· {precosDaMedida(g, l)}/{g.colunas.length}</span></h2>
            <MenuAcoes acoes={acoesMedida(l)} rotulo={t('Medida {n} cm', { n: l })} />
          </div>
          <ul className="divide-y divide-[var(--borda)]">
            {g.colunas.map((c) => (
              <li key={c.id} className="flex items-center justify-between gap-2 py-0.5">
                <span className="min-w-0 truncate text-sm">{c.nome}</span>
                <Celula k={chave(l, c.id)} rotulo={`${l} cm · ${c.nome}`} valor={g.valores[chave(l, c.id)]} antes={base?.valores[chave(l, c.id)]} comBase={!!base} c={celula} />
              </li>
            ))}
          </ul>
        </section>
      ))}
      <Botao variante="secundario" className="w-full" onClick={onMedida}>+ {t('Medida')}</Botao>
    </div>
  )
}
