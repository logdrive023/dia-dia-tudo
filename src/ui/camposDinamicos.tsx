// CAMPOS DINÂMICOS: desenha os atributos de um tipo de item (os do código + os criados em Configurações › Atributos).
// A tela não conhece "cor" ou "química": lê a lista de campos e desenha cada um pelo tipo.

import type { CampoDef } from '../core/modulos'
import type { Campos } from '../core/domain/tipos'
import { Campo, Entrada, Selecao } from './base'
import { useT } from './i18n'

export function CamposDinamicos({ campos, valores, onChange, pular = [] }: { campos: CampoDef[]; valores: Campos; onChange(v: Campos): void; pular?: string[] }) {
  const t = useT()
  const mostrar = campos.filter((c) => !pular.includes(c.id))
  if (!mostrar.length) return null
  const mudar = (id: string, v: Campos[string] | '') => onChange({ ...valores, [id]: v === '' ? undefined : v })
  return (
    <div className="grid gap-2 sm:grid-cols-3">
      {mostrar.map((c) => {
        const v = valores[c.id]
        const rotulo = `${c.nome}${c.unidade ? ` (${c.unidade})` : ''}${c.obrigatorio ? ' *' : ''}`
        if (c.tipo === 'simNao')
          return (
            <label key={c.id} className="flex min-h-11 items-center gap-2 self-end text-sm">
              <input type="checkbox" className="h-5 w-5" checked={v === true} onChange={(e) => mudar(c.id, e.target.checked)} /> {t(c.nome)}
            </label>
          )
        return (
          <Campo key={c.id} rotulo={rotulo} ajuda={c.ajuda}>
            {c.tipo === 'lista' ? (
              <Selecao valor={v === undefined ? '' : String(v)} vazio="—" onChange={(x) => mudar(c.id, x)} opcoes={(c.opcoes ?? []).map((o) => ({ id: o, nome: o }))} />
            ) : c.tipo === 'numero' ? (
              <Entrada inputMode="decimal" value={v === undefined ? '' : String(v)} onChange={(e) => mudar(c.id, e.target.value === '' ? '' : Number(e.target.value.replace(',', '.')) || 0)} />
            ) : (
              <Entrada value={v === undefined ? '' : String(v)} onChange={(e) => mudar(c.id, e.target.value)} />
            )}
          </Campo>
        )
      })}
    </div>
  )
}

/** Texto curto dos atributos preenchidos ("Cor: Preto · Química: sim"), na ordem dos campos. */
export function resumoCampos(campos: CampoDef[], valores: Campos, pular: string[] = []) {
  return campos
    .filter((c) => !pular.includes(c.id) && valores[c.id] !== undefined && valores[c.id] !== '')
    .map((c) => ({ id: c.id, nome: c.nome, valor: c.tipo === 'simNao' ? (valores[c.id] ? 'sim' : 'não') : `${valores[c.id]}${c.unidade ? ` ${c.unidade}` : ''}` }))
}
