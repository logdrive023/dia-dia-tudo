// CONFIGURAÇÕES › FISCAL E RELATÓRIOS — em 3 partes (abas), uma coisa por vez (CONTABILIDADE.md):
//   🧾 Impostos      o que aparece na compra e na venda: ligar/desligar, como mostrar (embutido · somado), onde mostrar
//                    (embaixo do total · quadro embaixo dos itens) e a LISTA de impostos vigentes (um cartão por imposto)
//   ⚖️ Regime        o padrão do relatório (🇧🇴 Bolívia = do sistema · 🇧🇷 Brasil) e o regime do país escolhido
//   🖨 Relatório     o cabeçalho do relatório impresso (razão social, NIT, endereço, contador, representante legal)
// Tudo é só informativo: nada muda o preço cobrado. Salvar uma vez no fim (o botão aparece quando algo mudou).
import { useState } from 'react'
import { FISCAL_PADRAO, IMPOSTOS_PADRAO_BO, IMPOSTOS_PADRAO_BR, NOMES_REGIME, type ConfigFiscal, type ImpostoOperacao } from '../core/dados/impostos'
import { Abas, Botao, Campo, Carregando, Cartao, Entrada, ValorInput, cx, dataBR } from '../ui/base'
import { Bandeira } from '../ui/bandeira'
import { useAvisoSaida, useComando, useConsulta, useParamTela } from '../ui/contexto'
import { EscolhaCartoes } from '../ui/escolhaCartoes'
import { useT } from '../ui/i18n'

const pct = (bp: number) => String(bp / 100).replace('.', ',')
const bp = (txt: string) => Math.round(Number(txt.replace(',', '.')) * 100)
const CORES = ['#7c3aed', '#ea580c', '#0ea5e9', '#16a34a', '#db2777', '#ca8a04']

function CampoTaxa({ rotulo, valor, onChange }: { rotulo: string; valor: number; onChange(bp: number): void }) {
  const [txt, setTxt] = useState(pct(valor))
  return (
    <Campo rotulo={rotulo}>
      <div className="flex items-center gap-1">
        <Entrada inputMode="decimal" value={txt} onChange={(e) => (setTxt(e.target.value), Number.isFinite(bp(e.target.value)) && onChange(bp(e.target.value)))} className="num w-24" />
        <span className="text-sm font-semibold text-[var(--suave)]">%</span>
      </div>
    </Campo>
  )
}

/** interruptor com nome e explicação (o mesmo desenho em todas as opções liga/desliga) */
function Interruptor({ ligado, onChange, titulo, texto }: { ligado: boolean; onChange(v: boolean): void; titulo: string; texto: string }) {
  const t = useT()
  return (
    <button type="button" role="switch" aria-checked={ligado} onClick={() => onChange(!ligado)} className="flex w-full items-start gap-3 rounded-2xl bg-[var(--fundo)] p-3 text-left">
      <span aria-hidden className={cx('relative mt-0.5 h-6 w-11 shrink-0 rounded-full transition-colors', ligado ? 'bg-[var(--marca)]' : 'bg-[var(--borda)]')}>
        <span className={cx('absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all', ligado ? 'left-[22px]' : 'left-0.5')} />
      </span>
      <span className="text-sm"><b className="block">{t(titulo)}</b><span className="text-[var(--suave)]">{t(texto)}</span></span>
    </button>
  )
}

export function ConfigFiscal() {
  const t = useT()
  const { dados } = useConsulta('configuracoes', {})
  const { executar, ocupado } = useComando()
  const [parte, setParte] = useParamTela<'impostos' | 'regime' | 'relatorio'>('parte', 'impostos')
  const [f, setF] = useState<ConfigFiscal>()
  // como estava quando a pessoa começou a mexer: o servidor junta com o que outra aba mudou (ou recusa se for o mesmo campo)
  const [antes, setAntes] = useState<ConfigFiscal>()
  const atual = dados?.config.fiscal ?? FISCAL_PADRAO
  const v = f ?? atual
  const sujo = !!f && JSON.stringify(f) !== JSON.stringify(atual)
  useAvisoSaida(sujo)
  if (!dados) return <Carregando />
  const mudar = (p: Partial<ConfigFiscal>) => (f || setAntes(atual), setF({ ...v, ...p }))
  const moeda = dados.config.moedaPrincipal
  const salvar = async () => (await executar('salvarConfig', { fiscal: v, antes: { fiscal: antes ?? atual } }, t('Salvo.'))) && setF(undefined)
  return (
    <div className="max-w-2xl pb-24">
      <Abas variante="sublinhado" atual={parte} onChange={(x) => setParte(x as typeof parte)} abas={[
        { id: 'impostos', nome: '🧾 Impostos' },
        { id: 'regime', nome: '⚖️ Regime e padrão' },
        { id: 'relatorio', nome: '🖨 Relatório impresso' },
      ]} />

      {parte === 'impostos' && <ImpostosOperacoes v={v} mudar={mudar} />}

      {parte === 'regime' && (
        <div className="space-y-4">
          <Cartao titulo={t('Padrão dos relatórios')} ajuda="O padrão boliviano é o do sistema. O brasileiro muda a ordem do resultado (começa na receita bruta e os impostos sobre a venda viram dedução).">
            <EscolhaCartoes<'BO' | 'BR'> rotulo="Padrão dos relatórios" valor={v.pais} onChange={(pais) => mudar({ pais })} opcoes={[
              { id: 'BO', icone: <Bandeira pais="BO" className="h-5 w-7" />, nome: 'Bolivia (padrão)', descricao: 'Estado de Resultados y Balance General · IVA, IT, IUE' },
              { id: 'BR', icone: <Bandeira pais="BR" className="h-5 w-7" />, nome: 'Brasil', descricao: 'DRE e Balanço Patrimonial · Simples ou Lucro Presumido' },
            ]} />
          </Cartao>
          {v.pais === 'BO' ? (
            <Cartao titulo={t('Régimen tributario en Bolivia')}>
              <div className="space-y-3">
                <EscolhaCartoes<'general' | 'rts'> rotulo="Régimen" valor={v.regimeBO} onChange={(regimeBO) => mudar({ regimeBO })} colunas={1} opcoes={[
                  { id: 'general', icone: '🧾', nome: NOMES_REGIME.general.nome, descricao: NOMES_REGIME.general.explica },
                  { id: 'rts', icone: '🏪', nome: NOMES_REGIME.rts.nome, descricao: NOMES_REGIME.rts.explica },
                ]} />
                {v.regimeBO === 'general' ? (
                  <>
                    <EscolhaCartoes<'sim' | 'nao'> rotulo="¿Las ventas salen con factura?" valor={v.vendasComFatura ? 'sim' : 'nao'} onChange={(x) => mudar({ vendasComFatura: x === 'sim' })} opcoes={[
                      { id: 'sim', icone: '🧾', nome: 'Ventas con factura', descricao: 'IVA débito fiscal sobre lo facturado' },
                      { id: 'nao', icone: '🚫', nome: 'Ventas sin factura', descricao: 'Sin débito fiscal (igual paga IT)' },
                    ]} />
                    <EscolhaCartoes<'sim' | 'nao'> rotulo="¿Las compras vienen con factura?" valor={v.comprasComFatura ? 'sim' : 'nao'} onChange={(x) => mudar({ comprasComFatura: x === 'sim' })} opcoes={[
                      { id: 'nao', icone: '🤝', nome: 'Compras sin factura', descricao: 'Lo normal al comprar cabello a personas: sin crédito fiscal' },
                      { id: 'sim', icone: '🧾', nome: 'Compras con factura', descricao: 'Crédito fiscal (baja el IVA a pagar)' },
                    ]} />
                    <div className="flex flex-wrap gap-4 rounded-xl bg-[var(--fundo)] p-3">
                      <CampoTaxa rotulo="IUE (sobre la utilidad)" valor={v.iueBp} onChange={(iueBp) => mudar({ iueBp })} />
                      <p className="basis-full text-xs text-[var(--suave)]">{t('IVA e IT: a taxa é a da aba Impostos.')}</p>
                    </div>
                  </>
                ) : (
                  <Campo rotulo={`${t('Cuota fija bimestral')} (${moeda})`}><ValorInput moeda={moeda} valor={v.rtsCuotaBimestral || undefined} onChange={(x) => mudar({ rtsCuotaBimestral: x ?? 0 })} /></Campo>
                )}
              </div>
            </Cartao>
          ) : (
            <Cartao titulo={t('Regime no Brasil')}>
              <div className="space-y-3">
                <EscolhaCartoes<'simples' | 'presumido'> rotulo="Regime no Brasil" valor={v.regimeBR} onChange={(regimeBR) => mudar({ regimeBR })} colunas={1} opcoes={[
                  { id: 'simples', icone: '📗', nome: NOMES_REGIME.simples.nome, descricao: NOMES_REGIME.simples.explica },
                  { id: 'presumido', icone: '📘', nome: NOMES_REGIME.presumido.nome, descricao: NOMES_REGIME.presumido.explica },
                ]} />
                <div className="flex flex-wrap gap-4 rounded-xl bg-[var(--fundo)] p-3">
                  {v.regimeBR === 'simples' ? <CampoTaxa rotulo="DAS (alíquota efetiva)" valor={v.simplesBp} onChange={(simplesBp) => mudar({ simplesBp })} /> : (
                    <>
                      <CampoTaxa rotulo="PIS" valor={v.pisBp} onChange={(pisBp) => mudar({ pisBp })} />
                      <CampoTaxa rotulo="COFINS" valor={v.cofinsBp} onChange={(cofinsBp) => mudar({ cofinsBp })} />
                      <CampoTaxa rotulo="ICMS / ISS" valor={v.icmsIssBp} onChange={(icmsIssBp) => mudar({ icmsIssBp })} />
                      <CampoTaxa rotulo="IRPJ + CSLL (sobre a receita)" valor={v.irpjCsllBp} onChange={(irpjCsllBp) => mudar({ irpjCsllBp })} />
                    </>
                  )}
                </div>
              </div>
            </Cartao>
          )}
        </div>
      )}

      {parte === 'relatorio' && (
        <Cartao titulo={t('Cabeçalho do relatório impresso')} ajuda="Aparece no topo de cada página e nas firmas do fim. Ex.: Razón social · NIT 1234567 · Av. 6 de Agosto 123.">
          <div className="grid gap-3 sm:grid-cols-2">
            <Campo rotulo="Razão social"><Entrada value={v.razaoSocial ?? ''} placeholder={dados.config.nomeNegocio} onChange={(e) => mudar({ razaoSocial: e.target.value })} /></Campo>
            <Campo rotulo="NIT"><Entrada inputMode="numeric" value={v.nit ?? ''} onChange={(e) => mudar({ nit: e.target.value })} /></Campo>
            <Campo rotulo="Endereço"><Entrada value={v.endereco ?? ''} onChange={(e) => mudar({ endereco: e.target.value })} /></Campo>
            <Campo rotulo="Atividade"><Entrada value={v.atividade ?? ''} placeholder={t('Ex.: venta de cabello y servicios de salón')} onChange={(e) => mudar({ atividade: e.target.value })} /></Campo>
            <Campo rotulo="Contador(a)"><Entrada value={v.contador ?? ''} onChange={(e) => mudar({ contador: e.target.value })} /></Campo>
            <Campo rotulo="Representante legal"><Entrada value={v.representante ?? ''} onChange={(e) => mudar({ representante: e.target.value })} /></Campo>
          </div>
          <div className="mt-3">
            <Interruptor ligado={v.firmasNoRelatorio !== false} onChange={(firmasNoRelatorio) => mudar({ firmasNoRelatorio })} titulo="Firmas no fim do relatório"
              texto="As linhas para assinar (Contador(a) · Representante legal). Desligado, o relatório sai sem elas; na hora de imprimir dá para pôr ou tirar." />
          </div>
        </Cartao>
      )}

      {sujo && (
        <div className="fixed inset-x-0 bottom-20 z-30 mx-auto flex max-w-2xl gap-2 px-3 md:bottom-4">
          <Botao variante="secundario" onClick={() => setF(undefined)}>{t('Desfazer')}</Botao>
          <Botao grande className="flex-1" disabled={ocupado} onClick={salvar}>{t('Salvar')}</Botao>
        </div>
      )}
    </div>
  )
}

/** a aba IMPOSTOS: ligar/desligar, como e onde mostrar, e a lista — um cartão bem separado por imposto */
function ImpostosOperacoes({ v, mudar }: { v: ConfigFiscal; mudar(p: Partial<ConfigFiscal>): void }) {
  const t = useT()
  const lista = v.impostos ?? []
  const [editando, setEditando] = useState<string>()
  const trocar = (k: number, p: Partial<ImpostoOperacao>) => mudar({ impostos: lista.map((x, i) => (i === k ? { ...x, ...p } : x)) })
  const chip = (on: boolean, rotulo: string, onClick: () => void) => (
    <button type="button" aria-pressed={on} onClick={onClick} className={`min-h-9 rounded-full px-3 text-xs font-semibold ring-1 ${on ? 'bg-[var(--marca)] text-white ring-[var(--marca)]' : 'bg-[var(--cartao)] text-[var(--suave)] ring-[var(--borda)]'}`}>{on ? '✓ ' : ''}{t(rotulo)}</button>
  )
  const ondeVale = (i: ImpostoOperacao) => [i.vendaProduto && t('produto'), i.vendaServico && t('serviço'), i.compra === 'credito' ? t('compra (crédito)') : i.compra === 'custo' ? t('compra (custo)') : ''].filter(Boolean).join(' · ')
  return (
    <div className="space-y-4">
      <Interruptor ligado={v.mostrarNasOperacoes} onChange={(mostrarNasOperacoes) => mudar({ mostrarNasOperacoes })} titulo="Mostrar os impostos nas compras e vendas"
        texto="Só informativo: não muda o preço cobrado. Desligado, nenhum imposto aparece (o registro no histórico continua)." />
      {v.mostrarNasOperacoes && (
        <>
          <Cartao titulo={t('Como e onde mostrar')}>
            <div className="space-y-3">
              <EscolhaCartoes<'dentro' | 'fora'> rotulo="Como mostrar" valor={v.modoPreco ?? 'dentro'} onChange={(modoPreco) => mudar({ modoPreco })} opcoes={[
                { id: 'dentro', icone: '🧾', nome: 'Embutido no preço', descricao: 'Bolívia (IVA por dentro): "dos Bs 60, Bs 9,60 é imposto"' },
                { id: 'fora', icone: '➕', nome: 'Somado ao preço', descricao: 'Mostra o custo final: Bs 60 + impostos = Bs 69,60' },
              ]} />
              <Interruptor ligado={v.mostrarNoTotal !== false} onChange={(mostrarNoTotal) => mudar({ mostrarNoTotal })} titulo="Embaixo do total" texto="A linha “🧾 impostos Bs X ›” embaixo do total da venda e da compra (um toque abre o detalhe)." />
              <Interruptor ligado={v.mostrarQuadro !== false} onChange={(mostrarQuadro) => mudar({ mostrarQuadro })} titulo="Quadro embaixo de “Nesta venda”" texto="O detalhe às claras (cada imposto, a alíquota vigente, a fonte e a conta) embaixo dos itens do caixa." />
            </div>
          </Cartao>

          <section aria-label={t('Impostos vigentes')}>
            <h2 className="mb-2 flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-[var(--suave)]">{t('Impostos vigentes')} <span className="num rounded-full bg-[var(--fundo)] px-2 text-xs">{lista.length}</span></h2>
            <ul className="space-y-3">
              {lista.map((i, k) => {
                const cor = CORES[k % CORES.length]
                const aberto = editando === i.id
                return (
                  <li key={i.id} className={cx('overflow-hidden rounded-2xl border-2 bg-[var(--cartao)] shadow-sm', !i.ligado && 'opacity-60')} style={{ borderColor: `color-mix(in srgb, ${cor} 45%, transparent)` }}>
                    {/* a cabeça do cartão: sigla colorida · nome · onde vale · a taxa grande · liga/desliga */}
                    <div className="flex flex-wrap items-center gap-3 p-3" style={{ background: `color-mix(in srgb, ${cor} 10%, transparent)` }}>
                      <span className="flex h-12 min-w-12 shrink-0 items-center justify-center rounded-xl px-2 text-sm font-black text-white" style={{ background: cor }}>{i.sigla || '?'}</span>
                      <span className="linha-texto">
                        <b className="block leading-tight">{i.nome || t('Sem nome')}</b>
                        <span className="text-xs text-[var(--suave)]">{ondeVale(i) || t('não vale em nada')}{i.vigenteDesde ? ` · ${t('desde')} ${dataBR(i.vigenteDesde)}` : ''}</span>
                      </span>
                      <b className="num shrink-0 text-2xl">{pct(i.taxaBp)}%</b>
                      <button type="button" role="switch" aria-checked={i.ligado} aria-label={`${i.sigla}: ${t(i.ligado ? 'ligado' : 'desligado')}`} onClick={() => trocar(k, { ligado: !i.ligado })} className={cx('relative h-6 w-11 shrink-0 rounded-full transition-colors', i.ligado ? 'bg-[var(--marca)]' : 'bg-[var(--borda)]')}>
                        <span className={cx('absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all', i.ligado ? 'left-[22px]' : 'left-0.5')} />
                      </button>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 border-t border-[var(--borda)] px-3 py-1.5">
                      {i.fonte && <span className="linha-texto truncate text-xs text-[var(--suave)]">📜 {i.fonte}</span>}
                      <button type="button" aria-expanded={aberto} onClick={() => setEditando(aberto ? undefined : i.id)} className="ml-auto min-h-10 rounded-lg px-2 text-sm font-semibold text-[var(--marca)] hover:bg-[var(--marca-suave)]">{aberto ? t('Fechar') : `✎ ${t('Editar')}`}</button>
                    </div>
                    {aberto && (
                      <div className="space-y-3 border-t border-[var(--borda)] p-3">
                        <div className="grid gap-2 sm:grid-cols-[6rem_1fr]">
                          <Campo rotulo="Sigla"><Entrada value={i.sigla} onChange={(e) => trocar(k, { sigla: e.target.value })} /></Campo>
                          <Campo rotulo="Nome"><Entrada value={i.nome} onChange={(e) => trocar(k, { nome: e.target.value })} /></Campo>
                        </div>
                        <div className="flex flex-wrap gap-4">
                          <CampoTaxa rotulo="Taxa" valor={i.taxaBp} onChange={(taxaBp) => trocar(k, { taxaBp })} />
                          {i.vendaServico && <CampoTaxa rotulo="Taxa no serviço" valor={i.taxaServicoBp ?? i.taxaBp} onChange={(taxaServicoBp) => trocar(k, { taxaServicoBp: taxaServicoBp === i.taxaBp ? undefined : taxaServicoBp })} />}
                        </div>
                        <div className="space-y-1.5">
                          <p className="text-xs font-semibold text-[var(--suave)]">{t('Vale em')}</p>
                          <div className="flex flex-wrap gap-1.5">
                            {chip(i.vendaProduto, 'Venda de produto', () => trocar(k, { vendaProduto: !i.vendaProduto }))}
                            {chip(i.vendaServico, 'Venda de serviço', () => trocar(k, { vendaServico: !i.vendaServico }))}
                          </div>
                        </div>
                        <EscolhaCartoes<ImpostoOperacao['compra']> rotulo="Na compra" valor={i.compra} onChange={(compra) => trocar(k, { compra })} colunas={3} opcoes={[
                          { id: 'nao', icone: '—', nome: 'Não se aplica' },
                          { id: 'credito', icone: '↩️', nome: 'Crédito fiscal', descricao: 'Abate o da venda' },
                          { id: 'custo', icone: '💸', nome: 'Custo', descricao: 'Não recupera' },
                        ]} />
                        <div className="grid gap-2 sm:grid-cols-[1fr_9rem_9rem]">
                          <Campo rotulo="Fonte legal"><Entrada value={i.fonte ?? ''} placeholder={t('Ex.: Ley 843, art. 15')} onChange={(e) => trocar(k, { fonte: e.target.value })} /></Campo>
                          <Campo rotulo="Vigente desde"><Entrada type="date" value={i.vigenteDesde ?? ''} onChange={(e) => trocar(k, { vigenteDesde: e.target.value || undefined })} /></Campo>
                          <Campo rotulo="Conferido em"><Entrada type="date" value={i.conferidoEm ?? ''} onChange={(e) => trocar(k, { conferidoEm: e.target.value || undefined })} /></Campo>
                        </div>
                        <Campo rotulo="Como a conta é feita (aparece no detalhe)"><Entrada value={i.explica ?? ''} onChange={(e) => trocar(k, { explica: e.target.value })} /></Campo>
                        <div className="flex justify-end">
                          <button type="button" onClick={() => mudar({ impostos: lista.filter((_, x) => x !== k) })} className="min-h-10 rounded-lg px-2 text-sm font-semibold text-[var(--ruim)] hover:bg-[var(--ruim)]/10">🗑 {t('Tirar este imposto')}</button>
                        </div>
                      </div>
                    )}
                  </li>
                )
              })}
            </ul>
            <div className="mt-3 flex flex-wrap gap-2">
              <Botao variante="secundario" onClick={() => { const id = `imp${Date.now()}`; mudar({ impostos: [...lista, { id, sigla: '', nome: '', taxaBp: 0, ligado: true, vendaProduto: true, vendaServico: true, compra: 'nao' }] }); setEditando(id) }}>+ {t('Imposto')}</Botao>
              <Botao variante="leve" onClick={() => mudar({ impostos: (v.pais === 'BR' ? IMPOSTOS_PADRAO_BR : IMPOSTOS_PADRAO_BO).map((x) => ({ ...x })) })}>↺ {t(v.pais === 'BR' ? 'Usar o padrão do Brasil' : 'Usar el estándar de Bolivia')}</Botao>
            </div>
          </section>
        </>
      )}
    </div>
  )
}
