// PACOTE PARA VENDER (funcionária): o que ela vê ao abrir #/lotes/<id> (ex.: lendo o QR do pacote).
// Só o que importa para vender: foto (toque amplia), código, rótulo, situação, peso disponível e o preço da tabela.
// Sem custo, margem, preço do fornecedor, histórico nem ações de estoque (Separar, Ajustar, Trocar código, Etiquetas):
// isso é do administrador. Um botão só: VENDER (abre o modo caixa já com o pacote).

import { useState } from 'react'
import { formatar } from '../../../core/domain/dinheiro'
import type { Id } from '../../../core/domain/tipos'
import { Botao, Carregando, ErroTela, cx, gramasTexto } from '../../../shared/ui/base'
import { useApp, useConsulta } from '../../../shared/ui/contexto'
import { StatusBadge } from '../../../shared/ui/estoqueUi'
import { VisorFotos, marcadorLote, useUrlFoto } from '../../../shared/ui/fotos'
import { useT } from '../../../shared/ui/i18n'
import { Trilha } from '../../../shared/ui/trilha'

export function PacoteVenda() {
  const t = useT()
  const { nav, ir, voltar } = useApp()
  const id = nav.params.id as Id
  const { dados, erro } = useConsulta('pacoteVenda', { id })
  const [ver, setVer] = useState(false)
  const url = useUrlFoto(dados?.foto, true)
  if (erro) return <ErroTela texto={erro} onVoltar={voltar} />
  if (!dados) return <Carregando />
  const grama = dados.unidade === 'grama'
  const q = (n: number) => (grama ? gramasTexto(n) : String(n))
  return (
    <div className="mx-auto max-w-md space-y-4">
      <Trilha atual={dados.codigo ?? t('Pacote')} />
      <button type="button" onClick={() => dados.foto && setVer(true)} aria-label={t('Ver fotos')} className={cx('block w-full', !dados.foto && 'cursor-default')}>
        <span className={cx('relative flex h-64 w-full flex-col items-center justify-center overflow-hidden rounded-2xl border border-[var(--borda)] bg-[var(--fundo)]', !dados.foto && 'border-dashed')}>
          {dados.foto ? (
            url ? <img src={url} alt="" className="h-full w-full object-cover" /> : <span className="block h-full w-full animate-pulse bg-[var(--borda)]" />
          ) : (
            <>
              <span className="num text-5xl font-black">{marcadorLote(dados.campos, dados.nome)}</span>
              <span className="mt-1 text-xs font-semibold uppercase text-[var(--suave)]">{t('Sem foto')}</span>
            </>
          )}
        </span>
      </button>
      <div>
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="font-mono text-3xl font-black">{dados.codigo ?? '—'}</h1>
          <StatusBadge status={dados.status} />
        </div>
        <p className="text-lg">{dados.rotulo}</p>
      </div>
      <dl className="grid grid-cols-2 gap-2 text-sm">
        <div className="rounded-xl bg-[var(--fundo)] p-3">
          <dt className="text-[var(--suave)]">{t('Peso disponível')}</dt>
          <dd className="num text-2xl font-bold">{q(dados.saldo)}</dd>
        </div>
        {dados.vendavel && dados.preco && (
          <div className="rounded-xl bg-[var(--fundo)] p-3">
            <dt className="text-[var(--suave)]">{t('Preço de venda')}</dt>
            <dd className="num text-2xl font-bold">{formatar(dados.preco.total, dados.preco.moeda)}</dd>
            {dados.preco.fator && <dd className="num text-xs text-[var(--suave)]">{q(dados.saldo)} × {dados.preco.fator}{dados.preco.coluna ? ` · ${dados.preco.coluna}` : ''}</dd>}
          </div>
        )}
      </dl>
      {dados.compras.length > 0 && (
        <p className="text-sm text-[var(--suave)]">{t('Compras de origem')}: <span className="font-mono">{dados.compras.join(', ')}</span></p>
      )}
      {dados.vendavel ? (
        <Botao grande className="min-h-14 w-full text-lg" onClick={() => ir('vendaRapida', { lote: dados.id })}>
          💰 {t('Vender')}
        </Botao>
      ) : (
        <p role="status" className="rounded-2xl bg-[var(--alerta)]/10 p-4 text-center font-semibold text-[var(--alerta)]">{t('Ainda não está pronto para vender')}</p>
      )}
      {ver && <VisorFotos itemId={dados.id} onFechar={() => setVer(false)} />}
    </div>
  )
}
