// TEXTO FORMATADO: o mesmo jeito de arrumar o que se digita (ao sair do campo) e o que se mostra (no relatório).
//   limparEspacos  "  Av.  6 de   Agosto "  → "Av. 6 de Agosto"
//   nomeProprio    "maria DA silva"        → "Maria da Silva" (de, da, do, del, y, e… ficam minúsculas)
//   soNumeros      "123.456-7"             → "1234567" (NIT, CI: só os dígitos)
// Não inventa formato oficial: só tira o que sobra e põe maiúscula no começo das palavras.

export const limparEspacos = (s: string) => s.replace(/\s+/g, ' ').trim()

/** palavras que ficam minúsculas no meio de um nome (português e espanhol) */
const MINUSCULAS = new Set(['de', 'da', 'do', 'das', 'dos', 'del', 'la', 'las', 'los', 'el', 'y', 'e'])

export function nomeProprio(s: string): string {
  return limparEspacos(s)
    .split(' ')
    .map((p, i) => {
      const baixa = p.toLocaleLowerCase('es')
      if (i > 0 && MINUSCULAS.has(baixa)) return baixa
      // sigla ou abreviação já em maiúsculas (S.R.L., SRL, Av.) fica como está
      if (p.length > 1 && p === p.toLocaleUpperCase('es') && /\p{L}/u.test(p)) return p
      return baixa.charAt(0).toLocaleUpperCase('es') + baixa.slice(1)
    })
    .join(' ')
}

export const soNumeros = (s: string) => s.replace(/\D/g, '')

/** o cabeçalho da empresa (relatório impresso, IR): arrumado ao salvar e de novo ao mostrar (dados salvos antes) */
export function empresaFormatada<E extends { razaoSocial?: string; nit?: string; endereco?: string; atividade?: string; contador?: string; representante?: string }>(e: E) {
  const o = (s: string | undefined, f: (x: string) => string) => (s === undefined ? undefined : f(s) || undefined)
  return {
    razaoSocial: o(e.razaoSocial, limparEspacos),
    nit: o(e.nit, soNumeros),
    endereco: o(e.endereco, nomeProprio),
    atividade: o(e.atividade, limparEspacos),
    contador: o(e.contador, nomeProprio),
    representante: o(e.representante, nomeProprio),
  }
}
