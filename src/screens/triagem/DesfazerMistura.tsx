// DESFAZER A MISTURA: o contrário da janela Juntar, com o mesmo desenho ao contrário.
//   [MISTURA L-0027 · 4,5 kg]  ↩ volta para  [☑ L-0021 1,2 kg] [☐ L-0022 3,3 kg]
//   COMO VAI FICAR: L-0021 volta com 1,2 kg · L-0027 fica com 3,3 kg (ou "deixa de existir" quando sobra 1 só)
//   → UM botão. Mexeram no misturado (venda, separação, ajuste)? A janela diz por quê e não deixa.
// Exportada para abrir também da ficha do pacote: <DesfazerMistura loteId={id} onFechar={…} />.
import { useState } from 'react'
import { formatar } from '../../core/domain/dinheiro'
import { novoId } from '../../core/domain/ids'
import type { Id } from '../../core/domain/tipos'
import { Botao, BotaoExpandir, Campo, Carregando, Entrada, Info, Janela, gramasTexto, moedaPadrao } from '../../ui/base'
import { useComando, useConsulta } from '../../ui/contexto'
import { useT } from '../../ui/i18n'
import { CartaoPacote, CartaoResultado, Sinal } from './pecasMistura'

const AJUDA = 'Cada pacote marcado volta a existir com as mesmas gramas e o mesmo custo que pôs na mistura. Se sobrar só um, a mistura inteira é desfeita. Só dá enquanto ninguém vendeu, separou ou ajustou o pacote misturado. Ex.: L-0027 (4,5 kg) = L-0021 (1,2 kg) + L-0022 (3,3 kg) → tirar L-0021 = L-0021 volta com 1,2 kg e L-0027 deixa de existir.'

export function DesfazerMistura({ loteId, onFechar, onFeito }: { loteId: Id; onFechar(): void; onFeito?(r: { desfeita: boolean }): void }) {
  const t = useT()
  const { dados, erro } = useConsulta('mistura', { loteId })
  const { executar, ocupado } = useComando()
  const [id] = useState(() => novoId())
  const [tirar, setTirar] = useState<Set<Id>>()
  const [motivo, setMotivo] = useState('')
  const [mais, setMais] = useState(false)
  const m = moedaPadrao()
  const titulo = <span className="inline-flex items-center">↩ {t('Desfazer mistura')}{dados?.lote.codigo ? ` · ${dados.lote.codigo}` : ''}<Info texto={AJUDA} /></span>
  if (erro) return <Janela aberta titulo={titulo} onFechar={onFechar}><p className="text-sm text-[var(--ruim)]">{erro}</p></Janela>
  if (!dados) return <Janela aberta titulo={titulo} onFechar={onFechar}><Carregando /></Janela>
  // começa com TODAS marcadas (desfazer tudo é o mais comum); desmarque as que ficam
  const marcadas = tirar ?? new Set(dados.fontes.map((f) => f.id))
  const marcar = (x: Id, v: boolean) => { const n = new Set(marcadas); if (v) n.add(x); else n.delete(x); setTirar(n) }
  const saem = dados.fontes.filter((f) => marcadas.has(f.id))
  const ficam = dados.fontes.filter((f) => !marcadas.has(f.id))
  const tudo = saem.length > 0 && ficam.length < 2
  const sobra = ficam.reduce((s, f) => s + f.g, 0)
  const confirmar = async () => {
    const r = await executar('tirarDaMistura', { id, loteId, tirar: saem.map((f) => f.id), motivo: motivo.trim() || undefined },
      tudo ? t('Mistura desfeita: os pacotes voltaram para separar.') : t('{n} pacote(s) saíram da mistura.', { n: saem.length }))
    if (r) (onFeito?.({ desfeita: r.desfeita }), onFechar())
  }
  const rotulo = !saem.length ? t('Marque o que sai da mistura') : tudo ? t('↩ Desfazer a mistura toda') : t('↩ Tirar {n} da mistura', { n: saem.length })

  return (
    <Janela aberta titulo={titulo} onFechar={onFechar} rodape={
      <div className="flex flex-wrap items-center gap-2">
        <Botao variante="leve" onClick={onFechar}>{t('Voltar')}</Botao>
        <Botao grande className="min-w-max flex-1" disabled={ocupado || !dados.podeDesfazer || !saem.length} onClick={confirmar}>{rotulo}</Botao>
      </div>
    }>
      <div className="space-y-2">
        <CartaoResultado rotulo="Mistura" tom="marca" codigo={dados.lote.codigo} g={dados.lote.saldo} riscado={dados.podeDesfazer && tudo}
          linhas={[dados.lote.custo !== undefined ? `💵 ${formatar(dados.lote.custo, m)}` : undefined]} />
        {!dados.podeDesfazer ? (
          <p role="alert" className="rounded-xl border border-[var(--alerta)]/40 bg-[var(--alerta)]/10 p-3 text-sm">
            <b className="block text-[var(--alerta)]">🔒 {t('Não dá para desfazer')}</b>
            {t(dados.porque ?? '')}
            <span className="mt-1 block text-xs text-[var(--suave)]">{t('Corrija pelo pacote (⋯ › Ajustar).')}</span>
          </p>
        ) : <>
          <Sinal rotulo="volta para">↩</Sinal>
          <div className="flex flex-col gap-1.5">
            {dados.fontes.map((f) => (
              <CartaoPacote key={f.id} marcado={marcadas.has(f.id)} onMarcar={(v) => marcar(f.id, v)}
                p={{ id: f.id, codigo: f.codigo, g: f.g, custo: f.custo !== undefined ? formatar(f.custo, m) : undefined, compras: f.compras }}
                nota={marcadas.has(f.id) ? <span className="text-[var(--bom)]">✓ {t('volta com {g}', { g: gramasTexto(f.g) })}</span> : <span className="text-[var(--suave)]">{t('fica na mistura')}</span>} />
            ))}
          </div>
          {/* COMO VAI FICAR: uma frase por pacote, na ordem */}
          {saem.length > 0 && (
            <div className="rounded-xl border border-[var(--borda)] p-3 text-sm">
              <b className="mb-1 block">{t('Como vai ficar')}</b>
              <ul className="num space-y-0.5">
                {(tudo ? dados.fontes : saem).map((f) => <li key={f.id}>✓ <b className="font-mono">{f.codigo}</b> {t('volta com {g} para separar', { g: gramasTexto(f.g) })}</li>)}
                <li className={tudo ? 'text-[var(--suave)]' : undefined}>{tudo ? `✕ ${t('{c} deixa de existir', { c: dados.lote.codigo ?? '' })}` : `🔗 ${t('{c} fica com {g}', { c: dados.lote.codigo ?? '', g: gramasTexto(sobra) })}`}</li>
              </ul>
              {dados.lote.etiquetaImpressaEm && <p className="mt-1 text-xs font-semibold text-[var(--alerta)]">🏷 {t('Jogue fora a etiqueta de {c}.', { c: dados.lote.codigo ?? '' })}</p>}
            </div>
          )}
          <BotaoExpandir aberto={mais} onClick={() => setMais(!mais)} className="-ml-2">{t('+ mais')} <span className="font-normal text-[var(--suave)]">({t('observação')})</span></BotaoExpandir>
          {mais && <Campo rotulo="Observação (fica no histórico)"><Entrada value={motivo} placeholder={t('Ex.: juntei o pacote errado')} onChange={(e) => setMotivo(e.target.value)} /></Campo>}
        </>}
      </div>
    </Janela>
  )
}
