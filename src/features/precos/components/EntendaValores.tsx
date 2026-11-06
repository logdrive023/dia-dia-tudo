// ENTENDA OS VALORES (aba da tabela) — a explicação para quem nunca usou o módulo: o que é a tabela, as versões, por
// que a venda antiga não muda, como escolher o valor na venda, o padrão, onde consultar e os cuidados. Blocos curtos,
// cada um com um exemplo; as regras que não podem ser esquecidas ficam em destaque.
import { useT } from '../../../shared/ui/i18n'

interface Bloco { n: number; icone: string; titulo: string; texto: string; exemplo?: string; regra?: string }

const BLOCOS: Bloco[] = [
  { n: 1, icone: '▦', titulo: 'O que é uma tabela de preço', texto: 'É uma grade: cada linha é uma medida (cm) e cada coluna é um comprador ou canal. O número no cruzamento é o fator: quanto vale cada grama.', exemplo: '60 cm na coluna Helena = 16 → 500 g × 16 = Bs 8.000.' },
  { n: 2, icone: '🔖', titulo: 'O que é uma versão', texto: 'Cada vez que alguém muda a tabela e publica, nasce uma versão nova (v1, v2, v3…). A anterior não some: fica guardada exatamente como era.', exemplo: 'v1 = 60 cm a 17 · v2 (depois do aumento) = 60 cm a 17,5.' },
  { n: 3, icone: '🧭', titulo: 'Por que existem versões', texto: 'Para saber sempre qual preço valia em cada dia e conseguir comparar o que mudou, sem perder o passado.' },
  { n: 4, icone: '➡️', titulo: 'O que a versão nova muda', texto: 'Só as operações DEPOIS da publicação. As vendas e compras novas passam a usar a versão nova na hora.', exemplo: 'Publicou a v3 às 10h: a venda das 10h05 já usa a v3.' },
  { n: 5, icone: '🔒', titulo: 'Por que a venda antiga não muda', texto: 'A venda guarda a versão, o comprador e o fator que usou. Mudar a tabela depois não mexe nela: o caixa, a comissão e os relatórios continuam batendo.', regra: 'Venda feita com a v2 fica com a v2 para sempre, mesmo depois da v3.' },
  { n: 6, icone: '👆', titulo: 'Escolher o valor na venda', texto: 'No modo caixa, embaixo de "Nesta venda", fica a linha "Preço da tabela". Um toque mostra os compradores da tabela com o total de cada um; tocar num deles troca o valor de todos os pacotes na hora.', exemplo: 'Normal (padrão) Bs 688,90 · Helena Bs 702,00 · P.W. Bs 720,00.' },
  { n: 7, icone: '★', titulo: 'O valor padrão', texto: 'Sem escolher nada, a venda usa a coluna ligada à cliente (se ela tiver uma) ou a primeira coluna da tabela. Escolher é opcional: a venda segue normal sem mexer.' },
  { n: 8, icone: '🧮', titulo: 'Como a troca reflete nas contas', texto: 'Trocar o comprador recalcula na hora o valor de cada pacote, o total, o desconto em %, os impostos estimados e o que vai ser cobrado. O que aparece na tela é o que fica salvo na venda.', exemplo: '367 g × 0,7 = Bs 256,90 → trocou para 0,8 → Bs 293,60 (o total e os impostos acompanham).' },
  { n: 9, icone: '🔎', titulo: 'Onde a versão foi usada', texto: 'Na aba "Onde foi usada", escolha a versão: aparecem só as vendas e compras daquela versão, com data, código, cliente, valor e quem fez.' },
  { n: 10, icone: '🕘', titulo: 'Rastreabilidade', texto: 'O Histórico mostra todas as versões (quando, quem e a nota) e compara quaisquer duas: o que subiu, desceu, entrou ou saiu. A Auditoria guarda cada publicação.' },
  { n: 11, icone: '⚖️', titulo: 'Mudar a tabela × criar outra tabela', texto: 'Mudar a grade e publicar cria uma VERSÃO nova da mesma tabela (mesma categoria, mesmo nome). Criar outra tabela é para outro tipo de cabelo (outra categoria, ex.: Tinte) ou para uma tabela que vai valer a partir de uma data.' },
  { n: 12, icone: '⚠️', titulo: 'Cuidados ao mudar preços', texto: 'Confira antes de publicar (a barra mostra quantas células mudaram) e escreva na nota o porquê. Mudança errada se corrige publicando outra versão — a errada continua no histórico.', regra: 'Valor mudado à mão numa venda aparece marcado "fator mudado à mão" em Onde foi usada.' },
]

export function EntendaValores() {
  const t = useT()
  return (
    <div className="space-y-3">
      <p className="rounded-2xl bg-[var(--marca-suave)] px-4 py-3 text-sm">💡 {t('Em uma frase: a tabela diz o preço, a versão diz QUANDO valia, e cada venda guarda a versão que usou — o passado nunca muda.')}</p>
      <ol className="grid gap-2 md:grid-cols-2">
        {BLOCOS.map((b) => (
          <li key={b.n} className="flex gap-3 rounded-2xl border border-[var(--borda)] bg-[var(--cartao)] p-3 shadow-sm">
            <span aria-hidden className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--fundo)] text-lg">{b.icone}</span>
            <div className="min-w-0 space-y-1.5">
              <h3 className="font-bold leading-tight"><span className="num mr-1 text-[var(--suave)]">{b.n}.</span>{t(b.titulo)}</h3>
              <p className="text-sm text-[var(--suave)]">{t(b.texto)}</p>
              {b.exemplo && <p className="num rounded-lg bg-[var(--fundo)] px-2 py-1 text-xs">{t('Ex.:')} {t(b.exemplo)}</p>}
              {b.regra && <p className="rounded-lg bg-[var(--alerta)]/12 px-2 py-1 text-xs font-semibold text-[var(--alerta)]">⚠️ {t(b.regra)}</p>}
            </div>
          </li>
        ))}
      </ol>
    </div>
  )
}

export const TEXTOS_ENTENDA = BLOCOS
