// Peças de tela dos CÓDIGOS: o selo do código (destacado e copiável), o campo com conferência ao vivo ("Já existe: …"
// com link para abrir) e a janela "Trocar código" (admin; fica no log com antes → depois).

import { useEffect, useState } from 'react'
import type { Id } from '../../core/domain/tipos'
import type { ParamsConsulta } from '../../core/services'
import type { ModoCompra } from '../../core/services/codigos'
import { Botao, Campo, Entrada, Janela, cx } from './base'
import { useApp, useComando, useConsulta } from './contexto'
import { useT } from './i18n'

/** Endereço do registro que já usa o código (abre em outra aba: o formulário não se perde). */
export const enderecoCodigo = (tela: 'lote' | 'pedido', id: Id) => `#/${tela === 'lote' ? 'lotes' : 'pedidos'}/${encodeURIComponent(id)}`

/** Código dentro de uma linha clicável ("P-0007 · Helena"): só o texto, em mono na cor da marca (o selo que copia é o CodigoSelo) */
export function CodigoTexto({ codigo, className }: { codigo?: string; className?: string }) {
  return <b className={cx('font-mono font-bold text-[var(--marca)]', className)}>{codigo ?? '—'}</b>
}

/** Código em destaque (selo). Tocar copia; o toque não abre a linha de baixo. */
export function CodigoSelo({ codigo, anteriores, grande, className }: { codigo?: string; anteriores?: string[]; grande?: boolean; className?: string }) {
  const t = useT()
  const { avisar } = useApp()
  if (!codigo) return <span className="text-[var(--suave)]">—</span>
  const copiar = (e: React.SyntheticEvent) => {
    e.stopPropagation()
    try {
      void navigator.clipboard?.writeText(codigo)
      avisar(t('Código {c} copiado.', { c: codigo }), 'ok')
    } catch {
      /* sem área de transferência: só mostra */
    }
  }
  return (
    <button
      type="button"
      onClick={copiar}
      onKeyDown={(e) => e.stopPropagation()}
      title={`${t('Copiar código')}${anteriores?.length ? ` · ${t('antes')}: ${anteriores.join(', ')}` : ''}`}
      aria-label={`${t('Copiar código')} ${codigo}`}
      className={cx('inline-flex max-w-full items-center gap-1 whitespace-nowrap rounded-lg border border-[var(--marca)]/30 bg-[var(--marca-suave)] font-mono font-bold text-[var(--marca)] hover:border-[var(--marca)]', grande ? 'min-h-10 px-3 text-base' : 'min-h-8 px-2 text-sm', className)}
    >
      <span className="truncate">{codigo}</span>
      <span aria-hidden className="text-xs opacity-60">⧉</span>
    </button>
  )
}

type Contexto = Omit<ParamsConsulta<'codigoDisponivel'>, 'tipo' | 'codigo'>

/**
 * Campo do código com conferência AO VIVO: mostra a sugestão da regra, avisa se já existe (dizendo qual registro, com
 * link) e devolve o código só quando está livre. Vazio = usa a sugestão. bloqueado = mostra a sugestão sem editar.
 */
export function CampoCodigo({ tipo, valor, onChange, contexto, rotulo = 'Código', bloqueado, onEstado, ajuda }: {
  tipo: 'compra' | 'lote'
  valor: string
  onChange(v: string): void
  contexto?: Contexto
  rotulo?: string
  bloqueado?: boolean
  /** avisa a tela se pode salvar (código livre ou vazio = sugestão) */
  onEstado?(ok: boolean): void
  ajuda?: string
}) {
  const t = useT()
  const { dados, digitado, conferido, ok } = useConferirCodigo(tipo, valor, contexto, onEstado)
  return (
    <div>
      <Campo rotulo={rotulo} ajuda={ajuda}>
        <Entrada
          value={bloqueado ? dados?.sugestao ?? '' : valor}
          disabled={bloqueado}
          placeholder={dados?.sugestao ? `${dados.sugestao} (${t('sugerido')})` : ''}
          autoCapitalize="characters"
          spellCheck={false}
          aria-invalid={!!digitado && conferido && !ok}
          className={cx('font-mono', digitado && conferido && !ok && 'border-[var(--ruim)]')}
          onChange={(e) => onChange(e.target.value)}
        />
      </Campo>
      <div className="mt-1 min-h-5 text-xs" aria-live="polite">
        <StatusCodigo dados={dados} digitado={digitado} conferido={conferido} semSugestao={bloqueado} />
      </div>
    </div>
  )
}

/** Conferência ao vivo de um código digitado (espera 250 ms parada a digitação). ok = vazio ou livre. */
function useConferirCodigo(tipo: 'compra' | 'lote', valor: string, contexto?: Contexto, onEstado?: (ok: boolean) => void) {
  const [atraso, setAtraso] = useState(valor)
  useEffect(() => {
    const h = setTimeout(() => setAtraso(valor), 250)
    return () => clearTimeout(h)
  }, [valor])
  const { dados } = useConsulta('codigoDisponivel', { tipo, codigo: atraso, ...(contexto ?? {}) })
  const digitado = valor.trim()
  const conferido = !!dados && atraso === valor
  const ok = !digitado || (conferido && !!dados?.livre)
  useEffect(() => onEstado?.(ok), [ok, onEstado])
  return { dados, digitado, conferido, ok }
}

type Conferencia = ReturnType<typeof useConferirCodigo>

function StatusCodigo({ dados, digitado, conferido, semSugestao }: Pick<Conferencia, 'dados' | 'digitado' | 'conferido'> & { semSugestao?: boolean }) {
  const t = useT()
  if (!digitado) return dados?.sugestao && !semSugestao ? <span className="text-[var(--suave)]">{t('Vazio = usa o sugerido')}: <b className="font-mono">{dados.sugestao}</b></span> : null
  if (!conferido || !dados) return <span className="text-[var(--suave)]">{t('Conferindo…')}</span>
  if (dados.livre) return <span className="font-semibold text-[var(--bom)]">✓ {t('Livre')}</span>
  if (dados.existe)
    return (
      <span className="text-[var(--ruim)]">
        ✕ {t('Já existe')}: <b>{dados.existe.resumo}</b>{' '}
        <a className="font-semibold underline" href={enderecoCodigo(dados.existe.tela, dados.existe.id)} target="_blank" rel="noreferrer">{t('Abrir')} ↗</a>
      </span>
    )
  return <span className="text-[var(--ruim)]">✕ {t(dados.invalido ?? '')}</span>
}

const MODOS_CODIGO_COMPRA: { id: ModoCompra; nome: string }[] = [
  { id: 'incremental', nome: 'Incremental' },
  { id: 'porPessoa', nome: 'Por pessoa' },
  { id: 'manual', nome: 'Manual' },
]

/**
 * Código de UMA compra com o tipo escolhido na hora: Incremental · Por pessoa · Manual (o padrão vem da regra de
 * Configurações › Códigos). Trocar o tipo mostra na hora o código que vai sair (P-0007, M3…); no manual digita-se,
 * conferindo se já existe. semPessoa = por pessoa sem fornecedor/quem comprou escolhido (sai o incremental).
 */
export function CampoCodigoCompra({ modo, onModo, valor, onChange, contexto, onEstado, semPessoa }: {
  modo: ModoCompra
  onModo(m: ModoCompra): void
  valor: string
  onChange(v: string): void
  contexto?: Contexto
  onEstado?(ok: boolean): void
  semPessoa?: string
}) {
  const t = useT()
  const manual = modo === 'manual'
  const c = useConferirCodigo('compra', manual ? valor : '', { ...(contexto ?? {}), modoCodigo: modo }, onEstado)
  return (
    <div className="space-y-2">
      <div role="radiogroup" aria-label={t('Tipo de código')} className="grid grid-cols-3 gap-1 rounded-xl bg-[var(--marca-suave)] p-1">
        {MODOS_CODIGO_COMPRA.map((o) => (
          <button key={o.id} type="button" role="radio" aria-checked={o.id === modo} onClick={() => onModo(o.id)} className={cx('min-h-11 truncate rounded-lg px-1 text-sm font-semibold', o.id === modo ? 'bg-[var(--cartao)] text-[var(--marca)] shadow' : 'text-[var(--suave)]')}>
            {t(o.nome)}
          </button>
        ))}
      </div>
      {manual ? (
        <div>
          <Entrada
            aria-label={t('Código do pedido')}
            value={valor}
            placeholder={c.dados?.sugestao ? `${c.dados.sugestao} (${t('sugerido')})` : ''}
            autoCapitalize="characters"
            spellCheck={false}
            aria-invalid={!c.ok}
            className={cx('font-mono', c.digitado && c.conferido && !c.ok && 'border-[var(--ruim)]')}
            onChange={(e) => onChange(e.target.value)}
          />
          <div className="mt-1 min-h-5 text-xs" aria-live="polite"><StatusCodigo dados={c.dados} digitado={c.digitado} conferido={c.conferido} /></div>
        </div>
      ) : (
        <p className="flex flex-wrap items-center gap-2 text-sm" aria-live="polite">
          <span className="text-[var(--suave)]">{t('Vai ser')}:</span>
          <b className="rounded-lg bg-[var(--marca-suave)] px-2 py-1 font-mono text-base text-[var(--marca)]">{c.dados?.sugestao || '…'}</b>
          {modo === 'porPessoa' && semPessoa && <span className="text-xs text-[var(--suave)]">{t(semPessoa)}</span>}
        </p>
      )}
    </div>
  )
}

/** Trocar o código de um lote ou de uma compra (admin). O antigo continua achando o registro na busca. */
export function TrocarCodigo({ tipo, id, atual, onFechar }: { tipo: 'compra' | 'lote'; id: Id; atual?: string; onFechar(): void }) {
  const t = useT()
  const { executar, ocupado } = useComando()
  const [codigo, setCodigo] = useState('')
  const [motivo, setMotivo] = useState('')
  const [livre, setLivre] = useState(false)
  const pode = !!codigo.trim() && livre && codigo.trim() !== atual
  const salvar = async () => {
    const r = tipo === 'lote'
      ? await executar('trocarCodigoLote', { id, codigo, motivo }, t('Código trocado.'))
      : await executar('trocarCodigoCompra', { id, codigo, motivo }, t('Código trocado.'))
    if (r) onFechar()
  }
  return (
    <Janela aberta titulo={t('Trocar código')} onFechar={onFechar} rodape={<Botao grande className="w-full" disabled={ocupado || !pode} onClick={salvar}>{t('Trocar')}</Botao>}>
      <div className="space-y-3">
        <p className="text-sm">{t('Agora')}: <b className="font-mono">{atual ?? '—'}</b></p>
        <CampoCodigo tipo={tipo} valor={codigo} onChange={setCodigo} contexto={{ ignorarId: id }} rotulo="Novo código" onEstado={setLivre} />
        <Campo rotulo="Motivo (fica no histórico)"><Entrada value={motivo} onChange={(e) => setMotivo(e.target.value)} /></Campo>
        <p className="text-xs text-[var(--suave)]">{t('O código antigo continua achando este registro na busca e não pode ser usado por outro.')}</p>
      </div>
    </Janela>
  )
}
