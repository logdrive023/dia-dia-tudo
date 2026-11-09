// VIAGENS › FORMULÁRIO: criar ou editar uma viagem (destino, datas, viajantes, orçamento).
import { useState } from 'react'
import { formatar } from '../../../core/domain/dinheiro'
import { dataLocal } from '../../../core/domain/datas'
import { novoId } from '../../../core/domain/ids'
import type { Id, Viagem } from '../../../core/domain/tipos'
import { Botao, Campo, Entrada, Escolha, Janela, Pagina, ValorInput, cx, dataBR, moedaPadrao } from '../../../shared/ui/base'
import { useApp, useAvisoSaida, useComando, useConsulta } from '../../../shared/ui/contexto'
import { useCotacoes } from '../../../shared/ui/compartilhados'
import { useT } from '../../../shared/ui/i18n'
import { Passo, useAssistente } from '../../../shared/ui/passoAPasso'
import { CampoCidade } from '../../../shared/ui/campoCidade'
import { BuscaPessoa } from '../../../shared/ui/buscaPessoa'
import { CIDADES_BOLIVIA, textoCidade } from '../../../core/dados/cidadesBolivia'

export function FormViagem({ viagem }: { viagem?: Viagem }) {
  const t = useT()
  const { ir, voltar, marcarSujo } = useApp()
  const { executar, ocupado } = useComando()
  const { dados } = useConsulta('viagens', {})
  const { cfg } = useCotacoes()
  const moeda = cfg?.moedaPrincipal ?? moedaPadrao()
  const [id] = useState(() => viagem?.id ?? novoId())
  const [nome, setNome] = useState(viagem?.nome ?? '')
  const [destino, setDestino] = useState(viagem?.destino ?? '')
  // "É viagem na Bolívia?" — Sim: escolhe na lista das cidades · Não: escreve o destino (nova viagem começa no Sim)
  const [naBolivia, setNaBolivia] = useState<'sim' | 'nao'>(() => !viagem || (viagem.naBolivia ?? (!viagem.destino || CIDADES_BOLIVIA.some((c) => textoCidade(c) === viagem.destino))) ? 'sim' : 'nao')
  const [viajantes, setViajantes] = useState<Id[]>(viagem?.viajantes ?? [])
  const [inicio, setInicio] = useState(viagem?.inicio ?? dataLocal())
  const [fim, setFim] = useState(viagem?.fim ?? '')
  const [orcamento, setOrcamento] = useState<number | undefined>(viagem?.orcamento)
  const [orcamentoCompra, setOrcamentoCompra] = useState<number | undefined>(viagem?.orcamentoCompra)
  const [rateio, setRateio] = useState<'grama' | 'valor'>(viagem?.rateio ?? 'grama')
  const [obs, setObs] = useState(viagem?.obs ?? '')
  // versão da viagem quando o formulário abriu: se outra aba mudar no meio, o servidor recusa em vez de gravar por cima
  const [versaoBase] = useState(() => viagem?.versao)
  useAvisoSaida(!viagem && !ocupado && (!!nome || viajantes.length > 0))
  const { backend } = useApp()
  const [parecidas, setParecidas] = useState<{ id: Id; codigo: string; nome: string; destino?: string; inicio: string; fim?: string }[]>()
  const salvar = async (confirmarParecida = false) => {
    // nova viagem: antes de criar, confere se já existe uma parecida em andamento (pode ser de propósito: a pessoa decide)
    if (!viagem && !confirmarParecida) {
      const ps = await backend.consulta('viagensParecidas', { id, nome, destino, inicio, fim: fim || undefined }).catch(() => [])
      if (ps.length) return setParecidas(ps)
    }
    setParecidas(undefined)
    const r = await executar('salvarViagem', { id, nome, destino, naBolivia: naBolivia === 'sim', viajantes, inicio, fim: fim || undefined, orcamento, orcamentoCompra, rateio, obs, confirmarParecida, versaoBase }, t(viagem ? 'Viagem salva.' : 'Viagem criada.'))
    if (!r) return
    marcarSujo(false)
    if (viagem) voltar()
    else ir('viagem', { id: r.id })
  }
  const pessoas = dados?.viajantesPossiveis ?? []
  // PASSO A PASSO (como Separar e Nova compra): 1 Para onde · 2 Quem vai · 3 Quanto pode gastar · 4 Como dividir
  const w = useAssistente()
  const alternar = w.alternar
  const abertos = { has: w.aberto }
  const dias = inicio && fim && fim >= inicio ? Math.round((new Date(`${fim}T12:00:00`).getTime() - new Date(`${inicio}T12:00:00`).getTime()) / 86400000) + 1 : undefined
  const nomesViajantes = pessoas.filter((p) => viajantes.includes(p.id)).map((p) => p.nome)
  const proximo = (n: number, rotulo: string) => w.proximo(n, rotulo)
  const falta = !nome.trim() ? t('o nome da viagem') : !viajantes.length ? t('quem vai') : ''
  return (
    <Pagina titulo={t(viagem ? 'Editar viagem' : 'Nova viagem de compra')} subtitulo={viagem?.codigo} onVoltar={voltar} rodape={
      <Botao grande className="w-full" disabled={ocupado || !!falta} onClick={() => salvar()}>{falta ? t('Falta: {x}', { x: falta }) : t(viagem ? 'Salvar' : 'Criar viagem')}</Botao>
    }>
      {/* VIAGEM PARECIDA EM ANDAMENTO: pode ser repetida por engano ou de propósito — a pessoa escolhe (sim / não) */}
      {parecidas && (
        <Janela aberta titulo={`⚠ ${t('Já existe uma viagem parecida em andamento')}`} onFechar={() => setParecidas(undefined)} rodape={
          <div className="space-y-2">
            {parecidas.length === 1 && <Botao grande className="w-full" onClick={() => (marcarSujo(false), ir('viagem', { id: parecidas[0].id }))}>{t('Não, usar a {v}', { v: parecidas[0].codigo })}</Botao>}
            <Botao variante="secundario" className="w-full" disabled={ocupado} onClick={() => salvar(true)}>{t('Sim, criar outra viagem mesmo assim')}</Botao>
          </div>
        }>
          <p className="mb-3 text-sm text-[var(--suave)]">{t('Pode ser a mesma viagem criada de novo sem querer. Se for outra de verdade (ex.: outra equipe na mesma cidade), continue.')}</p>
          <ul className="space-y-2">
            {parecidas.map((p) => (
              <li key={p.id}>
                <button type="button" onClick={() => (marcarSujo(false), ir('viagem', { id: p.id }))} className="flex w-full items-center gap-3 rounded-2xl border-2 border-l-[6px] border-[var(--borda)] p-3 text-left hover:border-sky-500" style={{ borderLeftColor: 'var(--bom)' }}>
                  <span className="min-w-0 flex-1">
                    <b className="font-mono">{p.codigo}</b> <span className="rounded-full bg-[var(--bom)]/12 px-2 text-[11px] font-semibold text-[var(--bom)]">{t('Em andamento')}</span>
                    <b className="block truncate text-sm">{p.nome}</b>
                    <span className="num block truncate text-xs text-[var(--suave)]">{[p.destino && `📍 ${p.destino}`, `📅 ${dataBR(p.inicio)}${p.fim ? ` – ${dataBR(p.fim)}` : ''}`].filter(Boolean).join(' · ')}</span>
                  </span>
                  <span className="shrink-0 text-sm font-semibold text-[var(--marca)]">{t('Abrir')} →</span>
                </button>
              </li>
            ))}
          </ul>
        </Janela>
      )}
      <ol className="mx-auto max-w-2xl space-y-3" aria-label={t('Passos da viagem')}>
        <Passo n={1} de={4} titulo="Para onde e quando" feito={!!nome.trim()} aberto={abertos.has(1)} onAlternar={() => alternar(1)}
          resumo={nome.trim() ? [nome.trim(), destino ? `📍 ${destino}` : '', `📅 ${dataBR(inicio)}${fim ? ` → ${dataBR(fim)}` : ''}${dias ? ` · ${t('{n} dia(s)', { n: dias })}` : ''}`].filter(Boolean).join(' · ') : t('falta o nome')}
          ajuda="Um nome curto para achar a viagem depois, para onde vai e as datas. A volta pode ficar em branco."
          exemplo="Ex.: Feira de Oruro · novembro · Oruro · 02/11 → 07/11 (6 dias)">
          <Campo rotulo="Nome da viagem *"><Entrada value={nome} onChange={(e) => setNome(e.target.value)} placeholder={t('Ex.: Feira de Oruro · novembro')} autoFocus={!viagem} /></Campo>
          <Campo comoDiv rotulo="É viagem na Bolívia?" ajuda="Sim: escolha a cidade na lista (todas as cidades da Bolívia já estão cadastradas). Não: escreva o destino.">
            <Escolha<'sim' | 'nao'> rotulo="É viagem na Bolívia?" valor={naBolivia} onChange={setNaBolivia} opcoes={[{ id: 'sim', nome: 'Sim' }, { id: 'nao', nome: 'Não' }]} />
          </Campo>
          {naBolivia === 'sim'
            ? <Campo comoDiv rotulo="Destino"><CampoCidade rotulo="Destino" valor={destino} onChange={setDestino} placeholder="Buscar cidade (ex.: Oruro)" /></Campo>
            : <Campo rotulo="Destino"><Entrada value={destino} onChange={(e) => setDestino(e.target.value)} placeholder={t('Ex.: Lima, Peru')} /></Campo>}
          <div className="grid gap-2 xs:grid-cols-2">
            <Campo rotulo="Ida"><Entrada type="date" value={inicio} onChange={(e) => setInicio(e.target.value)} /></Campo>
            <Campo rotulo="Volta (prevista)"><Entrada type="date" value={fim} onChange={(e) => setFim(e.target.value)} /></Campo>
          </div>
          {dias !== undefined && <p className="num text-sm font-semibold text-[var(--marca)]">= {t('{n} dia(s)', { n: dias })}</p>}
          {proximo(1, 'Quem vai')}
        </Passo>
        <Passo n={2} de={4} titulo="Quem vai" feito={viajantes.length > 0} aberto={abertos.has(2)} onAlternar={() => alternar(2)}
          resumo={nomesViajantes.length ? `👤 ${nomesViajantes.join(', ')}` : t('ninguém escolhido')}
          ajuda="Quem viaja lança os gastos pelo celular (gasolina, hotel, comida), só nesta viagem, e as compras dela ficam ligadas aqui."
          exemplo="Ex.: Paula e Wagner → os dois lançam gastos e o resultado conta para os dois">
          {/* PRIMEIRO USO: sem equipe cadastrada, cadastra AQUI (a peça padrão de busca cria "+ Nova pessoa da equipe"
              na hora) — antes só dizia "cadastre em Pessoas" e quem começava ficava preso no passo 2 */}
          {!pessoas.length && <p className="mb-2 text-sm text-[var(--suave)]">{t('Ninguém da equipe cadastrado ainda: escreva o nome de quem vai e toque em “+ Nova pessoa da equipe”.')}</p>}
          <div className="mb-2">
            <BuscaPessoa rotulo="Adicionar quem vai" papel="funcionario" novoRotulo="Nova pessoa da equipe" valor={undefined}
              onChange={(id) => id && !viajantes.includes(id) && setViajantes([...viajantes, id])} />
          </div>
          {pessoas.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {pessoas.map((p) => {
                const on = viajantes.includes(p.id)
                return (
                  <button key={p.id} type="button" aria-pressed={on} onClick={() => setViajantes(on ? viajantes.filter((x) => x !== p.id) : [...viajantes, p.id])} className={cx('min-h-11 rounded-full px-4 text-sm font-semibold', on ? 'bg-[var(--marca)] text-white' : 'bg-[var(--cartao)] text-[var(--marca)] ring-1 ring-[var(--marca)]/40')}>
                    {on ? '✓ ' : ''}{p.nome}
                  </button>
                )
              })}
            </div>
          )}
          {proximo(2, 'Quanto pode gastar')}
        </Passo>
        <Passo n={3} de={4} titulo="Quanto pode gastar" opcional feito={!!orcamento || !!orcamentoCompra} aberto={abertos.has(3)} onAlternar={() => alternar(3)}
          resumo={[orcamento ? `⛽ ${formatar(orcamento, moeda)}` : '', orcamentoCompra ? `💇 ${formatar(orcamentoCompra, moeda)}` : ''].filter(Boolean).join(' · ') || t('sem limite')}
          ajuda="Dois limites, se quiser: o dos gastos da viagem (gasolina, hotel, comida) e o do cabelo. O painel avisa quando passar."
          exemplo="Ex.: gastos até Bs 1.500 · cabelo até Bs 40.000">
          <div className="grid gap-2 sm:grid-cols-2">
            <Campo rotulo="Gastos da viagem (até)"><ValorInput moeda={moeda} valor={orcamento} onChange={setOrcamento} /></Campo>
            <Campo rotulo="Compra de cabelo (até)"><ValorInput moeda={moeda} valor={orcamentoCompra} onChange={setOrcamentoCompra} /></Campo>
          </div>
          {proximo(3, 'Como dividir o gasto')}
        </Passo>
        <Passo n={4} de={4} titulo="Como dividir o gasto" opcional feito={rateio !== (viagem?.rateio ?? 'grama') || !!obs.trim()} aberto={abertos.has(4)} onAlternar={() => alternar(4)}
          resumo={`${t(rateio === 'grama' ? 'Por gramas' : 'Por valor')}${obs.trim() ? ` · “${obs.trim()}”` : ''}`}
          ajuda="No fim, o gasto da viagem vai para o custo do cabelo comprado nela. Por gramas: cada grama leva o mesmo. Por valor: o cabelo mais caro leva mais."
          exemplo="Ex.: Bs 800 de gasto em 4 kg = Bs 200 por kg (por gramas)">
          <Escolha<'grama' | 'valor'> valor={rateio} onChange={setRateio} opcoes={[{ id: 'grama', nome: 'Por gramas' }, { id: 'valor', nome: 'Por valor' }]} />
          <Campo rotulo="Observação"><Entrada value={obs} onChange={(e) => setObs(e.target.value)} placeholder={t('Ex.: levar balança e sacos')} /></Campo>
        </Passo>
      </ol>
    </Pagina>
  )
}
