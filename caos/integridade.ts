// OPERAÇÃO CAOS — o conferidor de integridade usado por todas as baterias: não confia na tela, lê os repositórios e
// reconstrói tudo a partir do histórico. Devolve a lista de problemas (vazia = íntegro).
import type { BackendNoAparelho } from '../src/adapters/noAparelho'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Qualquer = any

export async function conferir(b: BackendNoAparelho): Promise<string[]> {
  const repos = (b as unknown as { repos: Qualquer }).repos
  const problemas: string[] = []
  // 1. o autodiagnóstico do próprio sistema (saldo × movimentos, caixa × transação, pagamentos × total, contas)
  try {
    const d = await b.consulta('diagnostico' as never, {} as never) as { problemas: string[] }
    problemas.push(...d.problemas.map((p) => `[diagnostico] ${p}`))
  } catch (e) {
    problemas.push(`[diagnostico] falhou: ${(e as Error).message}`)
  }
  // 2. referências: movimento de estoque sem item, linha de transação com item inexistente, origem apontando para nada
  const itens = new Map<string, Qualquer>((await repos.itens.listar()).map((i: Qualquer) => [i.id, i]))
  const trans = new Map<string, Qualquer>((await repos.transacoes.listar()).map((t: Qualquer) => [t.id, t]))
  const movs: Qualquer[] = repos.movEstoque ? await repos.movEstoque.listar() : []
  for (const m of movs) if (!itens.has(m.itemId)) problemas.push(`[órfão] movimento ${m.id} sem item ${m.itemId}`)
  for (const t of trans.values()) for (const l of t.linhas ?? []) if (l.itemId && !itens.has(l.itemId)) problemas.push(`[órfão] ${t.tipo} ${t.codigo ?? t.id} linha com item inexistente ${l.itemId}`)
  // 3. estado inválido: saldo negativo, quantidades não inteiras, totais NaN
  for (const i of itens.values()) {
    if (i.controlaEstoque && i.saldo < 0) problemas.push(`[estado] ${i.codigo ?? i.id} saldo negativo ${i.saldo}`)
    if (!Number.isInteger(i.saldo)) problemas.push(`[estado] ${i.codigo ?? i.id} saldo não inteiro ${i.saldo}`)
  }
  for (const t of trans.values()) if (!Number.isFinite(t.totalPrincipal)) problemas.push(`[estado] ${t.tipo} ${t.id} total inválido ${t.totalPrincipal}`)
  // 4. códigos repetidos (duplicidade)
  const cod = new Map<string, number>()
  for (const i of itens.values()) if (i.codigo && !i.apagadoEm) cod.set(i.codigo, (cod.get(i.codigo) ?? 0) + 1)
  for (const [c, n] of cod) if (n > 1) problemas.push(`[duplicado] código de pacote ${c} em ${n} itens`)
  const codT = new Map<string, number>()
  for (const t of trans.values()) if (t.codigo) codT.set(`${t.tipo}:${t.codigo}`, (codT.get(`${t.tipo}:${t.codigo}`) ?? 0) + 1)
  for (const [c, n] of codT) if (n > 1) problemas.push(`[duplicado] código ${c} em ${n} transações`)
  return problemas
}

/** o item que TEM de existir na lista: não achou → o teste falha dizendo o quê (e o tipo deixa de ser "talvez undefined") */
export function achar<T>(lista: readonly T[], pred: (x: T) => boolean, oQue: string): T {
  const x = lista.find(pred)
  if (x === undefined) throw new Error(`não achou: ${oQue}`)
  return x
}

/** os repositórios crus (para a bateria investigar além da tela) */
export const reposDe = (b: BackendNoAparelho) => (b as unknown as { repos: Qualquer }).repos
