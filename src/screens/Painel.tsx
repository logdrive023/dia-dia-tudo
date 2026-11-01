// PAINEL: resumo geral → por área (cada módulo desenha o seu) → específico (toque em qualquer número).

import { MOEDAS, formatar } from '../core/domain/dinheiro'
import { Abas, Carregando, Cartao, CartaoNumero, Erro, Pilula, Selecao, Titulo, cx } from '../ui/base'
import { useApp, useConsulta } from '../ui/contexto'
import { Barras, Linha, SecaoView } from '../ui/graficos'
import { useT } from '../ui/i18n'
import { SeletorPeriodo, useLembrado, usePeriodo } from '../ui/filtros'

export function Painel() {
  const t = useT()
  const { ir, nav } = useApp()
  const [periodo, setPeriodo] = usePeriodo()
  const [comparar, setComparar] = useLembrado('painel.comparar', true)
  const [moeda, setMoeda] = useLembrado('painel.moeda', 'convertido')
  const [area, setArea] = useLembrado<string>('painel.area', '')
  const [localId, setLocalId] = useLembrado<string>('painel.local', '')
  const areaAtual = (nav.params.area as string | undefined) ?? area
  const { dados: cfg } = useConsulta('configuracoes', {})
  const { dados: locais } = useConsulta('locais', {})
  const { dados: p, erro } = useConsulta('painel', { de: periodo.de, ate: periodo.ate, comparar, moeda, area: areaAtual || undefined, localId: localId || undefined })
  const ativos = cfg ? cfg.modulos.filter((m) => cfg.config.modulosAtivos.includes(m.id)) : []

  return (
    <div>
      <Titulo subtitulo={t('Tudo do negócio. Toque em qualquer número para ver de onde ele vem.')}>{t('Painel')}</Titulo>

      <Cartao className="mb-4">
        <div className="flex flex-wrap items-center gap-2">
          <SeletorPeriodo periodo={periodo} onChange={setPeriodo} />
          <Selecao className="w-auto" valor={moeda} onChange={setMoeda} opcoes={[{ id: 'convertido', nome: `${t('Tudo convertido')} (${cfg?.config.moedaPrincipal ?? ''})` }, ...MOEDAS.map((m) => ({ id: m.codigo, nome: `${t('Só')} ${m.codigo}` }))]} />
          <Selecao className="w-auto" valor={localId} onChange={setLocalId} vazio="Todas as unidades" opcoes={(locais ?? []).map((l) => ({ id: l.id, nome: l.nome }))} />
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={comparar} onChange={(e) => setComparar(e.target.checked)} className="h-5 w-5" /> {t('Comparar com o período anterior')}
          </label>
        </div>
      </Cartao>

      <Abas
        atual={areaAtual}
        onChange={(v) => (setArea(v), ir('painel', { area: v || undefined }))}
        abas={[{ id: '', nome: 'Visão geral' }, ...ativos.filter((m) => m.temVenda || m.telaPropria).map((m) => ({ id: m.id, nome: `${m.icone} ${t(m.nome)}` }))]}
      />

      <Erro texto={erro} />
      {!p ? (
        <Carregando />
      ) : (
        <div className="space-y-4">
          {p.alertas.length > 0 && !areaAtual && (
            <Cartao titulo={t('Atenção agora')}>
              <ul className="grid gap-2 md:grid-cols-2">
                {p.alertas.map((a) => (
                  <li key={a.id}>
                    <button type="button" onClick={() => a.detalhe && ir(a.detalhe.tela, a.detalhe.filtro)} className="flex w-full items-center gap-2 rounded-xl border border-[var(--borda)] p-2 text-left text-sm hover:border-[var(--marca)]">
                      <Pilula tom={a.nivel === 'ruim' ? 'ruim' : a.nivel === 'alerta' ? 'alerta' : 'marca'}>{a.quantidade}</Pilula>
                      {t(a.texto)}
                    </button>
                  </li>
                ))}
              </ul>
            </Cartao>
          )}

          <div className="grid grid-cols-2 gap-2 md:grid-cols-3 xl:grid-cols-5">
            {p.cartoes.map((c) => (
              <CartaoNumero key={c.id} c={c} />
            ))}
          </div>

          <div className="grid gap-4 lg:grid-cols-3">
            <Cartao titulo={t('Faturamento e lucro por dia')} className="lg:col-span-2">
              <Linha serie={p.serie} anterior={p.serieAnterior} formato="dinheiro" moeda={p.moedaVis} />
            </Cartao>
            <Cartao titulo={t('Caixa agora (por moeda)')} ajuda="Dinheiro na mão (efectivo) e no banco (QR, Pix, cartão), em cada moeda.">
              <ul className="space-y-2 text-sm">
                {p.caixa.map((c) => (
                  <li key={c.moeda} className="rounded-xl bg-[var(--fundo)] p-2">
                    <div className="flex justify-between font-bold"><span>{c.moeda}</span><span className="num">{formatar(c.total, c.moeda)}</span></div>
                    <div className="flex justify-between text-xs text-[var(--suave)]"><span>💵 {formatar(c.mao, c.moeda)}</span><span>🏦 {formatar(c.banco, c.moeda)}</span></div>
                  </li>
                ))}
              </ul>
            </Cartao>
          </div>

          {!areaAtual && (
            <div className="grid gap-4 md:grid-cols-3">
              <Cartao titulo={t('Por área')}>
                <Barras formato="dinheiro" moeda={p.moedaVis} itens={p.porArea.map((a) => ({ rotulo: `${a.icone} ${t(a.nome)}`, valor: a.valor, onClick: () => ir('painel', { area: a.id }) }))} />
              </Cartao>
              <Cartao titulo={t('Por forma de pagamento')}>
                <Barras formato="dinheiro" moeda={p.moedaVis} itens={p.porForma.map((f) => ({ rotulo: t(f.nome), valor: f.valor, onClick: () => ir('vendas', { de: periodo.de, ate: periodo.ate, forma: f.id }) }))} />
              </Cartao>
              <Cartao titulo={t('Por moeda')} ajuda="Quanto entrou em cada moeda e quanto isso vale convertido.">
                <ul className="space-y-1 text-sm">
                  {p.porMoeda.map((m) => (
                    <li key={m.moeda} className="flex justify-between border-b border-[var(--borda)] py-1">
                      <span className="num">{formatar(m.valor, m.moeda)}</span>
                      <span className="num text-[var(--suave)]">≈ {formatar(m.principal, cfg?.config.moedaPrincipal ?? 'BOB')}</span>
                    </li>
                  ))}
                </ul>
              </Cartao>
            </div>
          )}

          {p.areas.map((a) => (
            <div key={a.id} className="space-y-3">
              <h2 className={cx('flex items-center gap-2 pt-2 text-lg font-bold')}>
                <span aria-hidden>{a.icone}</span> {t(a.nome)}
              </h2>
              <div className="grid gap-4 lg:grid-cols-2">
                {a.secoes.map((s, i) => (
                  <div key={i} className={s.tipo === 'cartoes' ? 'lg:col-span-2' : ''}>
                    <SecaoView s={s} moeda={cfg?.config.moedaPrincipal ?? 'BOB'} />
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
