// VENDER › ITENS SIMPLES: escolher itens de uma área sem gramas (serviço, produto) e a quantidade.
import { useState } from 'react'
import { novoId } from '../../core/domain/ids'
import type { Id } from '../../core/domain/tipos'
import { Botao, Cartao, ValorInput, Vazio } from '../../ui/base'
import { useConsulta } from '../../ui/contexto'
import { useT } from '../../ui/i18n'
import { type LinhaTela } from './tipos'

/** Serviços/produtos com preço sugerido (toque para adicionar; preço editável). */
export function ItensSimples({ moduloId, moeda, onAdd, rotulo = 'Itens', profissionalId }: { moduloId: string; moeda: string; onAdd(l: LinhaTela): void; rotulo?: string; profissionalId?: Id }) {
  const t = useT()
  const { dados: itens } = useConsulta('catalogo', { moduloId })
  const { dados: estoque } = useConsulta('estoque', { moduloId })
  const [precos, setPrecos] = useState<Record<Id, number | undefined>>({})
  const lista = (itens ?? []).filter((i) => i.ativo)
  return (
    <Cartao titulo={t(rotulo)}>
      {!lista.length ? (
        <Vazio texto="Nenhum item cadastrado neste módulo." />
      ) : (
        <ul className="grid gap-2 sm:grid-cols-2">
          {lista.map((i) => {
            const saldo = estoque?.find((e) => e.id === i.id)?.saldo
            const preco = precos[i.id] ?? i.precoSugerido?.valor
            const m = i.precoSugerido?.moeda ?? moeda
            return (
              <li key={i.id} className="rounded-xl border border-[var(--borda)] p-2">
                <div className="flex justify-between gap-2">
                  <span className="font-semibold">{i.nome}</span>
                  {i.controlaEstoque && <span className="text-xs text-[var(--suave)]">{t('tem')} {saldo ?? 0}</span>}
                </div>
                <div className="mt-2 flex gap-2">
                  <ValorInput moeda={m} valor={preco} onChange={(v) => setPrecos({ ...precos, [i.id]: v })} />
                  <Botao disabled={preco === undefined || (i.controlaEstoque && !saldo)} onClick={() => onAdd({ id: novoId(), itemId: i.id, nome: i.nome, quantidade: 1, moeda: m, total: preco!, unidade: i.unidade, profissionalId })}>
                    +
                  </Botao>
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </Cartao>
  )
}
