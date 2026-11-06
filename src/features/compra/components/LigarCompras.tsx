// LIGAR COMPRAS A UMA VIAGEM — a janela única (uma compra no pedido, várias na lista de Compras, as sugeridas na
// tela da viagem). Três passos, sempre os mesmos:
//   1. qual viagem (EscolhaViagem: busca, 📍 cidade, 📅 data, cores) — pulado quando já vem da tela da viagem
//   2. o RESUMO antes de mudar (vem do servidor): "4 entram · 3 já estão nesta (ficam) · 3 estão em outra viagem"
//      + avisos (viagem encerrada há X dias, gasto que vai ser redividido, compra fora das datas). Com compra em outra
//      viagem, a pessoa escolhe: [Ligar só as sem viagem] ou [Mover também] — nada é sobrescrito sem ela ver.
//   3. o resultado com [Desfazer] (volta cada compra exatamente para onde estava)
import { useState } from 'react'
import type { Id } from '../../../core/domain/tipos'
import { Botao, Carregando, Janela, cx, dataBR } from '../../../shared/ui/base'
import { useComando, useConsulta } from '../../../shared/ui/contexto'
import { useT } from '../../../shared/ui/i18n'
import { EscolhaViagem, situacaoViagem } from '../../../shared/ui/seloViagem'

type Antes = { compraId: Id; viagemId?: Id }[]

export function LigarCompras({ compraIds, viagemId: fixa, onFechar, onFeito }: { compraIds: Id[]; viagemId?: Id; onFechar(): void; onFeito?(): void }) {
  const t = useT()
  const { executar, ocupado } = useComando()
  const [viagemId, setViagemId] = useState(fixa ?? '')
  const [escolhendo, setEscolhendo] = useState(!fixa)
  const [feito, setFeito] = useState<{ ligadas: number; movidas: number; jaNesta: number; antes: Antes; codigo: string }>()
  const [desfeito, setDesfeito] = useState(false)
  const { dados: viagens } = useConsulta('viagensParaFiltro', {})
  const { dados: pv } = useConsulta('previaLigarCompras', { viagemId, compraIds }, !!viagemId && !escolhendo && !feito)
  const v = viagens?.find((x) => x.id === viagemId)
  const n = compraIds.length

  const ligar = async (mover: boolean) => {
    const r = await executar('vincularCompras', { viagemId, compraIds, mover })
    if (!r) return
    setFeito({ ligadas: r.ligadas.length, movidas: r.movidas.length, jaNesta: r.jaNesta.length, antes: r.antes, codigo: pv?.viagem.codigo ?? '' })
    onFeito?.()
  }
  const desfazer = async () => {
    if (!feito?.antes.length) return
    if (await executar('desfazerLigacao', { antes: feito.antes }, t('Desfeito: as compras voltaram para onde estavam.'))) { setDesfeito(true); onFeito?.() }
  }

  // 3. o resultado (com desfazer)
  if (feito) {
    const mudou = feito.ligadas + feito.movidas
    return (
      <Janela aberta titulo={`✈️ ${t('Ligar a uma viagem')}`} onFechar={onFechar} rodape={
        <div className="flex flex-wrap gap-2">
          {mudou > 0 && !desfeito && <Botao variante="secundario" className="flex-1" disabled={ocupado} onClick={desfazer}>↩ {t('Desfazer')}</Botao>}
          <Botao className="flex-1" onClick={onFechar}>{t('Pronto')}</Botao>
        </div>
      }>
        <div role="status" className={cx('rounded-2xl p-4 text-center', mudou && !desfeito ? 'bg-[var(--bom)]/10' : 'bg-[var(--fundo)]')}>
          <p className="text-3xl" aria-hidden>{desfeito ? '↩' : mudou ? '✓' : '•'}</p>
          <p className="mt-1 text-base font-bold">
            {desfeito ? t('Desfeito: tudo voltou como estava.')
              : mudou ? t('{n} compra(s) agora em {v}', { n: mudou, v: feito.codigo })
                : t('Nada mudou: {n} já estava(m) em {v}.', { n: feito.jaNesta, v: feito.codigo })}
          </p>
          {!desfeito && mudou > 0 && (
            <p className="num mt-1 text-sm text-[var(--suave)]">{[feito.ligadas && t('{n} ligada(s)', { n: feito.ligadas }), feito.movidas && t('{n} movida(s) de outra viagem', { n: feito.movidas }), feito.jaNesta && t('{n} já estava(m) nesta', { n: feito.jaNesta })].filter(Boolean).join(' · ')}</p>
          )}
        </div>
      </Janela>
    )
  }

  // 1. escolher a viagem
  if (escolhendo)
    return (
      <Janela aberta titulo={`✈️ ${n > 1 ? t('Ligar {n} compras a uma viagem', { n }) : t('Ligar a uma viagem')}`} onFechar={onFechar} rodape={
        <Botao grande className="w-full" disabled={!viagemId} onClick={() => setEscolhendo(false)}>{v ? `${t('Continuar com {v}', { v: v.codigo })} →` : t('Escolha a viagem')}</Botao>
      }>
        <EscolhaViagem valor={viagemId} onEscolher={setViagemId} />
      </Janela>
    )

  // 2. o resumo antes de mudar
  const linha = (cor: string, texto: string) => <li className="flex items-start gap-2"><span aria-hidden className="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: cor }} /><span>{texto}</span></li>
  return (
    <Janela aberta titulo={`✈️ ${t('Confira antes de ligar')}`} onFechar={onFechar} rodape={!pv ? undefined : (
      <div className="space-y-2">
        {pv.outra > 0 ? (
          <>
            <Botao grande className="w-full" disabled={ocupado} onClick={() => ligar(true)}>{t('Ligar e mover as {n} de outra viagem', { n: pv.outra })}</Botao>
            {pv.ligar > 0 && <Botao variante="secundario" className="w-full" disabled={ocupado} onClick={() => ligar(false)}>{t('Ligar só as {n} sem viagem', { n: pv.ligar })}</Botao>}
          </>
        ) : (
          <Botao grande className="w-full" disabled={ocupado || !pv.ligar} onClick={() => ligar(false)}>{pv.ligar ? `✈️ ${t('Ligar {n} compra(s) a {v}', { n: pv.ligar, v: pv.viagem.codigo })}` : t('Nada para ligar')}</Botao>
        )}
      </div>
    )}>
      {!pv ? <Carregando /> : (
        <div className="space-y-3">
          {/* a viagem escolhida (trocar volta ao passo 1) */}
          <div className="flex flex-wrap items-center gap-2 rounded-2xl bg-[var(--fundo)] p-3">
            <span className="linha-texto">
              <b className="block"><span className="font-mono">{pv.viagem.codigo}</span> · {pv.viagem.nome}</b>
              <span className="num text-xs text-[var(--suave)]">📅 {dataBR(pv.viagem.inicio)}{pv.viagem.fim ? ` – ${dataBR(pv.viagem.fim)}` : ''}{v ? ` · ${situacaoViagem(v, t)}` : ''}</span>
            </span>
            {!fixa && <button type="button" onClick={() => setEscolhendo(true)} className="min-h-10 whitespace-nowrap rounded-lg px-2 text-sm font-semibold text-[var(--marca)] hover:bg-[var(--marca-suave)]">{t('Trocar')}</button>}
          </div>

          {/* o que vai acontecer com cada uma */}
          <ul className="space-y-1.5 text-sm">
            {pv.ligar > 0 && linha('var(--bom)', t('{n} compra(s) sem viagem vão entrar', { n: pv.ligar }))}
            {pv.jaNesta > 0 && linha('var(--suave)', t('{n} já está(ão) nesta viagem: ficam como estão', { n: pv.jaNesta }))}
            {pv.outra > 0 && linha('var(--alerta)', t('{n} está(ão) em outra viagem ({de}): só mudam se você escolher mover', { n: pv.outra, de: pv.deViagens.map((x) => (x.n > 1 ? `${x.codigo} ×${x.n}` : x.codigo)).join(', ') }))}
            {pv.canceladas > 0 && linha('var(--ruim)', t('{n} cancelada(s) ou recusada(s): ficam de fora', { n: pv.canceladas }))}
          </ul>

          {/* os avisos (não travam: só deixam claro) */}
          {v && v.tempo !== 'vigente' && <p className={cx('rounded-xl px-3 py-2 text-sm', v.tempo === 'recente' ? 'bg-[var(--alerta)]/10 text-[var(--alerta)]' : 'bg-[var(--fundo)] text-[var(--suave)]')}>⚠ {t('{v} foi {s}. Dá para ligar mesmo assim.', { v: v.codigo, s: situacaoViagem(v, t) })}</p>}
          {pv.redivide && <p className="rounded-xl bg-[var(--marca-suave)] px-3 py-2 text-sm text-[var(--marca)]">⚖ {t('O gasto da viagem já estava no custo dos pacotes: ele vai ser dividido de novo entre as compras, sozinho.')}</p>}
          {pv.foraDoPeriodo.length > 0 && <p className="rounded-xl bg-[var(--fundo)] px-3 py-2 text-sm text-[var(--suave)]">📅 {t('Fora das datas da viagem: {l}', { l: pv.foraDoPeriodo.map((x) => `${x.codigo} (${dataBR(x.data!)})`).join(', ') })}</p>}
        </div>
      )}
    </Janela>
  )
}
