// CONFIGURAÇÕES › O que a funcionária faz: o admin decide, com um toque em cada interruptor, o que quem tem perfil
// Funcionário (também a gerente) pode VENDER, o que VÊ NA AGENDA, se vê PESSOAS E CONTAS e quais CONFIGURAÇÕES aparecem
// para ela. Vale na hora. As regras conferem de novo no servidor (venda e agenda), não só a tela.
// Uma seção = um arquivo (a lista das seções e onde cada uma aparece fica em ../configSecoes.ts).
import type { ReactNode } from 'react'
import { Carregando, Cartao, Escolha, cx } from '../../../shared/ui/base'
import { useComando, useConsulta } from '../../../shared/ui/contexto'
import { useT } from '../../../shared/ui/i18n'
import { Chave, Interruptor } from '../../../shared/ui/interruptor'
import { CONFIG_SO_ADMIN, SECOES_CONFIG } from '../model/configSecoes'
import type { TelaLiberavel } from '../../../shared/ui/liberado'

const TELAS: { id: TelaLiberavel; nome: string; icone: string; dica: string }[] = [
  { id: 'pessoas', nome: 'Pessoas e contas', icone: '👥', dica: 'Clientes, fornecedoras e quem deve a quem. Ligue para quem é gerente.' },
  { id: 'viagens', nome: 'Viagens (minha viagem)', icone: '🧳', dica: 'Para quem viaja para comprar: lança os gastos da viagem dela.' },
  { id: 'adiantamentos', nome: 'Adiantamentos', icone: '🤝', dica: 'Dinheiro entregue a parceiros para comprar cabelo.' },
  { id: 'conversor', nome: 'Conversor de moedas', icone: '💱', dica: 'O atalho do menu para converter Bs, US$, R$…' },
]

export { CONFIG_SO_ADMIN } from '../model/configSecoes'

const AGENDA: { id: 'atendimento' | 'compromisso' | 'viagem' | 'emprestimo'; nome: string; icone: string; dica: string }[] = [
  { id: 'atendimento', nome: 'Atendimentos', icone: '✂️', dica: 'Os horários do salão (os dela; com "agenda da equipe", os das colegas).' },
  { id: 'compromisso', nome: 'Compromissos', icone: '📌', dica: 'Reuniões, entregas e lembretes.' },
  { id: 'viagem', nome: 'Viagens', icone: '🧳', dica: 'Viagens de compra (no padrão, só do admin).' },
  { id: 'emprestimo', nome: 'Empréstimos', icone: '💵', dica: 'Parcelas para receber ou pagar (no padrão, só do admin).' },
]

function Linha({ icone, nome, dica, ligado, onChange, travado }: { icone: string; nome: string; dica?: string; ligado: boolean; onChange(v: boolean): void; travado?: boolean }) {
  const t = useT()
  return (
    <li className={cx('flex min-h-14 items-center gap-3 py-1', !ligado && 'opacity-70')}>
      <span aria-hidden className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[var(--fundo)] text-lg">{icone}</span>
      <span className="min-w-0 flex-1">
        <b className="block text-sm">{t(nome)}</b>
        {dica && <span className="block text-xs text-[var(--suave)]">{t(dica)}</span>}
      </span>
      <Chave ligado={ligado} onChange={onChange} rotulo={nome} travado={travado} />
    </li>
  )
}

function Bloco({ titulo, ajuda, resumo, children }: { titulo: string; ajuda: string; resumo: string; children: ReactNode }) {
  const t = useT()
  return (
    <Cartao titulo={<span className="flex flex-wrap items-center gap-2">{t(titulo)}<span className="rounded-full bg-[var(--marca-suave)] px-2 py-0.5 text-xs font-bold text-[var(--marca)]">{resumo}</span></span>} ajuda={ajuda}>
      <ul className="divide-y divide-[var(--borda)]">{children}</ul>
    </Cartao>
  )
}

export function Funcionaria() {
  const t = useT()
  const { dados } = useConsulta('configuracoes', {})
  const { executar, ocupado } = useComando()
  if (!dados) return <Carregando />
  const c = dados.config
  const ativos = dados.modulos.filter((m) => c.modulosAtivos.includes(m.id) && m.temVenda)
  const temCabelo = ativos.some((m) => m.id === 'cabelo')
  const caminhos = [
    ...(temCabelo ? [{ id: 'caixa', nome: 'Cabelo pela pistola ou QR', icone: '⚡', dica: 'Modo caixa: lê a etiqueta e vende.' }, { id: 'medida', nome: 'Cabelo sem etiqueta (por medida)', icone: '📏', dica: 'Escolhe medida e categoria na tabela de preço.' }] : []),
    ...ativos.filter((m) => m.id !== 'cabelo').map((m) => ({ id: m.id, nome: m.nome, icone: m.icone ?? '🛍️', dica: undefined as string | undefined })),
  ]
  const salvar = (d: Record<string, unknown>, antes: Record<string, unknown>) => executar('salvarConfig', { ...d, antes } as never, t('Salvo.'))
  const naoVende = c.funcionariaNaoVende
  const agenda = c.funcionariaAgenda
  const vendeN = caminhos.filter((x) => !naoVende.includes(x.id)).length
  const secoes = SECOES_CONFIG.filter((s) => !CONFIG_SO_ADMIN.has(s.id))
  const verConfig = c.funcionariaConfig
  const telas = c.funcionariaTelas
  return (
    <div className="space-y-4">
      <p className="text-sm text-[var(--suave)]">{t('Vale para todo usuário com perfil Funcionário (também a gerente). O admin sempre vê e faz tudo. Tema, idioma e a própria senha a funcionária sempre pode mudar.')}</p>
      <div className="grid gap-4 xl:grid-cols-2">
        <Bloco titulo="Pode vender" resumo={`${vendeN}/${caminhos.length}`} ajuda="Os caminhos do “+ Nova venda” que aparecem para ela. Desligado some do menu e a venda é recusada também no servidor.">
          {caminhos.map((x) => (
            <Linha key={x.id} icone={x.icone} nome={x.nome} dica={x.dica} ligado={!naoVende.includes(x.id)} travado={ocupado}
              onChange={(v) => salvar({ funcionariaNaoVende: v ? naoVende.filter((y) => y !== x.id) : [...naoVende, x.id] }, { funcionariaNaoVende: naoVende })} />
          ))}
        </Bloco>
        <Bloco titulo="Vê na agenda" resumo={`${agenda.length}/${AGENDA.length}`} ajuda="O que aparece na agenda dela (e na legenda). Viagem e empréstimo são do admin: no padrão ficam desligados.">
          {AGENDA.map((x) => (
            <Linha key={x.id} icone={x.icone} nome={x.nome} dica={x.dica} ligado={agenda.includes(x.id)} travado={ocupado}
              onChange={(v) => salvar({ funcionariaAgenda: v ? [...agenda, x.id] : agenda.filter((y) => y !== x.id) }, { funcionariaAgenda: agenda })} />
          ))}
        </Bloco>
        <Bloco titulo="Telas além do básico" resumo={`${telas.length}/${TELAS.length}`} ajuda="O básico é Vender, Agenda, Equipe e Configurações (tema, idioma, senha). Estas ficam só com o admin até serem ligadas aqui (ex.: Pessoas para quem é gerente).">
          {TELAS.map((x) => (
            <Linha key={x.id} icone={x.icone} nome={x.nome} dica={x.dica} ligado={telas.includes(x.id)} travado={ocupado}
              onChange={(v) => salvar({ funcionariaTelas: v ? [...telas, x.id] : telas.filter((y) => y !== x.id) }, { funcionariaTelas: telas })} />
          ))}
        </Bloco>
        {/* CONTROLE DE TURNO (opcional): ligado, ela abre o turno com o troco antes de vender; o turno vai da abertura ao fechamento */}
        <Cartao titulo={t('Turno')} ajuda="Ligado: a funcionária ABRE o turno (com o troco que recebeu) antes de vender ou lançar dinheiro, e fecha contando o dinheiro. No Caixa › Turnos você vê de que horas a que horas ela trabalhou, as vendas e a média por hora. Desligado: o turno começa sozinho e vender não depende dele. Ex.: abre às 08:00 com Bs 100 de troco, fecha às 14:00.">
          <Interruptor ligado={c.controleTurno} onChange={(v) => salvar({ controleTurno: v }, { controleTurno: c.controleTurno })}
            titulo="Controle de turno" texto={c.controleTurno ? 'Ligado: abrir o turno antes de vender.' : 'Desligado: vende sem abrir turno.'} />
        </Cartao>
        <Cartao titulo={t('Idioma de quem entra como funcionária')} ajuda="A maioria da equipe é boliviana: espanhol no padrão. Cada aparelho ainda pode trocar no cabeçalho de Configurações.">
          <Escolha<'pt' | 'es'> rotulo="Idioma de quem entra como funcionária" valor={c.funcionariaIdioma} onChange={(v) => salvar({ funcionariaIdioma: v }, { funcionariaIdioma: c.funcionariaIdioma })} opcoes={[{ id: 'es', nome: 'Español' }, { id: 'pt', nome: 'Português' }]} />
        </Cartao>
        <Bloco titulo="Configurações que ela vê" resumo={`${verConfig.length}/${secoes.length}`} ajuda="Além de tema, idioma e a própria senha. Usuários, Dados, Módulos e esta tela ficam sempre só do admin. O que ela não pode mudar continua protegido: só o admin salva.">
          {secoes.map((s) => (
            <Linha key={s.id} icone={s.icone} nome={s.nome} dica={s.descricao} ligado={verConfig.includes(s.id)} travado={ocupado}
              onChange={(v) => salvar({ funcionariaConfig: v ? [...verConfig, s.id] : verConfig.filter((y) => y !== s.id) }, { funcionariaConfig: verConfig })} />
          ))}
        </Bloco>
      </div>
    </div>
  )
}
