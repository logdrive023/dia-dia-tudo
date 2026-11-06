// NOVA COMPRA › UMA LINHA: medida/item, peso, valor (por tabela, por grama ou total), moeda e cotação, atributos
// e o que falta. Fechada vira uma linha curta que abre no lugar. Recebe o estado do formulário pronto (useNovaCompra).
import { formatar, fatorValido } from '../../../core/domain/dinheiro'
import { fatorDaTabela } from '../../../core/services/precos'
import { CATEGORIAS_CABELO } from '../../../core/areas/cabelo'
import { Campo, Entrada, Info, Selecao, cx, gramasTexto, loc } from '../../../shared/ui/base'
import { LinhaCotacao, PesoInput, ValorMoedaInput, cotacaoSistema } from '../../../shared/ui/valorMoeda'
import { CamposDinamicos, resumoCampos } from '../../../shared/ui/camposDinamicos'
import { CAMPOS_FIXOS, type LinhaNova } from '../model/linhaNova'
import type { EstadoNovaCompra } from '../hooks/useNovaCompra'

export function LinhaCompra({ nc, l, i }: { nc: EstadoNovaCompra; l: LinhaNova; i: number }) {
  const { form, t, cfgCampo, visivel, ehCabelo, moeda, tentou, attrAbertos, setAttrAbertos, linhaAberta, setLinhaAberta, linhas, setLinhas, att, cotCompra, moedasValor, moedaDig, textoCot, attValor, catalogo, tabela, camposTipo, extras, col, fatorDaLinha, totalLinha, descLinha, faltasLinha,} = nc
  const fator = l.modo === 'tabela' ? fatorDaLinha(l) : undefined
  const fatorTabela = tabela && l.medida && col ? fatorDaTabela(tabela, l.medida, col).fator : undefined
  const tl = totalLinha(l)
  const faltam = faltasLinha(l, i)
  const tocado = tentou || !!l.quantidade || !!l.total || !!l.medida
  const resumoAttr = resumoCampos(camposTipo, l.campos, CAMPOS_FIXOS)
  const mostrarAttr = l.modo !== 'item' && extras.length > 0 && (visivel('atributos') || extras.some((c) => c.obrigatorio))
  const attrAberto = attrAbertos.has(l.id) || (visivel('atributos') && !!cfgCampo('atributos')?.aberto && !attrAbertos.has(`-${l.id}`)) || (tentou && faltam.some((x) => x.includes('(')))
  const alternarAttr = () => {
    const s = new Set(attrAbertos)
    if (attrAberto) (s.delete(l.id), s.add(`-${l.id}`))
    else (s.add(l.id), s.delete(`-${l.id}`))
    setAttrAbertos(s)
  }
  const mDig = moedaDig(l)
  const outraMoeda = l.modo !== 'tabela' && mDig !== moeda
  const campoValor = (rotulo: string) => (
    <Campo rotulo={rotulo} ajuda={moedasValor.length > 1 ? 'Pagou em outra moeda? Toque no símbolo dentro do campo (Bs → US$ → R$): converte pela cotação de compra. Ex.: US$ 100 × 6,96 = Bs 696,00.' : undefined}>
      <ValorMoedaInput rotulo={rotulo} moeda={mDig} moedas={moedasValor} valor={l.digitado} onChange={(v) => attValor(i, { digitado: v })} onMoeda={(m) => attValor(i, { moedaDig: m === moeda ? undefined : m, cotacao: undefined })} />
    </Campo>
  )
  const tirar = linhas.length > 1 && <button type="button" className="ml-auto h-11 w-11 shrink-0 rounded-xl text-xl text-[var(--suave)] hover:bg-[var(--ruim)]/10 hover:text-[var(--ruim)]" aria-label={t('Tirar a linha {n}', { n: i + 1 })} onClick={() => setLinhas(linhas.filter((_, k) => k !== i))}>×</button>
  const numero = <span aria-label={t('Linha {n}', { n: i + 1 })} className="num flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[var(--marca-suave)] text-xs font-bold text-[var(--marca)]">{i + 1}</span>
  // várias linhas: só a aberta mostra os campos; as outras ficam numa linha (tocar abre)
  const aberta = linhas.length < 2 || (linhaAberta ?? linhas[linhas.length - 1].id) === l.id
  if (!aberta)
    return (
      <button key={l.id} type="button" aria-expanded={false} onClick={() => setLinhaAberta(l.id)} className={cx('flex min-h-12 w-full items-center gap-2 rounded-xl border bg-[var(--cartao)] px-2.5 text-left text-sm', tentou && faltam.length ? 'border-[var(--ruim)]/60' : 'border-[var(--borda)]')}>
        <span aria-hidden className={cx('num flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold', faltam.length ? 'bg-[var(--marca-suave)] text-[var(--marca)]' : 'bg-[var(--bom)] text-white')}>{faltam.length ? i + 1 : '✓'}</span>
        <span className="min-w-0 flex-1 truncate font-semibold">{descLinha(l)}</span>
        <span className="num shrink-0">{ehCabelo ? gramasTexto(l.quantidade ?? 0) : l.quantidade ?? 0} · <b className={cx(!!l.campos.semValor && 'text-[var(--alerta)]')}>{l.campos.semValor ? t('sem valor') : tl !== undefined ? formatar(tl, moeda) : '—'}</b></span>
        <span aria-hidden className="shrink-0 text-[var(--suave)]">›</span>
      </button>
    )
  return (
    <div key={l.id} className={cx('space-y-3 rounded-xl border bg-[var(--cartao)] p-2.5 sm:p-3', tentou && faltam.length ? 'border-[var(--ruim)]/60' : 'border-[var(--borda)]')}>
      {l.modo === 'item' ? (
        <div className="flex items-end gap-2">
          <span className="mb-2">{numero}</span>
          <Campo rotulo="Produto" className="min-w-0 flex-1">
            <Selecao valor={l.itemId} onChange={(v) => att(i, { itemId: v || undefined })} vazio="Escolha…" opcoes={(catalogo ?? []).map((x) => ({ id: x.id, nome: x.nome }))} />
          </Campo>
          {tirar}
        </div>
      ) : (
        <div className="flex items-center gap-2">
          {numero}
          {ehCabelo && (
            <div role="radiogroup" aria-label={t('Como veio')} className="flex min-w-0 flex-1 gap-1 rounded-xl bg-[var(--marca-suave)] p-1 sm:flex-none">
              {(['bruto', 'tabela'] as const).map((m) => (
                <button key={m} type="button" role="radio" aria-checked={l.modo === m} onClick={() => attValor(i, { modo: m })} className={cx('min-h-9 flex-1 whitespace-nowrap rounded-lg px-3 text-sm font-semibold sm:flex-initial', l.modo === m ? 'bg-[var(--cartao)] text-[var(--marca)] shadow' : 'text-[var(--suave)]')}>
                  {t(m === 'bruto' ? 'Bruto' : 'Pela tabela')}
                </button>
              ))}
            </div>
          )}
          {ehCabelo && <Info texto="Bruto: veio tudo junto, separa depois. Pela tabela: já veio separado por medida. Ex.: 10 kg bruto · ou · 60 cm | 2 kg × 17,5." />}
          {tirar}
        </div>
      )}

      {l.modo === 'tabela' && (
        <div>
          <span className="mb-1 block text-sm font-semibold text-[var(--suave)]">{t('Medida (cm)')}</span>
          <div className="flex flex-wrap items-center gap-1.5">
            {form.medidas.map((m) => (
              <button key={m} type="button" aria-pressed={l.medida === m} onClick={() => att(i, { medida: m })} className={cx('num min-h-11 min-w-11 rounded-xl border px-2 text-sm font-bold', l.medida === m ? 'border-[var(--marca)] bg-[var(--marca)] text-white' : 'border-[var(--borda)] hover:border-[var(--marca)]')}>
                {m}
              </button>
            ))}
            <Entrada aria-label={t('Outra medida (cm)')} inputMode="numeric" className="num w-20" placeholder={t('outra')} value={l.medida && !form.medidas.includes(l.medida) ? l.medida : ''} onChange={(e) => att(i, { medida: Number(e.target.value.replace(/\D/g, '')) || undefined })} />
          </div>
        </div>
      )}

      {l.modo === 'item' ? (
        <div className="grid grid-cols-[5.5rem_minmax(0,1fr)] items-end gap-2 sm:grid-cols-[6rem_minmax(0,1fr)_minmax(0,0.8fr)]">
          <Campo rotulo="Qtd">
            <Entrada aria-label={t('Quantidade')} inputMode="numeric" className="num" placeholder="1" value={l.quantidade ?? ''} onChange={(e) => attValor(i, { quantidade: Number(e.target.value.replace(/\D/g, '')) || undefined })} />
          </Campo>
          {campoValor('Custo unitário')}
          <div className="col-span-2 flex items-center justify-between gap-2 rounded-xl bg-[var(--fundo)] px-3 sm:col-span-1 sm:block sm:bg-transparent sm:px-0">
            <span className="text-sm font-semibold text-[var(--suave)] sm:mb-1 sm:block">{t('Total')}</span>
            <span className={cx('num flex min-h-11 items-center justify-end text-base font-black sm:rounded-xl sm:bg-[var(--fundo)] sm:px-3', tl === undefined && 'text-[var(--suave)]')} aria-live="polite">{tl !== undefined ? formatar(tl, moeda) : '—'}</span>
          </div>
        </div>
      ) : (
        <div className={cx('grid grid-cols-2 items-end gap-2', l.modo === 'tabela' && 'sm:grid-cols-3')}>
          {l.modo === 'tabela' && (
            <Campo rotulo="Categoria" className="col-span-2 sm:col-span-1">
              <Selecao valor={String(l.campos.categoria ?? 'Normal')} onChange={(v) => att(i, { campos: { ...l.campos, categoria: v } })} opcoes={CATEGORIAS_CABELO.map((c) => ({ id: c, nome: c }))} />
            </Campo>
          )}
          <Campo rotulo={ehCabelo ? 'Peso' : 'Quantidade'} ajuda={ehCabelo ? 'O peso total que veio, mesmo misturado. Toque no g para digitar em kg. Ex.: 10 kg bruto da Maria.' : undefined}>
            {ehCabelo ? <PesoInput rotulo="Peso" valor={l.quantidade} onChange={(q) => attValor(i, { quantidade: q })} /> : <Entrada inputMode="numeric" value={l.quantidade ?? ''} onChange={(e) => attValor(i, { quantidade: Number(e.target.value.replace(/\D/g, '')) || undefined })} />}
          </Campo>
          {l.modo === 'tabela' ? (
            <Campo rotulo="Fator">
              <Entrada inputMode="decimal" className={cx('num', l.fator?.trim() && !fatorValido(l.fator) && 'border-[var(--ruim)]')} value={l.fator ?? ''} placeholder={fatorTabela ?? l.fatorAntigo ?? '?'} onChange={(e) => att(i, { fator: e.target.value })} />
            </Campo>
          ) : (
            campoValor('Valor total')
          )}
        </div>
      )}

      {outraMoeda && (
        <LinhaCotacao moeda={mDig} principal={moeda} texto={textoCot(l)} sistema={cotacaoSistema(mDig, moeda, cotCompra)} resultado={tl} onChange={(c) => attValor(i, { cotacao: c })} />
      )}

      {l.modo === 'tabela' && (l.medida || l.quantidade) ? (
        <p className={cx('num break-words text-xl font-black leading-tight sm:text-2xl', tl === undefined && 'text-[var(--suave)]')} aria-live="polite">
          {l.medida ?? '?'} | {l.quantidade ? l.quantidade.toLocaleString(loc()) : '?'} × {fator ?? '?'} = {tl !== undefined ? formatar(tl, moeda) : '?'}
        </p>
      ) : null}
      {l.modo === 'tabela' && !l.fator?.trim() && !fatorTabela && l.fatorAntigo && <p className="text-xs text-[var(--suave)]">{t('Fator da compra repetida (a tabela não tem esta medida).')}</p>}
      {ehCabelo && l.quantidade && tl ? (
        <p className="num text-right text-sm text-[var(--suave)]">
          = <b className="text-[var(--texto)]">{formatar(Math.round(tl / l.quantidade), moeda)}/g</b> · {formatar(Math.round((tl * 1000) / l.quantidade), moeda)}/kg
        </p>
      ) : null}

      {/* SEM VALOR desta linha (as outras da mesma compra podem ter): registra só o peso; o valor vem depois no pedido */}
      <label className={cx('flex min-h-11 cursor-pointer items-center gap-2 rounded-xl px-2 py-1 text-sm', l.campos.semValor ? 'bg-[var(--alerta)]/10 font-semibold text-[var(--alerta)]' : 'text-[var(--suave)]')}>
        <input type="checkbox" className="h-5 w-5" checked={!!l.campos.semValor} onChange={(e) => att(i, { campos: { ...l.campos, semValor: e.target.checked || undefined, ...(e.target.checked ? { jaPaga: undefined } : {}) } })} />
        <span className="min-w-0 flex-1">{t('Esta linha ainda não tem valor (pôr depois)')}</span>
        <Info texto="Marque só a linha que ainda não tem preço; as outras da mesma compra seguem com o valor. Ex.: 20 kg a Bs 30.000 + 10 kg sem preço → a compra fica com Bs 30.000 e a pendência Sem valor. Depois, no pedido: ✎ Pôr o valor na linha — o custo vai para os pacotes, mesmo já separados." />
      </label>

      {/* JÁ PAGA (esta linha): registra e pronto — não precisa abrir o pedido depois para dizer que pagou */}
      <label className={cx('flex min-h-11 cursor-pointer items-center gap-2 rounded-xl px-2 py-1 text-sm', l.campos.jaPaga ? 'bg-[var(--bom)]/10 font-semibold text-[var(--bom)]' : 'text-[var(--suave)]')}>
        <input type="checkbox" className="h-5 w-5 accent-[var(--bom)]" checked={!!l.campos.jaPaga} onChange={(e) => att(i, { campos: { ...l.campos, jaPaga: e.target.checked || undefined, ...(e.target.checked ? { semValor: undefined } : {}) } })} />
        <span className="min-w-0 flex-1">{t('Esta linha já está paga')}</span>
        <Info texto="Marque a linha que já foi paga: registra e pronto, sem entrar no pedido depois para dizer que pagou. Vale linha por linha. Ex.: 3 linhas, a 1ª paga na hora em dinheiro e as outras 2 a pagar → marque só a 1ª: o valor dela sai do caixa agora e o pedido fica em aberto só com o resto. Todas marcadas → o pedido já entra pago e concluído. Também serve para só catalogar o cabelo que já foi pago antes." />
      </label>

      {mostrarAttr && (
        <div className="rounded-xl bg-[var(--fundo)]">
          <button type="button" aria-expanded={attrAberto} onClick={alternarAttr} className="flex min-h-11 w-full items-center gap-2 px-3 text-left text-sm">
            <span aria-hidden className="text-xs">{attrAberto ? '▾' : '▸'}</span>
            <b className="shrink-0">{t('Atributos')}</b>
            <span className="min-w-0 truncate text-[var(--suave)]">{resumoAttr.length ? resumoAttr.map((x) => x.valor).join(' · ') : t('nenhum')}</span>
          </button>
          {attrAberto && <div className="px-3 pb-3"><CamposDinamicos campos={camposTipo} valores={l.campos} pular={CAMPOS_FIXOS} onChange={(v) => att(i, { campos: v })} /></div>}
        </div>
      )}
      {tocado && faltam.length > 0 && (tentou || l.quantidade) ? <p data-falta={tentou ? '' : undefined} className={cx('text-xs font-semibold', tentou ? 'text-[var(--ruim)]' : 'text-[var(--suave)]')}>{t('Falta')}: {faltam.map((x) => x.replace(` ${t('da linha {n}', { n: i + 1 })}`, '')).join(', ')}</p> : null}
    </div>
  )
}
