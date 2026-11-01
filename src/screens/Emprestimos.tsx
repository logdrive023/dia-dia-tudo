// EMPRÉSTIMOS: dado (me devem) ou tomado (eu devo), parcelas, pagamentos parciais, atraso e cobrança.
// O sistema só registra e calcula o combinado.

import { useState } from 'react'
import { formatar } from '../core/domain/dinheiro'
import { dataLocal, somarMeses } from '../core/domain/datas'
import { novoId } from '../core/domain/ids'
import type { Id, TipoJuros } from '../core/domain/tipos'
import { calcularParcelas } from '../core/services/emprestimos'
import { Abas, Botao, Campo, Carregando, Cartao, Entrada, Janela, Pilula, Selecao, Titulo, ValorInput, Vazio, dataBR } from '../ui/base'
import { useApp, useComando, useConsulta } from '../ui/contexto'
import { Anexos, SeletorPessoa, linkWhatsApp, useCotacoes } from '../ui/compartilhados'
import { LinhaDoTempo } from '../ui/linhaTempo'
import { useT } from '../ui/i18n'

const TOM = { atrasada: 'ruim', vencendo: 'alerta', 'em dia': 'marca', paga: 'bom', quitado: 'bom' } as const

export function Emprestimos() {
  const t = useT()
  const { nav, ir } = useApp()
  const [direcao, setDirecao] = useState<string>((nav.params.direcao as string) ?? '')
  const [novo, setNovo] = useState(false)
  const { dados } = useConsulta('emprestimos', { direcao: (direcao || undefined) as 'dado' | undefined, status: nav.params.status as string | undefined })
  return (
    <div>
      <Titulo acao={<Botao onClick={() => setNovo(true)}>+ {t('Empréstimo')}</Botao>} subtitulo={t('O sistema só registra e calcula o que foi combinado.')}>{t('Empréstimos')}</Titulo>
      <Abas atual={direcao} onChange={setDirecao} abas={[{ id: '', nome: 'Todos' }, { id: 'dado', nome: 'Me devem' }, { id: 'tomado', nome: 'Eu devo' }]} />
      {nav.params.status && <p className="mb-2 text-sm">{t('Filtro')}: <Pilula tom="alerta">{t(String(nav.params.status))}</Pilula> <button type="button" className="underline" onClick={() => ir('emprestimos')}>{t('limpar')}</button></p>}
      {!dados ? <Carregando /> : !dados.length ? <Vazio texto="Nenhum empréstimo." /> : (
        <ul className="grid gap-2 md:grid-cols-2">
          {dados.map((e) => (
            <li key={e.id}>
              <button type="button" onClick={() => ir('emprestimo', { id: e.id })} className="w-full rounded-2xl border border-[var(--borda)] bg-[var(--cartao)] p-3 text-left hover:border-[var(--marca)]">
                <div className="flex justify-between gap-2"><b>{e.pessoa}</b><Pilula tom={TOM[e.status]}>{t(e.status)}</Pilula></div>
                <div className="text-sm text-[var(--suave)]">{t(e.direcao === 'dado' ? 'Emprestei' : 'Peguei')} {formatar(e.principal, e.moeda)} · {dataBR(e.inicio)}</div>
                <div className="num mt-1 text-lg font-bold">{t('Falta')} {formatar(e.saldo, e.moeda)}</div>
                {e.proxima && <div className="text-xs">{t('Próxima')}: {dataBR(e.proxima.vencimento)} · {formatar(e.proxima.falta, e.moeda)}</div>}
              </button>
            </li>
          ))}
        </ul>
      )}
      {novo && <NovoEmprestimo onFechar={() => setNovo(false)} />}
    </div>
  )
}

function NovoEmprestimo({ onFechar }: { onFechar(): void }) {
  const t = useT()
  const { cfg } = useCotacoes()
  const { executar, ocupado } = useComando()
  const { ir } = useApp()
  const [id] = useState(() => novoId())
  const [direcao, setDirecao] = useState<'dado' | 'tomado'>('dado')
  const [pessoaId, setPessoaId] = useState<Id>()
  const [moeda, setMoeda] = useState(cfg?.moedaPrincipal ?? 'BOB')
  const [principal, setPrincipal] = useState<number>()
  const [tipo, setTipo] = useState<TipoJuros>('simples')
  const [taxa, setTaxa] = useState('5')
  const [fixo, setFixo] = useState<number>()
  const [n, setN] = useState(4)
  const [primeiro, setPrimeiro] = useState(somarMeses(dataLocal(), 1))
  const [forma, setForma] = useState('dinheiro')
  let previa: ReturnType<typeof calcularParcelas> | undefined
  try {
    if (principal) previa = calcularParcelas(principal, { tipo, taxaMensalBp: Math.round(Number(taxa.replace(',', '.')) * 100), valorFixo: fixo }, n, primeiro)
  } catch {
    previa = undefined
  }
  return (
    <Janela aberta titulo={t('Novo empréstimo')} onFechar={onFechar} rodape={<Botao grande className="w-full" disabled={ocupado || !previa || !pessoaId} onClick={async () => {
      const r = await executar('criarEmprestimo', { id, direcao, pessoaId: pessoaId!, moeda, principal: principal!, juros: { tipo, taxaMensalBp: Math.round(Number(taxa.replace(',', '.')) * 100), valorFixo: fixo }, parcelas: n, primeiroVencimento: primeiro, forma }, t('Empréstimo registrado.'))
      if (r) (onFechar(), ir('emprestimo', { id }))
    }}>{t('Registrar')}</Botao>}>
      <div className="space-y-3">
        <Abas atual={direcao} onChange={(v) => setDirecao(v as typeof direcao)} abas={[{ id: 'dado', nome: 'Eu emprestei' }, { id: 'tomado', nome: 'Eu peguei emprestado' }]} />
        <SeletorPessoa valor={pessoaId} onChange={setPessoaId} papel={direcao === 'dado' ? 'devedor' : 'credor'} />
        <div className="grid grid-cols-[7rem_1fr] gap-2">
          <Selecao valor={moeda} onChange={setMoeda} opcoes={(cfg?.moedasAtivas ?? []).map((x) => ({ id: x, nome: x }))} />
          <ValorInput moeda={moeda} valor={principal} onChange={setPrincipal} />
        </div>
        <Campo rotulo="Juros"><Selecao valor={tipo} onChange={(v) => setTipo(v as TipoJuros)} opcoes={[{ id: 'nenhum', nome: t('Sem juros') }, { id: 'simples', nome: t('Simples (% ao mês)') }, { id: 'composto', nome: t('Composto (parcelas iguais)') }, { id: 'fixo', nome: t('Valor fixo combinado') }]} /></Campo>
        {(tipo === 'simples' || tipo === 'composto') && <Campo rotulo="% ao mês"><Entrada inputMode="decimal" value={taxa} onChange={(e) => setTaxa(e.target.value)} /></Campo>}
        {tipo === 'fixo' && <Campo rotulo="Juros combinados (valor)"><ValorInput moeda={moeda} valor={fixo} onChange={setFixo} /></Campo>}
        <div className="grid grid-cols-2 gap-2">
          <Campo rotulo="Parcelas"><Entrada inputMode="numeric" value={n} onChange={(e) => setN(Number(e.target.value) || 1)} /></Campo>
          <Campo rotulo="1º vencimento"><Entrada type="date" value={primeiro} onChange={(e) => setPrimeiro(e.target.value)} /></Campo>
        </div>
        <Campo rotulo={direcao === 'dado' ? 'Saiu do caixa como' : 'Entrou no caixa como'}><Selecao valor={forma} onChange={setForma} opcoes={(cfg?.formas ?? []).filter((f) => f.moedas.includes(moeda)).map((f) => ({ id: f.id, nome: t(f.nome) }))} /></Campo>
        {previa && (
          <div className="rounded-xl bg-[var(--fundo)] p-3 text-sm">
            <b>{t('Total')}: {formatar(previa.total, moeda)}</b> ({t('juros')} {formatar(previa.juros, moeda)})
            <ul className="mt-1">{previa.parcelas.map((p) => <li key={p.numero} className="num">{p.numero}. {dataBR(p.vencimento)} · {formatar(p.valor, moeda)}</li>)}</ul>
          </div>
        )}
      </div>
    </Janela>
  )
}

export function FichaEmprestimo() {
  const t = useT()
  const { nav, voltar } = useApp()
  const id = nav.params.id as Id
  const { dados } = useConsulta('emprestimo', { id })
  const { executar, ocupado } = useComando()
  const { cfg } = useCotacoes()
  const [pagar, setPagar] = useState(false)
  const [valor, setValor] = useState<number>()
  const [forma, setForma] = useState('dinheiro')
  const [pid, setPid] = useState(() => novoId())
  if (!dados) return <Carregando />
  const e = dados.emprestimo
  const cobranca = `${t('Olá')} ${dados.pessoa?.nome ?? ''}! ${t('Parcelas em aberto')}: ${dados.parcelas.filter((p) => p.falta).map((p) => `${p.numero}ª ${dataBR(p.vencimento)} ${formatar(p.falta, e.moeda)}`).join(' · ')}. ${t('Total que falta')}: ${formatar(dados.saldo, e.moeda)}.`
  return (
    <div className="space-y-4">
      <Botao variante="leve" onClick={voltar}>← {t('Voltar')}</Botao>
      <Titulo subtitulo={`${t(e.direcao === 'dado' ? 'Emprestei' : 'Peguei')} ${formatar(e.principal, e.moeda)} · ${dataBR(e.inicio)}`} acao={
        <div className="flex flex-wrap gap-2">
          {dados.saldo > 0 && <Botao onClick={() => setPagar(true)}>{t(e.direcao === 'dado' ? 'Recebi pagamento' : 'Paguei')}</Botao>}
          {e.direcao === 'dado' && dados.saldo > 0 && <a className="min-h-10 rounded-xl bg-[#25d366] px-3 py-2 text-sm font-semibold text-white" href={linkWhatsApp(cobranca, dados.pessoa?.telefone)} target="_blank" rel="noreferrer">{t('Cobrar no WhatsApp')}</a>}
        </div>
      }>{dados.pessoa?.nome}</Titulo>
      <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
        <Cartao><div className="text-xs text-[var(--suave)]">{t('Falta')}</div><div className="num text-xl font-bold">{formatar(dados.saldo, e.moeda)}</div></Cartao>
        <Cartao><div className="text-xs text-[var(--suave)]">{t('Já pago')}</div><div className="num text-xl font-bold">{formatar(dados.recebido, e.moeda)}</div></Cartao>
        <Cartao><div className="text-xs text-[var(--suave)]">{t('Atrasado')}</div><div className="num text-xl font-bold text-[var(--ruim)]">{formatar(dados.atrasado, e.moeda)}</div></Cartao>
        <Cartao><div className="text-xs text-[var(--suave)]">{t('Maior atraso')}</div><div className="num text-xl font-bold">{dados.maiorAtraso} {t('dias')}</div></Cartao>
      </div>
      <Cartao titulo={t('Parcelas')}>
        <ul className="divide-y divide-[var(--borda)] text-sm">
          {dados.parcelas.map((p) => (
            <li key={p.id} className="flex items-center justify-between py-2">
              <span>{p.numero}. {dataBR(p.vencimento)}</span>
              <span className="num">{formatar(p.valor, e.moeda)} {p.falta > 0 && p.falta < p.valor && <span className="text-xs">({t('falta')} {formatar(p.falta, e.moeda)})</span>} <Pilula tom={TOM[p.status]}>{t(p.status)}</Pilula></span>
            </li>
          ))}
        </ul>
      </Cartao>
      <div className="grid gap-4 md:grid-cols-2">
        <Cartao titulo={t('Comprovantes')}><Anexos donoId={e.id} categorias={['comprovante', 'outro']} /></Cartao>
        <Cartao titulo={t('Linha do tempo')}><LinhaDoTempo id={e.id} /></Cartao>
      </div>
      <Janela aberta={pagar} titulo={t('Pagamento')} onFechar={() => setPagar(false)} rodape={<Botao grande className="w-full" disabled={ocupado || !valor} onClick={async () => {
        if (await executar('pagarEmprestimo', { id: pid, emprestimoId: e.id, valor: valor!, forma }, t('Pagamento registrado.'))) {
          setPagar(false)
          setValor(undefined)
          setPid(novoId())
        }
      }}>{t('Registrar')}</Botao>}>
        <div className="space-y-3">
          <Campo rotulo="Valor" ajuda="Pode ser parcial ou adiantado: abate das parcelas mais antigas primeiro."><ValorInput moeda={e.moeda} valor={valor} onChange={setValor} /></Campo>
          <Botao variante="leve" onClick={() => setValor(dados.proxima?.falta)}>{t('Valor da próxima parcela')}</Botao>
          <Botao variante="leve" onClick={() => setValor(dados.saldo)}>{t('Quitar tudo')}</Botao>
          <Campo rotulo="Forma"><Selecao valor={forma} onChange={setForma} opcoes={(cfg?.formas ?? []).filter((f) => f.moedas.includes(e.moeda)).map((f) => ({ id: f.id, nome: t(f.nome) }))} /></Campo>
        </div>
      </Janela>
    </div>
  )
}
