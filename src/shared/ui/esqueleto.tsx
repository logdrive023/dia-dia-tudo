// ESQUELETOS (carregando sem pular a tela): cada um tem o MESMO contorno do que vai chegar — mesma borda, mesmo
// espaçamento, mesma altura de linha —, então quando os dados chegam nada empurra nada (sem "salto").
//   EsqueletoBloco   — título + linhas (aba, cartão de texto) · é o Carregando padrão
//   EsqueletoTabela  — cabeçalho + linhas com as colunas de verdade e a coluna de ações (computador);
//                      no celular, linhas curtas como a lista (2 linhas de texto + valor à direita)
//   EsqueletoCartoes — a grade dos números grandes (rótulo, número, selo), 2 por linha no celular
// Todos: aparecem depois de 150 ms (resposta rápida não pisca), brilham de leve e param com "menos movimento"
// (classes .carregando-esqueleto e .esqueleto em index.css). O texto "Carregando…" fica para leitor de tela.
import { useT } from './i18n'

// sem importar o base (o Carregando do base usa este arquivo: importar de volta faria um ciclo)
const cx = (...c: (string | false | undefined)[]) => c.filter(Boolean).join(' ')

const Barra = ({ className, largura }: { className?: string; largura?: string }) => (
  <span aria-hidden className={cx('esqueleto block rounded-md', className)} style={largura ? { width: largura } : undefined} />
)
/** larguras variadas (parece texto de verdade, não uma grade de tijolos) */
const VARIA = ['92%', '70%', '84%', '60%', '76%']

function Leitor() {
  const t = useT()
  return <span className="sr-only">{t('Carregando…')}</span>
}

export function EsqueletoBloco({ linhas = 3 }: { linhas?: number }) {
  return (
    <div role="status" aria-live="polite" className="carregando-esqueleto min-h-32 space-y-3 rounded-2xl border border-[var(--borda)] bg-[var(--cartao)] p-4">
      <Leitor />
      <Barra className="h-4" largura="40%" />
      {Array.from({ length: linhas }, (_, k) => <Barra key={k} className="h-3" largura={VARIA[k % VARIA.length]} />)}
    </div>
  )
}

/** a tabela padrão (TabelaDados) enquanto carrega: mesmas colunas, mesma altura de linha, a coluna de ações à direita */
export function EsqueletoTabela({ colunas = 4, linhas = 5, acoes = false }: { colunas?: number; linhas?: number; acoes?: boolean }) {
  const cols = Math.max(1, Math.min(colunas, 8))
  return (
    <div role="status" aria-live="polite" aria-busy className="carregando-esqueleto overflow-hidden rounded-2xl border border-[var(--borda)] bg-[var(--cartao)]">
      <Leitor />
      {/* computador: cabeçalho + linhas em grade, com as colunas de verdade */}
      <div className="hidden md:block">
        <div className="grid items-center gap-4 border-b border-[var(--borda)] px-3 py-2.5" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0,1fr))${acoes ? ' 2.5rem' : ''}` }}>
          {Array.from({ length: cols }, (_, c) => <Barra key={c} className="h-3 opacity-70" largura={c === 0 ? '55%' : '40%'} />)}
          {acoes && <span />}
        </div>
        {Array.from({ length: linhas }, (_, l) => (
          <div key={l} className="grid min-h-12 items-center gap-4 border-t border-[var(--borda)] px-3 first:border-t-0" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0,1fr))${acoes ? ' 2.5rem' : ''}` }}>
            {Array.from({ length: cols }, (_, c) => <Barra key={c} className="h-3.5" largura={VARIA[(l + c) % VARIA.length]} />)}
            {acoes && <Barra className="mx-auto h-8 w-8 rounded-full" />}
          </div>
        ))}
      </div>
      {/* celular: a linha curta da lista (título + detalhe à esquerda, valor à direita) */}
      <div className="md:hidden">
        {Array.from({ length: linhas }, (_, l) => (
          <div key={l} className="flex min-h-16 items-center gap-3 border-t border-[var(--borda)] px-3 py-3 first:border-t-0">
            <span className="min-w-0 flex-1 space-y-2"><Barra className="h-3.5" largura={VARIA[l % VARIA.length]} /><Barra className="h-3" largura="45%" /></span>
            <Barra className="h-4 w-16 shrink-0" />
          </div>
        ))}
      </div>
    </div>
  )
}

/** a grade dos números grandes (GrupoNumeros/NumeroGrande): rótulo pequeno, o número, um selo */
export function EsqueletoCartoes({ quantos = 4 }: { quantos?: number }) {
  return (
    <div role="status" aria-live="polite" aria-busy className="carregando-esqueleto grid grid-cols-2 gap-2 sm:gap-3 md:grid-cols-4">
      <Leitor />
      {Array.from({ length: quantos }, (_, k) => (
        <div key={k} className="min-h-[6.5rem] space-y-2.5 rounded-2xl border border-[var(--borda)] bg-[var(--cartao)] p-3">
          <Barra className="h-3" largura="55%" />
          <Barra className="h-7" largura="70%" />
          <Barra className="h-4 rounded-full" largura="45%" />
        </div>
      ))}
    </div>
  )
}
