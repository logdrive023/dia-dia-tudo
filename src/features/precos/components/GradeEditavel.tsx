// PREÇOS › GRADE: a tabela de preços editável (medida × coluna de comprador), célula a célula.
import { fatorValido } from '../../../core/domain/dinheiro'
import { cx } from '../../../shared/ui/base'
import { useT } from '../../../shared/ui/i18n'
import { MenuAcoes, type Acao } from '../../../shared/ui/menuAcoes'
import { chave } from '../../../shared/ui/tabelaPrecoEdicao'
import { type Rascunho } from '../model/tipos'

export interface CelulaCtl {
  edit?: { k: string; texto: string }
  setTexto(t: string): void
  abrir(k: string): void
  tecla(e: React.KeyboardEvent<HTMLInputElement>): void
  sair(k: string): void
}

/** Um preço: mostra o número (ou "–"); toque → campo. Mudou em relação à versão publicada → destaque + "era 15". */
export function Celula({ k, rotulo, valor, antes, comBase, c }: { k: string; rotulo: string; valor?: string; antes?: string; comBase: boolean; c: CelulaCtl }) {
  const t = useT()
  const mudou = comBase && (antes ?? '') !== (valor ?? '')
  const ruim = !!valor && !fatorValido(valor)
  if (c.edit?.k === k)
    return (
      <input
        autoFocus
        aria-label={rotulo}
        inputMode="decimal"
        enterKeyHint="next"
        value={c.edit.texto}
        onFocus={(e) => e.currentTarget.select()}
        onChange={(e) => c.setTexto(e.target.value)}
        onKeyDown={c.tecla}
        onBlur={() => c.sair(k)}
        className={cx('num h-12 w-[4.75rem] rounded-lg bg-[var(--cartao)] text-center text-base font-bold outline-none ring-2', c.edit.texto.trim() && !fatorValido(c.edit.texto.trim()) ? 'ring-[var(--ruim)]' : 'ring-[var(--marca)]')}
      />
    )
  return (
    <button
      type="button"
      aria-label={`${rotulo}: ${valor || t('sem preço')}${mudou ? ` (${t('era {v}', { v: antes || '–' })})` : ''}`}
      onClick={() => c.abrir(k)}
      className={cx('num flex h-12 w-[4.75rem] flex-col items-center justify-center rounded-lg leading-tight hover:ring-1 hover:ring-[var(--marca)]', mudou && 'bg-[var(--marca-suave)]', ruim && 'bg-[var(--ruim)]/10')}
    >
      <span className={cx(!valor ? 'text-[var(--suave)] opacity-40' : mudou ? 'font-bold text-[var(--marca)]' : 'font-semibold', ruim && 'text-[var(--ruim)]')}>{valor || '–'}</span>
      {mudou && <span className="text-[10px] text-[var(--suave)]">{t('era {v}', { v: antes || '–' })}</span>}
    </button>
  )
}

export function GradeEditavel({ g, base, baixa, celula, acoesMedida, acoesColuna, onMedida, onComprador }: { g: Rascunho; base?: Rascunho; baixa?: boolean; celula: CelulaCtl; acoesMedida(l: number): Acao[]; acoesColuna(id: string): Acao[]; onMedida(): void; onComprador(): void }) {
  const t = useT()
  return (
    // altura limitada: o cabeçalho (compradores) fica grudado ao rolar; com a barra de publicar aberta, fica mais baixa
    <div className={cx('sem-barra overflow-auto rounded-2xl border border-[var(--borda)] bg-[var(--cartao)] [background:linear-gradient(to_right,var(--cartao)_30%,transparent),linear-gradient(to_left,var(--cartao)_30%,transparent)_100%_0,radial-gradient(farthest-side_at_100%_50%,rgba(0,0,0,.25),transparent)_100%_0] [background-attachment:local,local,scroll] [background-repeat:no-repeat] [background-size:40px_100%,40px_100%,14px_100%]', baixa ? 'max-h-[calc(100dvh-22rem)] min-h-[16rem] md:max-h-[calc(100dvh-19rem)]' : 'max-h-[calc(100dvh-15rem)] md:max-h-[calc(100dvh-13rem)]')}>
      <table className="border-separate border-spacing-0 text-sm">
        <thead>
          <tr>
            <th className="sticky left-0 top-0 z-30 border-b border-r border-[var(--borda)] bg-[var(--fundo)] px-2 py-2 text-left text-xs font-semibold text-[var(--suave)]">{t('cm')}</th>
            {g.colunas.map((c) => (
              <th key={c.id} scope="col" className={cx('sticky top-0 z-20 min-w-[5.25rem] border-b border-[var(--borda)] bg-[var(--fundo)] py-1 pl-2 pr-0 text-left text-xs font-semibold', base && !base.colunas.some((x) => x.id === c.id) && 'text-[var(--bom)]')}>
                <div className="flex items-center justify-between gap-0.5">
                  <span className="max-w-[7rem] truncate" title={c.nome}>{c.nome}{c.pessoaId ? <span aria-hidden className="ml-0.5 text-[var(--suave)]">·👤</span> : null}</span>
                  <MenuAcoes acoes={acoesColuna(c.id)} rotulo={t('Comprador {nome}', { nome: c.nome })} />
                </div>
              </th>
            ))}
            <th className="sticky top-0 z-20 border-b border-[var(--borda)] bg-[var(--fundo)] px-1">
              <button type="button" onClick={onComprador} aria-label={t('Adicionar comprador')} title={t('Adicionar comprador')} className="h-10 w-10 rounded-xl text-lg font-bold text-[var(--marca)] hover:bg-[var(--marca-suave)]">+</button>
            </th>
          </tr>
        </thead>
        <tbody>
          {g.linhas.map((l) => (
            <tr key={l}>
              <th scope="row" className={cx('sticky left-0 z-10 border-b border-r border-[var(--borda)] bg-[var(--cartao)] py-0 pl-2 pr-0 text-left', base && !base.linhas.includes(l) && 'text-[var(--bom)]')}>
                <div className="flex items-center gap-0.5">
                  <span className="num min-w-[2.25rem] text-base font-bold">{l}</span>
                  <MenuAcoes acoes={acoesMedida(l)} rotulo={t('Medida {n} cm', { n: l })} />
                </div>
              </th>
              {g.colunas.map((c) => {
                const k = chave(l, c.id)
                return (
                  <td key={c.id} className="border-b border-[var(--borda)] p-0.5 text-center">
                    <Celula k={k} rotulo={`${l} cm · ${c.nome}`} valor={g.valores[k]} antes={base?.valores[k]} comBase={!!base} c={celula} />
                  </td>
                )
              })}
              <td className="border-b border-[var(--borda)]" />
            </tr>
          ))}
          <tr>
            <th className="sticky left-0 z-10 bg-[var(--cartao)] p-1 text-left">
              <button type="button" onClick={onMedida} className="min-h-10 rounded-xl px-2 text-sm font-semibold text-[var(--marca)] hover:bg-[var(--marca-suave)]">+ {t('Medida')}</button>
            </th>
            <td colSpan={g.colunas.length + 1} />
          </tr>
        </tbody>
      </table>
    </div>
  )
}
