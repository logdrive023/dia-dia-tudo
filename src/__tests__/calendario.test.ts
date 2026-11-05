import { describe, expect, it } from 'vitest'
import { podeComando, podeConsulta } from '../core/services/permissoes'
import { bs, novoBackend } from './ajuda'

/** Sofia (funcionária, pessoa p-s) e Outra; uma cliente; um serviço; uma viagem com a Sofia e outra sem ela. */
async function montar() {
  const { b, sessao, r } = await novoBackend('2026-11-01')
  await b.comando('salvarPessoa', { id: 'p-s', nome: 'Sofia', papeis: ['profissional'] })
  await b.comando('salvarPessoa', { id: 'p-o', nome: 'Outra', papeis: ['profissional'] })
  await b.comando('salvarPessoa', { id: 'c', nome: 'Ana', papeis: ['cliente'] })
  await b.comando('salvarItem', { id: 's', moduloId: 'salao', tipoItem: 'servico', nome: 'Corte', duracaoMin: 45 })
  const ag = (id: string, prof: string, dia: string, h: string) =>
    b.comando('concluirVenda', { id, pessoaId: 'c', profissionalId: prof, agendadoPara: new Date(`${dia}T${h}`).toISOString(), linhas: [{ id: id + 'l', itemId: 's', quantidade: 1, moeda: 'BOB', total: bs(80) }], pagamentos: [] })
  await ag('a1', 'p-s', '2026-11-04', '15:00')
  await ag('a2', 'p-o', '2026-11-04', '15:00')
  await b.comando('salvarViagem', { id: 'v1', nome: 'Viagem a Cochabamba', viajantes: ['p-s'], inicio: '2026-11-10', fim: '2026-11-12' })
  await b.comando('salvarViagem', { id: 'v2', nome: 'Viagem a Santa Cruz', viajantes: ['p-o'], inicio: '2026-11-20', fim: '2026-11-21' })
  await b.comando('salvarUsuario', { id: 'u-s', login: 'sofia', nome: 'Sofia', perfil: 'funcionario', pessoaId: 'p-s', senha: 'senha123' })
  return { b, sessao, r }
}

describe('agenda em calendário', () => {
  it('junta atendimento + viagem + compromisso no período (viagem atravessa dias; semanal repete)', async () => {
    const { b } = await montar()
    await b.comando('salvarEvento', { id: 'e1', titulo: 'Buscar mechas no correio', data: '2026-11-04', hora: '09:00', duracaoMin: 30 })
    await b.comando('salvarEvento', { id: 'e2', titulo: 'Reunião da equipe', data: '2026-11-02', semanal: true, pessoaId: 'p-s' })
    const cal = await b.consulta('calendario', { de: '2026-11-01', ate: '2026-11-15' })
    expect(cal.filter((i) => i.tipo === 'atendimento').map((i) => i.id).sort()).toEqual(['a1', 'a2'])
    const a1 = cal.find((i) => i.id === 'a1')!
    expect(a1).toMatchObject({ data: '2026-11-04', hora: '15:00', horaFim: '15:45', cliente: 'Ana', pessoa: 'Sofia', status: 'agendado', diaTodo: false, ref: { tela: 'venda', id: 'a1' } })
    const v1 = cal.find((i) => i.id === 'v1')!
    expect(v1).toMatchObject({ tipo: 'viagem', data: '2026-11-10', ateData: '2026-11-12', diaTodo: true })
    expect(cal.some((i) => i.id === 'v2')).toBe(false) // fora do período
    expect(cal.find((i) => i.id === 'e1')).toMatchObject({ tipo: 'compromisso', hora: '09:00', horaFim: '09:30', status: 'agendado' })
    // semanal: 02, 09 (e não 16, fora do período)
    expect(cal.filter((i) => i.ref.id === 'e2').map((i) => i.data)).toEqual(['2026-11-02', '2026-11-09'])
    // no mesmo dia: dia todo primeiro, depois pela hora
    expect(cal.filter((i) => i.data === '2026-11-04').map((i) => i.hora)).toEqual(['09:00', '15:00', '15:00'])
    // filtro por tipo e por pessoa (admin)
    expect((await b.consulta('calendario', { de: '2026-11-01', ate: '2026-11-30', tipos: ['viagem'] })).map((i) => i.id).sort()).toEqual(['v1', 'v2'])
    expect((await b.consulta('calendario', { de: '2026-11-01', ate: '2026-11-30', pessoaId: 'p-o' })).map((i) => i.id).sort()).toEqual(['a2', 'v2'])
  })

  it('funcionária vê só o que é dela e cria compromisso sempre para ela', async () => {
    const { b, sessao } = await montar()
    await b.comando('salvarEvento', { id: 'adm', titulo: 'Fechar o mês', data: '2026-11-05' })
    await b.comando('salvarEvento', { id: 'pra-sofia', titulo: 'Levar amostras', data: '2026-11-06', pessoaId: 'p-s' })
    await b.comando('salvarEvento', { id: 'pra-outra', titulo: 'Folga', data: '2026-11-06', pessoaId: 'p-o' })
    Object.assign(sessao, await b.entrar('sofia', 'senha123'))
    await b.comando('salvarEvento', { id: 'meu', titulo: 'Dentista', data: '2026-11-07', hora: '08:00', pessoaId: 'p-o' })
    const cal = await b.consulta('calendario', { de: '2026-11-01', ate: '2026-11-30', pessoaId: 'p-o' })
    expect(cal.map((i) => i.id).sort()).toEqual(['a1', 'meu', 'pra-sofia', 'v1'])
    expect(cal.find((i) => i.id === 'meu')!.pessoaId).toBe('p-s') // não marca para outra pessoa
    // o que o admin marcou para ela: ela conclui, mas não edita nem exclui
    expect(cal.find((i) => i.id === 'pra-sofia')!.meu).toBe(false)
    await b.comando('concluirEvento', { id: 'pra-sofia' })
    await expect(b.comando('excluirEvento', { id: 'pra-sofia' })).rejects.toThrow(/Só quem marcou/)
    await expect(b.comando('concluirEvento', { id: 'pra-outra' })).rejects.toThrow(/não é seu/)
    await expect(b.consulta('evento', { id: 'adm' })).rejects.toThrow(/não é seu/)
    // o próprio: edita e exclui (some da agenda)
    await b.comando('salvarEvento', { id: 'meu', titulo: 'Dentista (remarcado)', data: '2026-11-08', hora: '08:30' })
    await b.comando('excluirEvento', { id: 'meu' })
    expect((await b.consulta('calendario', { de: '2026-11-01', ate: '2026-11-30' })).some((i) => i.id === 'meu')).toBe(false)
  })

  it('concluirEvento marca feito (e desfaz); no semanal vale só para o dia', async () => {
    const { b } = await montar()
    await b.comando('salvarEvento', { id: 'e', titulo: 'Pedir produtos', data: '2026-11-03', semanal: true, repetirAte: '2026-11-24' })
    await b.comando('concluirEvento', { id: 'e', data: '2026-11-10' })
    await expect(b.comando('concluirEvento', { id: 'e', data: '2026-11-11' })).rejects.toThrow(/não cai nesse dia/)
    let cal = await b.consulta('calendario', { de: '2026-11-01', ate: '2026-11-30', tipos: ['compromisso'] })
    expect(cal.map((i) => `${i.data}:${i.status}`)).toEqual(['2026-11-03:agendado', '2026-11-10:feito', '2026-11-17:agendado', '2026-11-24:agendado'])
    await b.comando('concluirEvento', { id: 'e', data: '2026-11-10', desfazer: true })
    cal = await b.consulta('calendario', { de: '2026-11-10', ate: '2026-11-10', tipos: ['compromisso'] })
    expect(cal[0].status).toBe('agendado')
    await expect(b.comando('salvarEvento', { id: 'x', titulo: ' ', data: '2026-11-03' })).rejects.toThrow(/Diga o que é/)
    await expect(b.comando('salvarEvento', { id: 'x', titulo: 'A', data: '2026-11-03', hora: '25:00' })).rejects.toThrow(/Hora inválida/)
  })

  it('atendimento: Feito, pagar depois → falta receber → Pago (só o que falta)', async () => {
    const { b, sessao } = await montar()
    Object.assign(sessao, await b.entrar('sofia', 'senha123'))
    await b.comando('atenderAgendamento', { id: 'a1', pagamentos: [] })
    let a1 = (await b.consulta('calendario', { de: '2026-11-04', ate: '2026-11-04' })).find((i) => i.id === 'a1')!
    expect(a1).toMatchObject({ status: 'feito', pago: false, falta: bs(80) })
    await expect(b.comando('receberAtendimento', { id: 'r0', vendaId: 'a1', forma: 'dinheiro', moeda: 'BOB', valor: bs(100) })).rejects.toThrow(/maior do que falta/)
    await b.comando('receberAtendimento', { id: 'r1', vendaId: 'a1', forma: 'dinheiro', moeda: 'BOB', valor: bs(80) })
    a1 = (await b.consulta('calendario', { de: '2026-11-04', ate: '2026-11-04' })).find((i) => i.id === 'a1')!
    expect(a1).toMatchObject({ status: 'feito', pago: true })
    await expect(b.comando('receberAtendimento', { id: 'r2', vendaId: 'a1', forma: 'dinheiro', moeda: 'BOB', valor: bs(1) })).rejects.toThrow(/já está pago/)
    // atendimento de outra profissional: não
    Object.assign(sessao, { usuarioId: 'sistema', perfil: 'admin', pessoaId: undefined })
    await b.comando('atenderAgendamento', { id: 'a2', pagamentos: [] })
    Object.assign(sessao, await b.entrar('sofia', 'senha123'))
    await expect(b.comando('receberAtendimento', { id: 'r3', vendaId: 'a2', forma: 'dinheiro', moeda: 'BOB', valor: bs(80) })).rejects.toThrow(/não é seu/)
    Object.assign(sessao, { usuarioId: 'sistema', perfil: 'admin', pessoaId: undefined })
    expect((await b.consulta('diagnostico', {})).problemas).toEqual([])
  })

  it('permissões: funcionária usa a agenda; criar viagem continua só do administrador', () => {
    for (const c of ['salvarEvento', 'excluirEvento', 'concluirEvento', 'receberAtendimento', 'concluirVenda', 'atenderAgendamento'] as const) expect(podeComando('funcionario', c)).toBe(true)
    expect(podeConsulta('funcionario', 'calendario')).toBe(true)
    expect(podeConsulta('funcionario', 'evento')).toBe(true)
    expect(podeComando('funcionario', 'salvarViagem')).toBe(false)
    expect(podeComando('funcionario', 'registrarAcerto')).toBe(false)
    expect(podeConsulta(undefined, 'calendario')).toBe(false)
  })
})

describe('agenda: equipe e empréstimos', () => {
  it('funcionária com "agenda da equipe" vê as colegas da unidade (e filtra por colega); sem ela, só a dela', async () => {
    const { b, sessao } = await montar()
    await b.comando('salvarEvento', { id: 'pra-outra', titulo: 'Folga', data: '2026-11-06', pessoaId: 'p-o' })
    // sem permissão: só a dela
    const antes = sessao.perfil
    Object.assign(sessao, await b.entrar('sofia', 'senha123'))
    expect((await b.consulta('calendario', { de: '2026-11-01', ate: '2026-11-30' })).map((i) => i.id).sort()).toEqual(['a1', 'v1'])
    expect((await b.consulta('agendaFiltros', {})).equipe).toBe(false)
    // o admin dá a permissão
    Object.assign(sessao, { perfil: antes, usuarioId: 'admin', pessoaId: undefined })
    await b.comando('salvarPessoa', { id: 'p-s', nome: 'Sofia', papeis: ['profissional'], verAgendaEquipe: true })
    Object.assign(sessao, await b.entrar('sofia', 'senha123'))
    const cal = await b.consulta('calendario', { de: '2026-11-01', ate: '2026-11-30' })
    expect(cal.map((i) => i.id).sort()).toEqual(['a1', 'a2', 'pra-outra', 'v1', 'v2'])
    expect((await b.consulta('agendaFiltros', {})).pessoas.map((p) => p.id).sort()).toEqual(['p-o', 'p-s'])
    // filtra uma colega: só o dela
    expect((await b.consulta('calendario', { de: '2026-11-01', ate: '2026-11-30', pessoaId: 'p-o' })).map((i) => i.id).sort()).toEqual(['a2', 'pra-outra', 'v2'])
  })

  it('parcelas de empréstimo entram na agenda no dia do vencimento (receber/pagar)', async () => {
    const { b } = await montar()
    await b.comando('salvarPessoa', { id: 'w', nome: 'Wagner', papeis: ['devedor'] })
    await b.comando('criarEmprestimo', { id: 'emp', direcao: 'dado', pessoaId: 'w', moeda: 'BOB', principal: bs(1000), juros: { tipo: 'nenhum' }, parcelas: 2, primeiroVencimento: '2026-11-15', forma: 'dinheiro' })
    const cal = (await b.consulta('calendario', { de: '2026-11-01', ate: '2026-12-31', tipos: ['emprestimo'] }))
    expect(cal.map((i) => [i.data, i.titulo, i.sentido])).toEqual([
      ['2026-11-15', 'Receber parcela 1/2 · Wagner', 'receber'],
      ['2026-12-15', 'Receber parcela 2/2 · Wagner', 'receber'],
    ])
    expect(cal[0]).toMatchObject({ tipo: 'emprestimo', valor: bs(500), status: 'agendado', ref: { tela: 'emprestimo', id: 'emp' } })
  })
})
