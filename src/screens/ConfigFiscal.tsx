// CONFIGURAÇÕES › FISCAL E RELATÓRIOS — o que o motor dos relatórios precisa saber (CONTABILIDADE.md):
//   1 o padrão (🇧🇴 Bolívia = padrão do sistema · 🇧🇷 Brasil = opção)
//   2 o regime (Bolívia: General ou RTS · Brasil: Simples ou Presumido) e as faturas (débito/crédito do IVA)
//   3 as taxas (mudam por lei: ficam aqui, não no código)
//   4 o cabeçalho do relatório impresso (razão social, NIT, endereço, contador e representante legal)
import { useState } from 'react'
import { Bandeira } from '../ui/bandeira'
import { FISCAL_PADRAO, NOMES_REGIME, type ConfigFiscal } from '../core/dados/impostos'
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
                <CampoTaxa rotulo="IVA" valor={v.ivaBp} onChange={(ivaBp) => mudar({ ivaBp })} />
                <CampoTaxa rotulo="IT" valor={v.itBp} onChange={(itBp) => mudar({ itBp })} />
                <CampoTaxa rotulo="IUE" valor={v.iueBp} onChange={(iueBp) => mudar({ iueBp })} />
              </div>
            </>
          ) : (
            <Campo rotulo={`${t('Cuota fija bimestral')} (${moeda})`}><ValorInput moeda={moeda} valor={v.rtsCuotaBimestral || undefined} onChange={(x) => mudar({ rtsCuotaBimestral: x ?? 0 })} /></Campo>
          )}
        </div>
      </Cartao>

      <Cartao titulo={t('Regime no Brasil (se escolher o padrão brasileiro)')}>
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
