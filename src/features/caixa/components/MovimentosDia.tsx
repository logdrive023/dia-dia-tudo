// CAIXA › MOVIMENTOS DO DIA: cada dinheiro que entrou ou saiu, na moeda dele. Só aqui dá para ver venda, compra, despesa
// e retirada juntas; lançamento manual se desfaz sem apagar e o resto abre a origem.
import { useState } from 'react'
import { formatar } from '../../../core/domain/dinheiro'
import type { Id, MovCaixa, TipoCaixa } from '../../../core/domain/tipos'
import { Vazio, loc } from '../../../shared/ui/base'
import { useApp } from '../../../shared/ui/contexto'
import { AbasSituacao } from '../../../shared/ui/filtroPadrao'
import { useT } from '../../../shared/ui/i18n'
import type { Acao } from '../../../shared/ui/menuAcoes'
import { TabelaDados } from '../../../shared/ui/tabelaDados'

/** tipos que se desfazem aqui (lançamento manual); vendas e compras se cancelam na própria venda/compra */
const DESFAZ = ['entrada', 'despesa', 'retirada', 'dar', 'saldoInicial']

const ICONE: Record<TipoCaixa, string> = {
  venda: '🛍️', compra: '📦', entrada: '➕', despesa: '🧾', retirada: '🏦', dar: '🤝', emprestimo: '💸', recebimento: '📥', estorno: '↩️', saldoInicial: '🏁', correcao: '✏️',
}

export function MovimentosDia({ movimentos, origens, nomeForma, aberto, onDesfazer }: { movimentos: MovCaixa[]; origens: Record<string, { tela: string; id: Id }>; nomeForma: Map<string, string>; aberto: boolean; onDesfazer(m: MovCaixa): void }) {
  const t = useT()
  const { ir } = useApp()
  const [qual, setQual] = useState('')
  const entrou = movimentos.filter((m) => m.delta > 0)
  const saiu = movimentos.filter((m) => m.delta < 0)
  const linhas = qual === 'entrou' ? entrou : qual === 'saiu' ? saiu : movimentos
  const valor = (m: MovCaixa) => `${m.delta > 0 ? '+' : ''}${formatar(m.delta, m.moeda)}`
  const horaDe = (m: MovCaixa) => new Date(m.criadoEm).toLocaleTimeString(loc(), { hour: '2-digit', minute: '2-digit' })
  const forma = (m: MovCaixa) => [t(nomeForma.get(m.forma) ?? m.forma), m.categoria].filter(Boolean).join(' · ')
  const acoes = (m: MovCaixa): Acao[] => {
    const o = m.origemId ? origens[m.origemId] : undefined
    return [
      ...(o ? [{ rotulo: 'Abrir origem', icone: '↗', onClick: () => ir(o.tela, { id: o.id }) }] : []),
      ...(DESFAZ.includes(m.tipo) && !m.estornadoPor && aberto ? [{ rotulo: 'Desfazer', icone: '↩️', perigo: true, separar: !!o, onClick: () => onDesfazer(m) }] : []),
    ]
  }
  return (
    <section id="cx-movimentos" aria-label={t('Movimentos do dia')} className="min-w-0 scroll-mt-4 space-y-2">
      <h2 className="text-base font-bold">{t('Movimentos do dia')}</h2>
      {movimentos.length > 0 && <AbasSituacao rotulo="Movimentos do dia" valor={qual} onChange={setQual} opcoes={[{ id: '', nome: 'Todos', n: movimentos.length }, { id: 'entrou', nome: 'Entrou', n: entrou.length }, { id: 'saiu', nome: 'Saiu', n: saiu.length }]} />}
      <TabelaDados<MovCaixa>
        linhas={linhas}
        chave={(m) => m.id}
        acoes={acoes}
        realce={(m) => (m.estornadoPor ? 'apagada' : undefined)}
        rotuloLinha={(m) => `${m.descricao} · ${valor(m)}`}
        vazio={<Vazio texto="Nenhum dinheiro entrou ou saiu neste dia." />}
        colunas={[
          { id: 'o-que', titulo: 'O que foi', classe: 'w-full min-w-[12rem]', celula: (m) => <span className="break-words font-semibold"><span aria-hidden className="mr-1.5">{ICONE[m.tipo] ?? '•'}</span>{m.descricao}</span> },
          { id: 'forma', titulo: 'Forma', classe: 'whitespace-nowrap', celula: forma },
          { id: 'hora', titulo: 'Hora', classe: 'num whitespace-nowrap', celula: horaDe },
          { id: 'valor', titulo: 'Valor', direita: true, classe: 'whitespace-nowrap', celula: (m) => <b className={m.delta < 0 ? 'text-[var(--ruim)]' : 'text-[var(--bom)]'}>{valor(m)}</b> },
        ]}
        celular={{
          titulo: (m) => m.descricao,
          valor,
          valorSub: horaDe,
          resumo: (m) => `${ICONE[m.tipo] ?? '•'} ${forma(m)}`,
          tom: (m) => (m.delta < 0 ? 'ruim' : 'bom'),
          situacao: (m) => (m.estornadoPor ? { texto: 'Desfeito', tom: 'suave' } : undefined),
        }}
      />
    </section>
  )
}
