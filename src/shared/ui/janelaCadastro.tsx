// JANELA DE CADASTRO: o mesmo modal para criar e para editar qualquer coisa das Configurações (unidade, usuário,
// item do catálogo, modalidade, senha…).
//   · título "Nova unidade" / "Editar unidade" (quem chama passa os dois textos);
//   · os campos em GRUPOS com nome (ex.: "Quem é", "Endereço"), em 2 colunas no computador e 1 no celular;
//   · rodapé igual em todos: [Cancelar] [Salvar]; Salvar fica apagado enquanto falta algo obrigatório.
import type { ReactNode } from 'react'
import { Botao, Janela, cx } from './base'
import { useT } from './i18n'

export function JanelaCadastro({ titulo, onFechar, onSalvar, ocupado, podeSalvar = true, rotuloSalvar = 'Salvar', larga, children }: {
  titulo: string
  onFechar(): void
  onSalvar(): void
  ocupado?: boolean
  /** false enquanto falta algo obrigatório */
  podeSalvar?: boolean
  rotuloSalvar?: string
  larga?: boolean
  children: ReactNode
}) {
  const t = useT()
  return (
    <Janela aberta larga={larga} titulo={t(titulo)} onFechar={onFechar}
      rodape={
        <div className="flex gap-2">
          <Botao variante="leve" grande className="shrink-0" onClick={onFechar}>{t('Cancelar')}</Botao>
          <Botao grande className="w-full" disabled={ocupado || !podeSalvar} onClick={onSalvar}>{t(rotuloSalvar)}</Botao>
        </div>
      }>
      <div className="space-y-5">{children}</div>
    </Janela>
  )
}

/** um grupo de campos com nome; `colunas={1}` para campos que precisam da largura toda */
export function GrupoCampos({ titulo, children, colunas = 2, className }: { titulo?: string; children: ReactNode; colunas?: 1 | 2; className?: string }) {
  const t = useT()
  return (
    <section className={className}>
      {titulo && <h3 className="mb-2 text-xs font-bold uppercase tracking-wide text-[var(--suave)]">{t(titulo)}</h3>}
      <div className={cx('grid items-start gap-3', colunas === 2 && 'sm:grid-cols-2')}>{children}</div>
    </section>
  )
}
