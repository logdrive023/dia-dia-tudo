// JUNTAR (unificar) pacotes brutos numa janela que se lê de cima para baixo:
//   [L-0021 1,2 kg · P-0005 · Wagner] + [L-0022 3,3 kg · P-0006] = [PACOTE NOVO L-0030 · 4,5 kg · Bs 4.285/kg · atributos]
//   → UM botão: "🔗 Juntar em 1 pacote de 4,5 kg". Código digitado e observação ficam no "+ mais" (secundário).
// Depois de juntar, a mesma janela diz o próximo passo (separar) com o botão.
import { useCallback, useState } from 'react'
import { formatar } from '../../../core/domain/dinheiro'
import { novoId } from '../../../core/domain/ids'
import type { Id } from '../../../core/domain/tipos'
import type { ResultadoConsulta } from '../../../core/services'
import { camposUnificados } from '../../../core/services/triagem'
import { Botao, Campo, Entrada, Info, Janela, BotaoExpandir, gramasTexto, moedaPadrao } from '../../../shared/ui/base'
import { resumoCampos } from '../../../shared/ui/camposDinamicos'
import { CampoCodigo } from '../../../shared/ui/codigos'
import { useApp, useComando, useConsulta } from '../../../shared/ui/contexto'
import { useT } from '../../../shared/ui/i18n'
import type { useCamposModulo } from '../../estoque'
import { CartaoPacote, CartaoResultado, Sinal, SomaPacotes } from './pecasMistura'
import { avisoFeito, avisoJuntar, planoJuntar } from '../model/juntarMisturas'

type Lote = ResultadoConsulta<'triagem'>['lotes'][number]

const DICA_JUNTAR = 'Junta pacotes de compras diferentes; a origem de cada grama fica guardada. Ex.: 2 kg do P3 (compra da Maria) + 4 kg da compra do Celso → P4 com 6 kg.'

export function Unificar({ lotes, campos, onFechar, onFeito }: { lotes: Lote[]; campos: ReturnType<typeof useCamposModulo>; onFechar(): void; onFeito(): void }) {
  const t = useT()
  const { ir } = useApp()
  const { executar, ocupado } = useComando()
  const [id] = useState(() => novoId())
  const [motivo, setMotivo] = useState('')
  const [mais, setMais] = useState(false)
  const { dados: regras } = useConsulta('codigos', {})
  const comprasIds = [...new Set(lotes.flatMap((l) => l.compras.map((c) => c.id)))]
  const { dados: sugestao } = useConsulta('codigoDisponivel', { tipo: 'lote', comprasUnificadas: comprasIds })
  const [digitar, setDigitar] = useState<boolean>()
  const [codigo, setCodigo] = useState('')
  const [codigoOk, setCodigoOk] = useState(true)
  // o que foi juntado fica guardado aqui: depois de juntar a seleção da tela é limpa (e `lotes` vem vazio)
  const [feito, setFeito] = useState<{ id: Id; codigo?: string; g: number; de: string }>()
  const marcarCodigo = useCallback((ok: boolean) => setCodigoOk(ok), [])
  const digitarCodigo = digitar ?? regras?.regras.lote.modo === 'manual'
  const m = moedaPadrao()
  const total = lotes.reduce((s, l) => s + l.saldo, 0)
  const temCusto = lotes.every((l) => l.custo !== undefined)
  const custo = lotes.reduce((s, l) => s + (l.custo ?? 0), 0)
  const resultado = resumoCampos(campos, camposUnificados(campos, lotes.map((l) => l.campos)))
  const codigoNovo = (digitarCodigo ? codigo.trim().toUpperCase() : '') || sugestao?.sugestao || undefined
  // já misturado na seleção: a mistura antiga é desfeita e as partes entram uma a uma (o aviso vem antes do botão)
  const plano = planoJuntar(lotes)
  const aviso = avisoJuntar(plano, t)
  const juntar = async () => {
    const r = await executar('triarLotes', { id, ids: lotes.map((l) => l.id), motivo, codigo: digitarCodigo ? codigo.trim() || undefined : undefined }, avisoFeito(plano, t, t('Lotes juntados.')))
    if (r) (onFeito(), setFeito({ id: r.lotes[0] ?? id, codigo: codigoNovo, g: total, de: lotes.flatMap((l) => plano.abrir.find((x) => x.codigo === l.codigo)?.partes ?? [l.codigo ?? '?']).join(' + ') }))
  }

  // ---------- feito: o próximo passo ----------
  if (feito)
    return (
      <Janela aberta titulo={`✓ ${t('Juntado')}`} onFechar={onFechar} rodape={
        <div className="flex flex-wrap gap-2">
          <Botao variante="leve" className="min-w-max flex-1" onClick={onFechar}>{t('Separar depois')}</Botao>
          <Botao grande className="min-w-max flex-1" onClick={() => (onFechar(), ir('separar', { id: feito.id, volta: 'triagem' }))}>✂️ {t('Separar agora')}</Botao>
        </div>
      }>
        <div className="space-y-3">
          <CartaoResultado rotulo="Pacote novo" codigo={feito.codigo} g={feito.g} linhas={[feito.de]} />
          <p className="rounded-xl border border-[var(--marca)]/40 bg-[var(--marca-suave)] p-3 text-sm">
            <b className="block text-[var(--marca)]">{t('Próximo passo: separar')}</b>
            {t('O pacote novo está em “Para separar”. Separe por medida: cada parte vira um pacote com etiqueta.')}
          </p>
        </div>
      </Janela>
    )

  return (
    <Janela aberta larga titulo={<span className="inline-flex items-center">🔗 {t('Juntar {n} pacotes', { n: lotes.length })}<Info texto={DICA_JUNTAR} /></span>} onFechar={onFechar} rodape={
      <div className="flex flex-wrap items-center gap-2">
        <Botao variante="leve" onClick={onFechar}>{t('Voltar')}</Botao>
        <Botao grande className="min-w-max flex-1" disabled={ocupado || (digitarCodigo && !codigoOk)} onClick={juntar}>🔗 {t('Juntar em 1 pacote de {g}', { g: gramasTexto(total) })}</Botao>
      </div>
    }>
      <div className="space-y-2">
        {/* A CONTA À VISTA: os pacotes de origem em cartões, o "+" entre eles e o pacote novo em destaque */}
        <SomaPacotes>
          {lotes.map((l) => <CartaoPacote key={l.id} p={{ id: l.id, codigo: l.codigo, g: l.saldo, custo: l.custo !== undefined ? formatar(l.custo, m) : undefined, compras: l.compras }} />)}
        </SomaPacotes>
        <Sinal>=</Sinal>
        <CartaoResultado
          rotulo="Pacote novo"
          codigo={codigoNovo}
          g={total}
          linhas={[
            temCusto ? `💵 ${formatar(custo, m)}${total > 0 ? ` · ${formatar(Math.round((custo * 1000) / total), m)}/kg` : ''}` : undefined,
            resultado.length ? resultado.map((a) => t(a.valor)).join(' · ') : undefined,
          ]}
        />
        {aviso.length > 0 && (
          <ul role="note" className="space-y-1 rounded-xl border border-[var(--marca)]/40 bg-[var(--marca-suave)] p-3 text-sm">
            {aviso.map((x) => <li key={x}>{x}</li>)}
          </ul>
        )}
        <p className="text-xs text-[var(--suave)]">{t('Cada grama continua sabendo de qual compra veio. Dá para desfazer enquanto ninguém mexer no pacote novo.')}</p>
        <BotaoExpandir aberto={mais} onClick={() => setMais(!mais)} className="-ml-2">{t('+ mais')} <span className="font-normal text-[var(--suave)]">({t('código e observação')})</span></BotaoExpandir>
        {mais && (
          <div className="space-y-3 rounded-xl bg-[var(--fundo)] p-3">
            <CampoCodigo tipo="lote" rotulo="Código do pacote novo" valor={codigo} onChange={setCodigo} bloqueado={!digitarCodigo} contexto={{ comprasUnificadas: comprasIds }} onEstado={marcarCodigo} />
            {regras?.regras.lote.modo !== 'manual' && <button type="button" className="min-h-10 text-sm font-semibold text-[var(--marca)]" onClick={() => (setDigitar(!digitarCodigo), setCodigo(''))}>{digitarCodigo ? t('Usar o código automático') : `✎ ${t('Digitar outro código')}`}</button>}
            <Campo rotulo="Observação (fica no histórico)"><Entrada value={motivo} placeholder={t('Ex.: mesma qualidade, lavar junto')} onChange={(e) => setMotivo(e.target.value)} /></Campo>
          </div>
        )}
      </div>
    </Janela>
  )
}
