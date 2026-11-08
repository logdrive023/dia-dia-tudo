// TURNO (conferência cega) — as peças de tela:
//   <BotaoFecharTurno>  na tela Vender: "▶ Abrir meu turno" (controle de turno ligado e fechado) ou "🔒 Fechar meu turno"
//   <JanelaAbrirTurno>  abre o turno com o troco inicial (a hora fica registrada sozinha)
//   <JanelaFecharTurno> conta o dinheiro em cada moeda, SEM ver quanto deveria ter; confirma e registra
//   <TurnosFechados>    no Caixa (administrador): cada turno com o esperado, o contado e a diferença no nome da pessoa
// A regra (o esperado e a diferença) é do serviço: src/core/services/turnos.ts.
import { type ReactNode, useState } from 'react'
import { formatar, MOEDAS } from '../../../core/domain/dinheiro'
import { novoId } from '../../../core/domain/ids'
import { Botao, BotaoExpandir, Campo, Cartao, Confirmar, Entrada, Pilula, ValorInput, cx, dataHora, hora, moedaPadrao } from '../../../shared/ui/base'
import { useComando, useConsulta } from '../../../shared/ui/contexto'
import { useT } from '../../../shared/ui/i18n'
import { JanelaCadastro } from '../../../shared/ui/janelaCadastro'
import type { Turno } from '../../../core/services/turnos'
import { duracaoTexto, resumoTurno } from '../model/turno'

/**
 * O BOTÃO DO TURNO (tela Vender). Controle de turno ligado e turno fechado → "▶ Abrir meu turno" (principal: sem
 * abrir, ela não vende); senão → "🔒 Fechar meu turno" (com o número de lançamentos em dinheiro).
 */
export function BotaoFecharTurno({ className }: { className?: string }) {
  const t = useT()
  const [aberta, setAberta] = useState<'abrir' | 'fechar'>()
  const { dados } = useConsulta('turnoAtual', {})
  return (
    <>
      {dados?.precisaAbrir ? (
        <Botao className={className} onClick={() => setAberta('abrir')}>▶ {t('Abrir meu turno')}</Botao>
      ) : (
        <Botao variante="secundario" className={className} onClick={() => setAberta('fechar')}>
          🔒 {t('Fechar meu turno')}
          {dados?.pendente && dados.lancamentos > 0 && <span className="ml-1 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-[var(--alerta)] px-1 text-[11px] font-bold text-white">{dados.lancamentos}</span>}
        </Botao>
      )}
      {aberta === 'abrir' && <JanelaAbrirTurno onFechar={() => setAberta(undefined)} />}
      {aberta === 'fechar' && <JanelaFecharTurno onFechar={() => setAberta(undefined)} />}
    </>
  )
}

/**
 * ABRIR O TURNO (controle de turno ligado): a hora fica registrada sozinha; ela informa o TROCO que recebeu para
 * começar (por moeda; pode ser 0). O troco entra no "deveria ter" do fechamento — que ela continua sem ver.
 */
export function JanelaAbrirTurno({ onFechar }: { onFechar(): void }) {
  const t = useT()
  const { dados: cfg } = useConsulta('configuracoes', {})
  const { executar, ocupado } = useComando()
  const [id] = useState(novoId)
  const principal = cfg?.config.moedaPrincipal ?? moedaPadrao()
  const moedas = [principal, ...(cfg?.config.moedasAtivas ?? []).filter((m) => m !== principal)]
  const [troco, setTroco] = useState<Record<string, number | undefined>>({})
  const abrir = async () => {
    const trocoInicial = Object.fromEntries(Object.entries(troco).filter(([, v]) => v))
    if (await executar('abrirTurno', { id, trocoInicial }, t('Turno aberto. Boas vendas!'))) onFechar()
  }
  return (
    <JanelaCadastro titulo="Abrir meu turno" onFechar={onFechar} onSalvar={abrir} ocupado={ocupado} rotuloSalvar="Abrir o turno">
      <div className="flex items-center gap-3 rounded-2xl bg-[var(--marca-suave)] px-3 py-2 text-sm">
        <span aria-hidden className="flex h-8 w-8 shrink-0 items-center justify-center text-xl">🕒</span>
        <span className="min-w-0"><b className="block">{t('Começa agora')}</b><span className="block text-xs text-[var(--suave)]">{t('A hora fica registrada sozinha. No fim, você conta o dinheiro e fecha o turno.')}</span></span>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {moedas.map((m) => (
          <Campo key={m} rotulo={`${t('Troco que recebi em')} ${MOEDAS.find((x) => x.codigo === m)?.nome ?? m} (${m})`} comoDiv
            ajuda={m === principal ? 'O dinheiro que você recebeu para dar troco. Ex.: Bs 100 em notas pequenas. Sem troco: deixe 0.' : undefined}>
            <ValorInput moeda={m} valor={troco[m]} onChange={(v) => setTroco({ ...troco, [m]: v })} placeholder="0" />
          </Campo>
        ))}
      </div>
    </JanelaCadastro>
  )
}

export function JanelaFecharTurno({ onFechar, aoFechar }: { onFechar(): void; aoFechar?(): void }) {
  const t = useT()
  const { dados: atual } = useConsulta('turnoAtual', {})
  const { dados: cfg } = useConsulta('configuracoes', {})
  const { executar, ocupado } = useComando()
  const [id] = useState(novoId)
  const principal = cfg?.config.moedaPrincipal ?? moedaPadrao()
  // as moedas que ela recebeu no turno + a principal (sempre)
  const moedas = [...new Set([principal, ...(atual?.moedas ?? [])])]
  const [contado, setContado] = useState<Record<string, number | undefined>>({})
  const [obs, setObs] = useState('')
  const [confirmar, setConfirmar] = useState(false)
  const [feito, setFeito] = useState(false)
  const [verComo, setVerComo] = useState(false)
  const preenchido = moedas.every((m) => contado[m] !== undefined)
  const registrar = async () => {
    const r = await executar('fecharTurno', { id, contado: Object.fromEntries(moedas.map((m) => [m, contado[m] ?? 0])), obs: obs || undefined })
    setConfirmar(false)
    if (r) (setFeito(true), aoFechar?.())
  }
  if (feito)
    return (
      <JanelaCadastro titulo="Turno fechado" onFechar={onFechar} onSalvar={onFechar} rotuloSalvar="Pronto">
        <div className="space-y-2 text-center">
          <div aria-hidden className="text-5xl">✅</div>
          <p className="font-bold">{t('Contagem registrada.')}</p>
          <p className="text-sm text-[var(--suave)]">{t('O administrador confere o resultado. O próximo turno começa agora.')}</p>
        </div>
      </JanelaCadastro>
    )
  return (
    <>
      <JanelaCadastro titulo="Fechar meu turno" onFechar={onFechar} onSalvar={() => setConfirmar(true)} ocupado={ocupado} podeSalvar={preenchido} rotuloSalvar="Registrar a contagem">
        {/* o turno de agora: desde quando e quanto movimento em efectivo (sem valores: a conferência é cega) */}
        {atual && (
          <div className={cx('flex items-center gap-3 rounded-2xl px-3 py-2 text-sm', atual.lancamentos ? 'bg-[var(--marca-suave)]' : 'bg-[var(--fundo)]')}>
            <span aria-hidden className="text-2xl">🕒</span>
            <span className="min-w-0">
              <b className="block">{t('Seu turno: desde {h}', { h: dataHora(atual.inicio) })}</b>
              <span className="block text-xs text-[var(--suave)]">{atual.lancamentos ? t('{n} lançamento(s) em efectivo neste turno', { n: atual.lancamentos }) : t('Nenhum lançamento em efectivo neste turno: se não recebeu dinheiro, conte 0 ou só saia.')}</span>
            </span>
          </div>
        )}
        {/* CELULAR PRIMEIRO: a CONTAGEM (o que ela veio fazer) logo em cima; o exemplo e a explicação depois */}
        <div className="grid gap-3 sm:grid-cols-2">
          {moedas.map((m) => (
            <Campo key={m} rotulo={`${t('Contei em')} ${MOEDAS.find((x) => x.codigo === m)?.nome ?? m} (${m})`} comoDiv>
              <ValorInput moeda={m} valor={contado[m]} onChange={(v) => setContado({ ...contado, [m]: v })} placeholder="0" />
            </Campo>
          ))}
        </div>
        <Campo rotulo="Observação (opcional)"><Entrada value={obs} placeholder={t('Ex.: dei troco de uma nota de 200')} onChange={(e) => setObs(e.target.value)} /></Campo>
        <ExemploTurno moeda={principal} />
        {/* o que é, o que conta e a diferença entre fechar e não fechar — recolhido (abre no toque) */}
        <div>
          <BotaoExpandir aberto={verComo} onClick={() => setVerComo(!verComo)} className="-ml-2">{t('Como funciona')}</BotaoExpandir>
          {verComo && (
            <ul className="mt-1 space-y-2 text-xs sm:text-sm">
              <ExplicaTurno icone="🧮" titulo="O que é">{t('Você conta o dinheiro em efectivo que está com você e escreve quanto deu. O sistema já sabe quanto deveria ter, mas não mostra: assim a contagem é honesta (conferência cega).')}</ExplicaTurno>
              <ExplicaTurno icone="💵" titulo="O que entra na conta">{t('Só o efectivo que VOCÊ recebeu ou entregou neste turno (vendas, troco, devoluções). QR, Pix, cartão e transferência não entram: não estão na sua mão.')}</ExplicaTurno>
              <ExplicaTurno icone="✅" titulo="Fechando o turno" tom="bom">{t('A diferença (se faltar ou sobrar) fica registrada só no seu nome, com data e hora. Cada colega responde só pelo turno dela, e o seu próximo turno começa do zero.')}</ExplicaTurno>
              <ExplicaTurno icone="⚠️" titulo="Sem fechar" tom="alerta">{t('O efectivo continua somando no mesmo turno, junto com o dia seguinte. Se faltar dinheiro, não dá para saber quando nem com quem faltou.')}</ExplicaTurno>
            </ul>
          )}
        </div>
      </JanelaCadastro>
      {confirmar && (
        <Confirmar titulo="Registrar a contagem?" rotulo="Sim, registrar" onFechar={() => setConfirmar(false)} onConfirmar={registrar}
          texto={`${moedas.map((m) => formatar(contado[m] ?? 0, m)).join(' · ')} — ${t('depois de registrar não dá para mudar.')}`} />
      )}
    </>
  )
}

/**
 * EXEMPLO DE CONTAGEM (números de exemplo, NUNCA os dela: a conferência é cega). Mostra a conta do dia em 3 linhas e
 * o resultado; o selo deixa claro que o que ela digita é só a contagem para conferir — não muda vendas nem o caixa.
 */
function ExemploTurno({ moeda }: { moeda: string }) {
  const t = useT()
  const v = (n: number) => formatar(n * 100, moeda)
  return (
    <section aria-label={t('Exemplo de contagem')} className="overflow-hidden rounded-2xl border border-[var(--borda)]">
      <div className="flex flex-wrap items-center justify-between gap-2 bg-[var(--fundo)] px-3 py-2">
        <b className="text-[11px] uppercase tracking-wide text-[var(--suave)]">{t('Exemplo (números de mentira)')}</b>
        <Pilula tom="alerta" pequena>🔒 {t('seus valores não aparecem')}</Pilula>
      </div>
      <dl className="num space-y-1 px-3 py-2 text-xs sm:text-sm">
        <div className="flex justify-between gap-3"><dt className="text-[var(--suave)]">{t('Hoje vendeu em efectivo')}</dt><dd className="font-semibold">{v(1250)}</dd></div>
        <div className="flex justify-between gap-3"><dt className="text-[var(--suave)]">{t('Deu de troco')}</dt><dd className="font-semibold">− {v(50)}</dd></div>
        <div className="flex justify-between gap-3 border-t border-[var(--borda)] pt-1"><dt className="font-semibold">{t('Na mão, conta e escreve')}</dt><dd className="text-sm font-black sm:text-base">{v(1200)}</dd></div>
      </dl>
      <p className="flex items-start gap-2 border-t border-[var(--alerta)]/30 bg-[var(--alerta)]/10 px-3 py-2 text-xs font-semibold text-[var(--texto)] sm:text-sm">
        <span aria-hidden>ℹ️</span>
        <span>{t('O que você digita é só a contagem para conferir: não muda as vendas nem o caixa.')}</span>
      </p>
    </section>
  )
}

/** uma linha da explicação do turno: ícone + título curto + o texto */
function ExplicaTurno({ icone, titulo, tom, children }: { icone: string; titulo: string; tom?: 'bom' | 'alerta'; children: ReactNode }) {
  const t = useT()
  return (
    <li className={cx('flex gap-3 rounded-2xl border p-3', tom === 'bom' ? 'border-[var(--bom)]/30 bg-[var(--bom)]/5' : tom === 'alerta' ? 'border-[var(--alerta)]/30 bg-[var(--alerta)]/5' : 'border-[var(--borda)]')}>
      {/* coluna FIXA do ícone (o emoji do celular é maior que a letra: sem a coluna ele encostava no título) */}
      <span aria-hidden className="flex h-7 w-7 shrink-0 items-center justify-center text-lg leading-none">{icone}</span>
      <span className="min-w-0 pt-0.5"><b className="block">{t(titulo)}</b><span className="text-[var(--suave)]">{children}</span></span>
    </li>
  )
}

/** Caixa (administrador): os turnos fechados com a diferença de cada pessoa. O que não confere aparece primeiro. */
export function TurnosFechados() {
  const t = useT()
  const { dados } = useConsulta('turnos', {})
  const [anotando, setAnotando] = useState<{ id: string; nome: string }>()
  if (!dados?.length) return null
  type T = Pick<Turno, 'id' | 'nome' | 'inicio' | 'fim' | 'contado' | 'lancamentos'> & Partial<Pick<Turno, 'esperado' | 'diferenca' | 'situacao' | 'obs' | 'trocoInicial' | 'vendas' | 'notas'>>
  const lista = (dados as T[]).slice(0, 30)
  const problemas = lista.filter((x) => x.situacao && x.situacao !== 'confere').length
  const txt = (r?: Record<string, number | undefined>) => Object.entries(r ?? {}).map(([m, v]) => formatar(v ?? 0, m)).join(' · ') || '—'
  return (
    <Cartao className="mt-4" titulo={<span className="flex flex-wrap items-center gap-2">{t('Turnos (conferência cega)')}{problemas > 0 && <Pilula tom="ruim" className="shrink-0">{t('{n} com diferença', { n: problemas })}</Pilula>}</span>}
      ajuda="Cada pessoa contou o dinheiro dela sem ver quanto deveria ter. Esperado = o troco inicial + o efectivo que ela lançou no turno. Diferença negativa = faltou; positiva = sobrou. Vendas = todas as formas, para a média por hora. Ex.: Ana, 08:00–12:30 (4 h 30), 6 vendas, Bs 900 → Bs 200 por hora.">
      <ul className="divide-y divide-[var(--borda)]">
        {lista.map((x) => {
          const ok = x.situacao === 'confere'
          const { minutos, porHora } = resumoTurno(x)
          return (
            <li key={x.id} className="space-y-1.5 py-2.5">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                <span aria-hidden className={cx('flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-bold text-white', ok ? 'bg-[var(--bom)]' : 'bg-[var(--ruim)]')}>{ok ? '✓' : '!'}</span>
                <span className="min-w-0 flex-1">
                  <b className="block">{x.nome}</b>
                  {/* trabalhou de X a Y (quanto tempo) */}
                  <span className="num block text-xs text-[var(--suave)]">{dataHora(x.inicio)} – {hora(x.fim)} · {duracaoTexto(minutos)} · {t('{n} lançamento(s)', { n: x.lancamentos })}</span>
                </span>
                <span className="num text-right text-sm">
                  <span className="block text-xs text-[var(--suave)]">{t('esperado')} {txt(x.esperado)} · {t('contou')} {txt(x.contado)}</span>
                  <b className={cx('block', ok ? 'text-[var(--bom)]' : 'text-[var(--ruim)]')}>{ok ? t('confere') : `${t(x.situacao === 'sobra' ? 'sobrou' : 'diferença')} ${txt(x.diferenca)}`}</b>
                </span>
              </div>
              {/* o desempenho do turno: vendas, média por hora e o troco com que começou */}
              <div className="flex flex-wrap gap-1.5 pl-11">
                {x.vendas && <Pilula>{t('{n} venda(s)', { n: x.vendas.n })} · {formatar(x.vendas.total, x.vendas.moeda)}</Pilula>}
                {x.vendas && porHora !== undefined && <Pilula tom="marca">{formatar(porHora, x.vendas.moeda)}/{t('hora')}</Pilula>}
                {x.trocoInicial && <Pilula>{t('troco inicial')} {txt(x.trocoInicial)}</Pilula>}
              </div>
              {(x.obs || x.notas?.length) && (
                <ul className="space-y-0.5 pl-11 text-xs text-[var(--suave)]">
                  {x.obs && <li>💬 {x.obs}</li>}
                  {x.notas?.map((n, k) => <li key={k}>📝 <b className="text-[var(--texto)]">{n.por}</b> · {dataHora(n.em)}: {n.nota}</li>)}
                </ul>
              )}
              <div className="pl-9"><Botao variante="leve" onClick={() => setAnotando({ id: x.id, nome: x.nome })}>📝 {t('Anotar')}</Botao></div>
            </li>
          )
        })}
      </ul>
      {anotando && <AnotarTurno id={anotando.id} nome={anotando.nome} onFechar={() => setAnotando(undefined)} />}
    </Cartao>
  )
}

/** ANOTAR (administrador): conferiu, explicou a diferença… Fica no turno e na auditoria (nada é apagado). */
function AnotarTurno({ id, nome, onFechar }: { id: string; nome: string; onFechar(): void }) {
  const t = useT()
  const { executar, ocupado } = useComando()
  const [nota, setNota] = useState('')
  const salvar = async () => {
    if (await executar('anotarTurno', { id, nota }, t('Anotado.'))) onFechar()
  }
  return (
    <JanelaCadastro titulo={t('Anotar o turno de {n}', { n: nome })} onFechar={onFechar} onSalvar={salvar} ocupado={ocupado} podeSalvar={!!nota.trim()} rotuloSalvar="Anotar">
      <Campo rotulo="Anotação" ajuda="Fica no turno e no registro de ações, com o seu nome e a hora. Ex.: Conferi: faltou troco de uma nota de 20.">
        <Entrada autoFocus value={nota} onChange={(e) => setNota(e.target.value)} placeholder={t('Ex.: Conferi: faltou troco de uma nota de 20.')} />
      </Campo>
    </JanelaCadastro>
  )
}
