// A LOJA EM SI (topo, filtros, pacotes): a MESMA peça na página do comprador (#/loja) e na prévia ao vivo do gerador —
// o que aparece na prévia é o que o comprador vê. As cores vêm de model/aparencia.ts, só nesta raiz.
// Só dados públicos (o serviço não manda custo, fornecedor nem compra). "Quero este" abre o WhatsApp com a mensagem pronta.
import { useContext, useState } from 'react'
import { APARENCIA_PADRAO, type AparenciaVitrine, type MensagensVitrine, type ModoPrecoVitrine, type PacoteVitrine } from '../../../core/services/vitrine'
import { cx, gramasTexto } from '../../../shared/ui/base'
import { useUrlFoto } from '../../../shared/ui/fotos'
import { IdiomaContexto, useT } from '../../../shared/ui/i18n'
import { estiloLoja } from '../model/aparencia'
import { idiomaDaMensagem, mensagemLoja, mensagemPacote } from '../model/mensagem'
import { CapaLoja } from './CapaLoja'

const SIMBOLO: Record<string, string> = { BOB: 'Bs', USD: 'US$', BRL: 'R$', PYG: '₲' }
const numero = (fator: string) => Number(fator.replace(/\./g, '').replace(',', '.'))
const dinheiro = (v: number, moeda: string) => `${SIMBOLO[moeda] ?? moeda} ${v.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
export const kg = (g: number) => (g >= 1000 ? `${(g / 1000).toLocaleString(undefined, { maximumFractionDigits: 2 })} kg` : gramasTexto(g))

/** a cor do cabelo vira a cor do desenho quando não há foto */
const TOM_COR: Record<string, string> = { Preto: '#1f1b1a', Castanho: '#5b3a29', 'Castanho claro': '#8a5a3c', Loiro: '#c9a063', Ruivo: '#9a3b1f', Misturado: '#6b4a3a' }

export function CartaoPacoteVitrine({ p, whatsapp, loja, modoPreco, mensagens }: { p: PacoteVitrine; whatsapp?: string; loja: string; modoPreco: ModoPrecoVitrine; mensagens?: MensagensVitrine }) {
  const t = useT()
  const idioma = useContext(IdiomaContexto)
  const url = useUrlFoto(p.foto)
  const cor = TOM_COR[p.cor ?? ''] ?? '#6d4c41'
  const porGrama = p.preco ? numero(p.preco.fator) : undefined
  // sem preço para mostrar, o caminho é um só: falar com a loja
  const contato = modoPreco === 'contato' || !porGrama
  const link = whatsapp ? `https://wa.me/${whatsapp.replace(/\D/g, '')}?text=${encodeURIComponent(mensagemPacote(idiomaDaMensagem(idioma, navigator.language), p, loja, kg(p.gramas), contato, mensagens))}` : undefined
  return (
    <article className="group flex flex-col overflow-hidden rounded-3xl border border-[var(--borda)] bg-[var(--cartao)] shadow-sm transition hover:-translate-y-0.5 hover:shadow-lg">
      <div className="relative aspect-[4/5] overflow-hidden" style={{ background: `linear-gradient(160deg, ${cor}22, ${cor}55)` }}>
        {url ? <img src={url} alt={`${p.medida} cm ${p.cor ?? ''}`} className="h-full w-full object-cover transition duration-500 group-hover:scale-105" loading="lazy" /> : (
          // sem foto: mechas desenhadas na cor do cabelo
          <svg aria-hidden viewBox="0 0 100 125" className="absolute inset-0 h-full w-full" preserveAspectRatio="xMidYMid slice">
            {[18, 30, 42, 54, 66, 78].map((x, k) => (
              <path key={x} d={`M${x} -5 C ${x + (k % 2 ? 8 : -8)} 40, ${x + (k % 2 ? -10 : 10)} 80, ${x + (k % 2 ? 4 : -4)} 130`} stroke={cor} strokeWidth={9 - (k % 3)} fill="none" strokeLinecap="round" opacity={0.55 + (k % 3) * 0.15} />
            ))}
          </svg>
        )}
        <span className="absolute left-3 top-3 rounded-full bg-white/90 px-2.5 py-1 text-sm font-black text-[#1f1b1a] shadow">{p.medida} cm</span>
        {p.categoria !== 'Normal' && <span className="absolute right-3 top-3 rounded-full bg-[var(--marca)] px-2.5 py-1 text-xs font-bold text-[var(--sobre-marca)] shadow">{t(p.categoria)}</span>}
        <span className="absolute bottom-3 left-3 rounded-full bg-black/60 px-2.5 py-1 text-xs font-semibold text-white backdrop-blur">⚖️ {kg(p.gramas)}</span>
      </div>
      <div className="flex flex-1 flex-col gap-2 p-3 sm:p-4">
        <div>
          <p className="font-bold leading-tight">{[p.cor && t(p.cor), p.textura && t(p.textura)].filter(Boolean).join(' · ') || t('Cabelo natural')}</p>
          <p className="text-xs text-[var(--suave)]">{p.codigo}{p.origem ? ` · ${t(p.origem)}` : ''}</p>
        </div>
        <div className="mt-auto">
          {!contato && p.preco && porGrama ? (
            <>
              <p className="num text-lg font-black text-[var(--marca-texto)]">{dinheiro(porGrama, p.preco.moeda)}<span className="text-xs font-semibold text-[var(--suave)]"> /g</span></p>
              <p className="num text-xs text-[var(--suave)]">{t('o pacote')}: {dinheiro(porGrama * p.gramas, p.preco.moeda)}</p>
            </>
          ) : modoPreco !== 'contato' && <p className="text-sm font-semibold text-[var(--suave)]">{t('Consultar preço')}</p>}
        </div>
        {link ? (
          <a href={link} target="_blank" rel="noreferrer" className="flex min-h-11 items-center justify-center gap-2 rounded-2xl bg-[#25d366] px-3 text-sm font-bold text-white transition hover:brightness-105">
            <svg aria-hidden viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor"><path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2zm5.3 14.2c-.2.6-1.3 1.2-1.8 1.2-.5.1-1 .1-3.3-.8-2.8-1.1-4.5-4-4.7-4.2-.1-.2-1.1-1.5-1.1-2.9s.7-2 1-2.3c.3-.3.6-.3.8-.3h.6c.2 0 .4 0 .6.5l.9 2.1c.1.2.1.4 0 .5l-.3.5-.4.5c-.1.1-.3.3-.1.6.2.3.8 1.3 1.7 2.1 1.2 1 2.1 1.3 2.4 1.5.3.1.5.1.6-.1l.9-1.1c.2-.3.4-.2.6-.1l2 .9c.3.1.5.2.5.3.1.2.1.7-.1 1.3z" /></svg>
            {t(contato ? 'Entrar em contato' : 'Quero este')}
          </a>
        ) : <span className="rounded-2xl bg-[var(--fundo)] px-3 py-2 text-center text-xs text-[var(--suave)]">{t('Peça pelo WhatsApp da loja')}</span>}
      </div>
    </article>
  )
}

/** botão de filtro (chip) da vitrine */
function Chip({ ativo, onClick, children }: { ativo: boolean; onClick(): void; children: React.ReactNode }) {
  return (
    <button type="button" aria-pressed={ativo} onClick={onClick}
      className={cx('min-h-10 shrink-0 rounded-full px-4 text-sm font-semibold transition', ativo ? 'bg-[var(--marca)] text-[var(--sobre-marca)] shadow' : 'bg-[var(--cartao)] text-[var(--texto)] ring-1 ring-[var(--borda)] hover:ring-[var(--marca)]')}>
      {children}
    </button>
  )
}


export interface DadosLoja {
  loja: { ativa: boolean; nome: string; descricao?: string; whatsapp?: string; modoPreco: ModoPrecoVitrine; mensagens?: MensagensVitrine; aparencia: AparenciaVitrine }
  pacotes: PacoteVitrine[]
  filtros: { medidas: number[]; cores: string[]; categorias: string[] }
  gramas: number
}

/** `colunas`: fixa a grade (a prévia é mais estreita que a tela); sem ela, segue a largura da tela */
export function ConteudoLoja({ dados, colunas, limite, className }: { dados?: DadosLoja; colunas?: 2 | 3; /** a prévia desenha só os primeiros (a contagem do topo continua a real) */ limite?: number; className?: string }) {
  const t = useT()
  const idioma = useContext(IdiomaContexto)
  const [medida, setMedida] = useState<number>()
  const [cor, setCor] = useState<string>()
  const [categoria, setCategoria] = useState<string>()
  const aparencia = dados?.loja.aparencia ?? APARENCIA_PADRAO
  const lista = (dados?.pacotes ?? []).filter((p) => (!medida || p.medida === medida) && (!cor || p.cor === cor) && (!categoria || p.categoria === categoria))
  const zap = dados?.loja.whatsapp ? `https://wa.me/${dados.loja.whatsapp.replace(/\D/g, '')}?text=${encodeURIComponent(mensagemLoja(idiomaDaMensagem(idioma, navigator.language), dados.loja.nome, dados.loja.mensagens))}` : undefined
  return (
    <div className={cx('text-[var(--texto)]', className)} style={estiloLoja(aparencia)}>
      <CapaLoja aparencia={aparencia} nome={dados?.loja.nome ?? '…'} descricao={dados?.loja.descricao} resumo={dados ? `${dados.pacotes.length === 1 ? t('1 pacote disponível') : t('{n} pacotes disponíveis', { n: dados.pacotes.length })} · ${kg(dados.gramas)}` : undefined} zap={zap} />
      <main className="mx-auto -mt-5 max-w-6xl px-4 pb-16">
        {!dados ? (
          <div className="rounded-3xl bg-[var(--cartao)] p-10 text-center text-[var(--suave)] shadow-sm">{t('Carregando…')}</div>
        ) : !dados.pacotes.length ? (
          <div className="rounded-3xl bg-[var(--cartao)] p-10 text-center shadow-sm">
            <div aria-hidden className="text-5xl">🛍️</div>
            <p className="mt-3 text-lg font-bold">{t(dados.loja.ativa ? 'Nenhum pacote disponível agora' : 'A vitrine está fechada no momento')}</p>
            <p className="mt-1 text-sm text-[var(--suave)]">{t('Fale com a loja pelo WhatsApp para saber das próximas chegadas.')}</p>
          </div>
        ) : (
          <>
            {/* filtros: medida, cor e categoria */}
            <div className="relative z-10 space-y-2 rounded-3xl bg-[var(--cartao)] p-3 shadow-md">
              <div className="flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none]">
                <Chip ativo={!medida} onClick={() => setMedida(undefined)}>{t('Todas as medidas')}</Chip>
                {dados.filtros.medidas.map((m) => <Chip key={m} ativo={medida === m} onClick={() => setMedida(medida === m ? undefined : m)}>{m} cm</Chip>)}
              </div>
              {(dados.filtros.cores.length > 1 || dados.filtros.categorias.length > 1) && (
                <div className="flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none]">
                  {dados.filtros.cores.length > 1 && dados.filtros.cores.map((c) => <Chip key={c} ativo={cor === c} onClick={() => setCor(cor === c ? undefined : c)}><span aria-hidden className="mr-1 inline-block h-3 w-3 rounded-full align-middle" style={{ background: TOM_COR[c] ?? '#6d4c41' }} />{t(c)}</Chip>)}
                  {dados.filtros.categorias.length > 1 && dados.filtros.categorias.map((c) => <Chip key={c} ativo={categoria === c} onClick={() => setCategoria(categoria === c ? undefined : c)}>{t(c)}</Chip>)}
                </div>
              )}
            </div>
            <p className="mb-3 mt-4 text-sm text-[var(--suave)]">{lista.length === 1 ? t('1 resultado') : t('{n} resultados', { n: lista.length })}</p>
            {!lista.length ? <p className="rounded-3xl bg-[var(--cartao)] p-8 text-center text-[var(--suave)]">{t('Nada com esses filtros.')}</p> : (
              <div className={cx('grid gap-3 sm:gap-4', colunas === 2 ? 'grid-cols-2' : colunas === 3 ? 'grid-cols-3' : 'grid-cols-2 md:grid-cols-3 lg:grid-cols-4')}>
                {(limite ? lista.slice(0, limite) : lista).map((p) => <CartaoPacoteVitrine key={p.id} p={p} whatsapp={dados.loja.whatsapp} loja={dados.loja.nome} modoPreco={dados.loja.modoPreco} mensagens={dados.loja.mensagens} />)}
              </div>
            )}
          </>
        )}
      </main>
      <footer className="pb-8 text-center text-xs text-[var(--suave)]">{t(dados?.loja.modoPreco === 'contato' ? 'Peso conferido na balança · envio a combinar' : 'Preço por grama · peso conferido na balança · envio a combinar')}</footer>
    </div>
  )
}
