// CONFIGURAÇÕES › FISCAL E RELATÓRIOS — o que o motor dos relatórios precisa saber (CONTABILIDADE.md):
//   1 o padrão (🇧🇴 Bolívia = padrão do sistema · 🇧🇷 Brasil = opção)
//   2 o regime (Bolívia: General ou RTS · Brasil: Simples ou Presumido) e as faturas (débito/crédito do IVA)
//   3 as taxas (mudam por lei: ficam aqui, não no código)
//   4 o cabeçalho do relatório impresso (razão social, NIT, endereço, contador e representante legal)
import { useState } from 'react'
import { Bandeira } from '../ui/bandeira'
import { FISCAL_PADRAO, IMPOSTOS_PADRAO_BO, IMPOSTOS_PADRAO_BR, NOMES_REGIME, type ConfigFiscal, type ImpostoOperacao } from '../core/dados/impostos'
import { Botao, Campo, Carregando, Cartao, Entrada, ValorInput } from '../ui/base'
import { useAvisoSaida, useComando, useConsulta } from '../ui/contexto'
import { EscolhaCartoes } from '../ui/escolhaCartoes'
import { useT } from '../ui/i18n'

const pct = (bp: number) => String(bp / 100).replace('.', ',')
const bp = (txt: string) => Math.round(Number(txt.replace(',', '.')) * 100)

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

export function ConfigFiscal() {
  const t = useT()
  const { dados } = useConsulta('configuracoes', {})
  const { executar, ocupado } = useComando()
  const [f, setF] = useState<ConfigFiscal>()
  const atual = dados?.config.fiscal ?? FISCAL_PADRAO
  const v = f ?? atual
  const sujo = !!f && JSON.stringify(f) !== JSON.stringify(atual)
  useAvisoSaida(sujo)
  if (!dados) return <Carregando />
  const mudar = (p: Partial<ConfigFiscal>) => setF({ ...v, ...p })
  const moeda = dados.config.moedaPrincipal
  const salvar = async () => (await executar('salvarConfig', { fiscal: v }, t('Salvo.'))) && setF(undefined)
  return (
    <div className="max-w-2xl space-y-4 pb-24">
      <Cartao titulo={t('Padrão dos relatórios')} ajuda="O padrão boliviano é o do sistema. O brasileiro muda a ordem do resultado (começa na receita bruta e os impostos sobre a venda viram dedução).">
        <EscolhaCartoes<'BO' | 'BR'> rotulo="Padrão dos relatórios" valor={v.pais} onChange={(pais) => mudar({ pais })} opcoes={[
          { id: 'BO', icone: <Bandeira pais="BO" className="h-5 w-7" />, nome: 'Bolivia (padrão)', descricao: 'Estado de Resultados y Balance General · IVA, IT, IUE' },
          { id: 'BR', icone: <Bandeira pais="BR" className="h-5 w-7" />, nome: 'Brasil', descricao: 'DRE e Balanço Patrimonial · Simples ou Lucro Presumido' },
        ]} />
      </Cartao>

      <ImpostosOperacoes v={v} mudar={mudar} />

      {v.pais === 'BO' && (
      <Cartao titulo={t('Régimen tributario en Bolivia')}>
        <div className="space-y-3">
          <EscolhaCartoes<'general' | 'rts'> rotulo="Régimen" valor={v.regimeBO} onChange={(regimeBO) => mudar({ regimeBO })} colunas={1} opcoes={[
            { id: 'general', icone: '🧾', nome: NOMES_REGIME.general.nome, descricao: NOMES_REGIME.general.explica },
            { id: 'rts', icone: '🏪', nome: NOMES_REGIME.rts.nome, descricao: NOMES_REGIME.rts.explica },
          ]} />
          {v.regimeBO === 'general' ? (
            <>
              <EscolhaCartoes<'sim' | 'nao'> rotulo="¿Las ventas salen con factura?" valor={v.vendasComFatura ? 'sim' : 'nao'} onChange={(x) => mudar({ vendasComFatura: x === 'sim' })} opcoes={[
                { id: 'sim', icone: '🧾', nome: 'Ventas con factura', descricao: 'IVA débito fiscal = 13% de lo facturado' },
                { id: 'nao', icone: '🚫', nome: 'Ventas sin factura', descricao: 'Sin débito fiscal (igual paga IT 3%)' },
              ]} />
              <EscolhaCartoes<'sim' | 'nao'> rotulo="¿Las compras vienen con factura?" valor={v.comprasComFatura ? 'sim' : 'nao'} onChange={(x) => mudar({ comprasComFatura: x === 'sim' })} opcoes={[
                { id: 'nao', icone: '🤝', nome: 'Compras sin factura', descricao: 'Lo normal al comprar cabello a personas: sin crédito fiscal' },
                { id: 'sim', icone: '🧾', nome: 'Compras con factura', descricao: 'Crédito fiscal = 13% de lo comprado (baja el IVA a pagar)' },
              ]} />
              <div className="flex flex-wrap gap-4 rounded-xl bg-[var(--fundo)] p-3">
                <CampoTaxa rotulo="IUE (sobre la utilidad)" valor={v.iueBp} onChange={(iueBp) => mudar({ iueBp })} />
                <p className="basis-full text-xs text-[var(--suave)]">{t('IVA e IT: a taxa é a da lista "Impostos nas compras e vendas" acima.')}</p>
              </div>
            </>
          ) : (
            <Campo rotulo={`${t('Cuota fija bimestral')} (${moeda})`}><ValorInput moeda={moeda} valor={v.rtsCuotaBimestral || undefined} onChange={(x) => mudar({ rtsCuotaBimestral: x ?? 0 })} /></Campo>
          )}
        </div>
      </Cartao>
      )}

      {v.pais === 'BR' && (
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

      <Cartao titulo={t('Cabeçalho do relatório impresso')} ajuda="Aparece no topo de cada página e nas firmas do fim. Ex.: Razón social · NIT 1234567 · Av. 6 de Agosto 123.">
        <div className="grid gap-3 sm:grid-cols-2">
          <Campo rotulo="Razão social"><Entrada value={v.razaoSocial ?? ''} placeholder={dados.config.nomeNegocio} onChange={(e) => mudar({ razaoSocial: e.target.value })} /></Campo>
          <Campo rotulo="NIT"><Entrada inputMode="numeric" value={v.nit ?? ''} onChange={(e) => mudar({ nit: e.target.value })} /></Campo>
          <Campo rotulo="Endereço"><Entrada value={v.endereco ?? ''} onChange={(e) => mudar({ endereco: e.target.value })} /></Campo>
          <Campo rotulo="Atividade"><Entrada value={v.atividade ?? ''} placeholder={t('Ex.: venta de cabello y servicios de salón')} onChange={(e) => mudar({ atividade: e.target.value })} /></Campo>
          <Campo rotulo="Contador(a)"><Entrada value={v.contador ?? ''} onChange={(e) => mudar({ contador: e.target.value })} /></Campo>
          <Campo rotulo="Representante legal"><Entrada value={v.representante ?? ''} onChange={(e) => mudar({ representante: e.target.value })} /></Campo>
        </div>
      </Cartao>

      {sujo && (
        <div className="fixed inset-x-0 bottom-20 z-30 mx-auto flex max-w-2xl gap-2 px-3 md:bottom-4">
          <Botao variante="secundario" onClick={() => setF(undefined)}>{t('Desfazer')}</Botao>
          <Botao grande className="flex-1" disabled={ocupado} onClick={salvar}>{t('Salvar')}</Botao>
        </div>
      )}
    </div>
  )
}

/**
 * IMPOSTOS NAS COMPRAS E VENDAS — a lista vigente, toda editável: cada imposto (sigla, nome, taxa), se está ligado e
 * onde vale (venda de produto, venda de serviço, compra como crédito ou custo). O interruptor geral desliga tudo:
 * aí não aparece imposto na compra, na venda nem no Painel.
 */
function ImpostosOperacoes({ v, mudar }: { v: ConfigFiscal; mudar(p: Partial<ConfigFiscal>): void }) {
  const t = useT()
  const lista = v.impostos ?? []
  const trocar = (k: number, p: Partial<ImpostoOperacao>) => mudar({ impostos: lista.map((x, i) => (i === k ? { ...x, ...p } : x)) })
  const chip = (on: boolean, rotulo: string, onClick: () => void) => (
    <button type="button" aria-pressed={on} onClick={onClick} className={`min-h-9 rounded-full px-3 text-xs font-semibold ring-1 ${on ? 'bg-[var(--marca)] text-white ring-[var(--marca)]' : 'bg-[var(--cartao)] text-[var(--suave)] ring-[var(--borda)]'}`}>{on ? '✓ ' : ''}{t(rotulo)}</button>
  )
  return (
    <Cartao titulo={t('Impostos nas compras e vendas')} ajuda="O sistema só INFORMA quanto da compra ou da venda iria para o fisco (não muda o preço nem cobra a mais). Aparece na nova compra, na venda, no caixa e no Painel. Não quer? Desligue aqui e some de tudo.">
      <div className="space-y-3">
        <label className="flex min-h-11 cursor-pointer items-start gap-3 rounded-xl bg-[var(--fundo)] p-3">
          <input type="checkbox" className="mt-0.5 h-6 w-6 shrink-0" checked={v.mostrarNasOperacoes} onChange={(e) => mudar({ mostrarNasOperacoes: e.target.checked })} />
          <span className="text-sm">
            <b className="block">{t('Mostrar os impostos nas compras e vendas')}</b>
            <span className="text-[var(--suave)]">{t('Ligado: cada compra e venda mostra o imposto estimado, e o Painel mostra o resultado antes e depois dos impostos. Desligado: nada disso aparece.')}</span>
          </span>
        </label>
        {v.mostrarNasOperacoes && (
          <>
            <EscolhaCartoes<'dentro' | 'fora'> rotulo="Como mostrar" valor={v.modoPreco ?? 'dentro'} onChange={(modoPreco) => mudar({ modoPreco })} opcoes={[
              { id: 'dentro', icone: '🧾', nome: 'Embutido no preço', descricao: 'Bolívia (IVA por dentro): "dos Bs 60, Bs 9,60 é imposto"' },
              { id: 'fora', icone: '➕', nome: 'Somado ao preço', descricao: 'Mostra o custo final: Bs 60 + impostos = Bs 69,60 (só informativo)' },
            ]} />
            <ul className="space-y-2">
              {lista.map((i, k) => (
                <li key={i.id} className={`rounded-2xl border p-3 ${i.ligado ? 'border-[var(--borda)] bg-[var(--cartao)]' : 'border-dashed border-[var(--borda)] opacity-70'}`}>
                  <div className="flex flex-wrap items-end gap-2">
                    <Campo rotulo="Sigla" className="w-24"><Entrada value={i.sigla} onChange={(e) => trocar(k, { sigla: e.target.value })} /></Campo>
                    <Campo rotulo="Nome" className="min-w-[10rem] flex-1"><Entrada value={i.nome} onChange={(e) => trocar(k, { nome: e.target.value })} /></Campo>
                    <CampoTaxa rotulo="Taxa" valor={i.taxaBp} onChange={(taxaBp) => trocar(k, { taxaBp })} />
                    {i.vendaServico && <CampoTaxa rotulo="Taxa no serviço" valor={i.taxaServicoBp ?? i.taxaBp} onChange={(taxaServicoBp) => trocar(k, { taxaServicoBp: taxaServicoBp === i.taxaBp ? undefined : taxaServicoBp })} />}
                    <label className="flex min-h-11 items-center gap-2 text-sm font-semibold"><input type="checkbox" className="h-5 w-5" checked={i.ligado} onChange={(e) => trocar(k, { ligado: e.target.checked })} /> {t('Ligado')}</label>
                    <button type="button" aria-label={`${t('Tirar')} ${i.sigla}`} onClick={() => mudar({ impostos: lista.filter((_, x) => x !== k) })} className="min-h-11 rounded-lg px-2 text-sm font-semibold text-[var(--ruim)] hover:bg-[var(--ruim)]/10">✕</button>
                  </div>
                  <div className="mt-2 flex flex-wrap items-center gap-1.5">
                    <span className="text-xs text-[var(--suave)]">{t('Vale em')}:</span>
                    {chip(i.vendaProduto, 'Venda de produto', () => trocar(k, { vendaProduto: !i.vendaProduto }))}
                    {chip(i.vendaServico, 'Venda de serviço', () => trocar(k, { vendaServico: !i.vendaServico }))}
                    <span className="ml-1 text-xs text-[var(--suave)]">{t('Na compra')}:</span>
                    <select aria-label={t('Na compra')} value={i.compra} onChange={(e) => trocar(k, { compra: e.target.value as ImpostoOperacao['compra'] })} className="min-h-9 rounded-full bg-[var(--fundo)] px-3 text-xs font-semibold ring-1 ring-[var(--borda)]">
                      <option value="nao">{t('não se aplica')}</option>
                      <option value="credito">{t('crédito fiscal (abate o da venda)')}</option>
                      <option value="custo">{t('custo (não recupera)')}</option>
                    </select>
                  </div>
                  {/* a alíquota VIGENTE: de onde vem e desde quando (aparece no detalhe da venda; base da sincronização futura) */}
                  <div className="mt-2 grid gap-2 sm:grid-cols-[1fr_9rem_9rem]">
                    <Campo rotulo="Fonte legal"><Entrada value={i.fonte ?? ''} placeholder={t('Ex.: Ley 843, art. 15')} onChange={(e) => trocar(k, { fonte: e.target.value })} /></Campo>
                    <Campo rotulo="Vigente desde"><Entrada type="date" value={i.vigenteDesde ?? ''} onChange={(e) => trocar(k, { vigenteDesde: e.target.value || undefined })} /></Campo>
                    <Campo rotulo="Conferido em"><Entrada type="date" value={i.conferidoEm ?? ''} onChange={(e) => trocar(k, { conferidoEm: e.target.value || undefined })} /></Campo>
                  </div>
                  <Campo rotulo="Como a conta é feita (aparece no detalhe)" className="mt-2"><Entrada value={i.explica ?? ''} onChange={(e) => trocar(k, { explica: e.target.value })} /></Campo>
                </li>
              ))}
            </ul>
            <div className="flex flex-wrap gap-2">
              <Botao variante="secundario" onClick={() => mudar({ impostos: [...lista, { id: `imp${Date.now()}`, sigla: '', nome: '', taxaBp: 0, ligado: true, vendaProduto: true, vendaServico: true, compra: 'nao' }] })}>+ {t('Imposto')}</Botao>
              <Botao variante="leve" onClick={() => mudar({ impostos: (v.pais === 'BR' ? IMPOSTOS_PADRAO_BR : IMPOSTOS_PADRAO_BO).map((x) => ({ ...x })) })}>↺ {t(v.pais === 'BR' ? 'Usar o padrão do Brasil' : 'Usar el estándar de Bolivia')}</Botao>
            </div>
          </>
        )}
      </div>
    </Cartao>
  )
}
