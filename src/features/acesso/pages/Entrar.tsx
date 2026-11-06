// ENTRAR: usuário e senha (com o olho), "Esqueceu a senha?" e — enquanto os dados ficam só no aparelho — o MODO DE
// TESTE bem separado: os usuários de teste para entrar com um toque e testar cada perfil. Antes de entrar na
// demonstração pede a SENHA DE ACESSO (src/app/acesso.ts), uma vez por sessão do navegador: o site fica aberto na internet.

import { useState } from 'react'
import { SENHA_DEMO, SENHA_DEMO_ANTIGA } from '../../../adapters/demo'
import { acessoLiberado, liberarAcesso } from '../model/acesso'
import type { Sessao } from '../../../core/ports/portas'
import { Botao, Campo, Entrada, Janela, Pilula, cx } from '../../../shared/ui/base'
import { useApp, useConsulta } from '../../../shared/ui/contexto'
import { useT } from '../../../shared/ui/i18n'
import { SenhaInput } from '../../../shared/ui/senhaInput'

type UsuarioDemo = { login: string; nome: string; perfil: 'admin' | 'funcionario' }

/** semTeste: chegou pelo QR de uma etiqueta — a lista de usuários de teste não aparece (quem leu pode ser de fora) */
export function Entrar({ onEntrou, semTeste }: { onEntrou(s: Sessao): void; semTeste?: boolean }) {
  const t = useT()
  const { backend, avisar } = useApp()
  const [login, setLogin] = useState('')
  const [senha, setSenha] = useState('')
  const [ocupado, setOcupado] = useState(false)
  const [esqueceu, setEsqueceu] = useState(false)
  const teste = backend.tipo !== 'api'
  const mostrarTeste = teste && !semTeste
  const { dados: demo } = useConsulta('usuariosDemo', {}, mostrarTeste)
  // demonstração aberta na internet: pede a senha de acesso antes (nos testes automáticos não)
  const pedeAcesso = teste && !import.meta.env.VITEST
  const [pedindo, setPedindo] = useState<{ l: string; s: string; demo?: boolean }>()
  const [acesso, setAcesso] = useState('')
  const [errou, setErrou] = useState(false)
  // demo = botão do usuário de teste: dados de exemplo de antes da regra de senha ainda usam a senha antiga
  const tentar = (l: string, s: string, demo?: boolean) => (pedeAcesso && !acessoLiberado() ? (setAcesso(''), setErrou(false), setPedindo({ l, s, demo })) : entrar(l, s, demo))
  const conferir = async () => {
    if (!pedindo) return
    if (!(await liberarAcesso(acesso))) return setErrou(true)
    const p = pedindo
    setPedindo(undefined)
    await entrar(p.l, p.s, p.demo)
  }
  const entrar = async (l: string, s: string, demo?: boolean) => {
    setOcupado(true)
    try {
      onEntrou(await backend.entrar(l, s).catch((e) => (demo ? backend.entrar(l, SENHA_DEMO_ANTIGA) : Promise.reject(e))))
    } catch (e) {
      avisar(e instanceof Error ? e.message : String(e), 'erro')
    } finally {
      setOcupado(false)
    }
  }
  const admins = (demo ?? []).filter((u) => u.perfil === 'admin')
  const equipe = (demo ?? []).filter((u) => u.perfil !== 'admin')
  return (
    <div className="flex min-h-screen items-start justify-center bg-[radial-gradient(ellipse_at_top,var(--marca-suave),var(--fundo)_60%)] px-4 py-8 sm:items-center">
      <div className="w-full max-w-md space-y-5">
        <header className="text-center">
          <div className="mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-3xl bg-gradient-to-br from-[var(--marca)] to-fuchsia-500 text-3xl font-black text-white shadow-lg shadow-[var(--marca)]/30">T</div>
          <h1 className="text-2xl font-black">{t('Entrar no Tudo')}</h1>
          <p className="text-sm text-[var(--suave)]">{t('Cabelo, salão, empréstimos e o que mais vier, num só lugar.')}</p>
        </header>

        <section className="rounded-3xl border border-[var(--borda)] bg-[var(--cartao)] p-5 shadow-sm">
          <form className="space-y-4" onSubmit={(e) => (e.preventDefault(), tentar(login.trim().toLowerCase(), senha))}>
            <Campo rotulo="Usuário"><Entrada autoComplete="username" autoCapitalize="none" spellCheck={false} placeholder={t('Ex.: sofia')} value={login} onChange={(e) => setLogin(e.target.value)} /></Campo>
            <Campo rotulo="Senha" comoDiv><SenhaInput rotulo="Senha" valor={senha} onChange={setSenha} /></Campo>
            <Botao grande type="submit" className="w-full" disabled={ocupado || !login.trim() || !senha}>{t(ocupado ? 'Entrando…' : 'Entrar')}</Botao>
          </form>
          <div className="mt-3 text-center">
            <button type="button" onClick={() => setEsqueceu(true)} className="min-h-10 rounded-lg px-2 text-sm font-semibold text-[var(--marca)] hover:bg-[var(--marca-suave)]">{t('Esqueceu a senha?')}</button>
          </div>
        </section>

        {mostrarTeste && (
          <section className="rounded-3xl border-2 border-dashed border-[var(--alerta)]/60 bg-[var(--alerta)]/5 p-5" aria-labelledby="modo-teste">
            <div className="flex flex-wrap items-center gap-2">
              <h2 id="modo-teste" className="text-base font-black">🧪 {t('Modo de teste')}</h2>
              <Pilula pequena tom="alerta">{t('dados só neste aparelho')}</Pilula>
            </div>
            <p className="mt-1 text-sm text-[var(--suave)]">{t('Ainda sem servidor: tudo fica guardado neste navegador. Toque num usuário para entrar com ele, sem digitar, e testar o que cada perfil vê.')}</p>
            {!demo?.length ? (
              <p className="mt-3 rounded-xl bg-[var(--cartao)] p-3 text-sm">{t('Nenhum usuário de teste neste aparelho.')}</p>
            ) : (
              <div className="mt-3 space-y-3">
                <GrupoDemo titulo="Administradores · veem tudo" usuarios={admins} ocupado={ocupado} onEntrar={(u) => tentar(u.login, SENHA_DEMO, true)} />
                <GrupoDemo titulo="Funcionárias · só o que é delas" usuarios={equipe} ocupado={ocupado} onEntrar={(u) => tentar(u.login, SENHA_DEMO, true)} />
                <p className="text-xs text-[var(--suave)]">{t('Senha de todos os usuários de teste')}: <code className="rounded bg-[var(--cartao)] px-1.5 py-0.5 font-mono">{SENHA_DEMO}</code> · {t('dados de exemplo carregados antes desta versão')}: <code className="rounded bg-[var(--cartao)] px-1.5 py-0.5 font-mono">{SENHA_DEMO_ANTIGA}</code></p>
              </div>
            )}
          </section>
        )}
      </div>

      {esqueceu && (
        <Janela aberta titulo={`🔑 ${t('Esqueceu a senha?')}`} onFechar={() => setEsqueceu(false)} rodape={<Botao grande className="w-full" onClick={() => setEsqueceu(false)}>{t('Entendi')}</Botao>}>
          <div className="space-y-3 text-sm">
            <p>{t('A senha é guardada embaralhada: ninguém consegue ver nem recuperar a senha antiga, nem o administrador. O que dá para fazer é criar uma nova.')}</p>
            <ol className="space-y-2">
              <Passo n={1}>{t('Peça a quem é administrador do sistema.')}</Passo>
              <Passo n={2}>{t('Na conta de administrador: Configurações › Usuários › toque no seu nome.')}</Passo>
              <Passo n={3}>{t('Em “Nova senha”: Gerar senha (ou digitar uma) e Salvar.')}</Passo>
              <Passo n={4}>{t('Você recebe a senha nova. Depois, se quiser, troque em Configurações › Usuários › Trocar minha senha.')}</Passo>
            </ol>
            {teste && <p className="rounded-xl bg-[var(--alerta)]/10 p-2 text-[var(--alerta)]">🧪 {t('No modo de teste, entre pelos usuários de teste: a senha deles é')} <code className="font-mono">{SENHA_DEMO}</code>.</p>}
          </div>
        </Janela>
      )}

      {pedindo && (
        <Janela aberta titulo={`🔒 ${t('Senha de acesso')}`} onFechar={() => setPedindo(undefined)} rodape={
          <Botao grande type="submit" form="form-acesso" className="w-full" disabled={!acesso || ocupado}>{t('Entrar')}</Botao>
        }>
          <form id="form-acesso" className="space-y-2" onSubmit={(e) => (e.preventDefault(), void conferir())}>
            <p className="text-sm text-[var(--suave)]">{t('Este sistema de demonstração pede uma senha de acesso antes de entrar.')}</p>
            <Campo rotulo="Senha de acesso"><Entrada type="password" autoFocus autoComplete="off" value={acesso} onChange={(e) => (setAcesso(e.target.value), setErrou(false))} /></Campo>
            {errou && <p role="alert" className="text-sm font-semibold text-[var(--ruim)]">{t('Senha de acesso errada.')}</p>}
          </form>
        </Janela>
      )}
    </div>
  )
}

function Passo({ n, children }: { n: number; children: React.ReactNode }) {
  return (
    <li className="flex gap-2">
      <span aria-hidden className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[var(--marca-suave)] text-xs font-bold text-[var(--marca)]">{n}</span>
      <span>{children}</span>
    </li>
  )
}

function GrupoDemo({ titulo, usuarios, ocupado, onEntrar }: { titulo: string; usuarios: UsuarioDemo[]; ocupado: boolean; onEntrar(u: UsuarioDemo): void }) {
  const t = useT()
  if (!usuarios.length) return null
  return (
    <div>
      <h3 className="mb-1.5 text-xs font-bold uppercase tracking-wide text-[var(--suave)]">{t(titulo)}</h3>
      <ul className="grid gap-2 sm:grid-cols-2">
        {usuarios.map((u) => (
          <li key={u.login}>
            <button type="button" disabled={ocupado} onClick={() => onEntrar(u)}
              className={cx('flex min-h-14 w-full items-center gap-3 rounded-2xl border bg-[var(--cartao)] px-3 py-2 text-left transition hover:border-[var(--marca)] hover:shadow-sm', u.login === 'admin' ? 'border-[var(--marca)]' : 'border-[var(--borda)]')}>
              <span aria-hidden className={cx('flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-bold', u.perfil === 'admin' ? 'bg-[var(--marca)] text-white' : 'bg-[var(--marca-suave)] text-[var(--marca)]')}>{u.nome.charAt(0)}</span>
              <span className="min-w-0">
                <b className="block truncate text-sm">{u.nome}</b>
                <span className="block font-mono text-xs text-[var(--suave)]">{u.login}</span>
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}
