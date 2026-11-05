// ENTRAR: usuário e senha. Na demonstração mostra os usuários de teste para testar cada perfil — mas antes pede a
// SENHA DE ACESSO (src/app/acesso.ts), uma vez por sessão do navegador: o site fica aberto na internet.

import { useState } from 'react'
import { SENHA_DEMO } from '../app/demo'
import { acessoLiberado, liberarAcesso } from '../app/acesso'
import type { Sessao } from '../core/ports/portas'
import { Botao, Campo, Cartao, Entrada, Janela, Pilula, cx } from '../ui/base'
import { useApp, useConsulta } from '../ui/contexto'
import { useT } from '../ui/i18n'

export function Entrar({ onEntrou }: { onEntrou(s: Sessao): void }) {
  const t = useT()
  const { backend, avisar } = useApp()
  const [login, setLogin] = useState('')
  const [senha, setSenha] = useState('')
  const [ocupado, setOcupado] = useState(false)
  const { dados: demo } = useConsulta('usuariosDemo', {}, backend.tipo !== 'api')
  // demonstração aberta na internet: pede a senha de acesso antes (nos testes automáticos não)
  const pedeAcesso = backend.tipo !== 'api' && !import.meta.env.VITEST
  const [pedindo, setPedindo] = useState<{ l: string; s: string }>()
  const [acesso, setAcesso] = useState('')
  const [errou, setErrou] = useState(false)
  const tentar = (l: string, s: string) => (pedeAcesso && !acessoLiberado() ? (setAcesso(''), setErrou(false), setPedindo({ l, s })) : entrar(l, s))
  const conferir = async () => {
    if (!pedindo) return
    if (!(await liberarAcesso(acesso))) return setErrou(true)
    const p = pedindo
    setPedindo(undefined)
    await entrar(p.l, p.s)
  }
  const entrar = async (l: string, s: string) => {
    setOcupado(true)
    try {
      onEntrou(await backend.entrar(l, s))
    } catch (e) {
      avisar(e instanceof Error ? e.message : String(e), 'erro')
    } finally {
      setOcupado(false)
    }
  }
  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--fundo)] p-4">
      <div className="w-full max-w-md space-y-4">
        <div className="text-center">
          <div className="mx-auto mb-2 flex h-14 w-14 items-center justify-center rounded-3xl bg-[var(--marca)] text-2xl font-black text-white">T</div>
          <h1 className="text-2xl font-black">Tudo</h1>
          <p className="text-sm text-[var(--suave)]">{t('Cabelo, salão, empréstimos e o que mais vier, num só lugar.')}</p>
        </div>
        <Cartao>
          <form
            className="space-y-3"
            onSubmit={(e) => {
              e.preventDefault()
              tentar(login, senha)
            }}
          >
            <Campo rotulo="Usuário"><Entrada autoComplete="username" autoCapitalize="none" value={login} onChange={(e) => setLogin(e.target.value)} /></Campo>
            <Campo rotulo="Senha"><Entrada type="password" autoComplete="current-password" value={senha} onChange={(e) => setSenha(e.target.value)} /></Campo>
            <Botao grande type="submit" className="w-full" disabled={ocupado || !login || !senha}>{t('Entrar')}</Botao>
          </form>
        </Cartao>
        {!!demo?.length && (
          <Cartao titulo={t('Usuários de teste')} ajuda="Toque num usuário para entrar com ele (pede a senha de acesso). Ex.: admin vê tudo; Sofia vê só a agenda e as vendas dela.">
            <ul className="grid gap-2 sm:grid-cols-2">
              {demo.map((u) => (
                <li key={u.login}>
                  <button type="button" disabled={ocupado} onClick={() => tentar(u.login, SENHA_DEMO)} className={cx('w-full rounded-xl border p-2 text-left text-sm hover:border-[var(--marca)]', u.login === 'admin' ? 'border-[var(--marca)] bg-[var(--marca-suave)]' : 'border-[var(--borda)]')}>
                    <b>{u.nome}</b>
                    <div className="flex items-center gap-1 text-xs text-[var(--suave)]">
                      <span className="font-mono">{u.login}</span>
                      <Pilula tom={u.perfil === 'admin' ? 'marca' : 'neutro'}>{t(u.perfil === 'admin' ? 'Administrador' : 'Funcionário')}</Pilula>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          </Cartao>
        )}
      </div>
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
