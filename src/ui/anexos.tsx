// ANEXOS de um registro (compra, lote, venda…): um botão só "+ Anexar" que abre a janela (1. o que é → 2. de onde:
// câmera, galeria ou PDF/arquivo; vários de uma vez), e a lista com filtro por tipo. A foto é reduzida e ganha
// miniatura (useEnviarFotos); tocar abre o visor (foto) ou o arquivo. As pendências (sem fotos / sem comprovante de
// origem) continuam vindo da categoria de cada anexo, calculadas no núcleo.
//  - BotaoAnexar: o botão + a janela
//  - ListaAnexos: a lista (grade de miniaturas ou linhas), com os filtros por tipo
//  - AbaAnexos: a aba "Anexos" da compra (botão, filtros, lista e o vazio com o botão)

import { useEffect, useState } from 'react'
import type { CategoriaAnexo, Id } from '../core/domain/tipos'
import { ehFoto } from '../core/services/fotos'
import { Botao, Janela, cx, dataBR, Pilula, Vazio } from './base'
import { useApp, useConsulta } from './contexto'
import { useT } from './i18n'
import { VisorFotos, useEnviarFotos } from './fotos'

export const NOMES_ANEXO: Record<CategoriaAnexo, string> = {
  pedido: 'Foto do pedido',
  produto: 'Foto do produto / cabelo',
  comprovante: 'Comprovante de pagamento',
  origem: 'Comprovante de origem',
  resultado: 'Foto do resultado',
  outro: 'Outro',
}
const ICONE_ANEXO: Record<CategoriaAnexo, string> = { pedido: '🧾', produto: '💇', comprovante: '💳', origem: '📜', resultado: '✨', outro: '📎' }
const AJUDA_ANEXAR = 'Escolha o tipo e tire a foto ou escolha o arquivo. Ex.: comprovante do Pix da Maria.'

/** Janela "Anexar": 1. o que é (o mais provável já vem marcado) → 2. de onde (câmera, galeria, PDF/arquivo). */
export function ModalAnexar({ donoId, categorias, padrao, onFechar }: { donoId: Id; categorias: CategoriaAnexo[]; padrao?: CategoriaAnexo; onFechar(): void }) {
  const t = useT()
  const { avisar } = useApp()
  const [tipo, setTipo] = useState<CategoriaAnexo>(padrao && categorias.includes(padrao) ? padrao : categorias[0])
  const { enviar, enviando } = useEnviarFotos()
  const subir = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const fs = [...(e.target.files ?? [])]
    e.target.value = ''
    if (!fs.length || enviando) return
    const n = await enviar(donoId, fs, tipo, false)
    if (n) {
      avisar(n === 1 ? t('Anexado.') : t('{n} anexados.', { n }), 'ok')
      onFechar()
    }
  }
  const fonte = (forte: boolean) => cx('flex min-h-14 flex-1 basis-28 cursor-pointer flex-col items-center justify-center gap-0.5 rounded-2xl px-3 py-2 text-sm font-semibold focus-within:ring-2 focus-within:ring-[var(--marca)] focus-within:ring-offset-2', forte ? 'bg-[var(--marca)] text-white' : 'bg-[var(--marca-suave)] text-[var(--marca)]', enviando && 'cursor-wait opacity-60')
  const passo = (n: number, s: string) => <h3 className="mb-2 text-left text-sm font-bold"><span className="mr-1 inline-flex size-6 items-center justify-center rounded-full bg-[var(--marca-suave)] text-xs text-[var(--marca)]">{n}</span>{t(s)}</h3>
  return (
    <Janela aberta titulo={t('Anexar')} onFechar={onFechar}>
      <div className="space-y-4">
        {categorias.length > 1 && (
          <section>
            {passo(1, 'O que é?')}
            <div role="radiogroup" aria-label={t('Tipo do anexo')} className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {categorias.map((c) => (
                <button key={c} type="button" role="radio" aria-checked={tipo === c} onClick={() => setTipo(c)} className={cx('flex min-h-12 items-center gap-2 rounded-2xl border-2 px-3 text-left text-sm font-semibold', tipo === c ? 'border-[var(--marca)] bg-[var(--marca-suave)] text-[var(--marca)]' : 'border-[var(--borda)] hover:border-[var(--marca)]')}>
                  <span aria-hidden className="text-lg">{ICONE_ANEXO[c]}</span>{t(NOMES_ANEXO[c])}
                </button>
              ))}
            </div>
          </section>
        )}
        <section>
          {passo(categorias.length > 1 ? 2 : 1, 'De onde?')}
          <div className="flex flex-wrap gap-2">
            <label aria-disabled={enviando} className={fonte(true)}>
              <span aria-hidden className="text-xl">📷</span>{enviando ? t('Enviando…') : t('Tirar foto')}
              <input type="file" accept="image/*" capture="environment" className="sr-only" disabled={enviando} onChange={subir} />
            </label>
            <label aria-disabled={enviando} className={fonte(false)}>
              <span aria-hidden className="text-xl">🖼</span>{t('Galeria')}
              <input type="file" accept="image/*" multiple className="sr-only" disabled={enviando} onChange={subir} />
            </label>
            <label aria-disabled={enviando} className={fonte(false)}>
              <span aria-hidden className="text-xl">📄</span>{t('Arquivo PDF')}
              <input type="file" accept="application/pdf,image/*,*/*" multiple className="sr-only" disabled={enviando} onChange={subir} />
            </label>
          </div>
          <p className="mt-2 text-xs text-[var(--suave)]">{t('Pode escolher vários de uma vez. Fica como: {tipo}.', { tipo: t(NOMES_ANEXO[tipo]) })}</p>
        </section>
      </div>
    </Janela>
  )
}

/** O botão "+ Anexar" (abre a janela). */
export function BotaoAnexar({ donoId, categorias, padrao, variante = 'primario', className }: { donoId: Id; categorias: CategoriaAnexo[]; padrao?: CategoriaAnexo; variante?: 'primario' | 'secundario'; className?: string }) {
  const t = useT()
  const [aberta, setAberta] = useState(false)
  return (
    <>
      <Botao variante={variante} className={className} title={t(AJUDA_ANEXAR)} onClick={() => setAberta(true)}>+ {t('Anexar')}</Botao>
      {aberta && <ModalAnexar donoId={donoId} categorias={categorias} padrao={padrao} onFechar={() => setAberta(false)} />}
    </>
  )
}

type AnexoTela = NonNullable<ReturnType<typeof useConsulta<'anexosDe'>>['dados']>[number]
/** imagem (foto ou comprovante fotografado): tem miniatura e abre no visor */
const eImagem = (a: Pick<AnexoTela, 'mime'>) => a.mime.startsWith('image/')

/** Busca uma vez o endereço dos arquivos sem miniatura (fotos antigas, PDFs) para mostrar/abrir. */
function useUrls(anexos: AnexoTela[]) {
  const { backend } = useApp()
  const [urls, setUrls] = useState<Record<string, string>>({})
  useEffect(() => {
    for (const a of anexos) if (!urls[a.id] && !a.miniatura) backend.urlDoAnexo(a.id).then((u) => u && setUrls((x) => ({ ...x, [a.id]: u })))
  }, [anexos, backend, urls])
  return urls
}

/**
 * A lista dos anexos: miniatura (foto) ou ícone (PDF e outros), o tipo, o nome, a data e quem anexou; tocar abre o
 * visor ou o arquivo. comFiltro = chips "Todos 5 · Foto do pedido 2 · …". compacta = linhas curtas (lote, venda).
 */
export function ListaAnexos({ anexos, comFiltro, compacta }: { anexos: AnexoTela[]; comFiltro?: boolean; compacta?: boolean }) {
  const t = useT()
  const [filtro, setFiltro] = useState<CategoriaAnexo | ''>('')
  const [busca, setBusca] = useState('')
  const [ver, setVer] = useState<string>()
  const urls = useUrls(anexos)
  const tipos = [...new Set(anexos.map((a) => a.categoria))]
  const termo = busca.trim().toLowerCase()
  const lista = anexos.filter((a) => (!filtro || a.categoria === filtro) && (!termo || [a.nome, a.porNome, t(NOMES_ANEXO[a.categoria])].filter(Boolean).join(' ').toLowerCase().includes(termo)))
  // com 2 ou mais arquivos: busca + tipo (também na lista compacta)
  const comFiltros = (comFiltro || anexos.length > 1) && anexos.length > 1
  const fotos = lista.filter(eImagem)
  const aberto = anexos.find((a) => a.id === ver)
  const chip = (id: CategoriaAnexo | '', nome: string, n: number) => (
    <button key={id || 'todos'} type="button" aria-pressed={filtro === id} onClick={() => setFiltro(id)} className={cx('min-h-9 shrink-0 rounded-full px-3 text-xs font-semibold', filtro === id ? 'bg-[var(--marca)] text-white' : 'bg-[var(--marca-suave)] text-[var(--marca)]')}>
      {t(nome)} <span className="num opacity-80">{n}</span>
    </button>
  )
  const miniatura = (a: AnexoTela, classe: string) => {
    const src = a.miniatura ?? urls[a.id]
    return eImagem(a) && src ? <img src={src} alt={a.nome} loading="lazy" className={cx('object-cover', classe)} /> : <span aria-hidden className={cx('flex items-center justify-center bg-[var(--fundo)] text-2xl', classe)}>{a.mime === 'application/pdf' ? '📄' : '📎'}</span>
  }
  const quando = (a: AnexoTela) => [dataBR(a.criadoEm), a.porNome].filter(Boolean).join(' · ')
  return (
    <div className="space-y-3">
      {comFiltros && (
        <div className="space-y-2">
          <input type="search" value={busca} onChange={(e) => setBusca(e.target.value)} placeholder={t('Buscar arquivo, tipo ou quem enviou')} aria-label={t('Buscar arquivo, tipo ou quem enviou')} className="min-h-11 w-full rounded-xl border border-[var(--borda)] bg-[var(--cartao)] px-3 text-sm outline-none focus:border-[var(--marca)]" />
          {tipos.length > 1 && (
            <div className="flex flex-wrap gap-2" aria-label={t('Filtrar por tipo')}>
              {chip('', 'Todos', anexos.length)}
              {tipos.map((c) => chip(c, NOMES_ANEXO[c], anexos.filter((a) => a.categoria === c).length))}
            </div>
          )}
        </div>
      )}
      {comFiltros && !lista.length && <p className="rounded-xl border border-dashed border-[var(--borda)] p-4 text-center text-sm text-[var(--suave)]">{t('Nenhum arquivo com esse filtro.')}</p>}
      {compacta ? (
        // lista em TABELA: arquivo · tipo · data · quem (no celular, tipo/data/quem embaixo do nome)
        <div className="overflow-hidden rounded-xl border border-[var(--borda)]">
          {lista.length > 0 && (
            <div aria-hidden className="hidden grid-cols-[2.5rem_minmax(0,1fr)_8rem_6rem_8rem] gap-3 bg-[var(--fundo)] px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-[var(--suave)] sm:grid">
              <span /><span>{t('Arquivo')}</span><span>{t('Tipo')}</span><span>{t('Data')}</span><span>{t('Quem')}</span>
            </div>
          )}
          <ul className="divide-y divide-[var(--borda)]">
            {lista.map((a) => (
              <li key={a.id}>
                <button type="button" onClick={() => setVer(a.id)} className="grid min-h-12 w-full grid-cols-[2.5rem_minmax(0,1fr)] items-center gap-3 px-3 py-1.5 text-left text-sm hover:bg-[var(--fundo)] sm:grid-cols-[2.5rem_minmax(0,1fr)_8rem_6rem_8rem]">
                  {miniatura(a, 'size-10 shrink-0 rounded-lg')}
                  <span className="min-w-0">
                    <b className="block truncate">{a.nome}</b>
                    <span className="block truncate text-xs text-[var(--suave)] sm:hidden">{ICONE_ANEXO[a.categoria]} {t(NOMES_ANEXO[a.categoria])} · {quando(a)}</span>
                  </span>
                  <span className="hidden truncate text-xs font-semibold text-[var(--marca)] sm:block">{ICONE_ANEXO[a.categoria]} {t(NOMES_ANEXO[a.categoria])}</span>
                  <span className="num hidden text-xs sm:block">{dataBR(a.criadoEm)}</span>
                  <span className="hidden truncate text-xs text-[var(--suave)] sm:block">{a.porNome ?? '—'}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {lista.map((a) => (
            <li key={a.id} className="min-w-0">
              <button type="button" onClick={() => setVer(a.id)} className="block w-full min-w-0 overflow-hidden rounded-2xl border border-[var(--borda)] bg-[var(--cartao)] text-left hover:border-[var(--marca)]">
                {miniatura(a, 'aspect-square w-full')}
                <span className="block space-y-0.5 p-2">
                  <Pilula pequena tom="marca">{ICONE_ANEXO[a.categoria]} {t(NOMES_ANEXO[a.categoria])}</Pilula>
                  <span className="block truncate text-xs font-semibold">{a.nome}</span>
                  <span className="block truncate text-[11px] text-[var(--suave)]">{quando(a)}</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {aberto && eImagem(aberto) ? (
        <VisorFotos fotos={fotos.map((a) => ({ id: a.id, miniatura: a.miniatura, nome: a.nome, em: a.criadoEm, propria: true }))} inicio={Math.max(0, fotos.findIndex((a) => a.id === ver))} onFechar={() => setVer(undefined)} />
      ) : (
        <Janela aberta={!!aberto} titulo={aberto ? t(NOMES_ANEXO[aberto.categoria]) : t('Anexo')} onFechar={() => setVer(undefined)}>
          {aberto && (
            <div className="space-y-2 text-sm">
              <p className="[overflow-wrap:anywhere]"><b>{aberto.nome}</b><span className="block text-xs text-[var(--suave)]">{quando(aberto)}</span></p>
              {urls[aberto.id] ? <a href={urls[aberto.id]} target="_blank" rel="noreferrer" download={aberto.nome} className="inline-flex min-h-10 items-center rounded-xl bg-[var(--marca)] px-4 font-semibold text-white">{t('Abrir arquivo')}</a> : <p className="text-[var(--suave)]">…</p>}
            </div>
          )}
        </Janela>
      )}
    </div>
  )
}

/** Anexos curtos (lote, venda): "+ Anexar" e a lista em linhas, sem abas. */
export function AnexosCurtos({ donoId, categorias, padrao, esconderFotos }: { donoId: Id; categorias: CategoriaAnexo[]; padrao?: CategoriaAnexo; esconderFotos?: boolean }) {
  const { dados } = useConsulta('anexosDe', { donoId })
  const anexos = (esconderFotos ? dados?.filter((a) => !ehFoto(a)) : dados) ?? []
  return (
    <div className="space-y-2">
      {anexos.length ? <ListaAnexos anexos={anexos} compacta /> : <Vazio compacto texto="Nenhum anexo ainda." />}
      <BotaoAnexar donoId={donoId} categorias={categorias} padrao={padrao} variante="secundario" />
    </div>
  )
}

/** A aba "Anexos" (compra): botão, filtros por tipo, a grade e, vazia, o convite com o botão. */
export function AbaAnexos({ donoId, categorias, padrao }: { donoId: Id; categorias: CategoriaAnexo[]; padrao?: CategoriaAnexo }) {
  const t = useT()
  const { dados } = useConsulta('anexosDe', { donoId })
  if (!dados) return null
  // ARQUIVOS (padrão de toda ficha: pedido, pacote, venda): um cartão com o título, quantos e o "Anexar"; dentro, a
  // lista com filtro por tipo (comprovante, foto, origem…). Sem nada: diz o que costuma ir aqui.
  return (
    <section aria-label={t('Arquivos')} className="overflow-hidden rounded-2xl border border-[var(--borda)] bg-[var(--cartao)] shadow-sm">
      <div className="flex flex-wrap items-center gap-2 border-b border-[var(--borda)] px-4 py-3">
        <h2 className="flex min-w-0 flex-1 items-center gap-2 text-base font-bold"><span aria-hidden className="flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--fundo)]">📎</span>{t('Arquivos')} <span className="num text-sm font-normal text-[var(--suave)]">{dados.length}</span></h2>
        <BotaoAnexar donoId={donoId} categorias={categorias} padrao={padrao} />
      </div>
      <div className="p-4">
        {dados.length
          ? <ListaAnexos anexos={dados} comFiltro />
          : <p className="rounded-xl border border-dashed border-[var(--borda)] p-6 text-center text-sm text-[var(--suave)]">{t('Nenhum arquivo ainda. Comprovantes, fotos e notas ficam aqui — {tipos}.', { tipos: categorias.map((c) => t(NOMES_ANEXO[c])).join(', ') })}</p>}
      </div>
    </section>
  )
}
