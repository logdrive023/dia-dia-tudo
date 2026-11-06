// CAIXA › LANÇAR: a janela de dar troco, entrada, despesa, retirada e pagamento.
import { useState } from 'react'
import { formasEmUso } from '../../core/domain/formas'
import { moeda as moedaDe } from '../../core/domain/dinheiro'
import { dataCurta } from '../../core/domain/datas'
import { novoId } from '../../core/domain/ids'
import type { Id, MovCaixa } from '../../core/domain/tipos'
import { Botao, Campo, Entrada, Janela, Selecao, ValorInput, cx, moedaPadrao } from '../../ui/base'
import { useApp, useComando, useConsulta } from '../../ui/contexto'
import { SeletorPessoa, useCotacoes } from '../../ui/compartilhados'
import { useT } from '../../ui/i18n'
import { BOTOES, CATEGORIAS_DESPESA, type TipoLancar } from './caixaDia'

/** Folha simples de lançar: valor grande, forma em botões, descrição (categorias na despesa), pessoa no pagamento. */
export function Lancar({ tipoInicial, data, hoje, onFechar }: { tipoInicial: TipoLancar; data: string; hoje: string; onFechar(): void }) {
  const t = useT()
  const { cfg } = useCotacoes()
  const { executar, ocupado } = useComando()
  const { backend } = useApp()
  const { dados: locais } = useConsulta('locais', {})
  const [id] = useState(() => novoId())
  const [tipo, setTipo] = useState<TipoLancar>(tipoInicial)
  const [moedaEscolhida, setMoeda] = useState<string>()
  const principal = cfg?.moedaPrincipal ?? moedaPadrao()
  const moeda = moedaEscolhida ?? principal
  const [forma, setForma] = useState('dinheiro')
  const [valor, setValor] = useState<number>()
  const [descricao, setDescricao] = useState('')
  const [categoria, setCategoria] = useState('')
  const [localId, setLocalId] = useState('')
  const [socioId, setSocioId] = useState('')
  const [pessoaId, setPessoaId] = useState<Id>()
  const sujo = valor !== undefined || !!descricao.trim() || !!categoria.trim()
  const fechar = () => (!sujo || window.confirm(t('Sair sem salvar?'))) && onFechar()
  const info = BOTOES.find((b) => b.tipo === tipo)!
  const formas = formasEmUso(cfg?.formas, moeda)
  const moedas = [principal, ...(cfg?.moedasAtivas ?? []).filter((m) => m !== principal)]
  const repetir = async () => {
    if (tipo === 'pagamento') return
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
  const podeLancar = !!valor && (tipo !== 'pagamento' || !!pessoaId)
  const salvar = async () => {
    if (!podeLancar) return
    const ok =
      tipo === 'pagamento'
        ? await executar('registrarAcerto', { id, pessoaId: pessoaId!, direcao: 'paguei', valor: valor!, moeda, forma, descricao: descricao || undefined }, t('Lançado.'))
        : await executar(
            'lancarCaixa',
            { id, tipo, moeda, forma, valor: valor!, descricao: descricao.trim() || (tipo === 'despesa' ? categoria : ''), categoria: tipo === 'despesa' ? categoria || undefined : undefined, localId: tipo === 'despesa' ? localId || undefined : undefined, socioId: tipo === 'retirada' ? socioId || undefined : undefined },
            t('Lançado.'),
          )
    if (ok) onFechar()
  }
  const chip = (ativo: boolean) => cx('min-h-10 rounded-full border px-3 text-sm font-semibold', ativo ? 'border-[var(--marca)] bg-[var(--marca)] text-white' : 'border-[var(--borda)] bg-[var(--cartao)]')
  return (
    <Janela
      aberta
      titulo={`${info.icone} ${t(info.nome)}`}
      onFechar={fechar}
      rodape={
        <Botao grande className="w-full" disabled={ocupado || !podeLancar} onClick={salvar}>
          {t('Lançar')}
        </Botao>
      }
    >
      <div className="space-y-4">
        {/* trocar o tipo sem fechar */}
        <div className="flex gap-1 overflow-x-auto pb-1" role="radiogroup" aria-label={t('Tipo')}>
          {BOTOES.map((b) => (
            <button key={b.tipo} type="button" role="radio" aria-checked={b.tipo === tipo} onClick={() => setTipo(b.tipo)} className={cx(chip(b.tipo === tipo), 'shrink-0 whitespace-nowrap')}>
              {b.icone} {t(b.nome)}
            </button>
          ))}
        </div>
        {data !== hoje && <p className="rounded-xl bg-[var(--alerta)]/10 p-2 text-sm text-[var(--alerta)]">{t('Entra no caixa de hoje ({d}).', { d: dataCurta(hoje) })}</p>}

        <div className="[&_input]:min-h-14 [&_input]:text-2xl [&_input]:font-black">
          <Campo rotulo="Quanto?">
            <ValorInput moeda={moeda} valor={valor} onChange={setValor} />
          </Campo>
        </div>
        {moedas.length > 1 && (
          <div className="flex flex-wrap gap-1" role="radiogroup" aria-label={t('Moeda')}>
            {moedas.map((m) => (
              <button key={m} type="button" role="radio" aria-checked={m === moeda} onClick={() => (setMoeda(m), setForma('dinheiro'))} className={chip(m === moeda)}>
                {moedaDe(m).simbolo}
              </button>
            ))}
          </div>
        )}

        <div>
          <div className="mb-1 text-sm font-semibold text-[var(--suave)]">{t('Forma')}</div>
          <div className="flex flex-wrap gap-1" role="radiogroup" aria-label={t('Forma')}>
            {formas.map((f) => (
              <button key={f.id} type="button" role="radio" aria-checked={f.id === forma} onClick={() => setForma(f.id)} className={chip(f.id === forma)}>
                {f.vivo ? '💵' : '🏦'} {t(f.nome)}
              </button>
            ))}
          </div>
        </div>

        {tipo === 'pagamento' && (
          <div>
            <SeletorPessoa rotulo="Para quem?" valor={pessoaId} onChange={setPessoaId} />
            <p className="mt-1 text-xs text-[var(--suave)]">{t('Sai do caixa e abate o que você deve a ela (conta da pessoa).')}</p>
          </div>
        )}

        {tipo === 'despesa' && (
          <div>
            <div className="mb-1 text-sm font-semibold text-[var(--suave)]">{t('Com o quê?')}</div>
            <div className="flex flex-wrap gap-1">
              {CATEGORIAS_DESPESA.map((c) => (
                <button key={c} type="button" aria-pressed={categoria === c} onClick={() => setCategoria(categoria === c ? '' : c)} className={chip(categoria === c)}>
                  {t(c)}
                </button>
              ))}
            </div>
          </div>
        )}

        <Campo rotulo={tipo === 'dar' ? 'Para quem / para quê? (opcional)' : 'Descrição (opcional)'}>
          <Entrada value={descricao} onChange={(e) => setDescricao(e.target.value)} placeholder={t(tipo === 'dar' ? 'Ex.: vale para a Chico' : tipo === 'despesa' ? 'Ex.: conta de luz de outubro' : 'Ex.: Luz, transporte, Chico…')} />
        </Campo>

        {tipo === 'despesa' && !!locais?.length && (
          <Campo rotulo="Unidade" ajuda="Despesa de um salão entra no custo dele (Equipe e unidades).">
            <Selecao valor={localId} onChange={setLocalId} vazio="Geral" opcoes={locais.map((l) => ({ id: l.id, nome: l.nome }))} />
          </Campo>
        )}
        {tipo === 'retirada' && !!cfg?.socios.length && (
          <Campo rotulo="Retirada de qual sócia?" ajuda="Abate da parte dela na divisão do lucro (Relatórios › Resultado).">
            <Selecao valor={socioId} onChange={setSocioId} vazio="Não é de sócia" opcoes={cfg.socios.map((s) => ({ id: s.id, nome: s.nome }))} />
          </Campo>
        )}

        {tipo !== 'pagamento' && (
          <Botao variante="leve" onClick={repetir}>
            ⟳ {t('Repetir o último')}
          </Botao>
        )}
      </div>
    </Janela>
  )
}
