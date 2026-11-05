// A NOTA DE VENTA no papel — o MESMO desenho na tela (prévia) e na impressão (o que se vê é o que sai).
// Recebe os dados prontos (consulta documentoVenda) e o modelo (dados/documentos.ts); não faz conta nenhuma.
// O papel é sempre em ESPANHOL (é o documento que vai para a cliente na Bolívia) e sempre claro (papel branco),
// mesmo com o sistema em português ou no tema escuro. Diz sempre "sin validez fiscal": não é factura.
import { createPortal } from 'react-dom'
import { useEffect } from 'react'
import { formatar } from '../core/domain/dinheiro'
import { MODELOS_DOCUMENTO, TEXTO_NOTA, type ModeloDocumentoId } from '../core/dados/documentos'
import type { DocumentoVenda } from '../core/services/documentos'
import { cx, dataBR } from './base'
import { traduzir } from './i18n'

const es = (s: string) => traduzir('es', s)
const num = (n: number) => n.toLocaleString('es-BO')
const pct = (bp: number) => `${(bp / 100).toLocaleString('es-BO')}%`

export function NotaVenda({ doc, modelo, includeTaxesInPrint, comDivisao }: { doc: DocumentoVenda; modelo: ModeloDocumentoId; includeTaxesInPrint: boolean; comDivisao?: boolean }) {
  const md = MODELOS_DOCUMENTO[modelo]
  const rolo = md.formato === 'rollo'
  const v = (c: number) => formatar(c, doc.moeda)
  const hora = doc.emitidoEm ? new Date(doc.emitidoEm).toLocaleTimeString('es-BO', { hour: '2-digit', minute: '2-digit', hour12: false }) : ''
  const quando = `${dataBR(doc.data)}${hora ? ` ${hora}` : ''}`
  const marca = doc.situacao === 'cancelado' ? TEXTO_NOTA.anulada : doc.situacao === 'agendado' ? TEXTO_NOTA.pendiente : ''
  const qtd = (l: DocumentoVenda['linhas'][number]) => `${num(l.quantidade)}${rolo ? ` ${l.unidade}` : ''}`
  const comImpostos = includeTaxesInPrint && doc.impostos.linhas.length > 0

  const emisor = (
    <div className={cx(rolo && 'text-center')}>
      <p className={cx('font-black uppercase tracking-wide', rolo ? 'text-[13px]' : 'text-[15px]')}>{doc.emisor.razaoSocial}</p>
      {doc.emisor.nomeComercial && <p className="text-[11px] font-semibold">{doc.emisor.nomeComercial}</p>}
      {doc.emisor.sucursal && <p className="text-[10px]">{doc.emisor.sucursal}</p>}
      {doc.emisor.endereco && <p className="text-[10px]">{doc.emisor.endereco}</p>}
      {doc.emisor.atividade && <p className="text-[10px] italic">{doc.emisor.atividade}</p>}
    </div>
  )
  const dadosDoc = (
    <dl className={cx('grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 text-[11px]', !rolo && 'rounded-md border border-black/70 px-3 py-2')}>
      <dt className="font-bold">NIT</dt><dd className="num">{doc.emisor.nit || '—'}</dd>
      <dt className="font-bold">Nº NOTA</dt><dd className="num font-bold">{doc.numero}</dd>
      <dt className="font-bold">FECHA</dt><dd className="num">{quando}</dd>
    </dl>
  )
  const comprador = (
    <dl className={cx('grid gap-x-3 gap-y-0.5 text-[11px]', rolo ? 'grid-cols-[auto_1fr]' : 'grid-cols-[auto_1fr] sm:grid-cols-[auto_1fr_auto_1fr] print:grid-cols-[auto_1fr_auto_1fr]')}>
      <dt className="font-bold">{rolo ? 'Cliente' : 'Nombre / Razón social'}</dt><dd className="min-w-0 break-words">{doc.comprador.nome || 'S/N'}</dd>
      <dt className="font-bold">NIT / CI / CEX</dt><dd className="num">{doc.comprador.documento || '—'}</dd>
      {!rolo && doc.atendidoPor && <><dt className="font-bold">Atendido por</dt><dd>{doc.atendidoPor}</dd></>}
      {!rolo && doc.comprador.telefone && <><dt className="font-bold">Teléfono</dt><dd className="num">{doc.comprador.telefone}</dd></>}
    </dl>
  )
  const COL: Record<string, { rot: string; cls?: string; cel(l: DocumentoVenda['linhas'][number]): string }> = {
    codigo: { rot: 'Código', cls: 'w-[13%] font-mono', cel: (l) => l.codigo || '—' },
    cantidad: { rot: 'Cant.', cls: 'w-[9%] text-right', cel: qtd },
    unidad: { rot: 'Unidad', cls: 'w-[9%]', cel: (l) => l.unidade },
    descripcion: { rot: 'Descripción', cel: (l) => l.descricao },
    precio: { rot: 'P. unit.', cls: 'w-[12%] whitespace-nowrap text-right', cel: (l) => v(l.precoUnitario) },
    descuento: { rot: 'Desc.', cls: 'w-[11%] whitespace-nowrap text-right', cel: (l) => (l.desconto ? v(l.desconto) : '0,00') },
    subtotal: { rot: 'Subtotal', cls: 'w-[13%] whitespace-nowrap text-right font-semibold', cel: (l) => v(l.subtotal) },
  }
  const linhaTotal = (rot: string, valor: string, forte?: boolean) => (
    <div className={cx('flex justify-between gap-3', forte && 'border-t border-black pt-1 text-[13px] font-black')}><span>{rot}</span><span className="num">{valor}</span></div>
  )

  return (
    <article lang="es" aria-label={`${TEXTO_NOTA.titulo} ${doc.numero}`}
      className={cx('nota-papel relative mx-auto bg-white text-[#111]', rolo ? 'nota-rollo w-[80mm] max-w-full px-3 py-4 font-mono text-[11px]' : 'nota-folha w-full max-w-[210mm] px-4 py-5 text-[12px] sm:px-8 sm:py-8')}>
      {marca && <span aria-hidden className="pointer-events-none absolute inset-0 flex items-center justify-center text-6xl font-black tracking-widest text-black/[0.07] [transform:rotate(-24deg)]">{marca}</span>}

      {/* A. CABEÇALHO: emisor à esquerda, NIT / nº / data num quadro à direita (rolo: tudo centrado, um embaixo do outro) */}
      <header className={cx(rolo ? 'space-y-2 border-b border-dashed border-black pb-2' : 'flex flex-wrap items-start justify-between gap-4 border-b-2 border-black pb-4')}>
        {emisor}
        {dadosDoc}
      </header>
      <div className={cx('text-center', rolo ? 'py-2' : 'py-4')}>
        <h2 className={cx('font-black tracking-[0.2em]', rolo ? 'text-[14px]' : 'text-[20px]')}>{TEXTO_NOTA.titulo}</h2>
        <p className="text-[10px] font-semibold uppercase">({es('Documento comercial — sin validez fiscal')})</p>
      </div>

      {/* B. COMPRADOR */}
      <section className={cx(rolo ? 'border-b border-dashed border-black pb-2' : 'rounded-md bg-black/[0.04] px-3 py-2 print:bg-transparent print:ring-1 print:ring-black/40')}>{comprador}</section>

      {/* C. DETALHE */}
      {/* rolo (e a folha no celular, onde 7 colunas não cabem): um item embaixo do outro. A folha impressa é sempre a tabela */}
      <ul className={cx('space-y-1.5 border-b border-dashed border-black py-2', !rolo && 'mt-3 sm:hidden print:hidden')}>
          {doc.linhas.map((l) => (
            <li key={l.id} className="break-inside-avoid">
              <p className="break-words font-semibold">{l.descricao}</p>
              <p className="num flex justify-between gap-2"><span>{num(l.quantidade)} {l.unidade} × {v(l.precoUnitario)}{l.gramas ? '/g' : ''}</span><span>{v(l.subtotal + l.desconto)}</span></p>
              {l.desconto > 0 && <p className="num flex justify-between gap-2"><span>Descuento</span><span>− {v(l.desconto)}</span></p>}
            </li>
          ))}
        </ul>
      {!rolo && (
        <table className="mt-4 hidden w-full border-collapse text-[11px] sm:table print:table">
          <thead>
            <tr className="border-y-2 border-black text-left">
              {md.colunas.map((c) => <th key={c} scope="col" className={cx('px-1.5 py-1.5 font-bold uppercase', COL[c].cls?.replace(/font-\w+/g, ''))}>{COL[c].rot}</th>)}
            </tr>
          </thead>
          <tbody>
            {doc.linhas.map((l) => (
              <tr key={l.id} className="break-inside-avoid border-b border-black/20 align-top">
                {md.colunas.map((c) => <td key={c} className={cx('num px-1.5 py-1.5', COL[c].cls, c === 'descripcion' && 'break-words')}>{COL[c].cel(l)}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {/* D. TOTAIS: subtotal, descontos, total; por extenso embaixo (como na factura) */}
      <div className={cx('break-inside-avoid', rolo ? 'space-y-0.5 py-2' : 'mt-3 flex flex-wrap items-start justify-between gap-4')}>
        {!rolo && <p className="max-w-[55%] pt-1 text-[11px] italic">{doc.totais.emPalavras}</p>}
        <div className={cx('space-y-0.5 text-[12px]', !rolo && 'ml-auto w-full max-w-[260px]')}>
          {linhaTotal('SUBTOTAL', v(doc.totais.subtotal))}
          {linhaTotal('DESCUENTO', v(doc.totais.descontos))}
          {linhaTotal('TOTAL', v(doc.totais.total), true)}
        </div>
        {rolo && <p className="text-[11px] italic">{doc.totais.emPalavras}</p>}
      </div>

      {/* IMPOSTOS (estimados) — só a apresentação: o total acima é o mesmo com ou sem este quadro */}
      {comImpostos && (
        <section className={cx('break-inside-avoid text-[11px]', rolo ? 'border-t border-dashed border-black py-2' : 'mt-4 rounded-md border border-black/40 px-3 py-2')}>
          <p className="font-bold uppercase">{doc.impostos.modoPreco === 'dentro' ? 'Impuestos incluidos en el precio (estimados)' : 'Impuestos estimados (no incluidos en el total)'}</p>
          <ul className="mt-1 space-y-0.5">
            {doc.impostos.linhas.map((l, k) => (
              <li key={k} className="num flex justify-between gap-2"><span>{l.sigla} {pct(l.taxaBp)} {rolo ? '' : `sobre ${v(l.base)}`}</span><span>{v(l.valor)}</span></li>
            ))}
          </ul>
          <p className="mt-1 text-[10px]">Valores estimados para información del cliente; el impuesto real se determina en la declaración del período.</p>
        </section>
      )}

      {/* DIVISÃO DO VALOR (se ligada): com quem a venda é dividida e o que fica com a casa */}
      {comDivisao && doc.divisao.partes.length > 0 && (
        <section className={cx('break-inside-avoid text-[11px]', rolo ? 'border-t border-dashed border-black py-2' : 'mt-4 rounded-md border border-black/40 px-3 py-2')}>
          <p className="font-bold uppercase">División del valor</p>
          <ul className="mt-1 space-y-0.5">
            {doc.divisao.partes.map((p, k) => <li key={k} className="num flex justify-between gap-2"><span className="min-w-0 break-words">{p.nome} <span className="opacity-70">({p.como})</span></span><span>{v(p.valor)}</span></li>)}
            <li className="num flex justify-between gap-2 border-t border-black/30 pt-0.5 font-semibold"><span>Queda para el negocio</span><span>{v(doc.divisao.casa)}</span></li>
          </ul>
        </section>
      )}

      {/* PAGAMENTOS: cada forma, o pago e o saldo */}
      <section className={cx('break-inside-avoid text-[11px]', rolo ? 'border-t border-dashed border-black py-2' : 'mt-4')}>
        <p className="font-bold uppercase">Forma de pago</p>
        <ul className="mt-1 space-y-0.5">
          {doc.pagamentos.length ? doc.pagamentos.map((p, k) => (
            <li key={k} className="num flex justify-between gap-2"><span>{es(p.forma)}{p.moeda !== doc.moeda ? ` (${formatar(p.valor, p.moeda)})` : ''}</span><span>{v(p.valorPrincipal)}</span></li>
          )) : <li>—</li>}
        </ul>
        <div className={cx('mt-1 space-y-0.5', !rolo && 'ml-auto max-w-[260px]')}>
          {linhaTotal('PAGADO', v(doc.totais.pago))}
          {doc.totais.saldo > 0 && <div className="flex justify-between gap-3 font-black"><span>SALDO PENDIENTE</span><span className="num">{v(doc.totais.saldo)}</span></div>}
          {doc.totais.troco > 0 && linhaTotal('CAMBIO', v(doc.totais.troco))}
        </div>
      </section>

      {/* o aviso legal: sempre, em destaque — não é factura */}
      <footer className={cx('break-inside-avoid text-center text-[10px]', rolo ? 'border-t border-dashed border-black pt-2' : 'mt-6 border-t-2 border-black pt-3')}>
        <p className="font-bold uppercase">{TEXTO_NOTA.aviso}</p>
        {!rolo && doc.emisor.nit && <p className="mt-0.5">Si necesita factura, solicítela al emisor (NIT {doc.emisor.nit}).</p>}
        <p className="mt-1">¡Gracias por su compra!</p>
      </footer>
    </article>
  )
}

/** a impressão: uma CÓPIA da nota fora do app (portal no <body>), só ela vai para o papel — o app inteiro some */
export function ImprimirNota({ onPronto, ...p }: { doc: DocumentoVenda; modelo: ModeloDocumentoId; includeTaxesInPrint: boolean; comDivisao?: boolean; onPronto(): void }) {
  useEffect(() => {
    document.body.classList.add('imprimindo-nota')
    // espera a cópia aparecer antes de abrir a impressão do navegador
    const id = window.setTimeout(() => {
      window.print()
      document.body.classList.remove('imprimindo-nota')
      onPronto()
    }, 50)
    return () => (window.clearTimeout(id), document.body.classList.remove('imprimindo-nota'))
  }, [onPronto])
  return createPortal(<div className={cx('nota-impressao', MODELOS_DOCUMENTO[p.modelo].formato === 'rollo' && 'rollo')}><NotaVenda {...p} /></div>, document.body)
}
