// CONFIGURAÇÕES › Dados: onde ficam, backup e importar (cenários de teste e zerar: Modo teste, ModoTeste.tsx).
// Uma seção = um arquivo (a lista das seções e onde cada uma aparece fica em ../configSecoes.ts).
import { useEffect, useState } from 'react'
import { espacoUsado, protegerDados } from '../../../adapters/local/indexeddb'
import { baixarBackup } from '../model/backup'
import { Botao, Campo, Carregando, Cartao, Entrada, Escolha, Pilula, Vazio, loc } from '../../../shared/ui/base'
import { ErroConsulta } from '../../../shared/ui/consultando'
import { useApp, useConsulta } from '../../../shared/ui/contexto'
import { useT } from '../../../shared/ui/i18n'
import { URL_SERVIDOR_LOCAL, lerModoDados, podeTrocarDados, trocarModoDados } from '../../../adapters/modoDados'
import { ERRO_SIMULADO, OPCOES_ATRASO, OPCOES_FALHA, lerAtraso, lerFalha, salvarAtraso, salvarFalha } from '../../../adapters/api/simularApi'

export function Dados() {
  const t = useT()
  const { backend, avisar, ir } = useApp()
  const [protegido, setProtegido] = useState<boolean>()
  const [espaco, setEspaco] = useState<{ usado: number; total: number }>()
  const { dados: diag } = useConsulta('diagnostico', {})
  useEffect(() => {
    if (backend.tipo === 'local') {
      protegerDados().then(setProtegido)
      espacoUsado().then(setEspaco)
    }
  }, [backend])
  const exportar = () => baixarBackup(backend)
  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
      <Cartao titulo={t('Onde os dados ficam')} className="md:col-span-2 lg:col-span-1 xl:col-span-2">
        {backend.tipo === 'api' ? (
          <p className="text-sm">🗄️ {t('Os dados ficam no banco de dados do servidor: qualquer aparelho que entrar vê os mesmos dados.')}</p>
        ) : (
          <>
            <ol className="grid gap-2 sm:grid-cols-2">
              <li className="rounded-2xl border-2 border-[var(--marca)] bg-[var(--marca-suave)] p-3">
                <p className="flex flex-wrap items-center gap-x-2 gap-y-1 font-bold"><span aria-hidden>📱</span><span className="min-w-0">{t('Hoje: só neste aparelho')}</span><Pilula pequena tom="marca" className="shrink-0 whitespace-nowrap">{t('em uso')}</Pilula></p>
                <p className="mt-1 text-sm">{t('Tudo fica guardado no navegador deste aparelho, sem internet e sem servidor. Outro celular ou computador não vê estes dados.')}</p>
              </li>
              <li className="rounded-2xl border-2 border-dashed border-[var(--borda)] p-3">
                <p className="flex flex-wrap items-center gap-x-2 gap-y-1 font-bold"><span aria-hidden>🗄️</span><span className="min-w-0">{t('Depois: banco de dados no servidor')}</span><Pilula pequena className="shrink-0 whitespace-nowrap">{t('em breve')}</Pilula></p>
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
      {podeTrocarDados() && <OndeFicamOsDados atual={backend.tipo} />}
      {backend.tipo !== 'api' && <SimularInternet />}
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
        <Cartao titulo={t('Dados de teste')}>
          <p className="text-sm">{t('Cenários prontos e “Zerar tudo” ficam em Modo teste.')}</p>
          <Botao variante="secundario" className="mt-3" onClick={() => ir('config', { aba: 'teste' })}>🧪 {t('Abrir o Modo teste')}</Botao>
        </Cartao>
      )}
    </div>
  )
}


/**
 * ONDE FICAM OS DADOS (só em desenvolvimento): neste aparelho (a demonstração) ou no SERVIDOR (a API Go de
 * ../dia-dia-tudo-backend). Trocar recarrega o app e pede o login de novo (a sessão de um não vale no outro).
 * Os dados NÃO são copiados de um para o outro.
 */
function OndeFicamOsDados({ atual }: { atual: string }) {
  const t = useT()
  const salvo = lerModoDados()
  const [tipo, setTipo] = useState<'local' | 'api'>(atual === 'api' ? 'api' : 'local')
  const [url, setUrl] = useState(salvo?.tipo === 'api' ? salvo.url : URL_SERVIDOR_LOCAL)
  const urlOk = /^https?:\/\/[^\s/]+/.test(url.trim())
  const mudou = tipo !== (atual === 'api' ? 'api' : 'local') || (tipo === 'api' && salvo?.tipo === 'api' && salvo.url !== url.trim().replace(/\/+$/, ''))
  return (
    <Cartao titulo={t('Onde ficam os dados (teste)')} ajuda="Só em desenvolvimento. Neste aparelho: a demonstração (IndexedDB). Servidor: a API Go (../dia-dia-tudo-backend), pelo canal cifrado. Trocar recarrega o app e pede o login de novo. Os dados não são copiados de um para o outro.">
      <p className="mb-2 text-sm">{t('Agora')}: <Pilula tom={atual === 'api' ? 'marca' : 'neutro'}>{atual === 'api' ? `🌐 ${t('Servidor')}` : `📱 ${t('Neste aparelho')}`}</Pilula></p>
      <Escolha<'local' | 'api'> rotulo="Onde ficam os dados" valor={tipo} onChange={setTipo} opcoes={[{ id: 'local', nome: 'Neste aparelho' }, { id: 'api', nome: 'Servidor (API)' }]} />
      {tipo === 'api' && (
        <Campo rotulo="Endereço do servidor" ajuda="O servidor Go rodando nesta máquina: scripts/rodar no ../dia-dia-tudo-backend. Ex.: http://127.0.0.1:8080">
          <Entrada inputMode="url" value={url} onChange={(e) => setUrl(e.target.value)} placeholder={URL_SERVIDOR_LOCAL} />
        </Campo>
      )}
      {tipo === 'api' && <p className="mt-2 text-xs text-[var(--suave)]">{t('Entre com o administrador do servidor (ADMIN_LOGIN / ADMIN_SENHA do .env dele). Por enquanto o servidor só tem Unidades: as outras telas mostram “Ainda não existe no servidor”.')}</p>}
      <Botao className="mt-3" disabled={!mudou || (tipo === 'api' && !urlOk)} onClick={() => trocarModoDados(tipo === 'api' ? { tipo: 'api', url: url.trim() } : { tipo: 'local' })}>↻ {t('Aplicar e recarregar')}</Botao>
    </Cartao>
  )
}

/** SIMULAR INTERNET: cada tela espera um pouco antes de mostrar os dados, como vai ser com o servidor (só neste aparelho) */
function SimularInternet() {
  const t = useT()
  const [ms, setMs] = useState(lerAtraso)
  const [falha, setFalha] = useState(lerFalha)
  const [previa, setPrevia] = useState(false)
  // "Desligado" · "0,3 s" · "0,8 s" · "2 s"
  const nome = (x: number) => (x === 0 ? t('Desligado') : `${(x / 1000).toLocaleString(loc(), { maximumFractionDigits: 1 })} s`)
  return (
    <Cartao titulo={t('Simular internet (teste)')} ajuda="Para ver como o app fica quando os dados vierem do servidor: cada tela espera o tempo escolhido antes de mostrar os dados (aparece o carregamento). Só neste aparelho; não muda nenhum dado.">
      <Escolha<string> rotulo="Simular internet (teste)" valor={String(ms)} onChange={(v) => (setMs(Number(v)), salvarAtraso(Number(v)))} opcoes={OPCOES_ATRASO.map((x) => ({ id: String(x), nome: nome(x) }))} />
      <p className="mt-2 text-xs text-[var(--suave)]">{t(ms ? 'Ligado: cada tela espera {n} antes de mostrar os dados.' : 'Desligado: os dados aparecem na hora (estão no aparelho).', { n: nome(ms) })}</p>
      {/* FALHA SIMULADA: para ver o erro e o "Tentar de novo" das telas (só consultas; nada é gravado pela metade) */}
      <p className="mt-3 mb-1 text-sm font-semibold">{t('Falhar de vez em quando')}</p>
      <Escolha<string> rotulo="Falhar de vez em quando" valor={String(falha)} onChange={(v) => (setFalha(Number(v)), salvarFalha(Number(v)))} opcoes={OPCOES_FALHA.map((x) => ({ id: String(x), nome: x ? `${x}%` : t('Nunca') }))} />
      <p className="mt-2 text-xs text-[var(--suave)]">{t(falha ? 'Ligado: {n}% das telas mostram “Não deu para carregar” com “Tentar de novo”. Só leitura: nada é gravado pela metade.' : 'Desligado: nenhuma tela falha de mentira.', { n: falha })}</p>
      <button type="button" onClick={() => setPrevia(!previa)} className="mt-1 min-h-9 rounded-lg px-2 text-sm font-semibold text-[var(--marca)] hover:bg-[var(--marca-suave)]">{t(previa ? 'Esconder o carregamento' : 'Ver o carregamento')}</button>
      {/* os 4 ESTADOS lado a lado (o que cada tela mostra enquanto espera, quando falha e quando não tem nada) */}
      {previa && (
        <div className="mt-2 space-y-3 rounded-2xl border border-dashed border-[var(--borda)] p-2">
          <p className="text-xs font-semibold text-[var(--suave)]">{t('Carregando: texto')}</p>
          <Carregando />
          <p className="text-xs font-semibold text-[var(--suave)]">{t('Carregando: tabela')}</p>
          <Carregando formato="tabela" colunas={4} acoes linhas={3} />
          <p className="text-xs font-semibold text-[var(--suave)]">{t('Carregando: números')}</p>
          <Carregando formato="cartoes" linhas={4} />
          <p className="text-xs font-semibold text-[var(--suave)]">{t('Erro')}</p>
          <ErroConsulta texto={ERRO_SIMULADO} onTentar={() => undefined} />
          <p className="text-xs font-semibold text-[var(--suave)]">{t('Vazio')}</p>
          <Vazio icone="📭" texto="Nada por aqui ainda." />
        </div>
      )}
    </Cartao>
  )
}
