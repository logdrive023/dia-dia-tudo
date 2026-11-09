// A LISTA DE COMPRAS NA LOJA: uma barra presa embaixo ("🛒 3 pacotes · 2,4 kg") que abre no lugar, com os itens
// numerados, o total e o botão que manda tudo numa mensagem só. Fica dentro da loja para usar as cores dela.
import { useContext, useState } from 'react'
import type { MensagensVitrine, ModoPrecoVitrine, PacoteVitrine } from '../../../core/services/vitrine'
import { IdiomaContexto, useDicionario, useT } from '../../../shared/ui/i18n'
import { MAX_LISTA } from '../hooks/useListaCompras'
import { dinheiroLoja, kg } from '../model/formato'
import { idiomaDaMensagem, mensagemLista, totalLista, valorPacote } from '../model/mensagem'

export function ListaCompras({ pacotes, loja, whatsapp, modoPreco, mensagens, cheia, onTirar, onLimpar }: {
  pacotes: PacoteVitrine[]
  loja: string
  whatsapp: string
  modoPreco: ModoPrecoVitrine
  mensagens?: MensagensVitrine
  cheia: boolean
  onTirar(id: string): void
  onLimpar(): void
}) {
  const t = useT()
  const idioma = useContext(IdiomaContexto)
  useDicionario('es')
  const [aberta, setAberta] = useState(false)
  const texto = mensagemLista(idiomaDaMensagem(idioma, navigator.language), pacotes, loja, modoPreco, mensagens)
  const link = `https://wa.me/${whatsapp.replace(/\D/g, '')}?text=${encodeURIComponent(texto)}`
  const total = totalLista(pacotes, modoPreco)
  const quantos = pacotes.length === 1 ? t('1 pacote') : t('{n} pacotes', { n: pacotes.length })
  return (
    <section aria-label={t('Minha lista')} className="sticky bottom-3 z-30 mx-auto mt-4 max-w-lg overflow-hidden rounded-3xl border border-[var(--borda)] bg-[var(--cartao)] shadow-2xl">
      <button type="button" aria-expanded={aberta} onClick={() => setAberta(!aberta)} className="flex min-h-16 w-full items-center gap-3 px-4 py-2 text-left">
        <span aria-hidden className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[var(--marca)] text-xl">🛒</span>
        <span className="min-w-0 flex-1">
          <b className="block">{quantos}</b>
          <span className="num block truncate text-sm text-[var(--suave)]">{total}</span>
        </span>
        <span className="shrink-0 text-sm font-bold text-[var(--marca-texto)]">{t(aberta ? 'Fechar lista' : 'Ver lista')} <span aria-hidden className={aberta ? 'inline-block rotate-180' : 'inline-block'}>▴</span></span>
      </button>
      {aberta && (
        <div className="border-t border-[var(--borda)]">
          <ol className="max-h-[45vh] divide-y divide-[var(--borda)] overflow-y-auto px-4">
            {pacotes.map((p, k) => {
              const valor = valorPacote(p, modoPreco)
              return (
                <li key={p.id} className="flex items-center gap-3 py-2">
                  <span aria-hidden className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[var(--marca)] text-xs font-black text-[var(--sobre-marca)]">{k + 1}</span>
                  <span className="min-w-0 flex-1">
                    <b className="block text-sm">{p.medida} cm{p.cor ? ` · ${t(p.cor)}` : ''}{p.categoria !== 'Normal' ? ` · ${t(p.categoria)}` : ''}</b>
                    <span className="num block text-xs text-[var(--suave)]">{[p.codigo, kg(p.gramas), valor !== undefined && p.preco ? dinheiroLoja(valor, p.preco.moeda) : ''].filter(Boolean).join(' · ')}</span>
                  </span>
                  <button type="button" aria-label={t('Tirar {c} da lista', { c: p.codigo ?? `${p.medida} cm` })} onClick={() => onTirar(p.id)} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-lg text-[var(--suave)] hover:bg-[var(--fundo)]">×</button>
                </li>
              )
            })}
          </ol>
          <div className="space-y-2 border-t border-[var(--borda)] p-3">
            {cheia && <p className="text-center text-xs font-semibold text-[var(--suave)]">{t('Lista cheia: até {n} pacotes por mensagem.', { n: MAX_LISTA })}</p>}
            <a href={link} target="_blank" rel="noreferrer" className="flex min-h-12 items-center justify-center rounded-2xl bg-[#25d366] px-3 text-sm font-bold text-white transition hover:brightness-105">{t('Enviar lista por WhatsApp')}</a>
            <button type="button" onClick={onLimpar} className="min-h-11 w-full rounded-2xl text-sm font-semibold text-[var(--suave)] hover:bg-[var(--fundo)]">{t('Limpar lista')}</button>
          </div>
        </div>
      )}
    </section>
  )
}
