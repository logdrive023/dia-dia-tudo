// NOVO ADIANTAMENTO — dinheiro para o parceiro comprar cabelo; a dívida é paga com o cabelo que ele entregar.
// Assistente em 4 passos:
//   1 Quem vai comprar   a pessoa (comprador/parceiro)
//   2 Quanto             moeda, valor e como sai do caixa
//   3 Ligações           viagem de compra (o campo de viagem padrão) e abater das comissões — opcional
//   4 Confira            o que vai acontecer (caixa, conta corrente, entregas), antes de registrar
// Registra com o mesmo comando (criarFinanciamento).
import { useState } from 'react'
import { formatar } from '../../core/domain/dinheiro'
import { novoId } from '../../core/domain/ids'
import type { Id } from '../../core/domain/tipos'
import { Botao, Campo, Entrada, Pagina, Selecao, ValorInput, moedaPadrao } from '../../ui/base'
import { useApp, useAvisoSaida, useComando, useConsulta } from '../../ui/contexto'
import { SeletorPessoa, useCotacoes } from '../../ui/compartilhados'
import { EscolhaCartoes } from '../../ui/escolhaCartoes'
import { useT } from '../../ui/i18n'
import { Passo, Passos, useAssistente } from '../../ui/passoAPasso'
import { CampoViagem } from '../../ui/seloViagem'

export function CadastroAdiantamento() {
  const t = useT()
  const { voltar, ir, marcarSujo, nav } = useApp()
  const { cfg } = useCotacoes()
  const { executar, ocupado } = useComando()
  const [id] = useState(() => novoId())
  const [pessoaId, setPessoaId] = useState<Id | undefined>(nav.params.pessoaId as Id | undefined)
  const [moedaEscolhida, setMoeda] = useState<string>()
  const moeda = moedaEscolhida ?? cfg?.moedaPrincipal ?? moedaPadrao()
  const [valor, setValor] = useState<number>()
  const [forma, setForma] = useState('dinheiro')
  const [viagemId, setViagemId] = useState<string>((nav.params.viagemId as string | undefined) ?? '')
  const [abater, setAbater] = useState(false)
  const [obs, setObs] = useState('')
  const { dados: pessoas } = useConsulta('pessoas', {})
  const { dados: viagens } = useConsulta('viagensParaFiltro', {})
  // vindo da pessoa ou da viagem: a pessoa já está escolhida → começa no "Quanto"
  const w = useAssistente(pessoaId ? 2 : 1)
  useAvisoSaida(!ocupado && (!!pessoaId || valor !== undefined))
  const formas = (cfg?.formas ?? []).filter((f) => f.moedas.includes(moeda))
  const nome = pessoas?.find((p) => p.id === pessoaId)?.nome
  const viagem = viagens?.find((v) => v.id === viagemId)
  const falta = !pessoaId ? t('quem vai comprar') : !valor ? t('o valor') : ''
  const registrar = async () => {
    const r = await executar('criarFinanciamento', { id, pessoaId: pessoaId!, moeda, valor: valor!, forma, viagemId: viagemId || undefined, abaterComissoes: abater, obs }, t('Adiantamento registrado.'))
    if (r) {
      marcarSujo(false)
      ir('financiamento', { id })
    }
  }
  return (
    <Pagina titulo={t('Novo adiantamento')} subtitulo={t('Dinheiro para o parceiro comprar cabelo. A dívida é paga com o cabelo que ele entregar.')} voltarRotulo="Adiantamentos" onVoltar={voltar} rodape={
      <Botao grande className="w-full" disabled={ocupado || !!falta} onClick={registrar}>{falta ? t('Falta: {x}', { x: falta }) : t('Registrar adiantamento')}</Botao>
    }>
      <Passos rotulo="Passos do adiantamento">
        <Passo n={1} de={4} titulo="Quem vai comprar" feito={!!pessoaId} aberto={w.aberto(1)} onAlternar={() => w.alternar(1)}
          resumo={nome ?? t('ninguém escolhido')}
          ajuda="O parceiro que recebe o dinheiro para comprar cabelo para você." exemplo="Ex.: Wagner, que compra na feira de Oruro">
          <SeletorPessoa valor={pessoaId} onChange={setPessoaId} rotulo="Quem vai comprar (comprador)" />
          {w.proximo(1, 'Quanto', !!pessoaId)}
        </Passo>
        <Passo n={2} de={4} titulo="Quanto" feito={!!valor} aberto={w.aberto(2)} onAlternar={() => w.alternar(2)}
          resumo={valor ? `${formatar(valor, moeda)} · ${t(formas.find((f) => f.id === forma)?.nome ?? forma)}` : t('falta o valor')}
          ajuda="Quanto sai do caixa agora e de que jeito." exemplo="Ex.: Bs 10.000 em dinheiro">
          <Campo rotulo="Valor *" comoDiv>
            <div className="grid grid-cols-[7rem_1fr] gap-2">
              <Selecao valor={moeda} onChange={(v) => (setMoeda(v), setForma((cfg?.formas ?? []).find((f) => f.moedas.includes(v))?.id ?? 'dinheiro'))} opcoes={(cfg?.moedasAtivas ?? [moeda]).map((x) => ({ id: x, nome: x }))} />
              <ValorInput moeda={moeda} valor={valor} onChange={setValor} />
            </div>
          </Campo>
          <Campo rotulo="Sai do caixa como"><Selecao valor={forma} onChange={setForma} opcoes={formas.map((f) => ({ id: f.id, nome: t(f.nome) }))} /></Campo>
          {w.proximo(2, 'Ligações', !!valor)}
        </Passo>
        <Passo n={3} de={4} titulo="Ligações" opcional feito={!!viagemId || abater || !!obs} aberto={w.aberto(3)} onAlternar={() => w.alternar(3)}
          resumo={[viagem ? `✈️ ${viagem.codigo}` : t('sem viagem'), abater && t('abate das comissões'), obs && `📝 ${obs}`].filter(Boolean).join(' · ')}
          ajuda="Se o dinheiro é para uma viagem de compra (as entregas entram como compras dela) e se a dívida pode ser abatida das comissões dele."
          exemplo="Ex.: VG-0002 · abater das comissões">
          <Campo rotulo="Viagem de compra (opcional)" comoDiv><CampoViagem valor={viagemId} onChange={setViagemId} rotulo="Viagem de compra" /></Campo>
          <EscolhaCartoes<'sim' | 'nao'> rotulo="Abater das comissões?" valor={abater ? 'sim' : 'nao'} onChange={(v) => setAbater(v === 'sim')} opcoes={[
            { id: 'nao', icone: '💇‍♀️', nome: 'Só com cabelo', descricao: 'A dívida baixa com as entregas de cabelo' },
            { id: 'sim', icone: '🧾', nome: 'Também nas comissões', descricao: 'Abate sozinho das próximas comissões pagas a ele' },
          ]} />
          <Campo rotulo="Observação (opcional)"><Entrada value={obs} onChange={(e) => setObs(e.target.value)} placeholder={t('Ex.: compra na feira de Oruro')} /></Campo>
          {w.proximo(3, 'Confira')}
        </Passo>
        <Passo n={4} de={4} titulo="Confira" feito={!falta} aberto={w.aberto(4)} onAlternar={() => w.alternar(4)}
          resumo={falta ? t('Falta: {x}', { x: falta }) : t('tudo certo para registrar')}
          ajuda="O que acontece ao registrar, para não ter surpresa." exemplo="Ex.: sai Bs 10.000 do caixa e Wagner passa a dever Bs 10.000">
          <ul className="space-y-2 text-sm">
            <li className="flex gap-2"><span aria-hidden>💸</span><span>{t('Sai do caixa')}: <b className="num">{valor ? formatar(valor, moeda) : '—'}</b> {t('como "Saída por empréstimo operacional" (não é despesa nem compra).')}</span></li>
            <li className="flex gap-2"><span aria-hidden>📒</span><span>{nome ? t('{nome} passa a dever esse valor na conta corrente.', { nome }) : t('A pessoa passa a dever esse valor na conta corrente.')}</span></li>
            <li className="flex gap-2"><span aria-hidden>💇‍♀️</span><span>{t('Cada entrega de cabelo vira uma compra normal que abate a dívida, sem sair do caixa.')}</span></li>
            {viagem && <li className="flex gap-2"><span aria-hidden>✈️</span><span>{t('As entregas entram como compras da viagem {v}.', { v: viagem.codigo })}</span></li>}
          </ul>
        </Passo>
      </Passos>
    </Pagina>
  )
}
