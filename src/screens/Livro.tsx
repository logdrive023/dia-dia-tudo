// LIVRO DO CABELO (#/livro): como o livro caixa, mas em gramas. Todos os lançamentos (entrada da compra, diferença de
// peso, triagem, lavagem, perda, venda, ajuste) em ordem, com filtros (compra, pacote, pessoa, período, tipo), CSV, e
// cada linha abre o registro de origem. Embaixo, o fechamento de cada compra: comprado = em pacotes + vendido + perda
// + diferença ✓.

import { useState } from 'react'
import type { TipoLivro } from '../core/services/livro'
import { Botao, Campo, Carregando, Cartao, Entrada, ErroTela, Info, Selecao, Titulo, cx, dataBR, gramasTexto, loc } from '../ui/base'
import { clicavel } from '../ui/compartilhados'
import { useApp, useConsulta, useParamTela } from '../ui/contexto'
import { useT } from '../ui/i18n'
import { baixarCSV } from './Relatorios'

const DICA_CONFERE = 'Comprado = em pacotes + vendido + perda. Ex.: 10 kg = 4 + 5,4 + 0,6.'
const MAX = 200
const sinal = (n: number) => (n > 0 ? `+${gramasTexto(n)}` : `−${gramasTexto(-n)}`)
const hora = (em: string) => new Date(em).toLocaleTimeString(loc(), { hour: '2-digit', minute: '2-digit' })

export function Livro() {
  const t = useT()
  const { ir } = useApp()
  const { dados, erro } = useConsulta('livroCabelo', { moduloId: 'cabelo' })
  const [compra, setCompra] = useParamTela('compra', '')
  const [pacote, setPacote] = useParamTela('pacote', '')
  const [pessoa, setPessoa] = useParamTela('pessoa', '')
  const [tipo, setTipo] = useParamTela('tipo', '')
  const [de, setDe] = useParamTela('de', '')
  const [ate, setAte] = useParamTela('ate', '')
  const [tudo, setTudo] = useState(false)
  if (erro) return <ErroTela texto={erro} onVoltar={() => ir('estoque')} />
  if (!dados) return <Carregando />
  const p = pacote.trim().toLowerCase()
  const linhas = dados.linhas.filter(
    (l) =>
      (!compra || l.compras.some((c) => c.id === compra)) &&
      (!p || [l.lote.codigo, l.lote.nome].some((x) => x?.toLowerCase().includes(p))) &&
      (!pessoa || l.pessoas.some((x) => x.id === pessoa)) &&
      (!tipo || l.tipo === (tipo as TipoLivro)) &&
      (!de || l.data >= de) &&
      (!ate || l.data <= ate),
  )
  const visiveis = tudo ? linhas : linhas.slice(0, MAX)
  const pessoas = [...new Map(dados.linhas.flatMap((l) => l.pessoas).map((x) => [x.id, x.nome ?? x.id])).entries()].sort((a, b) => a[1].localeCompare(b[1], 'pt-BR'))
  const compras = dados.porCompra.filter((c) => !compra || c.compraId === compra)
  const filtrado = !!(compra || pacote || pessoa || tipo || de || ate)
  const entrou = linhas.filter((l) => l.delta > 0).reduce((s, l) => s + l.delta, 0)
  const saiu = -linhas.filter((l) => l.delta < 0).reduce((s, l) => s + l.delta, 0)
  const abrir = (l: (typeof linhas)[number]) => (l.ref ? ir(l.ref.tela, l.ref.params) : ir('lote', { id: l.lote.id }))
  const exportar = () =>
    baixarCSV(`livro-do-cabelo-${new Date().toISOString().slice(0, 10)}`, linhas.map((l) => ({
      [t('Data')]: l.data, [t('Hora')]: hora(l.em), [t('Tipo')]: t(l.nomeTipo), [t('Lançamento')]: l.titulo, [t('Pacote')]: l.lote.codigo ?? l.lote.nome,
      [t('Compras')]: l.compras.map((c) => c.codigo ?? '').join(' + '), [t('Antes (g)')]: l.antes, [t('Movimentou (g)')]: l.delta, [t('Depois (g)')]: l.depois, [t('Quem')]: l.por ?? '', [t('Descrição')]: l.descricao ?? '',
    })))
  return (
    <div className="space-y-4">
      <Titulo subtitulo={t('Como o livro caixa, mas em gramas: tudo o que entrou e saiu, e de quais compras.')}>{t('Livro do cabelo')}</Titulo>

      <div className="grid gap-2 rounded-2xl border border-[var(--borda)] bg-[var(--cartao)] p-3 sm:grid-cols-2 lg:grid-cols-3">
        <Campo rotulo="Compra"><Selecao valor={compra} onChange={setCompra} vazio="Todas" opcoes={dados.porCompra.map((c) => ({ id: c.compraId, nome: [c.codigo, c.fornecedor].filter(Boolean).join(' · ') }))} /></Campo>
        <Campo rotulo="Pacote"><Entrada type="search" value={pacote} placeholder={t('Código ou nome')} onChange={(e) => setPacote(e.target.value)} /></Campo>
        <Campo rotulo="Pessoa"><Selecao valor={pessoa} onChange={setPessoa} vazio="Todas" opcoes={pessoas.map(([id, nome]) => ({ id, nome }))} /></Campo>
        <Campo rotulo="Tipo"><Selecao valor={tipo} onChange={setTipo} vazio="Todos" opcoes={dados.tipos.map((x) => ({ id: x.id, nome: t(x.nome) }))} /></Campo>
        <Campo comoDiv rotulo="Período">
          <div className="flex items-center gap-1">
            <Entrada type="date" aria-label={t('De')} value={de} onChange={(e) => setDe(e.target.value)} />
            <Entrada type="date" aria-label={t('Até')} value={ate} onChange={(e) => setAte(e.target.value)} />
          </div>
        </Campo>
        <div className="flex flex-wrap items-end gap-2">
          {filtrado && <Botao variante="leve" onClick={() => (setCompra(''), setPacote(''), setPessoa(''), setTipo(''), setDe(''), setAte(''))}>× {t('Limpar filtros')}</Botao>}
          <Botao variante="secundario" disabled={!linhas.length} onClick={exportar}>⬇ {t('Exportar CSV')}</Botao>
        </div>
      </div>

      <Cartao titulo={`${t('Lançamentos')} · ${linhas.length}`} acao={<span className="num text-sm text-[var(--suave)]">{t('entrou')} <b className="text-[var(--bom)]">{gramasTexto(entrou)}</b> · {t('saiu')} <b className="text-[var(--ruim)]">{gramasTexto(saiu)}</b></span>}>
        {!linhas.length ? <p className="text-sm text-[var(--suave)]">{t('Nenhum lançamento com esse filtro.')}</p> : (
          <ul className="divide-y divide-[var(--borda)]">
            {visiveis.map((l) => (
              <li key={l.id} {...clicavel(() => abrir(l))} className="flex cursor-pointer flex-wrap items-baseline gap-x-3 gap-y-0.5 rounded-lg px-1 py-2 text-sm outline-none hover:bg-[var(--fundo)] focus-visible:bg-[var(--marca-suave)]">
                <span className="num w-24 shrink-0 text-xs text-[var(--suave)]">{dataBR(l.data)} {hora(l.em)}</span>
                <span className="min-w-0 flex-1 basis-56 [overflow-wrap:anywhere]">
                  <b>{l.titulo}</b>
                  <span className="block text-xs text-[var(--suave)]">
                    <button type="button" className="font-mono font-semibold text-[var(--marca)] hover:underline" onClick={(e) => (e.stopPropagation(), ir('lote', { id: l.lote.id }))}>📦 {l.lote.codigo ?? l.lote.nome}</button>
                    {l.compras.length > 0 && <> · 🛒 {l.compras.map((c) => c.codigo ?? '?').join(' + ')}</>}
                    {l.por && <> · {l.por}</>}
                  </span>
                </span>
                <span className="num whitespace-nowrap text-xs text-[var(--suave)]">{gramasTexto(l.antes)} → {gramasTexto(l.depois)}</span>
                <span className={cx('num w-24 shrink-0 whitespace-nowrap text-right font-bold', l.delta < 0 ? 'text-[var(--ruim)]' : 'text-[var(--bom)]')}>{sinal(l.delta)}</span>
              </li>
            ))}
          </ul>
        )}
        {!tudo && linhas.length > MAX && <Botao variante="leve" className="mt-2" onClick={() => setTudo(true)}>{t('Ver tudo ({n})', { n: linhas.length })}</Botao>}
      </Cartao>

      <Cartao titulo={t('Fechamento por compra')} ajuda={DICA_CONFERE}>
        {!compras.length ? <p className="text-sm text-[var(--suave)]">{t('Nenhuma compra de cabelo ainda.')}</p> : (
          <ul className="divide-y divide-[var(--borda)]">
            {compras.map((c) => (
              <li key={c.compraId} {...clicavel(() => ir('pedido', { id: c.compraId }))} className="cursor-pointer rounded-lg px-1 py-2 text-sm outline-none hover:bg-[var(--fundo)] focus-visible:bg-[var(--marca-suave)]">
                <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                  <b><span className="font-mono">{c.codigo}</span>{c.fornecedor ? ` · ${c.fornecedor}` : ''}</b>
                  <span className="text-xs text-[var(--suave)]">{dataBR(c.data)}</span>
                </div>
                <p className={cx('num mt-0.5', c.confere ? 'text-[var(--bom)]' : 'text-[var(--alerta)]')}>
                  {t('comprado')} {gramasTexto(c.comprado)} = {t('em pacotes')} {gramasTexto(c.emPacotes)} + {t('vendido')} {gramasTexto(c.vendido)} + {t('perda')} {gramasTexto(c.perda)}{c.diferenca ? <> + {t('diferença')} {gramasTexto(c.diferenca)}</> : null}{' '}
                  {c.confere ? '✓' : `⚠️ ${t('não fecha: faltam {g}', { g: gramasTexto(c.resto) })}`}
                </p>
              </li>
            ))}
          </ul>
        )}
        <p className="mt-2 flex items-center text-xs text-[var(--suave)]">{t('Confere ✓')}<Info texto={DICA_CONFERE} /></p>
      </Cartao>
    </div>
  )
}
