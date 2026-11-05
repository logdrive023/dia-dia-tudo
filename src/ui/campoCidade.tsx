// CAMPO DE CIDADE — o componente único de escolher cidade (formulário da viagem, filtro de viagem, onde mais precisar):
//   [ 📍 Oruro                                   ✕ ]
//   ┌ [Todos] [La Paz] [Cochabamba] [Santa Cruz] [Oruro] … (departamentos: um toque mostra só as dele) ┐
//   │ ⭐ Oruro                                          Oruro   │
//   │    Caracollo                                      Oruro   │
//   │ + Cadastrar “Vila X” (a cidade não está na lista)          │
//   └────────────────────────────────────────────────────────────┘
// A busca ignora acento e maiúscula ("potosi" acha "Potosí"; "cocha" acha Cochabamba e as do departamento).
// Nome repetido em dois departamentos (Totora, San Pedro…) fica gravado com o departamento: "Totora · Oruro".
// A lista abre NO LUGAR (empurra o que vem embaixo): no celular nada fica cortado dentro do cartão do passo.
// As cidades vêm do servidor (consulta "cidades": as 340 da Bolívia + as cadastradas). Com `opcoes`, só aquelas
// (ex.: no filtro, só os destinos que as viagens têm).

import { type KeyboardEvent, useEffect, useId, useMemo, useRef, useState } from 'react'
import { DEPARTAMENTOS_BOLIVIA, semAcento, textoCidade } from '../core/dados/cidadesBolivia'
import { novoId } from '../core/domain/ids'
import { cx } from './base'
import { useComando, useConsulta } from './contexto'
import { useT } from './i18n'

interface Opcao { texto: string; nome: string; departamento?: string; capital?: boolean; extra?: boolean }

const MAX = 60

function Marcado({ texto, busca }: { texto: string; busca: string }) {
  const b = semAcento(busca)
  const i = b ? semAcento(texto).indexOf(b) : -1
  if (i < 0) return <>{texto}</>
  return <>{texto.slice(0, i)}<mark className="rounded bg-[var(--marca-suave)] px-0.5 text-[var(--marca)]">{texto.slice(i, i + b.length)}</mark>{texto.slice(i + b.length)}</>
}

export function CampoCidade({ valor, onChange, opcoes, permitirNovo = true, rotulo = 'Cidade', placeholder = 'Buscar cidade (ex.: Oruro)', compacto, autoFocus }: {
  valor: string
  onChange(texto: string): void
  /** só estas (textos já gravados); sem isso: todas as cidades cadastradas */
  opcoes?: string[]
  /** mostra "+ Cadastrar" quando não acha */
  permitirNovo?: boolean
  rotulo?: string
  placeholder?: string
  /** a versão pequena (filtro) */
  compacto?: boolean
  autoFocus?: boolean
}) {
  const t = useT()
  const idLista = useId()
  const caixa = useRef<HTMLDivElement>(null)
  const campo = useRef<HTMLInputElement>(null)
  const { dados } = useConsulta('cidades', {})
  const { executar, ocupado } = useComando()
  const [aberta, setAberta] = useState(false)
  const [busca, setBusca] = useState('')
  const [depto, setDepto] = useState('')
  const [destaque, setDestaque] = useState(-1)
  const [novoDepto, setNovoDepto] = useState<string>()

  // as opções: todas as cidades (texto gravado = nome, ou "nome · departamento" se o nome se repete)
  const todas = useMemo<Opcao[]>(() => {
    const cs = dados ?? []
    const base = cs.map((c) => ({ texto: textoCidade(c, cs), nome: c.nome, departamento: c.departamento, capital: c.capital, extra: c.extra }))
    if (!opcoes) return base
    const porTexto = new Map(base.map((o) => [o.texto, o]))
    return [...new Set(opcoes)].map((s) => porTexto.get(s) ?? { texto: s, nome: s })
  }, [dados, opcoes])
  const deptos = DEPARTAMENTOS_BOLIVIA.filter((d) => todas.some((o) => o.departamento === d))
  // poucas opções (ex.: no filtro, 2 destinos): só a lista — departamentos e contagem só ajudam na lista grande
  const muitas = todas.length > 12

  const b = semAcento(busca)
  const achados = todas
    .filter((o) => (!depto || o.departamento === depto) && (!b || semAcento(`${o.nome} ${o.departamento ?? ''}`).includes(b)))
    .map((o) => ({ o, comeca: Number(semAcento(o.nome).startsWith(b)) }))
    .sort((x, y) => (b ? y.comeca - x.comeca : 0) || Number(!!y.o.capital) - Number(!!x.o.capital) || x.o.nome.localeCompare(y.o.nome, 'es'))
    .map((x) => x.o)
  // sem busca e sem departamento: as capitais primeiro (as mais procuradas), depois o resto em ordem
  const lista = achados.slice(0, MAX)
  const exato = !!b && todas.some((o) => semAcento(o.nome) === b)
  const podeNovo = permitirNovo && !opcoes && busca.trim().length >= 2 && !exato

  useEffect(() => setDestaque(-1), [busca, depto])
  useEffect(() => {
    if (!aberta) return
    const fora = (e: PointerEvent) => { if (!caixa.current?.contains(e.target as Node)) fechar() }
    document.addEventListener('pointerdown', fora)
    return () => document.removeEventListener('pointerdown', fora)
  }, [aberta])

  const fechar = () => (setAberta(false), setBusca(''), setDepto(''), setNovoDepto(undefined))
  const escolher = (texto: string) => (onChange(texto), fechar(), campo.current?.blur())
  const cadastrar = async () => {
    const r = await executar('salvarCidade', { id: novoId(), nome: busca.trim(), departamento: novoDepto || undefined, pais: 'Bolívia' }, t('Cidade cadastrada.'))
    if (r) escolher(textoCidade({ nome: r.nome, departamento: novoDepto || undefined }, [...(dados ?? []), { nome: r.nome }]))
  }
  const teclar = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape') return (e.preventDefault(), fechar())
    if (e.key === 'ArrowDown' && lista.length) return (e.preventDefault(), setAberta(true), setDestaque((d) => (d + 1) % lista.length))
    if (e.key === 'ArrowUp' && lista.length) return (e.preventDefault(), setDestaque((d) => (d <= 0 ? lista.length - 1 : d - 1)))
    if (e.key === 'Enter') {
      e.preventDefault()
      const o = lista[destaque >= 0 ? destaque : 0]
      if (o && (destaque >= 0 || b)) escolher(o.texto)
    }
  }

  return (
    <div ref={caixa} className="relative scroll-mt-24">
      <div className={cx('flex items-center gap-2 rounded-xl border bg-[var(--cartao)] px-3 focus-within:border-[var(--marca)] focus-within:ring-2 focus-within:ring-[var(--marca)]/30', compacto ? 'min-h-9 rounded-full' : 'min-h-11', valor && compacto ? 'border-sky-500/50 bg-sky-500/10' : 'border-[var(--borda)]')}>
        <span aria-hidden className="text-[var(--suave)]">📍</span>
        <input
          ref={campo}
          type="search"
          role="combobox"
          aria-label={t(rotulo)}
          aria-expanded={aberta}
          aria-controls={idLista}
          aria-activedescendant={destaque >= 0 ? `${idLista}-${destaque}` : undefined}
          autoComplete="off"
          spellCheck={false}
          autoFocus={autoFocus}
          placeholder={valor || t(placeholder)}
          value={aberta ? busca : valor}
          // celular: o teclado sobe e a lista ficava atrás da barra de baixo → leva o campo para o alto da tela
          onFocus={() => (setAberta(true), setTimeout(() => caixa.current?.scrollIntoView?.({ block: 'start', behavior: 'smooth' }), 300))}
          onChange={(e) => (setBusca(e.target.value), setAberta(true))}
          onKeyDown={teclar}
          className={cx('min-w-0 flex-1 bg-transparent outline-none focus-visible:outline-none', aberta && valor ? 'placeholder:text-[var(--texto)] placeholder:opacity-60' : 'placeholder:text-[var(--suave)] placeholder:opacity-70', compacto ? 'text-sm font-semibold' : 'text-base')}
        />
        {valor && !aberta && (
          <button type="button" aria-label={t('Limpar cidade')} onClick={() => onChange('')} className="-mr-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[var(--suave)] hover:text-[var(--ruim)]">✕</button>
        )}
      </div>

      {aberta && (
        <div className="relative z-30 mt-1 overflow-hidden rounded-2xl border border-[var(--borda)] bg-[var(--cartao)] shadow-lg">
          {/* os departamentos: um toque mostra só as cidades dele (achar sem saber escrever) */}
          {muitas && deptos.length > 1 && (
            <div className="flex gap-1.5 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden border-b border-[var(--borda)] bg-[var(--fundo)] px-2 py-2" aria-label={t('Departamento')}>
              {['', ...deptos].map((d) => (
                <button key={d || 'todos'} type="button" aria-pressed={depto === d} onClick={() => setDepto(d)}
                  className={cx('min-h-8 shrink-0 rounded-full px-3 text-xs font-semibold ring-1', depto === d ? 'bg-[var(--marca)] text-white ring-[var(--marca)]' : 'bg-[var(--cartao)] ring-[var(--borda)] hover:ring-[var(--marca)]')}>
                  {d || t('Todos')}
                </button>
              ))}
            </div>
          )}
          {!dados ? <p className="px-3 py-3 text-sm text-[var(--suave)]">{t('Carregando…')}</p> : (
            <>
              {muitas && <p className="num flex flex-wrap justify-between gap-x-2 px-3 pt-2 text-xs text-[var(--suave)]">
                <span>{achados.length > lista.length ? t('{n} de {total} · continue digitando', { n: lista.length, total: achados.length }) : t('{n} cidade(s)', { n: achados.length })}</span>
                {!b && !depto && <span>⭐ {t('capitais primeiro')}</span>}
              </p>}
              {lista.length > 0 && (
                <ul id={idLista} role="listbox" aria-label={t(rotulo)} className="max-h-[min(20rem,50vh)] overflow-y-auto overscroll-contain py-1">
                  {lista.map((o, k) => (
                    <li key={o.texto} id={`${idLista}-${k}`} role="option" aria-selected={o.texto === valor}>
                      <button type="button" onMouseEnter={() => setDestaque(k)} onClick={() => escolher(o.texto)}
                        className={cx('flex min-h-10 w-full items-center gap-2 px-3 text-left text-sm', k === destaque ? 'bg-[var(--marca-suave)]' : 'hover:bg-[var(--marca-suave)]', o.texto === valor && 'font-bold')}>
                        <span aria-hidden className="w-4 shrink-0 text-xs">{o.capital ? '⭐' : o.texto === valor ? '✓' : ''}</span>
                        <span className="min-w-0 flex-1 truncate"><Marcado texto={o.nome} busca={busca} /></span>
                        {o.extra && <span className="shrink-0 rounded-full bg-[var(--fundo)] px-2 text-[10px] font-semibold text-[var(--suave)]">{t('cadastrada')}</span>}
                        {o.departamento && <span className="shrink-0 text-xs text-[var(--suave)]">{o.departamento}</span>}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              {!lista.length && <p className="px-3 pb-3 pt-1 text-sm text-[var(--suave)]">{t('Nenhuma cidade com “{b}”.', { b: busca.trim() })}</p>}
            </>
          )}
          {/* não achou: cadastra (vai para o cadastro e já fica escolhida) */}
          {podeNovo && (
            <div className="border-t border-[var(--borda)] bg-[var(--fundo)] p-2">
              {novoDepto === undefined ? (
                <button type="button" onClick={() => setNovoDepto(depto)} className="flex min-h-10 w-full items-center gap-2 rounded-xl px-2 text-left text-sm font-semibold text-[var(--marca)] hover:bg-[var(--marca-suave)]">
                  + {t('Cadastrar “{b}”', { b: busca.trim() })}<span className="font-normal text-[var(--suave)]">· {t('não está na lista')}</span>
                </button>
              ) : (
                <div className="space-y-2 px-1">
                  <p className="text-sm font-semibold">{t('Cadastrar “{b}” — de qual departamento?', { b: busca.trim() })}</p>
                  <div className="flex flex-wrap gap-1.5">
                    {[...DEPARTAMENTOS_BOLIVIA, ''].map((d) => (
                      <button key={d || 'fora'} type="button" aria-pressed={novoDepto === d} onClick={() => setNovoDepto(d)}
                        className={cx('min-h-8 rounded-full px-3 text-xs font-semibold ring-1', novoDepto === d ? 'bg-[var(--marca)] text-white ring-[var(--marca)]' : 'bg-[var(--cartao)] ring-[var(--borda)]')}>
                        {d || t('Sem departamento')}
                      </button>
                    ))}
                  </div>
                  <div className="flex justify-end gap-2">
                    <button type="button" onClick={() => setNovoDepto(undefined)} className="min-h-10 rounded-xl px-3 text-sm font-semibold text-[var(--suave)]">{t('Cancelar')}</button>
                    <button type="button" disabled={ocupado} onClick={cadastrar} className="min-h-10 rounded-xl bg-[var(--marca)] px-4 text-sm font-semibold text-white disabled:opacity-50">{t('Cadastrar e usar')}</button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
