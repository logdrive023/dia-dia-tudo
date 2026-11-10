// AUDITORIA (#/auditoria · menu Gestão · só administrador) — o log do sistema, BRUTO, para conferir o que foi feito.
// A tela só organiza as peças:
//   · os números do período (ações · hoje · quem agiu · recusadas — tocar filtra)
//   · o FILTRO PADRÃO: a área em abas com o número, busca (texto, código, id — consulta quando a pessoa para de
//     digitar), 📅 período, 👤 quem (TODOS os usuários cadastrados) e, no ⚙, a ação exata e a planilha
//   · a lista separada POR DIA ("Hoje", "Ontem", "seg 08/11"), uma linha por ação (components/LinhaAuditoria)
//   · tocar numa linha abre o DETALHE (components/DetalheAuditoria)
// Estado e filtros: hooks/useAuditoria · contas e nomes: model/auditoria · regra: core/services/auditoria.ts
import { useCallback, useMemo, useState } from 'react'
import type { RefAuditoria } from '../../../core/services/auditoria'
import { dataLocal } from '../../../core/domain/datas'
import { Campo, Carregando, Selecao, Titulo, Vazio } from '../../../shared/ui/base'
import { useApp } from '../../../shared/ui/contexto'
import { BotaoEscolha, FiltroLista, GrupoFiltro, VazioFiltro } from '../../../shared/ui/filtroPadrao'
import { useT } from '../../../shared/ui/i18n'
import { useListaVirtual } from '../../../shared/ui/listaVirtual'
import { GrupoNumeros, NumeroGrande } from '../../../shared/ui/numeroGrande'
import { AreaPaginada, Paginacao } from '../../../shared/ui/paginacao'
import { DetalheAuditoria } from '../components/DetalheAuditoria'
import { LinhaAuditoria } from '../components/LinhaAuditoria'
import { useAuditoria } from '../hooks/useAuditoria'
import { comecaDia, diaDaAcao, rotuloDia } from '../model/auditoria'

const SUBTITULO = 'Tudo o que foi feito no sistema, por quem e quando — com as referências. Só o administrador vê.'

export function Auditoria() {
  const t = useT()
  const { ir } = useApp()
  const { dados, linhas, pag, ativos, limpar, exportar, filtros: f, filtrando } = useAuditoria()
  const [aberto, setAberto] = useState<string>()
  // estimativa = a altura média medida de uma linha no celular (≈ 130 px): a lista não "pula" ao rolar
  const virtual = useListaVirtual(pag.itens.length, { estimativa: 132 })
  const abrirRef = useCallback((r: RefAuditoria) => ir(r.tela, r.params), [ir])
  // quantas ações em cada dia (o número no cabeçalho do dia conta a lista filtrada inteira, não só a página)
  const porDia = useMemo(() => {
    const m = new Map<string, number>()
    for (const l of linhas) m.set(diaDaAcao(l.em), (m.get(diaDaAcao(l.em)) ?? 0) + 1)
    return m
  }, [linhas])
  const hoje = dataLocal()

  // a 1ª resposta ainda não chegou: só o cabeçalho (os números, as abas e a lista chegam juntos — a tela não pula)
  if (!dados) return <div><Titulo subtitulo={t(SUBTITULO)}>{t('Auditoria')}</Titulo><Carregando /></div>
  return (
    <div>
      <Titulo subtitulo={t(SUBTITULO)}>{t('Auditoria')}</Titulo>
      <GrupoNumeros colunas={4}>
        <NumeroGrande rotulo="Ações" valor={dados.noPeriodo} icone="📜" sub={t(f.de || f.ate ? 'no período' : 'desde sempre')} onClick={limpar} />
        <NumeroGrande rotulo="Hoje" valor={dados.hoje} icone="⏱" onClick={() => f.setPeriodo(hoje, hoje)} ativo={f.de === hoje && f.ate === hoje} />
        <NumeroGrande rotulo="Quem agiu" valor={dados.agiram} icone="👥" sub={t('de {n} usuário(s)', { n: dados.usuarios.filter((u) => u.perfil).length })} />
        <NumeroGrande rotulo="Recusadas" valor={dados.recusadas} icone="⛔" tom={dados.recusadas ? 'ruim' : undefined} ativo={f.area === 'recusa'} onClick={() => f.setArea(f.area === 'recusa' ? '' : 'recusa')}
          ajuda="Tentativas que o sistema não deixou fazer (sem permissão, saldo, regra do negócio). Ficam registradas com o motivo." />
      </GrupoNumeros>
      <FiltroLista
        className="mb-3"
        situacao={{ valor: f.area, onChange: (v) => f.setArea(v as typeof f.area), opcoes: [{ id: '', nome: 'Tudo', n: dados.categorias.reduce((s, c) => s + c.n, 0) }, ...dados.categorias.map((c) => ({ id: c.id, nome: `${c.icone} ${t(c.nome)}`, n: c.n, tom: c.id === 'recusa' ? ('alerta' as const) : undefined }))] }}
        busca={f.busca} onBusca={f.setBusca} placeholder="Buscar texto, código ou id"
        periodo={{ de: f.de, ate: f.ate, onChange: f.setPeriodo }}
        extra={<BotaoEscolha icone="👤" rotulo="Quem" valor={f.usuarioId} onChange={f.setUsuarioId} opcoes={[{ id: '', nome: 'Todos os usuários' }, ...dados.usuarios.map((u) => ({
          id: u.id,
          nome: u.nome,
          sub: [t(u.perfil === 'admin' ? 'Administrador' : u.perfil ? 'Funcionário' : 'Sistema'), u.ativo === false ? t('inativo') : '', u.n ? t('{n} ação(ões)', { n: u.n }) : t('nenhuma ação no período')].filter(Boolean).join(' · '),
        }))]} />}
        painel={
          <GrupoFiltro titulo="Ação" icone="⚡">
            <Campo rotulo="Ação exata"><Selecao valor={f.acao} onChange={f.setAcao} vazio="Todas as ações" opcoes={dados.acoes.map((a) => ({ id: a.id, nome: `${t(a.nome)} (${a.n})` }))} /></Campo>
          </GrupoFiltro>
        }
        exportar={{ onExportar: exportar, quantos: linhas.length, unidade: 'ação(ões)' }}
        ativos={ativos} onTirar={(k) => (k === 'usuarioId' ? f.setUsuarioId('') : f.setAcao(''))} onLimpar={limpar}
        temAtivos={filtrando}
        resultados={dados.total} total={dados.noPeriodo} unidade="ação(ões)"
      />
      {!dados.noPeriodo ? <Vazio texto="Nada registrado ainda." /> : !linhas.length ? <VazioFiltro filtrando onLimpar={limpar} /> : (
        <>
          <AreaPaginada pag={pag}>
            <ul ref={virtual.ref} style={virtual.estilo} className="overflow-hidden rounded-2xl border border-[var(--borda)] bg-[var(--cartao)] shadow-sm">
              {virtual.fatia(pag.itens).map(({ item: l, indice }) => {
                const novoDia = comecaDia(pag.itens, indice)
                const d = novoDia ? rotuloDia(diaDaAcao(l.em), hoje) : undefined
                return (
                  <li ref={virtual.medir} data-index={indice} key={l.id} className={indice > 0 && !novoDia ? 'border-t border-[var(--borda)]' : undefined}>
                    <LinhaAuditoria l={l} dia={d && { texto: d.traduzir ? t(d.texto) : d.texto, n: porDia.get(diaDaAcao(l.em)) ?? 0 }} onAbrir={setAberto} onRef={abrirRef} />
                  </li>
                )
              })}
            </ul>
          </AreaPaginada>
          <div className="mt-3"><Paginacao {...pag} unidade="ação(ões)" /></div>
        </>
      )}
      {aberto && <DetalheAuditoria id={aberto} onFechar={() => setAberto(undefined)} onAbrir={(r) => (setAberto(undefined), abrirRef(r))} onOutro={setAberto} />}
    </div>
  )
}
