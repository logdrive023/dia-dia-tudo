// O QUE ACONTECE COM AS MISTURAS AO JUNTAR (o painel da seleção e a janela "Só juntar" avisam ANTES de tocar):
// mistura intacta é desfeita e as partes entram uma a uma; mistura já mexida entra como um pacote só.
// A regra de verdade é do serviço (core/services/triagem.ts › abrirMisturas); aqui só a leitura para a tela.

interface LoteComMistura {
  codigo?: string
  unificado: number
  unificadoDe?: { id: string; codigo?: string }[]
  mistura?: { pode: boolean; porque?: string }
}

export interface PlanoJuntar {
  /** misturas que serão desfeitas: o código e as partes que entram no lugar */
  abrir: { codigo: string; partes: string[] }[]
  /** misturas já mexidas: entram inteiras */
  inteiras: string[]
  /** quantos pacotes de origem o pacote novo vai ter ("Misturado de N") */
  partes: number
}

export function planoJuntar(lotes: LoteComMistura[]): PlanoJuntar {
  const abrir: PlanoJuntar['abrir'] = []
  const inteiras: string[] = []
  let partes = 0
  for (const l of lotes) {
    const cod = l.codigo ?? '?'
    if (l.unificado > 0 && l.mistura?.pode && l.unificadoDe?.length) {
      abrir.push({ codigo: cod, partes: l.unificadoDe.map((x) => x.codigo ?? '?') })
      partes += l.unificadoDe.length
    } else {
      if (l.unificado > 0) inteiras.push(cod)
      partes += 1
    }
  }
  return { abrir, inteiras, partes }
}

/** as frases do aviso (já traduzidas), na ordem: o que é desfeito, o que entra inteiro e como fica o pacote novo */
export function avisoJuntar(p: PlanoJuntar, t: (s: string, v?: Record<string, string | number>) => string): string[] {
  if (!p.abrir.length && !p.inteiras.length) return []
  return [
    ...p.abrir.map((x) => `🔄 ${t('{c} já é uma mistura ({p}): ao juntar, ela é desfeita e as partes entram uma a uma. Fica no histórico.', { c: x.codigo, p: x.partes.join(' + ') })}`),
    ...p.inteiras.map((c) => `🔗 ${t('{c} já foi mexida depois de juntar: entra como um pacote só.', { c })}`),
    `➡️ ${t('O pacote novo fica “Misturado de {n}”.', { n: p.partes })}`,
  ]
}

/** o aviso de "feito" (toast): diz que a mistura antiga foi desfeita e que ficou no histórico */
export function avisoFeito(p: PlanoJuntar, t: (s: string, v?: Record<string, string | number>) => string, padrao: string): string {
  return p.abrir.length ? t('Mistura {c} desfeita, partes juntadas e histórico atualizado.', { c: p.abrir.map((x) => x.codigo).join(', ') }) : padrao
}
