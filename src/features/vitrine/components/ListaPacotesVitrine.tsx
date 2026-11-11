// MINHA VITRINE › A LISTA DE PACOTES (a mesma peça na fila "Prontos" e no "Na vitrine"):
//   Pacote (código · medida · cor — abre a ficha no ESTOQUE) · Quantidade (o que vai para a vitrine: "1,3 kg" ou
//   "500 g de 1,3 kg"; tocar muda ali mesmo) · preço (se o modo pedir) · Na vitrine (pôr/tirar).
// Celular: cartão que abre no lugar, com os mesmos campos. A regra (o limite nunca passa do saldo) é do serviço.
// Pôr/tirar: a linha fica realçada por um instante e o selo "✓ Na vitrine" / "Fora" aparece ao lado da chave
// (a linha não muda de lugar: dá para ver o que mudou).
import { type ReactNode, useEffect, useRef, useState } from 'react'
import { Botao, Campo, Entrada, cx, gramasTexto } from '../../../shared/ui/base'
import { useApp } from '../../../shared/ui/contexto'
import { useT } from '../../../shared/ui/i18n'
import { Chave } from '../../../shared/ui/interruptor'
import { TabelaDados } from '../../../shared/ui/tabelaDados'

export interface PacoteLista {
  id: string
  codigo?: string
  medida: number
  categoria?: string
  cor?: string
  /** o que a vitrine mostra (saldo ou limite) */
  gramas: number
  /** o saldo inteiro do pacote */
  disponivel?: number
  limite?: number
  oculto?: boolean
}

export const kg = (g: number) => (g >= 1000 ? `${(g / 1000).toLocaleString(undefined, { maximumFractionDigits: 1 })} kg` : gramasTexto(g))

/** o limite que vale de verdade (um limite maior ou igual ao saldo = mostra tudo) */
const limiteAtivo = (x: PacoteLista) => (x.limite && x.limite < (x.disponivel ?? x.gramas) ? x.limite : undefined)

/** o campo em gramas: vazio = tudo. Salva ao sair (ou Enter); Esc desiste. */
function CampoGramas({ x, onLimite, onFim, travado, largo }: { x: PacoteLista; onLimite(g: number): void; onFim?(): void; travado?: boolean; largo?: boolean }) {
  const t = useT()
  const ativo = limiteAtivo(x)
  const total = x.disponivel ?? x.gramas
  const [texto, setTexto] = useState(ativo ? String(ativo) : '')
  const salvar = () => {
    const g = Math.round(Number(texto) || 0)
    const novo = g > 0 && g < total ? g : 0
    if (novo !== (ativo ?? 0)) onLimite(novo)
    onFim?.()
  }
  return (
    <span className={cx('relative inline-flex', largo ? 'w-40' : 'w-28')}>
      <Entrada inputMode="numeric" autoFocus={!largo} focoSempre disabled={travado} aria-label={`${t('Quanto mostrar na vitrine')} ${x.codigo ?? ''}`}
        placeholder={t('Tudo')} value={texto} onChange={(e) => setTexto(e.target.value.replace(/\D/g, ''))} onBlur={salvar}
        onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); if (e.key === 'Escape') onFim?.() }}
        className="num w-full pl-3 pr-7 text-right placeholder:text-[var(--suave)]" />
      <span aria-hidden className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-[var(--suave)]">g</span>
    </span>
  )
}

/** a quantidade como TEXTO (igual às outras colunas); tocar vira o campo, ali mesmo */
function Quantidade({ x, onLimite, travado }: { x: PacoteLista; onLimite(g: number): void; travado?: boolean }) {
  const t = useT()
  const [editando, setEditando] = useState(false)
  const ativo = limiteAtivo(x)
  if (editando) return <CampoGramas x={x} travado={travado} onLimite={onLimite} onFim={() => setEditando(false)} />
  return (
    <button type="button" disabled={travado} onClick={() => setEditando(true)} title={t('Quanto mostrar na vitrine')}
      aria-label={`${t('Quanto mostrar na vitrine')} ${x.codigo ?? ''}: ${kg(x.gramas)}`}
      className="alvo-amplo group inline-flex min-h-9 items-center gap-1.5 rounded-lg px-2 text-right hover:bg-[var(--fundo)]">
      <span className="num">
        <b className={cx(!!ativo && 'text-[var(--marca)]')}>{kg(x.gramas)}</b>
        {ativo && <span className="text-xs text-[var(--suave)]"> {t('de {t}', { t: kg(x.disponivel ?? x.gramas) })}</span>}
      </span>
      <span aria-hidden className="text-xs text-[var(--suave)] transition group-hover:text-[var(--marca)]">✎</span>
    </button>
  )
}

export function ListaPacotesVitrine({ linhas, escolher, ocupado, onNaVitrine, onLimite, preco, precoTexto }: {
  linhas: PacoteLista[]
  escolher: boolean
  ocupado: boolean
  onNaVitrine(ids: string[], entrar: boolean): void
  /** gramas a mostrar (0 = tudo) */
  onLimite(id: string, gramas: number): void
  /** a coluna de preço (só quando o modo de preço pede); sem ela, a coluna some */
  preco?: (x: PacoteLista) => ReactNode
  precoTexto(x: PacoteLista): string
}) {
  const t = useT()
  const { ir } = useApp()
  const abrir = (x: PacoteLista) => ir('lote', { id: x.id })
  // o que acabou de mudar: realce + selo por ~1,8 s
  const [mudou, setMudou] = useState<Record<string, 'entrou' | 'saiu'>>({})
  const relogios = useRef<Record<string, number>>({})
  useEffect(() => () => Object.values(relogios.current).forEach((r) => window.clearTimeout(r)), [])
  const alternar = (x: PacoteLista, entrar: boolean) => {
    onNaVitrine([x.id], entrar)
    setMudou((m) => ({ ...m, [x.id]: entrar ? 'entrou' : 'saiu' }))
    window.clearTimeout(relogios.current[x.id])
    relogios.current[x.id] = window.setTimeout(() => setMudou((m) => { const { [x.id]: _, ...resto } = m; return resto }), 1800)
  }
  /** a chave já mostra o novo estado no toque (não espera salvar) */
  const naVitrine = (x: PacoteLista) => (mudou[x.id] ? mudou[x.id] === 'entrou' : !x.oculto)
  const selo = (x: PacoteLista) => mudou[x.id] && (
    <span role="status" className={cx('ml-2 inline-flex animate-[entrada-tela_.25s_ease-out] items-center rounded-full px-2 py-0.5 text-xs font-semibold',
      mudou[x.id] === 'entrou' ? 'bg-[var(--bom)]/15 text-[var(--bom)]' : 'bg-[var(--fundo)] text-[var(--suave)]')}>
      {mudou[x.id] === 'entrou' ? `✓ ${t('Na vitrine')}` : t('Fora da vitrine')}
    </span>
  )
  const nome = (x: PacoteLista) => <>{x.medida} cm{x.categoria && x.categoria !== 'Normal' ? ` · ${t(x.categoria)}` : ''}</>
  return (
    <TabelaDados<PacoteLista>
      linhas={linhas}
      chave={(x) => x.id}
      realce={(x) => (mudou[x.id] === 'entrou' ? 'marcada' : undefined)}
      colunas={[
        { id: 'pacote', titulo: 'Pacote', classe: 'w-full min-w-[12rem]', celula: (x) => (
          <button type="button" onClick={() => abrir(x)} title={t('Abrir no estoque')} className="alvo-amplo group inline-flex items-baseline gap-1.5 text-left">
            <b className="font-mono text-[var(--marca)] group-hover:underline">{x.codigo}</b>
            <span className="font-semibold group-hover:underline">{nome(x)}</span>
            {x.cor && <span className="text-[var(--suave)]">· {t(x.cor)}</span>}
            <span aria-hidden className="text-[var(--marca)] opacity-0 transition group-hover:opacity-100">›</span>
          </button>
        ) },
        { id: 'quantidade', titulo: 'Quantidade', direita: true, classe: 'whitespace-nowrap', celula: (x) => <Quantidade key={limiteAtivo(x) ?? 'tudo'} x={x} travado={ocupado} onLimite={(g) => onLimite(x.id, g)} /> },
        ...(preco ? [{ id: 'preco', titulo: 'Preço/g', direita: true, classe: 'whitespace-nowrap', celula: (x: PacoteLista) => preco(x) }] : []),
        { id: 'na', titulo: 'Na vitrine', classe: 'whitespace-nowrap', celula: (x) => <span className="inline-flex items-center"><Chave ligado={naVitrine(x)} rotulo={`${t('Na vitrine')} ${x.codigo ?? ''}`} travado={ocupado} onChange={(v) => alternar(x, v)} />{selo(x)}</span> },
      ]}
      celular={{
        titulo: (x) => `${x.medida} cm${x.cor ? ` · ${t(x.cor)}` : ''}`,
        valor: (x) => kg(x.gramas),
        codigo: (x) => x.codigo ?? '',
        situacao: (x) => ({ texto: t(x.oculto ? (escolher ? 'Fora da vitrine' : 'Escondido') : 'Na vitrine'), tom: x.oculto ? 'suave' : 'bom' }),
        resumo: (x) => (limiteAtivo(x) ? t('{v} de {t}', { v: kg(x.gramas), t: kg(x.disponivel ?? x.gramas) }) : precoTexto(x)),
        aberto: (x) => (
          <div className="space-y-3">
            <Campo rotulo="Quanto mostrar na vitrine" ajuda="Ex.: o pacote tem 1 kg e você quer mostrar só 500 g. Vazio = tudo." comoDiv>
              <div className="flex flex-wrap items-center gap-2">
                <CampoGramas key={limiteAtivo(x) ?? 'tudo'} x={x} largo travado={ocupado} onLimite={(g) => onLimite(x.id, g)} />
                <span className="text-xs text-[var(--suave)]">{t('de {t} disponíveis', { t: kg(x.disponivel ?? x.gramas) })}</span>
              </div>
            </Campo>
            {preco && <Campo rotulo="Preço por grama" comoDiv>{preco(x)}</Campo>}
            <div className="flex flex-wrap gap-2">
              <Botao variante={x.oculto ? 'primario' : 'secundario'} disabled={ocupado} onClick={() => alternar(x, !!x.oculto)}>
                {x.oculto ? `🛍️ ${t(escolher ? 'Pôr na vitrine' : 'Mostrar na vitrine')}` : t(escolher ? 'Tirar da vitrine' : 'Esconder da vitrine')}
              </Botao>
              <Botao variante="secundario" onClick={() => abrir(x)}>📦 {t('Abrir no estoque')}</Botao>
              {selo(x)}
            </div>
          </div>
        ),
      }}
    />
  )
}
