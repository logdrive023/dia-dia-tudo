// FILTRO DE UNIDADE — a peça única para escolher a unidade (Equipe, Agenda e onde mais tiver "unidade"):
//   "🏢 Todas as unidades ▾" → cada unidade numa linha: ícone do tipo, o APELIDO (ou o nome) e, embaixo, o que mais
//   tiver cadastrado — o nome oficial (quando tem apelido), o endereço curto (rua nº · bairro · cidade) e a referência.
// Tudo dinâmico: só aparece o que a unidade tem. Uma unidade só (ou nenhuma): o filtro some.
import type { Local } from '../core/domain/tipos'
import { BotaoEscolha } from './filtroPadrao'
import { useConsulta } from './contexto'

const ICONE_TIPO: Record<Local['tipo'], string> = { salao: '💇', ponto: '📍', outro: '🏢' }

/** como a unidade aparece: o apelido, senão o nome */
export const nomeUnidade = (l: Pick<Local, 'nome' | 'apelido'>) => l.apelido?.trim() || l.nome
/** a linha de baixo: nome oficial (se tem apelido) · endereço curto · referência */
export function detalheUnidade(l: Local) {
  const rua = [l.rua, l.numero].filter(Boolean).join(' ')
  const endereco = [rua, l.bairro, l.cidade].filter(Boolean).join(' · ')
  return [l.apelido?.trim() && l.nome, endereco, l.referencia].filter(Boolean).join(' — ') || undefined
}

export function FiltroUnidade({ valor, onChange, tipos, rotuloTodas = 'Todas as unidades' }: {
  valor: string
  onChange(id: string): void
  /** só estes tipos (ex.: ['salao']); padrão: todas */
  tipos?: Local['tipo'][]
  rotuloTodas?: string
}) {
  const { dados } = useConsulta('locais', {})
  const lista = (dados ?? []).filter((l) => !tipos || tipos.includes(l.tipo))
  if (lista.length < 2) return null
  return (
    <BotaoEscolha
      icone="🏢"
      rotulo="Unidade"
      valor={valor}
      onChange={onChange}
      opcoes={[{ id: '', nome: rotuloTodas }, ...lista.map((l) => ({ id: l.id, nome: nomeUnidade(l), icone: ICONE_TIPO[l.tipo], sub: detalheUnidade(l) }))]}
    />
  )
}
