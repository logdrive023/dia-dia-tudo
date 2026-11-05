// CADASTRO DE PESSOA (Pessoas e contas) — assistente em 3 passos, novo ou editar:
//   1 Quem é      nome e WhatsApp (o nome é o único obrigatório)
//   2 O que ela é para você   cartões: cliente, fornecedora, funcionária… (uma pessoa pode ser várias coisas)
//   3 Detalhes (opcional)     documento, unidade onde costuma ser atendida, observação
// Salva com o mesmo comando de sempre (salvarPessoa). Sair com algo escrito pergunta antes.
import { useState } from 'react'
import { CampoTelefone } from '../../ui/campoTelefone'
import { novoId } from '../../core/domain/ids'
import type { Id, Papel } from '../../core/domain/tipos'
import { Botao, Campo, Entrada, Janela, Selecao } from '../../ui/base'
import { useComando, useConsulta } from '../../ui/contexto'
import { type OpcaoCartao, EscolhaCartoesVarias } from '../../ui/escolhaCartoes'
import { useT } from '../../ui/i18n'
import { Passo, Passos, useAssistente } from '../../ui/passoAPasso'

/** o que cada papel quer dizer, em uma linha (a pessoa marca sem conhecer os termos do sistema) */
export const PAPEIS_PESSOA: OpcaoCartao<Papel>[] = [
  { id: 'cliente', icone: '🛍️', nome: 'Cliente', descricao: 'Compra cabelo ou faz serviço com você' },
  { id: 'fornecedor', icone: '🚚', nome: 'Fornecedor(a)', descricao: 'Vende cabelo ou produto para você' },
  { id: 'funcionario', icone: '👩‍💼', nome: 'Funcionário(a)', descricao: 'Trabalha com você (equipe)' },
  { id: 'profissional', icone: '✂️', nome: 'Atende na agenda', descricao: 'Faz serviços e aparece na agenda' },
  { id: 'devedor', icone: '📥', nome: 'Me deve', descricao: 'Pegou dinheiro emprestado de você' },
  { id: 'credor', icone: '📤', nome: 'Eu devo', descricao: 'Emprestou dinheiro para você' },
  { id: 'socio', icone: '🤝', nome: 'Sócio(a)', descricao: 'Divide o negócio com você' },
]

export function CadastroPessoa({ id, onFechar }: { id?: Id; onFechar(): void }) {
  const t = useT()
  const { executar, ocupado } = useComando()
  const { dados: pessoas } = useConsulta('pessoas', {})
  const { dados: locais } = useConsulta('locais', {})
  const p = pessoas?.find((x) => x.id === id)
  const comeco = { nome: p?.nome ?? '', telefone: p?.telefone ?? '', documento: p?.documento ?? '', obs: p?.obs ?? '', papeis: p?.papeis ?? ([] as Papel[]), localId: p?.localId ?? '' }
  const [inicial] = useState(() => JSON.stringify(comeco))
  const [d, setD] = useState(comeco)
  const w = useAssistente()
  if (id && !p) return null
  const sujo = JSON.stringify(d) !== inicial
  const fechar = () => (!sujo || window.confirm(t('Sair sem salvar?'))) && onFechar()
  const falta = !d.nome.trim() ? t('o nome') : !d.papeis.length ? t('o que ela é para você') : ''
  const nomesPapeis = PAPEIS_PESSOA.filter((x) => d.papeis.includes(x.id)).map((x) => t(x.nome))
  const detalhes = [d.documento && `🪪 ${d.documento}`, d.localId && `📍 ${locais?.find((l) => l.id === d.localId)?.nome ?? ''}`, d.obs && `📝 ${d.obs}`].filter(Boolean)
  const salvar = async () => (await executar('salvarPessoa', { ...p, id: id ?? novoId(), ...d, nome: d.nome.trim(), localId: d.localId || undefined }, t(id ? 'Salvo.' : 'Pessoa cadastrada.'))) && onFechar()
  return (
    <Janela aberta larga titulo={t(id ? 'Editar pessoa' : 'Nova pessoa')} onFechar={fechar} rodape={
      <Botao grande className="w-full" disabled={ocupado || !!falta} onClick={salvar}>{falta ? t('Falta: {x}', { x: falta }) : t(id ? 'Salvar' : 'Cadastrar')}</Botao>
    }>
      <Passos rotulo="Passos do cadastro">
        <Passo n={1} de={3} titulo="Quem é" feito={!!d.nome.trim()} aberto={w.aberto(1)} onAlternar={() => w.alternar(1)}
          resumo={[d.nome.trim(), d.telefone && `📱 ${d.telefone}`].filter(Boolean).join(' · ') || t('falta o nome')}
          ajuda="O nome como você chama a pessoa e o WhatsApp para falar com ela." exemplo="Ex.: Ana Paula · +591 70000000">
          <Campo rotulo="Nome *"><Entrada value={d.nome} onChange={(e) => setD({ ...d, nome: e.target.value })} placeholder={t('Ex.: Ana Paula')} autoFocus={!id} /></Campo>
          <Campo rotulo="WhatsApp (opcional)" comoDiv><CampoTelefone valor={d.telefone} onChange={(telefone) => setD({ ...d, telefone })} /></Campo>
          {w.proximo(1, 'O que ela é para você', !!d.nome.trim())}
        </Passo>
        <Passo n={2} de={3} titulo="O que ela é para você" feito={d.papeis.length > 0} aberto={w.aberto(2)} onAlternar={() => w.alternar(2)}
          resumo={nomesPapeis.join(' · ') || t('nada marcado')}
          ajuda="Marque tudo o que vale: a mesma pessoa pode ser cliente e fornecedora. Isso decide onde ela aparece (vendas, compras, agenda, empréstimos)."
          exemplo="Ex.: Wagner → Fornecedor(a) e Me deve">
          <EscolhaCartoesVarias rotulo="O que ela é para você" opcoes={PAPEIS_PESSOA} valor={d.papeis} onChange={(papeis) => setD({ ...d, papeis })} />
          {w.proximo(2, 'Detalhes', d.papeis.length > 0)}
        </Passo>
        <Passo n={3} de={3} titulo="Detalhes" opcional feito={detalhes.length > 0} aberto={w.aberto(3)} onAlternar={() => w.alternar(3)}
          resumo={detalhes.join(' · ') || t('nada — pode pular')}
          ajuda="Só se precisar: documento, a unidade onde ela costuma ser atendida e uma observação." exemplo="Ex.: CI 1234567 · Unidade Centro · prefere atendimento à tarde">
          <Campo rotulo="Documento"><Entrada value={d.documento} onChange={(e) => setD({ ...d, documento: e.target.value })} placeholder={t('Ex.: CI 1234567')} /></Campo>
          {(locais?.length ?? 0) > 0 && <Campo rotulo="Unidade onde costuma ser atendida"><Selecao valor={d.localId} onChange={(v) => setD({ ...d, localId: v })} vazio="—" opcoes={(locais ?? []).map((l) => ({ id: l.id, nome: l.nome }))} /></Campo>}
          <Campo rotulo="Observação"><Entrada value={d.obs} onChange={(e) => setD({ ...d, obs: e.target.value })} /></Campo>
        </Passo>
      </Passos>
    </Janela>
  )
}
