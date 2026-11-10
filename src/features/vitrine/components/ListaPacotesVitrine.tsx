// MINHA VITRINE › A LISTA DE PACOTES (a mesma peça na fila "Prontos" e no "Na vitrine"):
//   o pacote (código · medida · cor) abre a ficha no ESTOQUE · Disponível (o saldo inteiro) · Na vitrine: QUANTO mostrar
//   (ex.: o pacote tem 1 kg, mas só 500 g vão para a vitrine; vazio = tudo) · preço (se o modo pedir) · pôr/tirar.
// Celular: cartão que abre no lugar, com os mesmos campos. A regra (o limite nunca passa do saldo) é do serviço.
import { type ReactNode, useState } from 'react'
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

/**
 * "Quanto mostrar": um campo só, com o "g" dentro. Vazio = "Tudo" (apagado); com limite, fica na cor da marca e ganha
 * o "×" para voltar a mostrar tudo. Salva ao sair do campo (ou Enter). Vazio, zero ou ≥ saldo = tudo.
 */
function QuantoMostrar({ x, onLimite, travado, largo }: { x: PacoteLista; onLimite(g: number): void; travado?: boolean; largo?: boolean }) {
  const t = useT()
  const ativo = limiteAtivo(x)
  const total = x.disponivel ?? x.gramas
  return <CampoQuanto key={ativo ?? 'tudo'} ativo={ativo} total={total} codigo={x.codigo} travado={travado} largo={largo} onLimite={onLimite} t={t} />
}

function CampoQuanto({ ativo, total, codigo, travado, largo, onLimite, t }: { ativo?: number; total: number; codigo?: string; travado?: boolean; largo?: boolean; onLimite(g: number): void; t: ReturnType<typeof useT> }) {
  const [texto, setTexto] = useState(ativo ? String(ativo) : '')
  const salvar = () => {
    const g = Math.round(Number(texto.replace(/\D/g, '')) || 0)
    const novo = g > 0 && g < total ? g : 0
    if (!novo) setTexto('')
    if (novo !== (ativo ?? 0)) onLimite(novo)
  }
  return (
    <span className={cx('relative inline-flex', largo ? 'w-40' : 'w-32')}>
      {ativo && (
        <button type="button" disabled={travado} onClick={() => onLimite(0)} aria-label={`${t('Mostrar tudo')} ${codigo ?? ''}`} title={t('Mostrar tudo')}
          className="absolute left-1.5 top-1/2 z-10 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full text-base leading-none text-[var(--marca)] hover:bg-[var(--cartao)]">×</button>
      )}
      <Entrada inputMode="numeric" disabled={travado} aria-label={`${t('Quanto mostrar na vitrine')} ${codigo ?? ''}`}
        placeholder={t('Tudo')} value={texto} onChange={(e) => setTexto(e.target.value.replace(/\D/g, ''))}
        onBlur={salvar} onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
        className={cx('num w-full pr-8 text-right placeholder:text-[var(--suave)]', ativo ? 'border-[var(--marca)] bg-[var(--marca-suave)] pl-9 font-semibold text-[var(--marca)]' : 'pl-3')} />
      {texto && <span aria-hidden className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-[var(--suave)]">g</span>}
    </span>
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
  const nome = (x: PacoteLista) => <>{x.medida} cm{x.categoria && x.categoria !== 'Normal' ? ` · ${t(x.categoria)}` : ''}</>
  const naVitrineTexto = (x: PacoteLista) => (limiteAtivo(x) ? t('{v} de {t}', { v: kg(x.gramas), t: kg(x.disponivel ?? x.gramas) }) : t('tudo ({v})', { v: kg(x.gramas) }))
  return (
    <TabelaDados<PacoteLista>
      linhas={linhas}
      chave={(x) => x.id}
      colunas={[
        { id: 'pacote', titulo: 'Pacote', classe: 'w-full min-w-[12rem]', celula: (x) => (
          <button type="button" onClick={() => abrir(x)} title={t('Abrir no estoque')} className="alvo-amplo group inline-flex items-baseline gap-1.5 text-left">
            <b className="font-mono text-[var(--marca)] group-hover:underline">{x.codigo}</b>
            <span className="font-semibold group-hover:underline">{nome(x)}</span>
            {x.cor && <span className="text-[var(--suave)]">· {t(x.cor)}</span>}
            <span aria-hidden className="text-[var(--marca)] opacity-0 transition group-hover:opacity-100">›</span>
          </button>
        ) },
        { id: 'disponivel', titulo: 'Disponível', direita: true, classe: 'whitespace-nowrap', celula: (x) => kg(x.disponivel ?? x.gramas) },
        { id: 'mostrar', titulo: 'Mostrar', direita: true, classe: 'whitespace-nowrap', celula: (x) => <QuantoMostrar x={x} travado={ocupado} onLimite={(g) => onLimite(x.id, g)} /> },
        ...(preco ? [{ id: 'preco', titulo: 'Preço/g', direita: true, classe: 'whitespace-nowrap', celula: (x: PacoteLista) => preco(x) }] : []),
        { id: 'na', titulo: 'Na vitrine', classe: 'whitespace-nowrap', celula: (x) => <Chave ligado={!x.oculto} rotulo={`${t('Na vitrine')} ${x.codigo ?? ''}`} travado={ocupado} onChange={(v) => onNaVitrine([x.id], v)} /> },
      ]}
      celular={{
        titulo: (x) => `${x.medida} cm${x.cor ? ` · ${t(x.cor)}` : ''}`,
        valor: (x) => kg(x.gramas),
        codigo: (x) => x.codigo ?? '',
        situacao: (x) => ({ texto: t(x.oculto ? (escolher ? 'Fora da vitrine' : 'Escondido') : 'Na vitrine'), tom: x.oculto ? 'suave' : 'bom' }),
        resumo: (x) => (limiteAtivo(x) ? `${t('Mostra')} ${naVitrineTexto(x)}` : precoTexto(x)),
        aberto: (x) => (
          <div className="space-y-3">
            <Campo rotulo="Quanto mostrar na vitrine" ajuda="Ex.: o pacote tem 1 kg e você quer mostrar só 500 g. Vazio = tudo." comoDiv>
              <div className="flex flex-wrap items-center gap-2">
                <QuantoMostrar x={x} largo travado={ocupado} onLimite={(g) => onLimite(x.id, g)} />
                <span className="text-xs text-[var(--suave)]">{t('de {t} disponíveis', { t: kg(x.disponivel ?? x.gramas) })}</span>
              </div>
            </Campo>
            {preco && <Campo rotulo="Preço por grama" comoDiv>{preco(x)}</Campo>}
            <div className="flex flex-wrap gap-2">
              <Botao variante={x.oculto ? 'primario' : 'secundario'} disabled={ocupado} onClick={() => onNaVitrine([x.id], !!x.oculto)}>
                {x.oculto ? `🛍️ ${t(escolher ? 'Pôr na vitrine' : 'Mostrar na vitrine')}` : t(escolher ? 'Tirar da vitrine' : 'Esconder da vitrine')}
              </Botao>
              <Botao variante="secundario" onClick={() => abrir(x)}>📦 {t('Abrir no estoque')}</Botao>
            </div>
          </div>
        ),
      }}
    />
  )
}
