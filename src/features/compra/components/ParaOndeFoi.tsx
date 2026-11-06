// PARA ONDE FOI A COMPRA (CartaoSecao + BarraPartes + LinhaPacote): cada grama do que foi comprado — aguardando
// triagem, em pacotes, vendido, perda, diferença de peso — e os pacotes que saíram dela (tocar abre; ⋯ = separar,
// trocar código). "✓ fecha" quando a conta bate. Os números vêm do servidor (pedido.fechamento).
import type { Id } from '../../../core/domain/tipos'
import { cx, gramasTexto } from '../../../shared/ui/base'
import { BarraPartes, CartaoSecao, LinhaPacote, LinkSecao } from '../../../shared/ui/cartaoSecao'
import { useApp } from '../../../shared/ui/contexto'
import { marcadorLote } from '../../../shared/ui/fotos'
import { useT } from '../../../shared/ui/i18n'
import { type DadosPedido, codigoDe, irSeparar } from '../model/pecas'

export function ParaOndeFoi({ dados, admin, onTrocarLote }: { dados: DadosPedido; admin: boolean; onTrocarLote(l: { id: Id; codigo?: string }): void }) {
  const t = useT()
  const { ir } = useApp()
  const f = dados.fechamento
  const c = dados.compra
  if (!f) return null
  const partes = [
    { id: 'aguardando', nome: 'Aguardando triagem', g: f.aguardando, cor: 'var(--marca)' },
    { id: 'pacotes', nome: 'Em pacotes', g: f.pacotes, cor: 'var(--alerta)' },
    { id: 'vendido', nome: 'Vendido', g: f.vendido, cor: 'var(--bom)' },
    { id: 'perda', nome: 'Perda', g: f.perda, cor: 'var(--ruim)' },
    { id: 'diferenca', nome: 'Diferença de peso', g: f.diferenca, cor: 'var(--suave)' },
  ]
  const etiquetas = () => ir('etiquetas', { f: 'todas', compra: codigoDe(c), sel: (dados.lotes.some((l) => l.saldo > 0) ? dados.lotes.filter((l) => l.saldo > 0) : dados.lotes).map((l) => l.id).join(',') })
  return (
    <CartaoSecao icone="📍" titulo="Para onde foi" rotulo="Para onde foi esta compra"
      ajuda="Comprado = aguardando + em pacotes + vendido + perda + diferença de peso." exemplo="Ex.: 10 kg = 4 em pacotes + 5,4 vendido + 0,6 de perda."
      direita={
        <span className={cx('num inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-semibold', f.confere ? 'bg-[var(--bom)]/12 text-[var(--bom)]' : 'bg-[var(--alerta)]/12 text-[var(--alerta)]')}>
          {gramasTexto(f.comprado)} {f.confere ? `✓ ${t('fecha')}` : `⚠ ${t('falta {g}', { g: gramasTexto(f.falta) })}`}
        </span>
      }
      rodape={<>
        {dados.lotes.length > 0 && <LinkSecao onClick={etiquetas}>🏷 {t('Etiquetas')}</LinkSecao>}
        <LinkSecao onClick={() => ir('rastreio', { compraId: c.id })}>🔎 {t('Rastreio completo')}</LinkSecao>
      </>}>
      <div className="px-4 pb-3"><BarraPartes partes={partes} /></div>
      {dados.lotes.length > 0 && (
        <div className="border-t border-[var(--borda)]">
          <p className="px-4 pb-1 pt-3 text-xs font-semibold uppercase tracking-wide text-[var(--suave)]">{t('Pacotes desta compra')} · {dados.lotes.length}</p>
          <ul className="px-2 pb-2">
            {dados.lotes.map((l) => (
              <LinhaPacote key={l.id} id={l.id} codigo={l.codigo} nome={l.nome} foto={l.foto} marcador={marcadorLote(l.campos, l.nome)}
                situacao={l.aguardando ? { texto: `${t('aguardando triagem')} · ${t('{n} dia(s)', { n: l.aguardando.dias })}`, tom: 'marca' } : l.saldo <= 0 ? { texto: t('esgotado'), tom: 'suave' } : { texto: t('em estoque'), tom: 'bom' }}
                valor={l.unidade === 'grama' ? gramasTexto(l.saldo) : l.saldo}
                onAbrir={() => ir('lote', { id: l.id })}
                acoes={admin ? [
                  ...(l.aguardando ? [{ rotulo: 'Separar', icone: '✂️', onClick: () => irSeparar(ir, [l.id]) }] : []),
                  { rotulo: 'Trocar código', icone: '#', onClick: () => onTrocarLote({ id: l.id, codigo: l.codigo }) },
                ] : undefined} />
            ))}
          </ul>
        </div>
      )}
    </CartaoSecao>
  )
}
