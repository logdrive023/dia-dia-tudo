// CÓDIGOS: como a compra e o lote são identificados. Dois padrões: CUSTOMIZÁVEL (por pessoa M1/C1, da compra M1-1,
// manual — nunca repete um código que já existe) e INCREMENTAL (1, 2, 3 ou P-0001). Prévia ao vivo dos próximos
// códigos, tabela de siglas por pessoa e a explicação com exemplos. Mudar a regra não muda os códigos já dados.

import { useEffect, useMemo, useState } from 'react'
import type { Id } from '../core/domain/tipos'
import type { ModoCompra, ModoLote, RegrasCodigos, Sequencia } from '../core/services/codigos'
import { Botao, Campo, Carregando, Cartao, Entrada, ErroTela, Pilula, Selecao, cx } from '../ui/base'
import { useApp, useAvisoSaida, useComando, useConsulta } from '../ui/contexto'
import { useT } from '../ui/i18n'

type Rascunho = Omit<RegrasCodigos, 'siglas'>

const MODOS_COMPRA: { id: ModoCompra; nome: string; ajuda: string; exemplo: string }[] = [
  { id: 'incremental', nome: 'Incremental', ajuda: 'Um número que sobe sozinho. Com prefixo (P-0001) ou sem (1, 2, 3).', exemplo: 'P-0001, P-0002 · 1, 2, 3' },
  { id: 'porPessoa', nome: 'Por pessoa', ajuda: 'Sigla da pessoa + a sequência dela. Maria → M1, M2; Celso → C1.', exemplo: 'M1, M2, C1' },
  { id: 'manual', nome: 'Manual', ajuda: 'Digita-se o código em cada compra. O sistema sugere o próximo incremental e não deixa repetir.', exemplo: 'HELENA-OUT, 2026-15' },
]

const MODOS_LOTE: { id: ModoLote; nome: string; ajuda: string; exemplo: string }[] = [
  { id: 'incremental', nome: 'Incremental', ajuda: 'Um número que sobe sozinho, igual para todos os lotes.', exemplo: 'L-0001, L-0002 · 1, 2, 3' },
  { id: 'daCompra', nome: 'Da compra', ajuda: 'O lote leva o código da compra. Separado: o código do lote-mãe + letra. Juntado: as compras com "+".', exemplo: 'M1-1 → M1-1a, M1-1b · M1+C3-1' },
  { id: 'manual', nome: 'Manual', ajuda: 'Digita-se o código de cada lote (na entrada, na separação e ao juntar). Sugere o próximo incremental.', exemplo: 'CX-07, PRETO-60' },
]

const PAPEL: Record<string, string> = { fornecedor: 'Fornecedor', doadora: 'Doadora', funcionario: 'Funcionária', profissional: 'Profissional', socio: 'Sócia', cliente: 'Cliente', devedor: 'Devedor', credor: 'Credor' }

const CASAS = [0, 2, 3, 4, 5, 6].map((n) => ({ id: String(n), nome: n ? `${n} (${'0'.repeat(n - 1)}1)` : 'sem zeros (1)' }))

const igual = (a?: Rascunho, b?: Rascunho) => JSON.stringify(a) === JSON.stringify(b)

export function ConfigCodigos() {
  const t = useT()
  const { sessao } = useApp()
  const admin = sessao.perfil === 'admin'
  const [rasc, setRasc] = useState<Rascunho>()
  const [exemploId, setExemploId] = useState<Id>()
  const { dados, erro } = useConsulta('codigos', { rascunho: rasc, pessoaId: exemploId }, admin)
  const { executar, ocupado } = useComando()
  const salvo = useMemo<Rascunho | undefined>(() => (dados ? { compra: dados.regras.compra, lote: dados.regras.lote, triagem: dados.regras.triagem, venda: dados.regras.venda } : undefined), [dados])
  const atual = rasc ?? salvo
  const mudou = !!rasc && !igual(rasc, salvo)
  useAvisoSaida(mudou)
  if (!admin) return <p className="text-sm text-[var(--suave)]">{t('Só o administrador muda os códigos.')}</p>
  if (erro) return <ErroTela texto={erro} onVoltar={() => history.back()} />
  if (!dados || !atual) return <Carregando />
  const mudar = <K extends keyof Rascunho>(k: K, v: Partial<Rascunho[K]>) => setRasc({ ...atual, [k]: { ...atual[k], ...v } })
  const salvar = async () => {
    const r = await executar('salvarCodigos', atual, t('Códigos salvos. Valem para as próximas compras e lotes.'))
    if (r) setRasc(undefined)
  }
  const pv = dados.previa
  return (
    <div className="space-y-4">
      <Cartao>
        <p className="text-sm">{t('Todo código é único: ao digitar um que já existe, o sistema diz qual registro já usa. Mudar a regra vale para o que for criado depois; os códigos que já existem não mudam (e quem tiver o código trocado continua sendo achado pelo antigo).')}</p>
      </Cartao>

      {/* COMPRA */}
      <Cartao titulo={`🛒 ${t('Compras')}`}>
        <div className="space-y-3">
          <OpcoesModo opcoes={MODOS_COMPRA} valor={atual.compra.modo} onChange={(modo) => mudar('compra', { modo })} nome="modo-compra" />
          {atual.compra.modo === 'porPessoa' && (
            <Campo rotulo="Sigla de quem?">
              <Selecao valor={atual.compra.base} onChange={(v) => mudar('compra', { base: v as 'fornecedor' | 'comprador' })} opcoes={[{ id: 'fornecedor', nome: 'Do fornecedor (de quem compro)' }, { id: 'comprador', nome: 'De quem comprou (equipe)' }]} />
            </Campo>
          )}
          <SequenciaCampos
            s={atual.compra}
            onChange={(v) => mudar('compra', v)}
            nota={atual.compra.modo === 'porPessoa' ? t('Usado quando a compra não tem pessoa.') : atual.compra.modo === 'manual' ? t('Usado para sugerir o próximo.') : undefined}
          />
          <Previa rotulo={atual.compra.modo === 'porPessoa' && pv.compraDe ? t('Próximos de {p}', { p: pv.compraDe }) : 'Próximos'} codigos={pv.compra} />
          {atual.compra.modo === 'porPessoa' && dados.pessoas.length > 0 && (
            <Campo rotulo="Ver a prévia de">
              <Selecao valor={exemploId} onChange={(v) => setExemploId(v || undefined)} vazio="Quem mais aparece nas compras" opcoes={dados.pessoas.map((p) => ({ id: p.id, nome: `${p.nome} (${p.sigla})` }))} />
            </Campo>
          )}
        </div>
      </Cartao>

      {/* LOTE */}
      <Cartao titulo={`📦 ${t('Lotes')}`}>
        <div className="space-y-3">
          <OpcoesModo opcoes={MODOS_LOTE} valor={atual.lote.modo} onChange={(modo) => mudar('lote', { modo })} nome="modo-lote" />
          <SequenciaCampos s={atual.lote} onChange={(v) => mudar('lote', v)} nota={atual.lote.modo === 'daCompra' ? t('Usado para lote sem compra ou juntado de mais de 3 compras.') : atual.lote.modo === 'manual' ? t('Usado para sugerir o próximo.') : undefined} />
          <Previa rotulo={atual.lote.modo === 'daCompra' && pv.loteCompra ? t('Próximos da compra {c}', { c: pv.loteCompra }) : 'Próximos'} codigos={pv.lote} />
          {pv.loteSeparado.length > 0 && <Previa rotulo={t('Separando {c}', { c: pv.lote[0] ?? '' })} codigos={pv.loteSeparado} />}
          {atual.lote.modo === 'daCompra' && (
            <ul className="list-disc space-y-1 pl-5 text-sm text-[var(--suave)]">
              <li>{t('Lote da compra M1')}: <b className="font-mono text-[var(--texto)]">M1-1, M1-2</b></li>
              <li>{t('Separado (M1-1 em 3 partes)')}: <b className="font-mono text-[var(--texto)]">M1-1a, M1-1b, M1-1c</b> · {t('separando M1-1a de novo')}: <b className="font-mono text-[var(--texto)]">M1-1a1, M1-1a2</b></li>
              <li>{t('Juntado (compras M1 e C3)')}: <b className="font-mono text-[var(--texto)]">M1+C3-1</b> · {t('juntado de lotes da mesma compra')}: <b className="font-mono text-[var(--texto)]">M1-3</b></li>
            </ul>
          )}
        </div>
      </Cartao>

      {/* TRIAGEM E VENDA */}
      <Cartao titulo={`🧺 ${t('Triagens e vendas')}`} ajuda="Sempre incremental. Ex.: T-0001 para a triagem e V-0001 para a venda; sem prefixo fica 1, 2, 3.">
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <h3 className="text-sm font-bold">{t('Triagem')}</h3>
            <SequenciaCampos s={atual.triagem} onChange={(v) => mudar('triagem', v)} />
            <Previa rotulo="Próximos" codigos={pv.triagem} />
          </div>
          <div className="space-y-2">
            <h3 className="text-sm font-bold">{t('Venda')}</h3>
            <SequenciaCampos s={atual.venda} onChange={(v) => mudar('venda', v)} />
            <Previa rotulo="Próximos" codigos={pv.venda} />
          </div>
        </div>
      </Cartao>

      <div className="sticky bottom-20 z-10 flex flex-wrap items-center justify-end gap-2 rounded-2xl border border-[var(--borda)] bg-[var(--cartao)] p-2 shadow-lg md:bottom-4">
        {mudou && <span className="mr-auto px-2 text-sm text-[var(--alerta)]">{t('Mudanças não salvas')}</span>}
        <Botao variante="leve" disabled={!mudou} onClick={() => setRasc(undefined)}>{t('Desfazer')}</Botao>
        <Botao grande disabled={ocupado || !mudou} onClick={salvar}>{t('Salvar')}</Botao>
      </div>

      <Siglas pessoas={dados.pessoas} destaque={atual.compra.modo === 'porPessoa'} />
    </div>
  )
}

function OpcoesModo<M extends string>({ opcoes, valor, onChange, nome }: { opcoes: { id: M; nome: string; ajuda: string; exemplo: string }[]; valor: M; onChange(m: M): void; nome: string }) {
  const t = useT()
  return (
    <div role="radiogroup" className="grid gap-2 md:grid-cols-3">
      {opcoes.map((o) => (
        <label key={o.id} className={cx('flex min-h-10 cursor-pointer gap-2 rounded-xl border p-3 text-sm', valor === o.id ? 'border-[var(--marca)] bg-[var(--marca-suave)]' : 'border-[var(--borda)] hover:border-[var(--marca)]')}>
          <input type="radio" name={nome} className="mt-0.5 h-5 w-5 shrink-0" checked={valor === o.id} onChange={() => onChange(o.id)} />
          <span className="min-w-0">
            <b className="block">{t(o.nome)}</b>
            <span className="block text-[var(--suave)]">{t(o.ajuda)}</span>
            <span className="mt-1 block font-mono text-xs">{o.exemplo}</span>
          </span>
        </label>
      ))}
    </div>
  )
}

function SequenciaCampos({ s, onChange, nota }: { s: Sequencia; onChange(v: Partial<Sequencia>): void; nota?: string }) {
  return (
    <div>
      <div className="grid grid-cols-2 gap-2 sm:max-w-md">
        <Campo rotulo="Prefixo" ajuda="O que vem antes do número. Vazio = só o número (1, 2, 3).">
          <Entrada value={s.prefixo} maxLength={10} spellCheck={false} className="font-mono" placeholder="—" onChange={(e) => onChange({ prefixo: e.target.value.replace(/\s/g, '') })} />
        </Campo>
        <Campo rotulo="Casas do número">
          <Selecao valor={String(s.digitos)} onChange={(v) => onChange({ digitos: Number(v) })} opcoes={CASAS.some((c) => c.id === String(s.digitos)) ? CASAS : [...CASAS, { id: String(s.digitos), nome: String(s.digitos) }]} />
        </Campo>
      </div>
      {nota && <p className="mt-1 text-xs text-[var(--suave)]">{nota}</p>}
    </div>
  )
}

function Previa({ rotulo, codigos }: { rotulo: string; codigos: string[] }) {
  const t = useT()
  return (
    <p className="flex flex-wrap items-center gap-1 text-sm" aria-live="polite">
      <span className="text-[var(--suave)]">{t(rotulo)}:</span>
      {codigos.length ? codigos.map((c) => <span key={c} className="rounded-lg bg-[var(--marca-suave)] px-2 py-0.5 font-mono font-bold text-[var(--marca)]">{c}</span>) : <span className="text-[var(--ruim)]">{t('confira o prefixo e as casas')}</span>}
      {codigos.length > 0 && <span className="text-[var(--suave)]">…</span>}
    </p>
  )
}

type PessoaSigla = { id: Id; nome: string; papeis: string[]; sigla: string; padrao: boolean; compras: number; sugestoes: string[] }

/** Tabela de siglas: busca, edição na linha (Enter ou sair do campo salva) e aviso na hora quando a sigla já é de alguém. */
function Siglas({ pessoas, destaque }: { pessoas: PessoaSigla[]; destaque: boolean }) {
  const t = useT()
  const [busca, setBusca] = useState('')
  const b = busca.trim().toLowerCase()
  const lista = pessoas.filter((p) => !b || p.nome.toLowerCase().includes(b) || p.sigla.toLowerCase() === b)
  return (
    <Cartao titulo={`🔤 ${t('Siglas por pessoa')}`} ajuda="Usadas no modo por pessoa: sigla + número da pessoa (M1, M2). Cada sigla é de uma pessoa só. A sugerida vem do nome e fica fixa na primeira compra.">
      {!destaque && <p className="mb-2 text-sm text-[var(--suave)]">{t('Só valem com as compras no modo "Por pessoa".')}</p>}
      <Entrada type="search" className="mb-2" placeholder={t('Buscar pessoa ou sigla')} aria-label={t('Buscar pessoa ou sigla')} value={busca} onChange={(e) => setBusca(e.target.value)} />
      {!lista.length ? (
        <p className="text-sm text-[var(--suave)]">{t('Ninguém com esse nome.')}</p>
      ) : (
        <ul className="divide-y divide-[var(--borda)]">
          {lista.map((p) => <LinhaSigla key={p.id} p={p} outras={pessoas.filter((x) => x.id !== p.id)} />)}
        </ul>
      )}
    </Cartao>
  )
}

function LinhaSigla({ p, outras }: { p: PessoaSigla; outras: PessoaSigla[] }) {
  const t = useT()
  const { executar, ocupado } = useComando()
  const [v, setV] = useState(p.sigla)
  useEffect(() => setV(p.sigla), [p.sigla])
  const limpa = v.normalize('NFD').replace(/[̀-ͯ]/g, '').trim().toUpperCase()
  const dono = outras.find((x) => x.sigla === limpa)
  const invalida = !!limpa && !/^[A-Z]{1,5}$/.test(limpa)
  const livres = p.sugestoes.filter((s) => !outras.some((x) => x.sigla === s) && s !== p.sigla)
  const salvar = async (sigla = limpa) => {
    if (sigla === p.sigla || dono || invalida) return
    await executar('salvarSigla', { pessoaId: p.id, sigla }, t('Sigla salva.'))
  }
  return (
    <li className="grid gap-2 py-2 sm:grid-cols-[1fr_auto] sm:items-center">
      <div className="min-w-0">
        <b className="block truncate">{p.nome}</b>
        <span className="text-xs text-[var(--suave)]">{p.papeis.map((x) => t(PAPEL[x] ?? x)).join(', ')}{p.compras ? ` · ${t('{n} compra(s)', { n: p.compras })}` : ''}</span>
      </div>
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <Entrada
            aria-label={`${t('Sigla de')} ${p.nome}`}
            className={cx('w-24 font-mono font-bold uppercase', (dono || invalida) && 'border-[var(--ruim)]')}
            value={v}
            maxLength={5}
            disabled={ocupado}
            onChange={(e) => setV(e.target.value)}
            onBlur={() => salvar()}
            onKeyDown={(e) => e.key === 'Enter' && salvar()}
          />
          {p.padrao && limpa === p.sigla && <Pilula>{t('sugerida')}</Pilula>}
          {!p.padrao && <button type="button" className="min-h-10 px-2 text-xs font-semibold text-[var(--marca)]" disabled={ocupado} onClick={() => salvar('')} title={t('Voltar para a sugerida pelo nome')}>{t('padrão')}</button>}
        </div>
        {dono && <p className="mt-1 text-xs text-[var(--ruim)]">{t('A sigla {s} já é de {p}.', { s: limpa, p: dono.nome })}{livres.length ? ` ${t('Livres')}: ` : ''}{livres.slice(0, 3).map((s) => <button key={s} type="button" className="mx-0.5 rounded bg-[var(--fundo)] px-1.5 font-mono font-bold text-[var(--marca)]" onClick={() => (setV(s), salvar(s))}>{s}</button>)}</p>}
        {invalida && <p className="mt-1 text-xs text-[var(--ruim)]">{t('De 1 a 5 letras (o número é a sequência).')}</p>}
      </div>
    </li>
  )
}
