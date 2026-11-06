// VENDER › CABELO: as linhas de cabelo da venda (medida, categoria, gramas) e de quais lotes saem.
import { useEffect, useMemo, useRef, useState } from 'react'
import { formatar, multiplicarFator, fatorValido } from '../../core/domain/dinheiro'
import { novoId } from '../../core/domain/ids'
import type { Id, TabelaPreco } from '../../core/domain/tipos'
import { fatorDaTabela } from '../../core/services/precos'
import { Botao, Campo, Cartao, Entrada, GramasInput, Selecao, cx, gramasTexto, loc, moedaPadrao, ehToque } from '../../ui/base'
import { useApp, useConsulta } from '../../ui/contexto'
import { useT } from '../../ui/i18n'
import { LeitorCodigo } from '../../ui/estoqueUi'
import { acharPorCodigo, buscarPacotes, usePistola } from '../../ui/leitorPistola'
import { CATEGORIAS_RESERVA, type LinhaTela } from './tipos'

/**
 * Linha de cabelo pela tabela: medida → categoria → gramas → fator (da tabela, editável) = total.
 * Escolhe sozinha o lote mais antigo daquela medida/categoria e divide entre lotes se precisar (rastreio).
 */
export function LinhasCabelo({ moduloId, pessoaId, onAdd, opcional, jaUsado }: { moduloId: string; pessoaId?: Id; onAdd(ls: LinhaTela[]): void; opcional?: boolean; jaUsado: LinhaTela[] }) {
  const t = useT()
  const { dados: tabelas } = useConsulta('tabelasPreco', { moduloId })
  const { dados: estoque } = useConsulta('estoque', { moduloId, somenteComSaldo: true })
  const { dados: conf } = useConsulta('configuracoes', {})
  const [aberto, setAberto] = useState(!opcional)
  const [categoria, setCategoria] = useState('Normal')
  const tabela: TabelaPreco | undefined = useMemo(() => {
    const ts = tabelas ?? []
    return ts.find((x) => (x.categoria ?? 'Normal') === categoria) ?? ts.find((x) => !x.categoria) ?? ts[0]
  }, [tabelas, categoria])
  const colunaDaPessoa = tabela?.colunas.find((c) => c.pessoaId && c.pessoaId === pessoaId)?.id
  const [coluna, setColuna] = useState<string>()
  const colunaAtual = coluna ?? colunaDaPessoa ?? tabela?.colunas[0]?.id
  const [medida, setMedida] = useState<number>()
  const [gramas, setGramas] = useState<number>()
  const [fator, setFator] = useState('')
  const [loteEscolhido, setLoteEscolhido] = useState<Id>()
  // coluna e fator ficam numa linha só ("60 cm · 17,5 · Bs 35.140") quando vêm da cliente/tabela; "trocar" abre
  const [trocarPreco, setTrocarPreco] = useState(false)
  // LER OU BUSCAR PACOTE: leitor pistola (Enter com código exato), câmera ou digitação (código, código antigo, rótulo)
  const [busca, setBusca] = useState('')
  const [lendo, setLendo] = useState(false)
  const [aviso, setAviso] = useState<string>()
  const [focarGramas, setFocarGramas] = useState(0)
  const caixaGramas = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (focarGramas && !ehToque()) caixaGramas.current?.querySelector('input')?.focus()
  }, [focarGramas])
  // categorias: da configuração de atributos do módulo (Configurações › Atributos), não fixas na tela
  const categorias = useMemo(() => {
    const def = conf?.modulos.find((m) => m.id === moduloId)?.tiposItem.flatMap((ti) => ti.campos).find((c) => c.id === 'categoria')
    const lista = def?.opcoes?.length ? def.opcoes : CATEGORIAS_RESERVA
    return lista.includes(categoria) ? lista : [...lista, categoria]
  }, [conf, moduloId, categoria])
  // vindo da Triagem (#/vender?modulo=cabelo&lote=… ou &medida=60&categoria=Normal): já abre com a medida, a categoria,
  // o lote e as gramas dele
  const { nav } = useApp()
  const loteParam = nav.params.lote as Id | undefined
  const medidaParam = nav.params.medida ? Number(nav.params.medida) : undefined
  const [aplicado, setAplicado] = useState(false)
  useEffect(() => {
    if (aplicado || (!loteParam && !medidaParam) || !estoque) return
    setAplicado(true)
    if (nav.params.coluna) setColuna(String(nav.params.coluna))
    if (!loteParam) {
      setAberto(true)
      if (nav.params.categoria) setCategoria(String(nav.params.categoria))
      setMedida(medidaParam)
      return
    }
    const l = estoque.find((i) => i.id === loteParam)
    if (!l) return
    setAberto(true)
    setCategoria(String(l.campos.categoria || 'Normal'))
    if (l.campos.comprimento) setMedida(Number(l.campos.comprimento))
    setLoteEscolhido(l.id)
    setGramas(l.saldo)
  }, [aplicado, loteParam, medidaParam, estoque, nav.params.coluna, nav.params.categoria])

  const usados = new Map<Id, number>()
  for (const l of jaUsado) usados.set(l.itemId, (usados.get(l.itemId) ?? 0) + l.quantidade)
  const lotes = (estoque ?? [])
    .filter((i) => i.unidade === 'grama' && (!medida || Number(i.campos.comprimento) === medida) && String(i.campos.categoria || 'Normal') === categoria)
    .map((i) => ({ ...i, livre: i.saldo - (usados.get(i.id) ?? 0) }))
    .filter((i) => i.livre > 0)
    .sort((a, b) => (a.criadoEm < b.criadoEm ? -1 : 1))
  const moedaTabela = tabela?.moeda ?? moedaPadrao()
  const fatorTabela = tabela && medida && colunaAtual ? fatorDaTabela(tabela, medida, colunaAtual).fator : undefined
  const fatorUsado = fator.trim() || fatorTabela || ''
  // recolhido: o fator veio da tabela (coluna da cliente ou a primeira) e ninguém pediu para trocar
  const precoAberto = trocarPreco || coluna !== undefined || !fatorTabela
  const nomeColuna = tabela?.colunas.find((c) => c.id === colunaAtual)?.nome
  const disponivel = loteEscolhido ? lotes.find((l) => l.id === loteEscolhido)?.livre ?? 0 : lotes.reduce((s, l) => s + l.livre, 0)
  const totalPrev = gramas && fatorValido(fatorUsado) ? multiplicarFator(gramas, fatorUsado, moedaTabela) : undefined
  const medidas = [...new Set([...(tabela?.linhas ?? []), ...(estoque ?? []).filter((i) => i.campos.comprimento).map((i) => Number(i.campos.comprimento))])].sort((a, b) => a - b)

  const usarPacote = (l: NonNullable<typeof estoque>[number]) => {
    setBusca('')
    if (l.unidade !== 'grama' || !l.campos.comprimento) return setAviso(t('{c} ainda não tem medida: separe na triagem antes de vender.', { c: l.codigo ?? l.nome }))
    const livre = l.saldo - (usados.get(l.id) ?? 0)
    if (livre <= 0) return setAviso(t('{c} já está todo nesta venda.', { c: l.codigo ?? l.nome }))
    setAviso(undefined)
    setCategoria(String(l.campos.categoria || 'Normal'))
    setMedida(Number(l.campos.comprimento))
    setFator('')
    setGramas(undefined)
    setLoteEscolhido(l.id)
    setFocarGramas((n) => n + 1)
  }
  const pistola = usePistola(estoque, usarPacote, (x) => setAviso(t('Nenhum pacote com o código {c}.', { c: x.trim() })))
  const achados = buscarPacotes(estoque, busca, 6)

  if (!aberto)
    return (
      <Botao variante="secundario" onClick={() => setAberto(true)}>
        + {t('Usar cabelo do estoque (mega hair)')}
      </Botao>
    )

  const adicionar = () => {
    if (!gramas || !totalPrev || !medida) return
    // divide entre lotes (o mais antigo primeiro) quando um só não basta
    const fila = loteEscolhido ? lotes.filter((l) => l.id === loteEscolhido) : lotes
    let resta = gramas
    const novas: LinhaTela[] = []
    for (const l of fila) {
      if (!resta) break
      const q = Math.min(resta, l.livre)
      novas.push({
        id: novoId(),
        itemId: l.id,
        nome: `${l.codigo ? l.codigo + ' · ' : ''}${l.nome}`,
        quantidade: q,
        moeda: moedaTabela,
        total: multiplicarFator(q, fatorUsado, moedaTabela),
        unidade: 'grama',
        calculo: { medida, fator: fatorUsado.replace('.', ','), categoria, tabelaId: tabela?.id, colunaId: colunaAtual },
      })
      resta -= q
    }
    if (resta > 0) return
    onAdd(novas)
    setGramas(undefined)
    setFator('')
    setLoteEscolhido(undefined)
  }

  return (
    <Cartao titulo={t('Cabelo')} ajuda="Como no caderno: medida | gramas × fator = total. Ex.: 40 | 2.000 × 3,5 = Bs 7.000.">
      <div className="relative mb-3">
        <Campo comoDiv rotulo="Ler ou buscar pacote" ajuda="Aponte o leitor ou a câmera para a etiqueta, ou digite o código. Ex.: P4 ou M1-2.">
          <div className="flex gap-2">
            <Entrada
              type="search"
              aria-label={t('Ler ou buscar pacote')}
              placeholder={t('Código, código antigo ou rótulo')}
              value={busca}
              onChange={(e) => (setBusca(e.target.value), setAviso(undefined))}
              onKeyDown={pistola.onKeyDown}
              spellCheck={false}
              autoComplete="off"
            />
            <Botao variante="secundario" className="shrink-0" aria-label={t('Ler código')} title={t('Ler código')} onClick={() => setLendo(true)}>📷</Botao>
          </div>
        </Campo>
        {achados.length > 0 && (
          <ul className="absolute inset-x-0 z-20 mt-1 max-h-72 overflow-auto rounded-xl border border-[var(--borda)] bg-[var(--cartao)] shadow-lg">
            {achados.map((l) => (
              <li key={l.id}>
                <button type="button" onClick={() => usarPacote(l)} className="flex w-full justify-between gap-2 px-3 py-2 text-left text-sm hover:bg-[var(--marca-suave)]">
                  <span className="min-w-0 truncate"><b className="font-mono">{l.codigo ?? '—'}</b> · {l.nome}</span>
                  <span className="num shrink-0 text-[var(--suave)]">{gramasTexto(l.saldo)}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
        {aviso && <p className="mt-1 text-sm font-semibold text-[var(--alerta)]">{aviso}</p>}
      </div>
      {lendo && (
        <LeitorCodigo
          abrirLote={false}
          onFechar={() => setLendo(false)}
          onLer={(c) => {
            setLendo(false)
            const l = acharPorCodigo(estoque, c)
            if (l) usarPacote(l)
            else (setBusca(c), setAviso(t('Nenhum pacote com o código {c}.', { c })))
          }}
        />
      )}
      <div className="grid gap-3 sm:grid-cols-2">
        <Campo rotulo="Categoria">
          <Selecao valor={categoria} onChange={(v) => (setCategoria(v), setFator(''), setLoteEscolhido(undefined))} opcoes={categorias.map((c) => ({ id: c, nome: t(c) }))} />
        </Campo>
        {precoAberto && (
          <Campo rotulo="Coluna da tabela (comprador)" ajuda="Cada comprador tem seu preço. Se a pessoa estiver ligada a uma coluna, ela já vem escolhida.">
            <Selecao valor={colunaAtual} onChange={(v) => (setColuna(v), setFator(''))} opcoes={(tabela?.colunas ?? []).map((c) => ({ id: c.id, nome: c.nome }))} />
          </Campo>
        )}
      </div>
      <div className="mt-3">
        <span id="medida-cabelo" className="mb-1 block text-sm font-semibold text-[var(--suave)]">{t('Medida (cm)')}</span>
        <div role="group" aria-labelledby="medida-cabelo" className="flex flex-wrap gap-1">
          {medidas.map((m) => {
            const temEstoque = (estoque ?? []).some((i) => Number(i.campos.comprimento) === m && String(i.campos.categoria || 'Normal') === categoria && i.saldo > (usados.get(i.id) ?? 0))
            return (
              <button key={m} type="button" aria-pressed={medida === m} onClick={() => (setMedida(m), setFator(''), setLoteEscolhido(undefined))} className={cx('min-h-11 min-w-12 rounded-xl border px-2 font-bold', medida === m ? 'border-[var(--marca)] bg-[var(--marca)] text-white' : 'border-[var(--borda)]', !temEstoque && 'opacity-40')}>
                {m}
              </button>
            )
          })}
        </div>
      </div>
      {medida && (
        <div className="mt-3 grid gap-3 sm:grid-cols-3">
          <Campo rotulo="Gramas" ajuda="Digite em gramas (2008) ou troque para kg (2,5).">
            <div ref={caixaGramas}><GramasInput key={focarGramas} valor={gramas} onChange={setGramas} /></div>
          </Campo>
          {precoAberto && (
            <Campo rotulo="Fator" ajuda="Vem da tabela; dá para mudar só nesta venda.">
              <Entrada inputMode="decimal" value={fator} placeholder={fatorTabela ?? '?'} onChange={(e) => setFator(e.target.value)} />
            </Campo>
          )}
          <Campo rotulo="Lote" ajuda="Pega o pacote mais antigo; se não bastar, divide. Ex.: 1.500 g = 1.000 g do P1 + 500 g do P4.">
            <Selecao valor={loteEscolhido} onChange={(v) => setLoteEscolhido(v || undefined)} vazio="Automático (mais antigo)" opcoes={lotes.map((l) => ({ id: l.id, nome: `${l.codigo ?? ''} ${gramasTexto(l.livre)}` }))} />
          </Campo>
        </div>
      )}
      {medida && !precoAberto && (
        <div className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
          <span className="num font-semibold">{medida} cm</span>
          <span aria-hidden>·</span>
          <input inputMode="decimal" aria-label={t('Fator')} value={fator} placeholder={fatorTabela} onChange={(e) => setFator(e.target.value)} className="num w-16 rounded-lg border border-transparent bg-transparent px-1 font-semibold outline-none placeholder:text-[var(--texto)] hover:border-[var(--borda)] focus:border-[var(--marca)]" />
          <span aria-hidden>·</span>
          <span className="num font-semibold">{totalPrev !== undefined ? formatar(totalPrev, moedaTabela) : '—'}</span>
          {nomeColuna && <span className="text-[var(--suave)]">({nomeColuna})</span>}
          <button type="button" className="min-h-10 px-2 font-semibold text-[var(--marca)] underline-offset-4 hover:underline" onClick={() => setTrocarPreco(true)}>{t('trocar')}</button>
        </div>
      )}
      {medida && (
        <div className="mt-3 rounded-xl bg-[var(--fundo)] p-3">
          <div className="num text-lg font-bold">
            {medida} | {gramas ? gramas.toLocaleString(loc()) : '—'} × {fatorUsado || '?'} = {totalPrev !== undefined ? formatar(totalPrev, moedaTabela) : '—'}
          </div>
          <div className="text-xs text-[var(--suave)]">
            {t('Disponível')}: {gramasTexto(disponivel)}
            {gramas && gramas > disponivel && <b className="ml-2 text-[var(--ruim)]">{t('Não tem tudo isso em estoque.')}</b>}
            {!fatorUsado && <b className="ml-2 text-[var(--alerta)]">{t('A tabela não tem esse valor: digite o fator.')}</b>}
          </div>
          <Botao className="mt-2" disabled={!gramas || !totalPrev || gramas > disponivel} onClick={adicionar}>
            + {t('Adicionar')}
          </Botao>
        </div>
      )}
    </Cartao>
  )
}
