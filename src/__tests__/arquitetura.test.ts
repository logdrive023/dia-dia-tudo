// ARQUITETURA POR DOMÍNIO (docs/architecture/ARQUITETURA.md): as regras de dependência viram teste, para a estrutura não se desfazer.
//   app ─► features ─► shared ─► core          adapters ─► core          (a seta é "pode importar")
//   · core (regras de negócio) não conhece tela, peça, app nem adaptador;
//   · shared (peças comuns) não conhece domínio nem app;
//   · domínio não importa o app, e só usa outro domínio pelo index.ts dele (o contrato público);
//   · nenhum ciclo de import novo (os 3 antigos estão listados abaixo, para resolver depois).
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { dirname, join, normalize, relative } from 'node:path'
import { describe, expect, it } from 'vitest'

const SRC = join(__dirname, '..')
const rel = (p: string) => relative(SRC, p).split('\\').join('/')
const arquivos: string[] = []
const andar = (d: string) => {
  for (const n of readdirSync(d)) {
    const c = join(d, n)
    if (statSync(c).isDirectory()) andar(c)
    else if (/\.(ts|tsx)$/.test(n)) arquivos.push(rel(c))
  }
}
andar(SRC)
const existe = new Set(arquivos)
const ehTeste = (p: string) => p.startsWith('__tests__/') || p.includes('/tests/') || /\.test\.tsx?$/.test(p)
function resolver(de: string, alvo: string) {
  const b = normalize(join(dirname(de), alvo)).split('\\').join('/')
  return ['', '.ts', '.tsx', '/index.ts', '/index.tsx'].map((e) => b + e).find((x) => existe.has(x))
}
/** imports de VALOR e de tipo (as duas amarram a estrutura), relativos, de cada arquivo (sem testes) */
const imports = new Map<string, string[]>()
for (const a of arquivos.filter((x) => !ehTeste(x))) {
  const s = readFileSync(join(SRC, a), 'utf8')
  const alvos: string[] = []
  for (const m of s.matchAll(/^\s*(?:import|export)\s+(?:type\s+)?(?:[^'"]*?\sfrom\s+)?['"](\.[^'"]+)['"]/gm)) {
    const r = resolver(a, m[1])
    if (r) alvos.push(r)
  }
  imports.set(a, alvos)
}
const camada = (p: string) => p.split('/')[0]
const dominio = (p: string) => (p.startsWith('features/') ? p.split('/')[1] : undefined)

describe('arquitetura por domínio', () => {
  it('cada camada só importa o que pode', () => {
    const PROIBIDO: Record<string, string[]> = {
      core: ['shared', 'features', 'app', 'adapters'],
      adapters: ['shared', 'features', 'app'],
      shared: ['features', 'app'],
      features: ['app'],
    }
    const violam: string[] = []
    for (const [a, alvos] of imports)
      for (const r of alvos) if (PROIBIDO[camada(a)]?.includes(camada(r))) violam.push(`${a} → ${r}`)
    expect(violam).toEqual([])
  })

  it('um domínio só usa outro pelo index.ts (contrato público)', () => {
    const violam: string[] = []
    for (const [a, alvos] of imports)
      for (const r of alvos) {
        const da = dominio(a), dr = dominio(r)
        if (da && dr && da !== dr && r !== `features/${dr}/index.ts`) violam.push(`${a} → ${r}`)
      }
    expect(violam).toEqual([])
  })

  it('o app usa os domínios só pelo index.ts', () => {
    const violam: string[] = []
    for (const [a, alvos] of imports)
      if (camada(a) === 'app') for (const r of alvos) if (dominio(r) && !r.endsWith('/index.ts')) violam.push(`${a} → ${r}`)
    expect(violam).toEqual([])
  })

  it('tela não acessa persistência direto: domínio não importa adapters (só os conhecidos)', () => {
    // telas de ferramenta do aparelho (backup, modo teste, câmbio, entrar com dados de exemplo): resolver e tirar daqui
    const CONHECIDOS = new Set(['features/acesso/pages/Entrar.tsx', 'features/config/components/Dados.tsx', 'features/config/components/ModoTeste.tsx', 'features/config/components/Moedas.tsx'])
    const violam = [...imports].filter(([a, alvos]) => camada(a) === 'features' && !CONHECIDOS.has(a) && alvos.some((r) => camada(r) === 'adapters')).map(([a]) => a)
    expect(violam).toEqual([])
  })

  it('shared não é depósito: o que só UM domínio usa fica dentro dele', () => {
    // só a compra usa: descer para features/compra quando a tela for mexida, e tirar daqui
    const CONHECIDOS = new Set(['shared/ui/cartaoSecao.tsx', 'shared/ui/valorMoeda.tsx'])
    const usadoPor = new Map<string, Set<string>>()
    for (const [a, alvos] of imports) for (const r of alvos) if (camada(r) === 'shared') usadoPor.set(r, (usadoPor.get(r) ?? new Set()).add(dominio(a) ?? camada(a)))
    const violam = [...usadoPor].filter(([r, quem]) => quem.size === 1 && !quem.has('shared') && !quem.has('app') && !CONHECIDOS.has(r)).map(([r, quem]) => `${r} → só ${[...quem][0]}`)
    expect(violam).toEqual([])
  })

  it('imports relativos: atalho "@/" esconderia o caminho das regras de camada acima', () => {
    const violam = arquivos.filter((a) => /from\s+['"]@\//.test(readFileSync(join(SRC, a), 'utf8')))
    expect(violam).toEqual([])
  })

  it('nenhum ciclo de import novo', () => {
    // ciclos antigos, conhecidos (fila do CONTINUAR.md): resolver e tirar daqui
    const CONHECIDOS = [
      'core/services/estoque.ts|core/services/fotos.ts',
      'core/services/comissoes.ts|core/services/financiamentos.ts',
      'features/config/components/Funcionaria.tsx|features/config/model/configSecoes.ts|features/config/pages/Config.tsx',
    ]
    // Tarjan (componentes fortemente conexos)
    let i = 0
    const idx = new Map<string, number>(), low = new Map<string, number>(), pilha: string[] = [], naPilha = new Set<string>()
    const ciclos: string[] = []
    const visitar = (v: string) => {
      idx.set(v, i); low.set(v, i); i++; pilha.push(v); naPilha.add(v)
      for (const w of imports.get(v) ?? []) {
        if (!idx.has(w)) { visitar(w); low.set(v, Math.min(low.get(v)!, low.get(w)!)) }
        else if (naPilha.has(w)) low.set(v, Math.min(low.get(v)!, idx.get(w)!))
      }
      if (low.get(v) === idx.get(v)) {
        const comp: string[] = []
        let w: string
        do { w = pilha.pop()!; naPilha.delete(w); comp.push(w) } while (w !== v)
        if (comp.length > 1) ciclos.push(comp.sort().join('|'))
      }
    }
    for (const v of imports.keys()) if (!idx.has(v)) visitar(v)
    expect(ciclos.filter((c) => !CONHECIDOS.includes(c))).toEqual([])
  })
})
