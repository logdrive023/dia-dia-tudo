// CADASTRO DE FUNCIONÁRIO (Equipe e unidades) — assistente em 4 passos, novo ou editar:
//   1 Quem é             nome, cargo e WhatsApp
//   2 Onde trabalha      unidade, a quem responde (organograma) e se atende clientes (agenda)
//   3 Quanto ganha       salário (mês/semana/dia) e comissão — opcional, é a estimativa do custo
//   4 O que pode ver     cartões: Funcionário (só a unidade e a própria agenda) · Administrador (tudo)
// Salva com o mesmo comando (salvarPessoa) e mantém os outros papéis que a pessoa já tinha.
import { useState } from 'react'
import { formatar } from '../../core/domain/dinheiro'
import { novoId } from '../../core/domain/ids'
import type { Pessoa } from '../../core/domain/tipos'
import { Botao, Campo, Entrada, Janela, Selecao, ValorInput, moedaPadrao } from '../../ui/base'
import { useComando, useConsulta } from '../../ui/contexto'
import { useCotacoes } from '../../ui/compartilhados'
import { EscolhaCartoes } from '../../ui/escolhaCartoes'
import { useT } from '../../ui/i18n'
import { Passo, Passos, useAssistente } from '../../ui/passoAPasso'

export const PERIODOS_SALARIO = { mes: 'por mês', semana: 'por semana', dia: 'por dia' } as const
const CARGOS = ['Diretora geral', 'Gerente', 'Cabeleireira sênior', 'Cabeleireira', 'Manicure', 'Recepção']

export function CadastroFuncionario({ pessoa, localPadrao, onFechar }: { pessoa?: Pessoa; localPadrao?: string; onFechar(): void }) {
  const t = useT()
  const { executar, ocupado } = useComando()
  const { dados: locais } = useConsulta('locais', {})
  const { dados: todos } = useConsulta('pessoas', { papel: 'funcionario' })
  const { cfg } = useCotacoes()
  const [d, setD] = useState({
    id: pessoa?.id ?? novoId(),
    nome: pessoa?.nome ?? '',
    telefone: pessoa?.telefone ?? '',
    cargo: pessoa?.cargo ?? '',
    localId: pessoa?.localId ?? localPadrao ?? '',
    superiorId: pessoa?.superiorId ?? '',
    salario: pessoa?.salario?.valor,
    moeda: pessoa?.salario?.moeda as string | undefined,
    periodo: (pessoa?.salario?.periodo ?? 'mes') as keyof typeof PERIODOS_SALARIO,
    comissao: pessoa?.comissaoBp ? String(pessoa.comissaoBp / 100) : '',
    atende: pessoa ? pessoa.papeis.includes('profissional') : true,
    acesso: (pessoa?.acesso ?? 'funcionario') as 'funcionario' | 'admin',
  })
  const [inicial] = useState(() => JSON.stringify(d))
  const w = useAssistente()
  const moeda = d.moeda ?? cfg?.moedaPrincipal ?? moedaPadrao()
  const fechar = () => (JSON.stringify(d) === inicial || window.confirm(t('Sair sem salvar?'))) && onFechar()
  const falta = !d.nome.trim() ? t('o nome') : ''
  const local = locais?.find((l) => l.id === d.localId)?.nome
  const chefe = todos?.find((p) => p.id === d.superiorId)?.nome
  const salvar = async () => {
    const r = await executar('salvarPessoa', {
      id: d.id,
      nome: d.nome.trim(),
      telefone: d.telefone,
      papeis: [...new Set([...(pessoa?.papeis ?? []).filter((x) => x !== 'profissional'), 'funcionario', ...(d.atende ? ['profissional' as const] : [])])] as Pessoa['papeis'],
      cargo: d.cargo,
      localId: d.localId || undefined,
      superiorId: d.superiorId || undefined,
      salario: d.salario !== undefined ? { moeda, valor: d.salario, periodo: d.periodo } : undefined,
      comissaoBp: d.comissao ? Math.round(Number(d.comissao.replace(',', '.')) * 100) : undefined,
      acesso: d.acesso,
    }, t(pessoa ? 'Salvo.' : 'Funcionário cadastrado.'))
    if (r) onFechar()
  }
  return (
    <Janela aberta larga titulo={t(pessoa ? 'Editar funcionário' : 'Novo funcionário')} onFechar={fechar} rodape={
      <Botao grande className="w-full" disabled={ocupado || !!falta} onClick={salvar}>{falta ? t('Falta: {x}', { x: falta }) : t(pessoa ? 'Salvar' : 'Cadastrar')}</Botao>
    }>
      <Passos rotulo="Passos do cadastro">
        <Passo n={1} de={4} titulo="Quem é" feito={!!d.nome.trim()} aberto={w.aberto(1)} onAlternar={() => w.alternar(1)}
          resumo={[d.nome.trim(), d.cargo, d.telefone && `📱 ${d.telefone}`].filter(Boolean).join(' · ') || t('falta o nome')}
          ajuda="O nome, o cargo e o WhatsApp de quem trabalha com você." exemplo="Ex.: Paula · Cabeleireira · +591 70000000">
          <Campo rotulo="Nome *"><Entrada value={d.nome} onChange={(e) => setD({ ...d, nome: e.target.value })} placeholder={t('Ex.: Paula')} autoFocus={!pessoa} /></Campo>
          <Campo rotulo="Cargo (opcional)"><Entrada list="cargos" value={d.cargo} onChange={(e) => setD({ ...d, cargo: e.target.value })} placeholder={t('Ex.: Cabeleireira')} /><datalist id="cargos">{CARGOS.map((c) => <option key={c} value={c} />)}</datalist></Campo>
          <Campo rotulo="WhatsApp (opcional)"><Entrada inputMode="tel" value={d.telefone} onChange={(e) => setD({ ...d, telefone: e.target.value })} placeholder="+591 70000000" /></Campo>
          {w.proximo(1, 'Onde trabalha', !!d.nome.trim())}
        </Passo>
        <Passo n={2} de={4} titulo="Onde trabalha" feito={!!d.localId || !!d.superiorId} aberto={w.aberto(2)} onAlternar={() => w.alternar(2)}
          resumo={[local && `📍 ${local}`, chefe && `↑ ${chefe}`, d.atende ? `✂️ ${t('atende na agenda')}` : t('não atende clientes')].filter(Boolean).join(' · ')}
          ajuda="A unidade, a quem ela responde (monta o organograma) e se atende clientes (aparece na agenda para marcar horário)."
          exemplo="Ex.: Unidade Centro · responde à Gerente · atende na agenda">
          {(locais?.length ?? 0) > 0 && <Campo rotulo="Unidade"><Selecao valor={d.localId} onChange={(v) => setD({ ...d, localId: v })} vazio="—" opcoes={(locais ?? []).map((l) => ({ id: l.id, nome: l.nome }))} /></Campo>}
          <Campo rotulo="Responde a"><Selecao valor={d.superiorId} onChange={(v) => setD({ ...d, superiorId: v })} vazio="Ninguém (topo)" opcoes={(todos ?? []).filter((p) => p.id !== d.id).map((p) => ({ id: p.id, nome: `${p.nome}${p.cargo ? ` · ${p.cargo}` : ''}` }))} /></Campo>
          <EscolhaCartoes<'sim' | 'nao'> rotulo="Atende clientes?" valor={d.atende ? 'sim' : 'nao'} onChange={(v) => setD({ ...d, atende: v === 'sim' })} opcoes={[
            { id: 'sim', icone: '✂️', nome: 'Atende clientes', descricao: 'Aparece na agenda para marcar horário' },
            { id: 'nao', icone: '🗂️', nome: 'Não atende', descricao: 'Ex.: recepção, administração' },
          ]} />
          {w.proximo(2, 'Quanto ganha')}
        </Passo>
        <Passo n={3} de={4} titulo="Quanto ganha" opcional feito={d.salario !== undefined || !!d.comissao} aberto={w.aberto(3)} onAlternar={() => w.alternar(3)}
          resumo={[d.salario !== undefined && `${formatar(d.salario, moeda)} ${t(PERIODOS_SALARIO[d.periodo])}`, d.comissao && `${d.comissao}% ${t('de comissão')}`].filter(Boolean).join(' · ') || t('nada — pode pular')}
          ajuda="Serve de estimativa do custo da equipe; o que for pago de verdade fica no caixa. A comissão é a % sobre o que ela atender."
          exemplo="Ex.: Bs 3.000 por mês + 10% de comissão">
          <Campo rotulo="Salário / custo" comoDiv>
            <div className="grid grid-cols-[6rem_1fr] gap-2"><Selecao valor={moeda} onChange={(m) => setD({ ...d, moeda: m })} opcoes={(cfg?.moedasAtivas ?? [moeda]).map((m) => ({ id: m, nome: m }))} /><ValorInput moeda={moeda} valor={d.salario} onChange={(v) => setD({ ...d, salario: v })} /></div>
          </Campo>
          <div className="grid gap-2 xs:grid-cols-2">
            <Campo rotulo="Período"><Selecao valor={d.periodo} onChange={(v) => setD({ ...d, periodo: v as 'mes' })} opcoes={Object.entries(PERIODOS_SALARIO).map(([id, nome]) => ({ id, nome: t(nome) }))} /></Campo>
            <Campo rotulo="Comissão (%)"><Entrada inputMode="decimal" value={d.comissao} onChange={(e) => setD({ ...d, comissao: e.target.value })} placeholder="10" /></Campo>
          </div>
          {w.proximo(3, 'O que pode ver')}
        </Passo>
        <Passo n={4} de={4} titulo="O que pode ver" feito aberto={w.aberto(4)} onAlternar={() => w.alternar(4)}
          resumo={t(d.acesso === 'admin' ? 'Administrador (tudo)' : 'Funcionário (a unidade e a própria agenda)')}
          ajuda="O que ela vê quando entrar no sistema com o usuário dela." exemplo="Ex.: cabeleireira → Funcionário · gerente → Administrador">
          <EscolhaCartoes<'funcionario' | 'admin'> rotulo="O que pode ver" valor={d.acesso} onChange={(acesso) => setD({ ...d, acesso })} opcoes={[
            { id: 'funcionario', icone: '🪪', nome: 'Funcionário', descricao: 'Só a unidade dela e a própria agenda' },
            { id: 'admin', icone: '🔑', nome: 'Administrador', descricao: 'Vê e muda tudo (compras, caixa, relatórios)' },
          ]} />
        </Passo>
      </Passos>
    </Janela>
  )
}
