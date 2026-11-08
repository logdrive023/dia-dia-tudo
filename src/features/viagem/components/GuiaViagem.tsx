// PRIMEIRA VIAGEM (lista vazia, sem filtro): em vez de "nada por aqui", o caminho inteiro em 4 passos com exemplo,
// o botão de criar e o atalho para ver tudo funcionando com os dados de exemplo (Configurações › Modo teste).
import { Botao, Cartao } from '../../../shared/ui/base'
import { useApp } from '../../../shared/ui/contexto'
import { useT } from '../../../shared/ui/i18n'

const PASSOS = [
  { icone: '🧳', titulo: 'Crie a viagem', texto: 'Destino, quem vai e o orçamento dos gastos. Ex.: Sucre · Renata · Bs 800.' },
  { icone: '⛽', titulo: 'Lance cada gasto na hora', texto: 'Pelo botão ⛽ Gasto, no celular, mesmo sem internet. Ex.: ônibus Bs 120.' },
  { icone: '🛒', titulo: 'Registre as compras da viagem', texto: 'Cada compra feita lá fica ligada à viagem (o cabelo e o que foi pago).' },
  { icone: '🏁', titulo: 'Encerre e confira', texto: 'Conte o dinheiro que voltou: aparece o custo por kg real (cabelo + gastos).' },
]

export function GuiaPrimeiraViagem({ onNova }: { onNova(): void }) {
  const t = useT()
  const { ir } = useApp()
  return (
    <Cartao titulo={`💡 ${t('Como funciona uma viagem de compra')}`}>
      <ol className="grid gap-2 sm:grid-cols-2">
        {PASSOS.map((p, k) => (
          <li key={p.titulo} className="flex gap-3 rounded-2xl border border-[var(--borda)] p-3">
            <span aria-hidden className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[var(--marca-suave)] text-lg">{p.icone}</span>
            <span className="min-w-0">
              <b className="block text-sm"><span className="num text-[var(--marca)]">{k + 1}.</span> {t(p.titulo)}</b>
              <span className="mt-0.5 block text-xs text-[var(--suave)]">{t(p.texto)}</span>
            </span>
          </li>
        ))}
      </ol>
      <div className="mt-3 flex flex-wrap gap-2">
        <Botao grande className="min-w-max flex-1 sm:flex-none" onClick={onNova}>+ {t('Criar a primeira viagem')}</Botao>
        <Botao variante="leve" className="min-w-max flex-1 sm:flex-none" onClick={() => ir('config', { aba: 'teste' })}>🧪 {t('Ver com dados de exemplo')}</Botao>
      </div>
    </Cartao>
  )
}
