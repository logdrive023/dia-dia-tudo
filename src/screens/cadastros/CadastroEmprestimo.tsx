// NOVO EMPRÉSTIMO — assistente em 4 passos (o sistema só registra e calcula o que foi combinado):
//   1 Quem e para que lado   cartões "Eu emprestei" / "Eu peguei emprestado" + a pessoa
//   2 Quanto                 moeda, valor e como saiu/entrou no caixa
//   3 Juros                  cartões: sem juros · simples · composto · valor fixo (cada um com o que quer dizer)
//   4 Parcelas               quantas, 1º vencimento e a conta pronta (total, juros, cada parcela)
// Registra com o mesmo comando (criarEmprestimo); a conta de cada parcela vem de calcularParcelas.
import { useState } from 'react'
import { formatar } from '../../core/domain/dinheiro'
import { dataLocal, somarMeses } from '../../core/domain/datas'
import { novoId } from '../../core/domain/ids'
import type { Id, TipoJuros } from '../../core/domain/tipos'
import { calcularParcelas } from '../../core/services/emprestimos'
import { Botao, Campo, Entrada, Pagina, Selecao, ValorInput, dataBR, moedaPadrao } from '../../ui/base'
import { useApp, useAvisoSaida, useComando, useConsulta } from '../../ui/contexto'
import { SeletorPessoa, useCotacoes } from '../../ui/compartilhados'
import { EscolhaCartoes } from '../../ui/escolhaCartoes'
import { useT } from '../../ui/i18n'
import { Passo, Passos, useAssistente } from '../../ui/passoAPasso'

const JUROS: { id: TipoJuros; icone: string; nome: string; descricao: string }[] = [
  { id: 'nenhum', icone: '🤝', nome: 'Sem juros', descricao: 'Devolve só o que pegou' },
  { id: 'simples', icone: '➕', nome: 'Juros simples', descricao: '% ao mês sobre o valor emprestado' },
  { id: 'composto', icone: '🧮', nome: 'Parcelas iguais', descricao: '% ao mês, juros sobre o saldo (tabela Price)' },
  { id: 'fixo', icone: '💰', nome: 'Valor fixo', descricao: 'Um valor de juros combinado, de uma vez' },
]

export function CadastroEmprestimo() {
  const { voltar, ir, marcarSujo } = useApp()
  const t = useT()
  const { cfg } = useCotacoes()
  const { executar, ocupado } = useComando()
  const { dados: pessoas } = useConsulta('pessoas', {})
  const [id] = useState(() => novoId())
  const [direcao, setDirecao] = useState<'dado' | 'tomado'>('dado')
  const [pessoaId, setPessoaId] = useState<Id>()
  const [moedaEscolhida, setMoeda] = useState<string>()
  const moeda = moedaEscolhida ?? cfg?.moedaPrincipal ?? moedaPadrao()
  const [principal, setPrincipal] = useState<number>()
  const [tipo, setTipo] = useState<TipoJuros>()
  const [taxa, setTaxa] = useState('5')
  const [fixo, setFixo] = useState<number>()
  const [n, setN] = useState(4)
  const [primeiro, setPrimeiro] = useState(somarMeses(dataLocal(), 1))
  const [forma, setForma] = useState('dinheiro')
  const w = useAssistente()
  useAvisoSaida(!ocupado && (!!pessoaId || principal !== undefined || fixo !== undefined))
  const taxaBp = Math.round(Number(taxa.replace(',', '.')) * 100)
  let previa: ReturnType<typeof calcularParcelas> | undefined
  try {
    if (principal && tipo) previa = calcularParcelas(principal, { tipo, taxaMensalBp: taxaBp, valorFixo: fixo }, n, primeiro)
  } catch {
    previa = undefined
  }
  const nome = pessoas?.find((p) => p.id === pessoaId)?.nome
  const formas = (cfg?.formas ?? []).filter((f) => f.moedas.includes(moeda))
  const falta = !pessoaId ? t('quem') : !principal ? t('o valor') : !tipo ? t('os juros') : !previa ? t('as parcelas') : ''
  const nomeJuros = JUROS.find((j) => j.id === tipo)
  const registrar = async () => {
    const r = await executar('criarEmprestimo', { id, direcao, pessoaId: pessoaId!, moeda, principal: principal!, juros: { tipo: tipo!, taxaMensalBp: taxaBp, valorFixo: fixo }, parcelas: n, primeiroVencimento: primeiro, forma }, t('Empréstimo registrado.'))
    if (r) {
      marcarSujo(false)
      ir('emprestimo', { id })
    }
  }
  return (
    <Pagina titulo={t('Novo empréstimo')} subtitulo={t('O sistema só registra e calcula o que foi combinado.')} voltarRotulo="Empréstimos" onVoltar={voltar} rodape={
      <Botao grande className="w-full" disabled={ocupado || !!falta} onClick={registrar}>{falta ? t('Falta: {x}', { x: falta }) : t('Registrar empréstimo')}</Botao>
    }>
      <Passos rotulo="Passos do empréstimo">
        <Passo n={1} de={4} titulo="Quem e para que lado" feito={!!pessoaId} aberto={w.aberto(1)} onAlternar={() => w.alternar(1)}
          resumo={[t(direcao === 'dado' ? 'Eu emprestei' : 'Eu peguei emprestado'), nome].filter(Boolean).join(' · ')}
          ajuda="Se o dinheiro saiu de você (emprestou) ou entrou para você (pegou emprestado), e com quem." exemplo="Ex.: Eu emprestei · Wagner">
          <EscolhaCartoes<'dado' | 'tomado'> rotulo="Para que lado" valor={direcao} onChange={setDirecao} opcoes={[
            { id: 'dado', icone: '📤', nome: 'Eu emprestei', descricao: 'O dinheiro sai do caixa; a pessoa te deve' },
            { id: 'tomado', icone: '📥', nome: 'Eu peguei emprestado', descricao: 'O dinheiro entra no caixa; você deve' },
          ]} />
          <SeletorPessoa valor={pessoaId} onChange={setPessoaId} papel={direcao === 'dado' ? 'devedor' : 'credor'} rotulo={direcao === 'dado' ? 'Para quem' : 'De quem'} />
          {w.proximo(1, 'Quanto', !!pessoaId)}
        </Passo>
        <Passo n={2} de={4} titulo="Quanto" feito={!!principal} aberto={w.aberto(2)} onAlternar={() => w.alternar(2)}
          resumo={principal ? `${formatar(principal, moeda)} · ${t(formas.find((f) => f.id === forma)?.nome ?? forma)}` : t('falta o valor')}
          ajuda="O valor emprestado e como ele saiu (ou entrou) no caixa." exemplo="Ex.: Bs 5.000 em dinheiro">
          <Campo rotulo="Valor *" comoDiv>
            <div className="grid grid-cols-[7rem_1fr] gap-2">
              <Selecao valor={moeda} onChange={(v) => (setMoeda(v), setForma((cfg?.formas ?? []).find((f) => f.moedas.includes(v))?.id ?? 'dinheiro'))} opcoes={(cfg?.moedasAtivas ?? [moeda]).map((x) => ({ id: x, nome: x }))} />
              <ValorInput moeda={moeda} valor={principal} onChange={setPrincipal} />
            </div>
          </Campo>
          <Campo rotulo={direcao === 'dado' ? 'Saiu do caixa como' : 'Entrou no caixa como'}><Selecao valor={forma} onChange={setForma} opcoes={formas.map((f) => ({ id: f.id, nome: t(f.nome) }))} /></Campo>
          {w.proximo(2, 'Juros', !!principal)}
        </Passo>
        <Passo n={3} de={4} titulo="Juros" feito={!!tipo} aberto={w.aberto(3)} onAlternar={() => w.alternar(3)}
          resumo={[nomeJuros ? t(nomeJuros.nome) : t('escolha como foram os juros'), (tipo === 'simples' || tipo === 'composto') && `${taxa}% ${t('ao mês')}`, tipo === 'fixo' && fixo !== undefined && formatar(fixo, moeda)].filter(Boolean).join(' · ')}
          ajuda="Como os juros foram combinados. Escolha e veja a conta pronta no próximo passo." exemplo="Ex.: 5% ao mês, juros simples">
          <EscolhaCartoes<TipoJuros> rotulo="Juros" valor={tipo} onChange={setTipo} opcoes={JUROS} />
          {(tipo === 'simples' || tipo === 'composto') && <Campo rotulo="% ao mês"><Entrada inputMode="decimal" value={taxa} onChange={(e) => setTaxa(e.target.value)} /></Campo>}
          {tipo === 'fixo' && <Campo rotulo="Juros combinados (valor)"><ValorInput moeda={moeda} valor={fixo} onChange={setFixo} /></Campo>}
          {w.proximo(3, 'Parcelas', !!tipo)}
        </Passo>
        <Passo n={4} de={4} titulo="Parcelas" feito={!!previa} aberto={w.aberto(4)} onAlternar={() => w.alternar(4)}
          resumo={previa ? `${t('{n}x', { n })} · ${t('total')} ${formatar(previa.total, moeda)} · 1ª ${dataBR(primeiro)}` : t('falta o valor')}
          ajuda="Em quantas vezes e quando vence a primeira. A conta aparece pronta embaixo." exemplo="Ex.: 4 parcelas, a 1ª daqui a um mês">
          <div className="grid gap-2 xs:grid-cols-2">
            <Campo rotulo="Parcelas"><Entrada inputMode="numeric" value={n} onChange={(e) => setN(Math.max(1, Number(e.target.value) || 1))} /></Campo>
            <Campo rotulo="1º vencimento"><Entrada type="date" value={primeiro} onChange={(e) => setPrimeiro(e.target.value)} /></Campo>
          </div>
          {previa ? (
            <div className="rounded-2xl bg-[var(--cartao)] p-3 ring-1 ring-[var(--borda)]">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <span className="text-sm text-[var(--suave)]">{t('Total a {x}', { x: t(direcao === 'dado' ? 'receber' : 'pagar') })}</span>
                <b className="num text-xl">{formatar(previa.total, moeda)}</b>
              </div>
              <p className="num text-xs text-[var(--suave)]">{formatar(principal!, moeda)} + {t('juros')} {formatar(previa.juros, moeda)}</p>
              <ul className="mt-2 divide-y divide-[var(--borda)] text-sm">
                {previa.parcelas.map((p) => <li key={p.numero} className="num flex justify-between gap-3 py-1.5"><span>{p.numero}ª · {dataBR(p.vencimento)}</span><b>{formatar(p.valor, moeda)}</b></li>)}
              </ul>
            </div>
          ) : <p className="text-sm text-[var(--suave)]">{t('Ponha o valor (passo 2) para ver a conta.')}</p>}
        </Passo>
      </Passos>
    </Pagina>
  )
}
