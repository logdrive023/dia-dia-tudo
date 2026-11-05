// PEÇAS DO RELATÓRIO CONTÁBIL — as mesmas na tela e na impressão (o que a pessoa vê é o que sai no papel):
//   · valorContabil: "1.234,56" e negativo entre parênteses "(130,00)", como em todo estado financeiro
//   · TabelaResultado: as linhas (contas recuadas, subtotal com linha em cima, total com linha dupla)
//   · TabelaAnexo: tabela simples de anexo (cabeçalho, linhas, total no pé)
//   · TEXTO: os nomes das seções no padrão escolhido (🇧🇴 espanhol · 🇧🇷 português)
import type { ReactNode } from 'react'
import type { LinhaRelatorio } from '../../core/services/contabilidade'
import type { useConsulta } from '../../ui/contexto'
import { cx } from '../../ui/base'

export type Relatorio = NonNullable<ReturnType<typeof useConsulta<'relatorioContabil'>>['dados']>

export function valorContabil(v: number, pais: 'BO' | 'BR') {
  const n = (Math.abs(v) / 100).toLocaleString(pais === 'BO' ? 'es-BO' : 'pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  return v < 0 ? `(${n})` : n
}

export const TEXTO = {
  BO: {
    expresado: (m: string) => `Expresado en ${m === 'BOB' ? 'Bolivianos (Bs)' : m}`, periodo: 'Del {de} al {ate}', nit: 'NIT', regime: 'Régimen',
    impostos: 'Determinación de impuestos (estimada)', estimativa: 'ESTIMACIÓN para planificar y acompañar el negocio: los importes reales salen de la declaración del período (con todos los créditos, compensaciones y ajustes). No reemplaza al contador.', carga: 'Carga tributaria estimada', sobreVentas: 'de las ventas', conferencia: 'Conferencia de saldos', notas: 'Notas', anexos: 'Anexos', activo: 'ACTIVO', pasivo: 'PASIVO', patrimonio: 'PATRIMONIO',
    totalActivo: 'Total activo', totalPasivo: 'Total pasivo', patrimonioTotal: 'Total patrimonio (activo − pasivo)', diario: 'Libro Diario de Caja', vendas: 'Ventas línea por línea', compras: 'Compras línea por línea',
    inventario: 'Libro de Inventarios (a costo)', gastos: 'Gastos por categoría', cuentas: 'Cuentas por cobrar y por pagar', cobrar: 'Por cobrar', pagar: 'Por pagar',
    contador: 'Contador(a)', representante: 'Representante legal', gerado: 'Generado el {d} por {q}', saldoInicial: 'Saldo inicial', saldoFinal: 'Saldo final', total: 'Total', ok: 'cuadra', dif: 'diferencia',
    col: { data: 'Fecha', descricao: 'Concepto', forma: 'Forma', entrada: 'Ingreso', saida: 'Egreso', saldo: 'Saldo', cliente: 'Cliente', item: 'Detalle', qtd: 'Cant.', venda: 'Venta', custo: 'Costo', lucro: 'Utilidad', fornecedor: 'Proveedor', etapa: 'Estado', valor: 'Importe', codigo: 'Código', categoria: 'Categoría', pessoa: 'Persona' },
  },
  BR: {
    expresado: (m: string) => `Valores em ${m === 'BRL' ? 'reais (R$)' : m}`, periodo: 'De {de} a {ate}', nit: 'CNPJ/NIT', regime: 'Regime',
    impostos: 'Apuração dos impostos (estimada)', estimativa: 'ESTIMATIVA para planejar e acompanhar o negócio: os valores reais saem da apuração do período (com todos os créditos, compensações e ajustes). Não substitui o contador.', carga: 'Carga tributária estimada', sobreVentas: 'das vendas', conferencia: 'Conferência dos saldos', notas: 'Notas explicativas', anexos: 'Anexos', activo: 'ATIVO', pasivo: 'PASSIVO', patrimonio: 'PATRIMÔNIO LÍQUIDO',
    totalActivo: 'Total do ativo', totalPasivo: 'Total do passivo', patrimonioTotal: 'Patrimônio líquido (ativo − passivo)', diario: 'Livro Caixa', vendas: 'Vendas linha a linha', compras: 'Compras linha a linha',
    inventario: 'Inventário de estoques (a custo)', gastos: 'Despesas por categoria', cuentas: 'Contas a receber e a pagar', cobrar: 'A receber', pagar: 'A pagar',
    contador: 'Contador(a)', representante: 'Representante legal', gerado: 'Gerado em {d} por {q}', saldoInicial: 'Saldo inicial', saldoFinal: 'Saldo final', total: 'Total', ok: 'confere', dif: 'diferença',
    col: { data: 'Data', descricao: 'Histórico', forma: 'Forma', entrada: 'Entrada', saida: 'Saída', saldo: 'Saldo', cliente: 'Cliente', item: 'Descrição', qtd: 'Qtd.', venda: 'Venda', custo: 'Custo', lucro: 'Lucro', fornecedor: 'Fornecedor', etapa: 'Etapa', valor: 'Valor', codigo: 'Código', categoria: 'Categoria', pessoa: 'Pessoa' },
  },
} as const

/** o Estado de Resultados / DRE (e o quadro de impostos): conta recuada, subtotal com linha, total com linha dupla */
export function TabelaResultado({ linhas, pais, onAnexo, impressao }: { linhas: LinhaRelatorio[]; pais: 'BO' | 'BR'; onAnexo?(a: string): void; impressao?: boolean }) {
  return (
    <table className="w-full border-collapse text-sm">
      <tbody>
        {linhas.map((l) => (
          <tr key={l.id} className={cx(l.tipo === 'subtotal' && 'border-t border-[var(--texto)]/30 font-semibold', l.tipo === 'total' && 'border-y-[3px] border-double border-[var(--texto)]/60 text-base font-bold')}>
            <td className={cx('py-1.5 pr-3', l.tipo === 'conta' && 'pl-5')}>
              {l.rotulo}
              {l.conta && <span className="ml-2 text-[11px] font-normal text-[var(--suave)]">{l.conta}</span>}
              {!impressao && onAnexo && l.anexo && <button type="button" onClick={() => onAnexo(l.anexo!)} className="nao-imprimir ml-2 rounded px-1 text-[11px] font-semibold text-[var(--marca)] hover:bg-[var(--marca-suave)]">ver ›</button>}
            </td>
            <td className={cx('num whitespace-nowrap py-1.5 text-right tabular-nums', l.valor < 0 && 'text-[var(--ruim)] print:text-black')}>{valorContabil(l.valor, pais)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

export interface ColunaAnexo<T> { titulo: string; celula(l: T): ReactNode; direita?: boolean; total?: number }

/** tabela de anexo: cabeçalho fixo, linhas e (se tiver) a linha de total */
export function TabelaAnexo<T>({ colunas, linhas, vazio, pais }: { colunas: ColunaAnexo<T>[]; linhas: T[]; vazio: string; pais: 'BO' | 'BR' }) {
  if (!linhas.length) return <p className="py-2 text-sm text-[var(--suave)]">{vazio}</p>
  const temTotal = colunas.some((c) => c.total !== undefined)
  return (
    <div className="overflow-x-auto print:overflow-visible">
      <table className="w-full border-collapse text-[13px] print:text-[10px]">
        <thead>
          <tr className="border-b-2 border-[var(--texto)]/40 text-left text-[11px] uppercase tracking-wide text-[var(--suave)] print:text-black">
            {colunas.map((c) => <th key={c.titulo} className={cx('whitespace-nowrap px-1.5 py-1 font-semibold', c.direita && 'text-right')}>{c.titulo}</th>)}
          </tr>
        </thead>
        <tbody>
          {linhas.map((l, k) => (
            <tr key={k} className="border-b border-[var(--borda)] print:break-inside-avoid">
              {colunas.map((c) => <td key={c.titulo} className={cx('px-1.5 py-1 align-top', c.direita && 'num whitespace-nowrap text-right tabular-nums')}>{c.celula(l)}</td>)}
            </tr>
          ))}
        </tbody>
        {temTotal && (
          <tfoot>
            <tr className="border-t-2 border-[var(--texto)]/50 font-bold">
              {colunas.map((c, k) => <td key={c.titulo} className={cx('px-1.5 py-1.5', c.direita && 'num whitespace-nowrap text-right tabular-nums')}>{c.total !== undefined ? valorContabil(c.total, pais) : k === 0 ? TEXTO[pais].total : ''}</td>)}
            </tr>
          </tfoot>
        )}
      </table>
    </div>
  )
}
