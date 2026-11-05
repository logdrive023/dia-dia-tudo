// CONFIGURAÇÕES › Dados: onde ficam, backup, importar, dados de exemplo e zerar.
// Uma seção = um arquivo (a lista das seções e onde cada uma aparece fica em ../configSecoes.ts).
import { useEffect, useState } from 'react'
import type { BackendNoAparelho } from '../../adapters/noAparelho'
import { espacoUsado, protegerDados } from '../../adapters/local/indexeddb'
import { carregarDemo } from '../../app/demo'
import { Botao, Cartao, Confirmar, Pilula } from '../../ui/base'
import { useApp, useConsulta } from '../../ui/contexto'
import { useT } from '../../ui/i18n'

export function Dados() {
  const t = useT()
  const { backend, avisar } = useApp()
  const [protegido, setProtegido] = useState<boolean>()
  const [espaco, setEspaco] = useState<{ usado: number; total: number }>()
  const [confirmar, setConfirmar] = useState<'demo' | 'zerar'>()
  const { dados: diag } = useConsulta('diagnostico', {})
  useEffect(() => {
    if (backend.tipo === 'local') {
      protegerDados().then(setProtegido)
      espacoUsado().then(setEspaco)
    }
  }, [backend])
  const exportar = async () => {
    const b = await backend.exportar()
    const url = URL.createObjectURL(new Blob([JSON.stringify(b)], { type: 'application/json' }))
    const a = document.createElement('a')
    a.href = url
    a.download = `backup-tudo-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }
  const acao = async () => {
    try {
      if (confirmar === 'demo') await carregarDemo(backend as BackendNoAparelho)
      else await backend.limparTudo()
      avisar(t(confirmar === 'demo' ? 'Dados de exemplo carregados.' : 'Tudo zerado.'), 'ok')
    } catch (e) {
      avisar(e instanceof Error ? e.message : String(e), 'erro')
    } finally {
      setConfirmar(undefined)
    }
  }
  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
      <Cartao titulo={t('Onde os dados ficam')} className="md:col-span-2 lg:col-span-1 xl:col-span-2">
        {backend.tipo === 'api' ? (
          <p className="text-sm">🗄️ {t('Os dados ficam no banco de dados do servidor: qualquer aparelho que entrar vê os mesmos dados.')}</p>
        ) : (
          <>
            <ol className="grid gap-2 sm:grid-cols-2">
              <li className="rounded-2xl border-2 border-[var(--marca)] bg-[var(--marca-suave)] p-3">
                <p className="flex items-center gap-2 font-bold"><span aria-hidden>📱</span>{t('Hoje: só neste aparelho')}<Pilula pequena tom="marca">{t('em uso')}</Pilula></p>
                <p className="mt-1 text-sm">{t('Tudo fica guardado no navegador deste aparelho, sem internet e sem servidor. Outro celular ou computador não vê estes dados.')}</p>
              </li>
              <li className="rounded-2xl border-2 border-dashed border-[var(--borda)] p-3">
                <p className="flex items-center gap-2 font-bold"><span aria-hidden>🗄️</span>{t('Depois: banco de dados no servidor')}<Pilula pequena>{t('em breve')}</Pilula></p>
                <p className="mt-1 text-sm text-[var(--suave)]">{t('Todos os aparelhos vão ver os mesmos dados, com cópia de segurança automática. As telas e as regras continuam iguais.')}</p>
              </li>
            </ol>
            <p className="mt-3 rounded-xl bg-[var(--alerta)]/10 p-2 text-sm text-[var(--alerta)]">⚠️ {t('Enquanto for só neste aparelho: limpar o navegador, trocar ou perder o aparelho apaga os dados. Baixe um backup com frequência.')}</p>
          </>
        )}
        <dl className="mt-3 grid gap-x-4 gap-y-1 text-sm sm:grid-cols-2">
          {backend.tipo === 'local' && <div className="flex flex-wrap items-center gap-1"><dt>{t('Proteção contra limpeza do navegador')}:</dt><dd><Pilula tom={protegido ? 'bom' : 'alerta'}>{protegido ? t('protegido') : t('não garantido')}</Pilula></dd></div>}
          {espaco && <div className="flex flex-wrap items-center gap-1"><dt>{t('Espaço usado')}:</dt><dd className="num">{(espaco.usado / 1e6).toFixed(1)} MB {t('de')} {(espaco.total / 1e9).toFixed(1)} GB</dd></div>}
          <div className="flex flex-wrap items-center gap-1"><dt>{t('Conferência das contas')}:</dt><dd>{diag ? <Pilula tom={diag.ok ? 'bom' : 'ruim'}>{diag.ok ? t('tudo bate ✓') : `${diag.problemas.length} ${t('problema(s)')}`}</Pilula> : '…'}</dd></div>
        </dl>
        {diag && !diag.ok && <ul className="mt-1 text-xs text-[var(--ruim)]">{diag.problemas.slice(0, 5).map((p) => <li key={p}>{p}</li>)}</ul>}
      </Cartao>
      <Cartao titulo={t('Backup')}>
        <div className="flex flex-wrap gap-2">
          <Botao onClick={exportar}>⬇️ {t('Baixar backup (JSON)')}</Botao>
          <label className="inline-flex min-h-10 cursor-pointer items-center rounded-xl bg-[var(--marca-suave)] px-4 text-sm font-semibold text-[var(--marca)]">
            ⬆️ {t('Restaurar backup')}
            <input type="file" accept="application/json" className="hidden" onChange={async (e) => {
              const f = e.target.files?.[0]
              e.target.value = ''
              if (!f) return
              try {
                await backend.importar(JSON.parse(await f.text()))
                avisar(t('Backup restaurado.'), 'ok')
              } catch (err) {
                avisar(err instanceof Error ? err.message : String(err), 'erro')
              }
            }} />
          </label>
        </div>
        <p className="mt-2 text-xs text-[var(--suave)]">{t('O backup leva tudo, inclusive fotos e comprovantes. Serve também para levar a demonstração para outro aparelho.')}</p>
      </Cartao>
      {backend.tipo !== 'api' && (
        <Cartao titulo={t('Dados de teste')} ajuda="Para testar à vontade: carregue os dados de exemplo (clientes, compras, vendas, viagens) ou comece do zero. Só mexe neste aparelho.">
          <div className="flex flex-wrap gap-2">
            <Botao onClick={() => setConfirmar('demo')}>{t('Carregar dados de exemplo')}</Botao>
            <Botao variante="perigo" onClick={() => setConfirmar('zerar')}>{t('Zerar tudo')}</Botao>
          </div>
          <p className="mt-2 text-xs text-[var(--suave)]">{t('Antes de zerar, baixe um backup se quiser voltar depois.')}</p>
        </Cartao>
      )}
      {confirmar && (
        <Confirmar
          titulo="Tem certeza?"
          texto={confirmar === 'demo' ? 'Os dados atuais serão trocados pelos dados de exemplo.' : 'Todos os dados deste aparelho serão apagados.'}
          rotulo="Sim, continuar"
          perigo={confirmar === 'zerar'}
          onConfirmar={acao}
          onFechar={() => setConfirmar(undefined)}
        />
      )}
    </div>
  )
}

