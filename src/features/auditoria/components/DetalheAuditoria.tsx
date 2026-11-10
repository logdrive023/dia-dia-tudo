// AUDITORIA › DETALHE DE UM REGISTRO: o que, quem, quando (com segundos), os ids, as referências, as outras ações
// sobre o mesmo registro e o registro cru (como está guardado).
import { useState } from 'react'
import type { RefAuditoria } from '../../../core/services/auditoria'
import { Botao, Carregando, Janela, Pilula, cx, loc } from '../../../shared/ui/base'
import { useConsulta } from '../../../shared/ui/contexto'
import { useT } from '../../../shared/ui/i18n'
import { COR_AREA, ICONE_AREA, ICONE_REF, NOME_AREA } from '../model/auditoria'

/** data e hora com segundos (o log é para conferir) */
const quando = (iso: string) => new Date(iso).toLocaleString(loc(), { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' })

export function DetalheAuditoria({ id, onFechar, onAbrir, onOutro }: { id: string; onFechar(): void; onAbrir(r: RefAuditoria): void; onOutro(id: string): void }) {
  const t = useT()
  const { dados, erro } = useConsulta('registroAuditoria', { id })
  const [cru, setCru] = useState(false)
  if (erro) return <Janela aberta titulo={t('Registro')} onFechar={onFechar}><p className="text-sm">{erro}</p></Janela>
  if (!dados) return <Janela aberta titulo={t('Registro')} onFechar={onFechar}><Carregando /></Janela>
  const r = dados.registro
  const cor = COR_AREA[r.categoria]
  const fato = (rotulo: string, valor: React.ReactNode, mono?: boolean) => (
    <div className="contents">
      <dt className="text-[var(--suave)]">{t(rotulo)}</dt>
      <dd className={cx('min-w-0 break-all font-semibold', mono && 'font-mono text-xs font-normal')}>{valor}</dd>
    </div>
  )
  return (
    <Janela aberta onFechar={onFechar} titulo={
      <span className="flex min-w-0 items-center gap-3">
        <span aria-hidden className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-xl" style={{ background: `color-mix(in srgb, ${cor} 16%, transparent)`, boxShadow: `inset 0 0 0 1px color-mix(in srgb, ${cor} 35%, transparent)` }}>{ICONE_AREA[r.categoria]}</span>
        <span className="min-w-0">
          <span className="block truncate text-lg font-bold leading-tight">{t(r.nomeAcao)}</span>
          <span className="mt-0.5 block text-xs font-semibold" style={{ color: cor }}>{t(NOME_AREA[r.categoria])}</span>
        </span>
      </span>
    }>
      <div className="space-y-4">
        <p className={cx('rounded-xl px-3 py-2 text-sm', r.categoria === 'recusa' ? 'bg-[var(--ruim)]/10 font-semibold text-[var(--ruim)]' : 'bg-[var(--fundo)]')}>{r.resumo || '—'}</p>
        <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1.5 text-sm">
          {fato('Quando', <span className="num">{quando(r.em)}</span>)}
          {fato('Quem', <>{r.usuarioNome}{r.login && <span className="font-normal text-[var(--suave)]"> · {r.login}</span>} <Pilula pequena tom={r.perfil === 'admin' ? 'marca' : 'neutro'}>{t(r.perfil === 'admin' ? 'Administrador' : r.perfil ? 'Funcionário' : 'Sistema')}</Pilula></>)}
          {fato('Ação', r.acao, true)}
          {fato('Usuário (id)', r.usuarioId, true)}
          {r.alvoId && fato('Registro afetado (id)', r.alvoId, true)}
          {fato('Id deste registro', r.id, true)}
        </dl>
        {dados.refs.length > 0 && (
          <section>
            <h3 className="mb-1.5 text-xs font-bold uppercase tracking-wide text-[var(--suave)]">🔗 {t('Referências')}</h3>
            <div className="grid gap-1.5 sm:grid-cols-2">
              {dados.refs.map((x) => (
                <button key={x.id} type="button" onClick={() => onAbrir(x)} className="flex min-h-11 items-center gap-2 rounded-xl border border-[var(--borda)] px-3 text-left text-sm transition active:scale-[0.98] hover:border-[var(--marca)]">
                  <span aria-hidden>{ICONE_REF[x.tipo] ?? '🔗'}</span>
                  <span className="min-w-0 flex-1"><b className="num block truncate">{x.rotulo}</b><span className="block text-xs text-[var(--suave)]">{t(x.tipo)}</span></span>
                  <span aria-hidden className="text-[var(--marca)]">›</span>
                </button>
              ))}
            </div>
          </section>
        )}
        {dados.mesmoAlvo.length > 0 && (
          <section>
            <h3 className="mb-1.5 text-xs font-bold uppercase tracking-wide text-[var(--suave)]">🕘 {t('Outras ações sobre o mesmo registro')} · {dados.mesmoAlvo.length}</h3>
            <ul className="max-h-64 divide-y divide-[var(--borda)] overflow-y-auto rounded-xl border border-[var(--borda)]">
              {dados.mesmoAlvo.map((x) => (
                <li key={x.id}>
                  <button type="button" onClick={() => onOutro(x.id)} className="relative flex min-h-11 w-full gap-2 py-2 pl-3 pr-2 text-left text-sm hover:bg-[var(--fundo)]">
                    <span aria-hidden className="absolute inset-y-0 left-0 w-1" style={{ background: COR_AREA[x.categoria] }} />
                    <span className="min-w-0 flex-1">
                      <span className="num block font-mono text-[11px] text-[var(--suave)]">{quando(x.em)} · {x.usuarioNome}</span>
                      <b className="block">{t(x.nomeAcao)}</b>
                      <span className="block truncate text-xs text-[var(--suave)]">{x.resumo}</span>
                    </span>
                    <span aria-hidden className="self-center text-[var(--suave)]">›</span>
                  </button>
                </li>
              ))}
            </ul>
          </section>
        )}
        <section>
          <Botao variante="leve" onClick={() => setCru(!cru)} aria-expanded={cru}>{cru ? '▾' : '▸'} {t('Registro cru (como está guardado)')}</Botao>
          {cru && <pre className="mt-1.5 max-h-72 overflow-auto rounded-xl bg-[var(--fundo)] p-3 font-mono text-[11px] leading-relaxed">{JSON.stringify(dados.bruto, null, 2)}</pre>}
        </section>
      </div>
    </Janela>
  )
}
