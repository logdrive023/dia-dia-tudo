// RELATÓRIOS contábeis e gerenciais: resultado (DRE) e divisão entre sócias, livro caixa, inventário, balanço,
// vendas e compras linha a linha, contas, e o LOG de tudo (filtra por usuário e período). CSV e imprimir/PDF.

import { useState } from 'react'
import { formatar } from '../core/domain/dinheiro'
import { Abas, Botao, Carregando, Cartao, Entrada, Selecao, Titulo, Vazio, cx, dataBR, gramasTexto } from '../ui/base'
import { useApp, useConsulta } from '../ui/contexto'
import { SeletorPeriodo, usePeriodo } from '../ui/filtros'
import { useT } from '../ui/i18n'

/** CSV com ";" (abre direto no Excel em pt/es) e proteção contra fórmula maliciosa (=, +, -, @ no começo). */
export function baixarCSV(nome: string, linhas: Record<string, string | number>[]) {
  if (!linhas.length) return
  const cols = Object.keys(linhas[0])
  const esc = (v: string | number) => {
    if (typeof v === 'number') return String(v).replace('.', ',')
    let s = String(v ?? '')
    if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`
    return /[;"\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
  }
  const csv = '﻿' + [cols.join(';'), ...linhas.map((l) => cols.map((c) => esc(l[c])).join(';'))].join('\n')
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }))
  const a = document.createElement('a')
  a.href = url
  a.download = `${nome}.csv`
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

const RELATORIOS = [
  { id: 'dre', nome: 'Resultado e sócias' },
  { id: 'caixa', nome: 'Livro caixa' },
  { id: 'vendas', nome: 'Vendas' },
  { id: 'compras', nome: 'Compras' },
  { id: 'inventario', nome: 'Inventário' },
  { id: 'balanco', nome: 'Balanço' },
  { id: 'log', nome: 'Log (quem fez o quê)' },
]

export function Relatorios() {
  const t = useT()
  const { nav } = useApp()
  const [rel, setRel] = useState((nav.params.relatorio as string) ?? 'dre')
  const [periodo, setPeriodo] = usePeriodo('rel.periodo', 'mes')
  return (
    <div>
      <Titulo acao={<Botao variante="secundario" className="nao-imprimir" onClick={() => window.print()}>🖨️ {t('Imprimir / PDF')}</Botao>}>{t('Relatórios')}</Titulo>
      <div className="nao-imprimir">
        <Abas atual={rel} onChange={setRel} abas={RELATORIOS} />
        {rel !== 'inventario' && rel !== 'balanco' && <div className="mb-3"><SeletorPeriodo periodo={periodo} onChange={setPeriodo} /></div>}
      </div>
      <p className="mb-2 hidden text-sm print:block">{t(RELATORIOS.find((r) => r.id === rel)!.nome)} · {dataBR(periodo.de)} – {dataBR(periodo.ate)}</p>
      {rel === 'dre' && <Dre de={periodo.de} ate={periodo.ate} />}
      {rel === 'caixa' && <Livro de={periodo.de} ate={periodo.ate} />}
      {rel === 'vendas' && <VendasDet de={periodo.de} ate={periodo.ate} />}
      {rel === 'compras' && <ComprasDet de={periodo.de} ate={periodo.ate} />}
      {rel === 'inventario' && <Inventario />}
      {rel === 'balanco' && <Balanco />}
      {rel === 'log' && <Log de={periodo.de} ate={periodo.ate} usuarioInicial={nav.params.usuarioId as string | undefined} />}
    </div>
  )
}

function Dre({ de, ate }: { de: string; ate: string }) {
  const t = useT()
  const { dados } = useConsulta('dre', { de, ate })
  if (!dados) return <Carregando />
  const m = dados.moeda
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Cartao titulo={t('Resultado do período')} acao={<Botao variante="leve" className="nao-imprimir" onClick={() => baixarCSV('resultado', dados.linhas.map((l) => ({ conta: l.conta, valor: l.valor / 100 })))}>CSV</Botao>} ajuda="Receita − custo do que foi vendido − comissões = lucro bruto; − despesas = resultado.">
        <table className="w-full text-sm">
          <tbody>
            {dados.linhas.map((l, i) => (
              <tr key={i} className={cx('border-t border-[var(--borda)]', l.nivel === 0 && 'font-bold')}>
                <td className={cx('py-1', l.nivel === 1 && 'pl-4')}>{t(l.conta)}</td>
                <td className={cx('num text-right', l.valor < 0 && 'text-[var(--ruim)]')}>{formatar(l.valor, m)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="mt-2 text-sm text-[var(--suave)]">{dados.vendas} {t('vendas')} · {t('margem')} {(dados.margem / 100).toLocaleString('pt-BR')}%</p>
      </Cartao>
      <Cartao titulo={t('Divisão entre sócias')} ajuda="Resultado × parte de cada uma − o que já retirou = quanto falta acertar (o “÷ 2” do caderno).">
        {!dados.socios.length ? <Vazio texto="Cadastre as sócias em Configurações." /> : (
          <table className="w-full text-sm">
            <thead><tr className="text-left text-xs text-[var(--suave)]"><th>{t('Sócia')}</th><th className="text-right">{t('Parte')}</th><th className="text-right">{t('Retirou')}</th><th className="text-right">{t('Falta acertar')}</th></tr></thead>
            <tbody>
              {dados.socios.map((s) => (
                <tr key={s.id} className="border-t border-[var(--borda)]">
                  <td className="py-1">{s.nome} ({s.parteBp / 100}%)</td>
                  <td className="num text-right">{formatar(s.parte, m)}</td>
                  <td className="num text-right">{formatar(s.retirou, m)}</td>
                  <td className={cx('num text-right font-bold', s.falta < 0 && 'text-[var(--ruim)]')}>{formatar(s.falta, m)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Cartao>
    </div>
  )
}

function Livro({ de, ate }: { de: string; ate: string }) {
  const t = useT()
  const { dados } = useConsulta('livroCaixa', { de, ate })
  if (!dados) return <Carregando />
  if (!dados.length) return <Vazio texto="Sem movimento no período." />
  return (
    <div className="space-y-4">
      {dados.map((l) => (
        <Cartao key={l.moeda} titulo={`${t('Livro caixa')} · ${l.moeda}`} acao={<Botao variante="leve" className="nao-imprimir" onClick={() => baixarCSV(`livro-caixa-${l.moeda}`, l.linhas.map((x) => ({ data: x.data, descricao: x.descricao, forma: x.forma, entrada: x.entrada / 100, saida: x.saida / 100, saldo: x.saldo / 100 })))}>CSV</Botao>}>
          <p className="mb-2 text-sm">{t('Saldo inicial')} <b className="num">{formatar(l.inicial, l.moeda)}</b> · {t('entradas')} <b className="num text-[var(--bom)]">{formatar(l.entradas, l.moeda)}</b> · {t('saídas')} <b className="num text-[var(--ruim)]">{formatar(l.saidas, l.moeda)}</b> · {t('final')} <b className="num">{formatar(l.final, l.moeda)}</b></p>
          <div className="max-h-[60vh] overflow-auto print:max-h-none">
            <table className="w-full text-sm">
              <thead><tr className="text-left text-xs text-[var(--suave)]"><th>{t('Data')}</th><th>{t('Descrição')}</th><th className="text-right">{t('Entrada')}</th><th className="text-right">{t('Saída')}</th><th className="text-right">{t('Saldo')}</th></tr></thead>
              <tbody>{l.linhas.map((x, i) => <tr key={i} className="border-t border-[var(--borda)]"><td className="whitespace-nowrap py-1">{dataBR(x.data)}</td><td>{x.descricao} <span className="text-xs text-[var(--suave)]">· {t(x.forma)}</span></td><td className="num text-right text-[var(--bom)]">{x.entrada ? formatar(x.entrada, l.moeda) : ''}</td><td className="num text-right text-[var(--ruim)]">{x.saida ? formatar(x.saida, l.moeda) : ''}</td><td className="num text-right">{formatar(x.saldo, l.moeda)}</td></tr>)}</tbody>
            </table>
          </div>
        </Cartao>
      ))}
    </div>
  )
}

function VendasDet({ de, ate }: { de: string; ate: string }) {
  const t = useT()
  const { ir } = useApp()
  const { dados } = useConsulta('vendasDetalhadas', { de, ate })
  if (!dados) return <Carregando />
  const total = dados.reduce((s, l) => s + l.totalPrincipal, 0)
  const lucro = dados.reduce((s, l) => s + l.lucro, 0)
  return (
    <Cartao titulo={`${t('Vendas linha a linha')} · ${formatar(total, 'BOB')} · ${t('lucro')} ${formatar(lucro, 'BOB')}`} acao={<Botao variante="leve" className="nao-imprimir" onClick={() => baixarCSV('vendas-detalhadas', dados.map((l) => ({ data: l.data, cliente: l.cliente, lote: l.lote, descricao: l.descricao, medida: l.medida, categoria: l.categoria, quantidade: l.quantidade, fator: l.fator, total: l.total / 100, moeda: l.moeda, total_principal: l.totalPrincipal / 100, custo: l.custo / 100, lucro: l.lucro / 100 })))}>CSV</Botao>}>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead><tr className="text-left text-xs text-[var(--suave)]"><th>{t('Data')}</th><th>{t('Cliente')}</th><th>{t('Lote')}</th><th>{t('Conta')}</th><th className="text-right">{t('Total')}</th><th className="text-right">{t('Lucro')}</th></tr></thead>
          <tbody>{dados.map((l, i) => (
            <tr key={i} className="cursor-pointer border-t border-[var(--borda)] hover:bg-[var(--marca-suave)]" onClick={() => ir('venda', { id: l.vendaId })}>
              <td className="whitespace-nowrap py-1">{dataBR(l.data)}</td><td>{l.cliente}</td><td className="font-mono text-xs">{l.lote}</td>
              <td className="num">{l.fator ? `${l.medida} | ${l.quantidade.toLocaleString('pt-BR')} × ${l.fator}` : `${l.descricao} × ${l.quantidade}`}</td>
              <td className="num text-right">{formatar(l.total, l.moeda)}</td><td className={cx('num text-right', l.lucro < 0 && 'text-[var(--ruim)]')}>{formatar(l.lucro, 'BOB')}</td>
            </tr>
          ))}</tbody>
        </table>
      </div>
    </Cartao>
  )
}

function ComprasDet({ de, ate }: { de: string; ate: string }) {
  const t = useT()
  const { ir } = useApp()
  const { dados } = useConsulta('comprasDetalhadas', { de, ate })
  if (!dados) return <Carregando />
  return (
    <Cartao titulo={t('Compras linha a linha')} acao={<Botao variante="leve" className="nao-imprimir" onClick={() => baixarCSV('compras', dados.map((l) => ({ data: l.data, fornecedor: l.fornecedor, etapa: l.etapa, descricao: l.descricao, quantidade: l.quantidade, total: l.total / 100, moeda: l.moeda })))}>CSV</Botao>}>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead><tr className="text-left text-xs text-[var(--suave)]"><th>{t('Data')}</th><th>{t('Fornecedor')}</th><th>{t('Item')}</th><th className="text-right">{t('Quantidade')}</th><th className="text-right">{t('Total')}</th><th>{t('Etapa')}</th></tr></thead>
          <tbody>{dados.map((l, i) => <tr key={i} className="cursor-pointer border-t border-[var(--borda)] hover:bg-[var(--marca-suave)]" onClick={() => ir('comprar', { id: l.compraId })}><td className="py-1">{dataBR(l.data)}</td><td>{l.fornecedor}</td><td>{l.descricao}</td><td className="num text-right">{gramasTexto(l.quantidade)}</td><td className="num text-right">{formatar(l.total, l.moeda)}</td><td>{t(l.etapa)}</td></tr>)}</tbody>
        </table>
      </div>
    </Cartao>
  )
}

function Inventario() {
  const t = useT()
  const { ir } = useApp()
  const { dados } = useConsulta('inventario', {})
  if (!dados) return <Carregando />
  return (
    <Cartao titulo={`${t('Inventário a custo')} · ${formatar(dados.valor, 'BOB')}`} acao={<Botao variante="leve" className="nao-imprimir" onClick={() => baixarCSV('inventario', dados.linhas.map((l) => ({ codigo: l.codigo, nome: l.nome, quantidade: l.quantidade, unidade: l.unidade, valor_custo: l.valorCusto / 100, desde: l.desde })))}>CSV</Botao>}>
      <table className="w-full text-sm">
        <thead><tr className="text-left text-xs text-[var(--suave)]"><th>{t('Código')}</th><th>{t('Item')}</th><th className="text-right">{t('Quantidade')}</th><th className="text-right">{t('Custo')}</th></tr></thead>
        <tbody>{dados.linhas.map((l) => <tr key={l.id} className="cursor-pointer border-t border-[var(--borda)]" onClick={() => ir('lote', { id: l.id })}><td className="font-mono text-xs">{l.codigo}</td><td className="py-1">{l.nome}</td><td className="num text-right">{l.unidade === 'grama' ? gramasTexto(l.quantidade) : l.quantidade}</td><td className="num text-right">{formatar(l.valorCusto, 'BOB')}</td></tr>)}</tbody>
      </table>
    </Cartao>
  )
}

function Balanco() {
  const t = useT()
  const { ir } = useApp()
  const { dados } = useConsulta('balanco', {})
  if (!dados) return <Carregando />
  const m = dados.moeda
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <Cartao titulo={t('O que o negócio tem')}>
        <table className="w-full text-sm"><tbody>{dados.ativos.map((a) => <tr key={a.conta} className="border-t border-[var(--borda)]"><td className="py-1">{t(a.conta)}{'moeda' in a && a.moeda !== m ? <span className="text-xs text-[var(--suave)]"> ({formatar(a.detalhe!, a.moeda!)})</span> : null}</td><td className="num text-right">{formatar(a.valor, m)}</td></tr>)}<tr className="border-t-2 font-bold"><td>{t('Total')}</td><td className="num text-right">{formatar(dados.totalAtivos, m)}</td></tr></tbody></table>
      </Cartao>
      <Cartao titulo={t('O que o negócio deve')}>
        <table className="w-full text-sm"><tbody>{dados.passivos.map((a) => <tr key={a.conta} className="border-t border-[var(--borda)]"><td className="py-1">{t(a.conta)}</td><td className="num text-right">{formatar(a.valor, m)}</td></tr>)}<tr className="border-t-2 font-bold"><td>{t('Total')}</td><td className="num text-right">{formatar(dados.totalPassivos, m)}</td></tr></tbody></table>
      </Cartao>
      <Cartao titulo={t('Patrimônio (tem − deve)')} className="md:col-span-2"><div className="num text-3xl font-black">{formatar(dados.patrimonio, m)}</div></Cartao>
      <Cartao titulo={t('Quem me deve')}>
        <ul className="text-sm">{dados.devedores.map((d) => <li key={d.pessoaId} className="flex justify-between border-t border-[var(--borda)] py-1"><button type="button" className="underline" onClick={() => ir('pessoa', { id: d.pessoaId })}>{d.nome}</button><span className="num">{formatar(d.saldo, m)}</span></li>)}</ul>
      </Cartao>
      <Cartao titulo={t('A quem eu devo')}>
        <ul className="text-sm">{dados.credores.map((d) => <li key={d.pessoaId} className="flex justify-between border-t border-[var(--borda)] py-1"><button type="button" className="underline" onClick={() => ir('pessoa', { id: d.pessoaId })}>{d.nome}</button><span className="num">{formatar(-d.saldo, m)}</span></li>)}</ul>
      </Cartao>
    </div>
  )
}

function Log({ de, ate, usuarioInicial }: { de: string; ate: string; usuarioInicial?: string }) {
  const t = useT()
  const [usuarioId, setUsuarioId] = useState(usuarioInicial ?? '')
  const [acao, setAcao] = useState('')
  const [busca, setBusca] = useState('')
  const { dados } = useConsulta('logDetalhado', { de, ate, usuarioId: usuarioId || undefined, acao: acao || undefined, busca: busca || undefined })
  const { dados: todos } = useConsulta('logDetalhado', { limite: 0 })
  return (
    <Cartao titulo={`${t('Log')} · ${dados?.total ?? 0} ${t('ações')}`} ajuda="Toda ação fica registrada com quem fez e quando. Filtre por pessoa e período: “o que a funcionária fez do dia X ao Y”." acao={dados && <Botao variante="leve" className="nao-imprimir" onClick={() => baixarCSV('log', dados.linhas.map((l) => ({ quando: l.criadoEm, quem: l.usuarioNome ?? l.criadoPor, acao: l.nomeAcao, detalhe: l.resumo })))}>CSV</Botao>}>
      <div className="nao-imprimir mb-3 flex flex-wrap gap-2">
        <Selecao className="w-auto" valor={usuarioId} onChange={setUsuarioId} vazio="Todos os usuários" opcoes={todos?.usuarios ?? []} />
        <Selecao className="w-auto" valor={acao} onChange={setAcao} vazio="Todas as ações" opcoes={(todos?.acoes ?? []).map((a) => ({ id: a.id, nome: t(a.nome) }))} />
        <Entrada className="w-auto flex-1" placeholder={t('Buscar')} value={busca} onChange={(e) => setBusca(e.target.value)} />
      </div>
      {!dados ? <Carregando /> : !dados.linhas.length ? <Vazio texto="Nada no log com esse filtro." /> : (
        <ul className="divide-y divide-[var(--borda)] text-sm">
          {dados.linhas.map((l) => (
            <li key={l.id} className="py-2">
              <div className="text-xs text-[var(--suave)]">{new Date(l.criadoEm).toLocaleString('pt-BR')} · <b>{l.usuarioNome ?? l.criadoPor}</b></div>
              <div><b>{t(l.nomeAcao)}</b> · {l.resumo}</div>
            </li>
          ))}
        </ul>
      )}
    </Cartao>
  )
}
