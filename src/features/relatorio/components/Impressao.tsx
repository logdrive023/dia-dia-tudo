// IMPRESSÃO DO RELATÓRIO — a feature exclusiva de imprimir: a PRÉVIA em folhas A4 (o que se vê é o que sai), com
//   · a escolha do que vai no papel (resumo, impostos, conferência, cada anexo)
//   · cabeçalho em toda folha (empresa · NIT · título · período · moeda), páginas numeradas no rodapé (CSS @page)
//   · o resumo (resultado + balanço) na 1ª folha, com as FIRMAS (Contador · Representante legal) — padrão boliviano
//   · cada parte começa numa folha nova; tabelas longas quebram sem cortar linha
// "Imprimir / salvar PDF" usa a impressão do navegador (no celular: Compartilhar → Imprimir → Salvar PDF).
import { useEffect, useState } from 'react'
import { Botao, dataBR } from '../../../shared/ui/base'
import { useT } from '../../../shared/ui/i18n'
import { ConteudoSecao, type IdSecao, SECOES, tituloSecao } from './conteudo'
import { type Relatorio, TEXTO } from './pecas'

export function Impressao({ rel, onFechar }: { rel: Relatorio; onFechar(): void }) {
  const t = useT()
  const x = TEXTO[rel.pais]
  // as firmas no fim: vem da configuração (Fiscal › Relatório impresso) e dá para tirar/pôr só nesta impressão
  const [comFirmas, setComFirmas] = useState(rel.empresa.firmas !== false)
  const [marcadas, setMarcadas] = useState<Set<IdSecao>>(new Set(['resultado', 'balanco', 'impostos', 'conferencia', 'diario', 'vendas', 'compras', 'gastos', 'inventario', 'cuentas']))
  // Esc fecha; a página por baixo não rola
  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === 'Escape' && onFechar()
    document.addEventListener('keydown', k)
    document.body.classList.add('imprimindo-relatorio')
    return () => (document.removeEventListener('keydown', k), document.body.classList.remove('imprimindo-relatorio'))
  }, [onFechar])
  const alternar = (id: IdSecao) => setMarcadas((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n })
  const lista = SECOES.filter((s) => marcadas.has(s.id))
  // 1ª folha: resultado + balanço (o resumo) com as firmas; depois uma folha por parte
  const resumo = lista.filter((s) => s.id === 'resultado' || s.id === 'balanco')
  const resto = lista.filter((s) => s.id !== 'resultado' && s.id !== 'balanco')
  const cabecalho = (
    <header className="mb-5 border-b-2 border-black pb-3 text-center">
      <p className="text-[15px] font-black uppercase tracking-wide">{rel.empresa.nome}</p>
      <p className="text-[10px]">{[rel.empresa.nit && `${x.nit} ${rel.empresa.nit}`, rel.empresa.atividade, rel.empresa.endereco].filter(Boolean).join(' · ')}</p>
      <p className="mt-1.5 text-[13px] font-bold">{rel.titulo}</p>
      <p className="text-[10px]">{x.periodo.replace('{de}', dataBR(rel.de)).replace('{ate}', dataBR(rel.ate))} · {x.expresado(rel.moeda)} · {x.regime}: {rel.regimeNome}</p>
    </header>
  )
  const firmas = !comFirmas ? null : (
    <div className="mt-16 grid grid-cols-2 gap-10 text-center text-[11px] print:break-inside-avoid">
      <div><div className="mx-auto mb-1 w-48 border-t border-black" />{rel.empresa.contador || '…'}<br /><b>{x.contador}</b></div>
      <div><div className="mx-auto mb-1 w-48 border-t border-black" />{rel.empresa.representante || '…'}<br /><b>{x.representante}</b></div>
    </div>
  )
  const rodape = <p className="mt-6 text-[9px] text-black/60">{x.gerado.replace('{d}', new Date(rel.geradoEm).toLocaleString(rel.pais === 'BO' ? 'es-BO' : 'pt-BR')).replace('{q}', rel.geradoPor ?? '')}</p>
  return (
    <div className="impressao-relatorio fixed inset-0 z-50 overflow-y-auto bg-[#525659] print:static print:overflow-visible print:bg-white">
      {/* a barra (não sai no papel): o que imprimir e o botão */}
      <div className="nao-imprimir sticky top-0 z-10 flex flex-wrap items-center gap-2 border-b border-black/20 bg-[var(--cartao)] px-3 py-2 shadow">
        <b className="mr-auto">🖨 {t('Vista previa')}</b>
        <div className="order-last flex basis-full flex-wrap gap-1">
          {SECOES.map((s) => (
            <button key={s.id} type="button" aria-pressed={marcadas.has(s.id)} onClick={() => alternar(s.id)}
              className={`min-h-9 rounded-full px-2.5 text-xs font-semibold ring-1 ${marcadas.has(s.id) ? 'bg-[var(--marca)] text-white ring-[var(--marca)]' : 'bg-[var(--cartao)] text-[var(--suave)] ring-[var(--borda)]'}`}>
              {marcadas.has(s.id) ? '✓ ' : ''}{s.icone} {tituloSecao(s.id, rel)}
            </button>
          ))}
          <button type="button" aria-pressed={comFirmas} onClick={() => setComFirmas(!comFirmas)}
            className={`min-h-9 rounded-full px-2.5 text-xs font-semibold ring-1 ${comFirmas ? 'bg-[var(--marca)] text-white ring-[var(--marca)]' : 'bg-[var(--cartao)] text-[var(--suave)] ring-[var(--borda)]'}`}>
            {comFirmas ? '✓ ' : ''}✍️ {t('Firmas')}
          </button>
        </div>
        <Botao variante="secundario" onClick={onFechar}>{t('Fechar')}</Botao>
        <Botao disabled={!lista.length} onClick={() => window.print()}>🖨 {t('Imprimir / salvar PDF')}</Botao>
      </div>

      {/* as folhas A4 (na tela: papel branco com sombra; no papel: as páginas) */}
      <div className="mx-auto flex flex-col items-center gap-6 py-6 print:block print:p-0">
        {resumo.length > 0 && (
          <article className="folha-a4">
            {cabecalho}
            {resumo.map((s) => (
              <section key={s.id} className="mb-6">
                <h2 className="mb-2 border-b border-black/30 pb-1 text-[12px] font-bold uppercase tracking-wide">{tituloSecao(s.id, rel)}</h2>
                <div className="relatorio-papel"><ConteudoSecao id={s.id} rel={rel} impressao /></div>
              </section>
            ))}
            {firmas}
            {rodape}
          </article>
        )}
        {resto.map((s) => (
          <article key={s.id} className="folha-a4">
            {cabecalho}
            <h2 className="mb-2 border-b border-black/30 pb-1 text-[12px] font-bold uppercase tracking-wide">{s.anexo ? `${x.anexos} · ` : ''}{tituloSecao(s.id, rel)}</h2>
            <div className="relatorio-papel"><ConteudoSecao id={s.id} rel={rel} impressao /></div>
            {rodape}
          </article>
        ))}
        {!lista.length && <p className="text-white">{t('Escolha o que imprimir.')}</p>}
      </div>
    </div>
  )
}
