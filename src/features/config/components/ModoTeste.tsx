// CONFIGURAÇÕES › Modo teste: cenários prontos (troca os dados deste aparelho) e "Zerar tudo" (dados + preferências).
// Só no modo "neste aparelho"; no servidor não mexe em nada. As regras ficam em adapters/cenarios.ts.
import { useState } from 'react'
import type { BackendNoAparelho } from '../../../adapters/noAparelho'
import { CENARIOS, type CenarioId, carregarCenario, zerarAparelho } from '../../../adapters/cenarios'
import { Botao, Campo, Cartao, Confirmar, Entrada, Janela, Vazio, cx } from '../../../shared/ui/base'
import { useApp } from '../../../shared/ui/contexto'
import { useT } from '../../../shared/ui/i18n'
import { baixarBackup } from '../model/backup'

export function ModoTeste() {
  const t = useT()
  const { backend, avisar } = useApp()
  const [cenario, setCenario] = useState<CenarioId>('loja')
  const [confirmarCenario, setConfirmarCenario] = useState(false)
  const [zerar, setZerar] = useState(false)
  if (backend.tipo === 'api') return <Vazio icone="🗄️" texto="O modo teste só funciona com os dados neste aparelho. No servidor, nada é apagado por aqui." />
  const b = backend as BackendNoAparelho
  const escolhido = CENARIOS.find((c) => c.id === cenario)!
  const carregar = async () => {
    try {
      await carregarCenario(b, cenario)
      avisar(t('Cenário “{n}” carregado.', { n: t(escolhido.nome) }), 'ok')
    } catch (e) {
      avisar(e instanceof Error ? e.message : String(e), 'erro')
    }
  }
  return (
    <div className="grid gap-4 xl:grid-cols-2">
      <p className="rounded-xl bg-[var(--alerta)]/10 p-3 text-sm text-[var(--alerta)] xl:col-span-2">🧪 {t('Para testar à vontade. Tudo aqui mexe só neste aparelho e troca ou apaga os dados dele.')}</p>

      <Cartao titulo={`📦 ${t('Cenários prontos')}`}>
        <div role="radiogroup" aria-label={t('Cenários prontos')} className="grid gap-2">
          {CENARIOS.map((c) => (
            <button key={c.id} type="button" role="radio" aria-checked={c.id === cenario} onClick={() => setCenario(c.id)}
              className={cx('flex min-h-14 items-start gap-3 rounded-2xl border-2 p-3 text-left', c.id === cenario ? 'border-[var(--marca)] bg-[var(--marca-suave)]' : 'border-[var(--borda)] hover:border-[var(--marca)]')}>
              <span aria-hidden className="flex h-8 w-8 shrink-0 items-center justify-center text-xl leading-none">{c.icone}</span>
              <span className="min-w-0 flex-1">
                <b className={cx('block text-sm', c.id === cenario && 'text-[var(--marca)]')}>{t(c.nome)}</b>
                <span className="mt-0.5 block text-xs text-[var(--suave)]">{t(c.descricao)}</span>
              </span>
              <span aria-hidden className={cx('mt-1 h-4 w-4 shrink-0 rounded-full border-2', c.id === cenario ? 'border-[5px] border-[var(--marca)]' : 'border-[var(--borda)]')} />
            </button>
          ))}
        </div>
        <Botao className="mt-3 w-full sm:w-auto" onClick={() => setConfirmarCenario(true)}>📦 {t('Carregar cenário')}</Botao>
      </Cartao>

      <section aria-labelledby="zerar-titulo" className="rounded-2xl border-2 border-[var(--ruim)]/40 bg-[var(--ruim)]/5 p-4">
        <h3 id="zerar-titulo" className="font-bold text-[var(--ruim)]">⚠️ {t('Zerar tudo')}</h3>
        <ul className="mt-2 list-disc space-y-0.5 pl-5 text-sm">
          <li>{t('Apaga todos os dados deste aparelho (cadastros, estoque, vendas, fotos).')}</li>
          <li>{t('Apaga também as preferências: login, idioma, filtros e onde ficam os dados.')}</li>
          <li>{t('O app recarrega como no primeiro uso (com os dados de exemplo). Não dá para desfazer.')}</li>
        </ul>
        <Botao variante="perigo" className="mt-3 w-full sm:w-auto" onClick={() => setZerar(true)}>⚠️ {t('Zerar tudo')}</Botao>
      </section>

      {confirmarCenario && (
        <Confirmar titulo="Trocar os dados?" texto={t('Os dados deste aparelho serão trocados pelo cenário “{n}”. Baixe um backup antes se quiser voltar.', { n: t(escolhido.nome) })} rotulo="Sim, carregar"
          onConfirmar={carregar} onFechar={() => setConfirmarCenario(false)} />
      )}
      {zerar && <ConfirmarZerar onZerar={() => zerarAparelho(b)} onBackup={() => baixarBackup(backend)} onFechar={() => setZerar(false)} />}
    </div>
  )
}

/** CONFIRMAÇÃO DUPLA: o toque em "Zerar tudo" abre esta janela; o botão vermelho só liga depois de digitar a palavra */
function ConfirmarZerar({ onZerar, onBackup, onFechar }: { onZerar(): Promise<void>; onBackup(): Promise<void>; onFechar(): void }) {
  const t = useT()
  const palavra = t('ZERAR')
  const [digitado, setDigitado] = useState('')
  const [ocupado, setOcupado] = useState(false)
  const pronto = digitado.trim().toUpperCase() === palavra
  return (
    <Janela aberta titulo={`⚠️ ${t('Zerar tudo?')}`} onFechar={onFechar} rodape={
      <div className="flex flex-wrap justify-end gap-2">
        <Botao variante="leve" onClick={onFechar}>{t('Voltar')}</Botao>
        <Botao variante="perigo" disabled={!pronto || ocupado} carregando={ocupado} onClick={async () => { setOcupado(true); await onZerar() }}>{t('Apagar tudo e recarregar')}</Botao>
      </div>
    }>
      <p className="text-sm">{t('Todos os dados e as preferências deste aparelho serão apagados. Não dá para desfazer.')}</p>
      <Botao variante="secundario" className="mt-3 w-full sm:w-auto" onClick={onBackup}>⬇️ {t('Baixar backup antes')}</Botao>
      <div className="mt-3">
        <Campo rotulo={t('Para confirmar, digite {p}', { p: palavra })}>
          <Entrada autoFocus autoCapitalize="characters" autoComplete="off" value={digitado} onChange={(e) => setDigitado(e.target.value)} placeholder={palavra} />
        </Campo>
      </div>
    </Janela>
  )
}
