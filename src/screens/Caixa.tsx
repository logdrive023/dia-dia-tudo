// CAIXA do dia, por moeda: veio de ontem (na mão · no banco) + hoje = total. Lançar, repetir o último,
// desfazer (sem apagar), conferir o dinheiro contado e encerrar o dia com relatório no WhatsApp.

import { useState } from 'react'
import { MOEDAS, formatar } from '../core/domain/dinheiro'
import { dataLocal } from '../core/domain/datas'
import { novoId } from '../core/domain/ids'
import type { MovCaixa } from '../core/domain/tipos'
import { Abas, Botao, Campo, Carregando, Cartao, Confirmar, Entrada, Janela, Pilula, Selecao, Titulo, ValorInput, cx, dataBR } from '../ui/base'
import { useApp, useComando, useConsulta } from '../ui/contexto'
import { linkWhatsApp, useCotacoes } from '../ui/compartilhados'
import { useT } from '../ui/i18n'

export function Caixa() {
  const t = useT()
  const { nav } = useApp()
  const [data, setData] = useState((nav.params.data as string) ?? dataLocal())
  const { dados } = useConsulta('caixaDoDia', { data })
  const { cfg } = useCotacoes()
  const { executar, ocupado } = useComando()
  const [lancar, setLancar] = useState(false)
  const [encerrar, setEncerrar] = useState(false)
  const [desfazer, setDesfazer] = useState<MovCaixa>()
  const [reabrir, setReabrir] = useState(false)
  const nomeForma = new Map((cfg?.formas ?? []).map((f) => [f.id, f.nome]))
  if (!dados) return <Carregando />
  return (
    <div>
      <Titulo
        subtitulo={<>{t('Situação')}: <Pilula tom={dados.status === 'encerrado' ? 'neutro' : 'bom'}>{t(dados.status)}</Pilula></>}
        acao={
          <div className="flex flex-wrap gap-2">
            <Entrada type="date" className="w-auto" value={data} onChange={(e) => setData(e.target.value)} />
            {dados.status !== 'encerrado' ? (
              <>
                <Botao onClick={() => setLancar(true)}>+ {t('Lançar dinheiro')}</Botao>
                <Botao variante="secundario" onClick={() => setEncerrar(true)}>{t('Encerrar o dia')}</Botao>
              </>
            ) : (
              <Botao variante="secundario" disabled={ocupado} onClick={() => setReabrir(true)}>{t('Reabrir o dia')}</Botao>
            )}
          </div>
        }
      >
        {t('Caixa')} · {dataBR(data)}
      </Titulo>

      {!dados.contas.length && <p className="mb-3 text-sm text-[var(--suave)]">{t('Nenhum movimento neste dia.')}</p>}
      <div className="grid gap-4 lg:grid-cols-2">
        {dados.contas.map((c) => (
          <Cartao key={c.moeda} titulo={`${MOEDAS.find((m) => m.codigo === c.moeda)?.nome} (${c.moeda})`} ajuda="Ontem + hoje = total. Na mão = só dinheiro vivo (efectivo); o resto está no banco (QR, Pix, cartão).">
            <div className="rounded-xl bg-[var(--marca)] p-3 text-white">
              <div className="text-xs opacity-80">{t('Total')}</div>
              <div className="num text-2xl font-black">{formatar(c.total, c.moeda)}</div>
              <div className="mt-1 flex justify-between text-sm"><span>💵 {t('Na mão')}: <b className="num">{formatar(c.mao, c.moeda)}</b></span><span>🏦 {t('No banco')}: <b className="num">{formatar(c.banco, c.moeda)}</b></span></div>
            </div>
            <table className="mt-3 w-full text-sm">
              <tbody>
                <tr><td className="py-1">📅 {t('Veio de ontem')}</td><td className="num text-right">{formatar(c.ontemMao + c.ontemBanco, c.moeda)}</td></tr>
                {c.linhas.map((l, i) => (
                  <tr key={i} className="border-t border-[var(--borda)]">
                    <td className="py-1">{l.vivo ? '💵' : '🏦'} {l.rotulo}</td>
                    <td className={cx('num text-right', l.valor < 0 && 'text-[var(--ruim)]')}>{l.valor > 0 ? '+' : ''}{formatar(l.valor, c.moeda)}</td>
                  </tr>
                ))}
                <tr className="border-t-2 border-[var(--texto)] font-bold"><td className="py-1">= {t('Hoje')}</td><td className="num text-right">{formatar(c.hoje, c.moeda)}</td></tr>
              </tbody>
            </table>
            {c.contado !== undefined && (
              <p className={cx('mt-2 rounded-xl p-2 text-sm font-semibold', c.contado === c.mao ? 'bg-[var(--bom)]/10 text-[var(--bom)]' : 'bg-[var(--alerta)]/10 text-[var(--alerta)]')}>
                {t('Contado')}: {formatar(c.contado, c.moeda)} · {c.contado === c.mao ? t('bateu ✓') : c.contado < c.mao ? t('faltam {v}', { v: formatar(c.mao - c.contado, c.moeda) }) : t('sobram {v}', { v: formatar(c.contado - c.mao, c.moeda) })}
              </p>
            )}
          </Cartao>
        ))}
      </div>

      <Cartao titulo={t('Movimentado no dia')} className="mt-4">
        <ul className="divide-y divide-[var(--borda)] text-sm">
          {dados.movimentos.map((m) => (
            <li key={m.id} className="flex items-center justify-between gap-2 py-2">
              <div className="min-w-0">
                <div className={cx('font-semibold', m.estornadoPor && 'line-through opacity-60')}>{m.descricao}</div>
                <div className="text-xs text-[var(--suave)]">{t(nomeForma.get(m.forma) ?? m.forma)} · {new Date(m.criadoEm).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}{m.categoria ? ` · ${m.categoria}` : ''}</div>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <span className={cx('num font-bold', m.delta < 0 ? 'text-[var(--ruim)]' : 'text-[var(--bom)]')}>{m.delta > 0 ? '+' : ''}{formatar(m.delta, m.moeda)}</span>
                {['entrada', 'despesa', 'retirada', 'dar', 'saldoInicial'].includes(m.tipo) && !m.estornadoPor && dados.status !== 'encerrado' && (
                  <Botao variante="leve" onClick={() => setDesfazer(m)}>{t('desfazer')}</Botao>
                )}
              </div>
            </li>
          ))}
        </ul>
      </Cartao>
      {lancar && <Lancar onFechar={() => setLancar(false)} />}
      {desfazer && <Confirmar titulo="Desfazer lançamento?" texto={`${desfazer.descricao}: ${formatar(desfazer.delta, desfazer.moeda)}. Entra um lançamento inverso; o original fica no histórico.`} rotulo="Desfazer" perigo onFechar={() => setDesfazer(undefined)} onConfirmar={(motivo) => executar('estornarLancamento', { lancamentoId: desfazer.id, motivo: motivo || undefined }, t('Desfeito (fica no histórico).'))} />}
      {reabrir && <Confirmar titulo="Reabrir o dia?" texto="O dia volta a aceitar lançamentos. O dinheiro contado no encerramento fica guardado." rotulo="Reabrir o dia" onFechar={() => setReabrir(false)} onConfirmar={() => executar('reabrirDia', { data }, t('Dia reaberto.'))} />}
      {encerrar && <Encerrar data={data} contas={dados.contas} movimentos={dados.movimentos} onFechar={() => setEncerrar(false)} />}
    </div>
  )
}

function Lancar({ onFechar }: { onFechar(): void }) {
  const t = useT()
  const { cfg } = useCotacoes()
  const { executar, ocupado } = useComando()
  const { backend } = useApp()
  const { dados: locais } = useConsulta('locais', {})
  const [id] = useState(() => novoId())
  const [tipo, setTipo] = useState<'despesa' | 'entrada' | 'retirada' | 'dar'>('despesa')
  const [moedaEscolhida, setMoeda] = useState<string>()
  const moeda = moedaEscolhida ?? cfg?.moedaPrincipal ?? 'BOB'
  const [forma, setForma] = useState('dinheiro')
  const [valor, setValor] = useState<number>()
  const [descricao, setDescricao] = useState('')
  const [categoria, setCategoria] = useState('')
  const [localId, setLocalId] = useState('')
  const [socioId, setSocioId] = useState('')
  const repetir = async () => {
    const u = (await backend.consulta('ultimoLancamento', { tipo })) as MovCaixa | undefined
    if (!u) return
    setMoeda(u.moeda)
    setForma(u.forma)
    setValor(Math.abs(u.delta))
    setDescricao(u.descricao)
    setCategoria(u.categoria ?? '')
    setLocalId(u.localId ?? '')
    setSocioId(u.socioId ?? '')
  }
  return (
    <Janela aberta titulo={t('Lançar dinheiro')} onFechar={onFechar} rodape={<Botao grande className="w-full" disabled={ocupado || !valor} onClick={async () => (await executar('lancarCaixa', { id, tipo, moeda, forma, valor: valor!, descricao, categoria: categoria || undefined, localId: localId || undefined, socioId: socioId || undefined }, t('Lançado.'))) && onFechar()}>{t('Lançar')}</Botao>}>
      <div className="space-y-3">
        <Abas atual={tipo} onChange={(v) => setTipo(v as typeof tipo)} abas={[{ id: 'despesa', nome: 'Despesa' }, { id: 'entrada', nome: 'Entrada' }, { id: 'retirada', nome: 'Retirada' }, { id: 'dar', nome: 'Dei dinheiro' }]} />
        <Botao variante="leve" onClick={repetir}>⟳ {t('Repetir o último')}</Botao>
        <div className="grid grid-cols-[7rem_1fr] gap-2">
          <Selecao valor={moeda} onChange={(m) => (setMoeda(m), setForma('dinheiro'))} opcoes={(cfg?.moedasAtivas ?? []).map((m) => ({ id: m, nome: m }))} />
          <ValorInput moeda={moeda} valor={valor} onChange={setValor} />
        </div>
        <Campo rotulo="Forma"><Selecao valor={forma} onChange={setForma} opcoes={(cfg?.formas ?? []).filter((f) => f.moedas.includes(moeda)).map((f) => ({ id: f.id, nome: t(f.nome) }))} /></Campo>
        <Campo rotulo="Descrição"><Entrada value={descricao} onChange={(e) => setDescricao(e.target.value)} placeholder={t('Ex.: Luz, transporte, Chico…')} /></Campo>
        {tipo === 'despesa' && (
          <div className="grid grid-cols-2 gap-2">
            <Campo rotulo="Categoria"><Entrada list="cats" value={categoria} onChange={(e) => setCategoria(e.target.value)} /><datalist id="cats">{['Aluguel', 'Luz e água', 'Transporte', 'Material', 'Comida', 'Outras despesas'].map((c) => <option key={c} value={c} />)}</datalist></Campo>
            <Campo rotulo="Unidade" ajuda="Despesa de um salão entra no custo dele (Equipe e unidades)."><Selecao valor={localId} onChange={setLocalId} vazio="Geral" opcoes={(locais ?? []).map((l) => ({ id: l.id, nome: l.nome }))} /></Campo>
          </div>
        )}
        {tipo === 'retirada' && !!cfg?.socios.length && (
          <Campo rotulo="Retirada de qual sócia?" ajuda="Abate da parte dela na divisão do lucro (Relatórios › Resultado)."><Selecao valor={socioId} onChange={setSocioId} vazio="Não é de sócia" opcoes={cfg.socios.map((s) => ({ id: s.id, nome: s.nome }))} /></Campo>
        )}
      </div>
    </Janela>
  )
}

function Encerrar({ data, contas, movimentos, onFechar }: { data: string; contas: { moeda: string; mao: number; total: number; banco: number; hoje: number }[]; movimentos: MovCaixa[]; onFechar(): void }) {
  const t = useT()
  const { executar, ocupado } = useComando()
  const { cfg } = useCotacoes()
  const [contado, setContado] = useState<Record<string, number | undefined>>({})
  const vendas = movimentos.filter((m) => m.tipo === 'venda')
  const texto = [
    `*${cfg?.nomeNegocio ?? ''} · ${dataBR(data)}*`,
    `${t('Vendas')}: ${vendas.length}`,
    ...contas.map((c) => `${c.moeda}: ${t('hoje')} ${formatar(c.hoje, c.moeda)} · ${t('total')} ${formatar(c.total, c.moeda)} (💵 ${formatar(c.mao, c.moeda)} · 🏦 ${formatar(c.banco, c.moeda)})${contado[c.moeda] !== undefined ? ` · ${t('contado')} ${formatar(contado[c.moeda]!, c.moeda)}` : ''}`),
  ].join('\n')
  return (
    <Janela aberta titulo={t('Encerrar o dia')} onFechar={onFechar} rodape={
      <div className="flex flex-wrap gap-2">
        <a className="min-h-12 flex-1 rounded-xl bg-[#25d366] px-4 py-3 text-center font-semibold text-white" href={linkWhatsApp(texto)} target="_blank" rel="noreferrer">{t('Relatório no WhatsApp')}</a>
        <Botao grande className="flex-1" disabled={ocupado} onClick={async () => (await executar('encerrarDia', { data, contado: Object.fromEntries(Object.entries(contado).filter(([, v]) => v !== undefined)) as Record<string, number> }, t('Dia encerrado.'))) && onFechar()}>{t('Encerrar')}</Botao>
      </div>
    }>
      <div className="space-y-3">
        {contas.map((c) => (
          <Campo key={c.moeda} rotulo={`${t('Dinheiro vivo contado')} (${c.moeda})`} ajuda="Conte o dinheiro da gaveta e digite: o app diz se faltou ou sobrou.">
            <ValorInput moeda={c.moeda} valor={contado[c.moeda]} onChange={(v) => setContado({ ...contado, [c.moeda]: v })} />
            {contado[c.moeda] !== undefined && (
              <p className={cx('mt-1 text-sm font-semibold', contado[c.moeda] === c.mao ? 'text-[var(--bom)]' : 'text-[var(--alerta)]')}>
                {contado[c.moeda] === c.mao ? t('bateu ✓') : contado[c.moeda]! < c.mao ? t('faltam {v}', { v: formatar(c.mao - contado[c.moeda]!, c.moeda) }) : t('sobram {v}', { v: formatar(contado[c.moeda]! - c.mao, c.moeda) })}
              </p>
            )}
          </Campo>
        ))}
        <pre className="whitespace-pre-wrap rounded-xl bg-[var(--fundo)] p-3 font-sans text-sm">{texto}</pre>
      </div>
    </Janela>
  )
}
