// CONFIGURAÇÕES › Usuários: quem entra no sistema, perfil e acesso.
// Uma seção = um arquivo (a lista das seções e onde cada uma aparece fica em ../configSecoes.ts).
import { useState } from 'react'
import { novoId } from '../../core/domain/ids'
import { Botao, Campo, Carregando, Entrada, Info, Janela, Pilula, Selecao, cx, loc } from '../../ui/base'
import { useApp, useComando, useConsulta } from '../../ui/contexto'
import { useT } from '../../ui/i18n'

export function Usuarios() {
  const t = useT()
  const { sessao } = useApp()
  const { dados } = useConsulta('usuarios', {})
  const { dados: pessoas } = useConsulta('pessoas', {})
  const { dados: locais } = useConsulta('locais', {})
  const { executar, ocupado } = useComando()
  // versao = a do usuário quando o formulário abriu (outro administrador mudou no meio → recusa, não reativa ninguém)
  const [ed, setEd] = useState<{ id: string; login: string; nome: string; perfil: 'admin' | 'funcionario'; pessoaId?: string; localId?: string; senha?: string; ativo: boolean; novo: boolean; versao?: number }>()
  const [minha, setMinha] = useState<{ atual: string; nova: string }>()
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <Botao onClick={() => setEd({ id: novoId(), login: '', nome: '', perfil: 'funcionario', ativo: true, novo: true })}>+ {t('Usuário')}</Botao>
        <Botao variante="secundario" onClick={() => setMinha({ atual: '', nova: '' })}>{t('Trocar minha senha')}</Botao>
      </div>
      <p className="flex items-center text-sm text-[var(--suave)]">{t('Cada ação do sistema fica registrada no nome do usuário que entrou.')}<Info texto="Administrador vê e faz tudo. Funcionário só vende/atende, vê a própria agenda, a unidade e as próprias comissões. Ex.: Sofia entra e vê só os horários dela." /></p>
      {!dados ? <Carregando /> : (
        <ul className="grid gap-2 md:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
          {dados.map((u) => (
            <li key={u.id}>
              <button type="button" className={cx('w-full rounded-xl border bg-[var(--cartao)] p-3 text-left', u.ativo ? 'border-[var(--borda)]' : 'border-dashed border-[var(--borda)] opacity-60')} onClick={() => setEd({ id: u.id, login: u.login, nome: u.nome, perfil: u.perfil, pessoaId: u.pessoaId, localId: u.localId, ativo: u.ativo, novo: false, versao: u.versao })}>
                <div className="flex items-center justify-between gap-2"><b>{u.nome}</b><Pilula tom={u.perfil === 'admin' ? 'marca' : 'neutro'}>{t(u.perfil === 'admin' ? 'Administrador' : 'Funcionário')}</Pilula></div>
                <div className="text-xs text-[var(--suave)]"><span className="font-mono">{u.login}</span>{u.local ? ` · ${u.local}` : ''}{u.ultimoAcesso ? ` · ${t('último acesso')} ${new Date(u.ultimoAcesso).toLocaleString(loc())}` : ''}{!u.ativo ? ` · ${t('desativado')}` : ''}</div>
              </button>
            </li>
          ))}
        </ul>
      )}
      {ed && (
        <Janela aberta titulo={t(ed.novo ? 'Novo usuário' : 'Editar usuário')} onFechar={() => setEd(undefined)} rodape={<Botao grande className="w-full" disabled={ocupado} onClick={async () => (await executar('salvarUsuario', { id: ed.id, login: ed.login, nome: ed.nome, perfil: ed.perfil, pessoaId: ed.pessoaId, localId: ed.localId, senha: ed.senha || undefined, ativo: ed.ativo, versaoBase: ed.novo ? undefined : ed.versao }, t('Salvo.'))) && setEd(undefined)}>{t('Salvar')}</Botao>}>
          <div className="grid gap-3 sm:grid-cols-2">
            <Campo rotulo="Usuário (para entrar)" ajuda="Letras minúsculas, sem espaço. Ex.: sofia"><Entrada autoCapitalize="none" value={ed.login} onChange={(e) => setEd({ ...ed, login: e.target.value })} /></Campo>
            <Campo rotulo="Nome"><Entrada value={ed.nome} onChange={(e) => setEd({ ...ed, nome: e.target.value })} /></Campo>
            <Campo rotulo="Perfil"><Selecao valor={ed.perfil} onChange={(v) => setEd({ ...ed, perfil: v as 'admin' })} opcoes={[{ id: 'admin', nome: t('Administrador (tudo)') }, { id: 'funcionario', nome: t('Funcionário (só a unidade e a própria agenda)') }]} /></Campo>
            <Campo rotulo={ed.novo ? 'Senha' : 'Nova senha (deixe vazio para manter)'}><Entrada type="password" autoComplete="new-password" value={ed.senha ?? ''} onChange={(e) => setEd({ ...ed, senha: e.target.value })} /></Campo>
            <Campo rotulo="É a pessoa" ajuda="Liga o usuário à funcionária: a agenda e as comissões dela aparecem para ela."><Selecao valor={ed.pessoaId} vazio="—" onChange={(v) => setEd({ ...ed, pessoaId: v || undefined })} opcoes={(pessoas ?? []).filter((p) => p.papeis.includes('funcionario') || p.papeis.includes('profissional')).map((p) => ({ id: p.id, nome: p.nome }))} /></Campo>
            <Campo rotulo="Unidade"><Selecao valor={ed.localId} vazio="Todas" onChange={(v) => setEd({ ...ed, localId: v || undefined })} opcoes={(locais ?? []).map((l) => ({ id: l.id, nome: l.nome }))} /></Campo>
            {!ed.novo && ed.id !== sessao.usuarioId && <label className="flex items-center gap-2 text-sm"><input type="checkbox" className="h-5 w-5" checked={ed.ativo} onChange={(e) => setEd({ ...ed, ativo: e.target.checked })} /> {t('Ativo (pode entrar)')}</label>}
          </div>
        </Janela>
      )}
      {minha && (
        <Janela aberta titulo={t('Trocar minha senha')} onFechar={() => setMinha(undefined)} rodape={<Botao grande className="w-full" disabled={ocupado} onClick={async () => (await executar('trocarMinhaSenha', minha, t('Senha trocada.'))) && setMinha(undefined)}>{t('Salvar')}</Botao>}>
          <div className="space-y-3">
            <Campo rotulo="Senha atual"><Entrada type="password" autoComplete="current-password" value={minha.atual} onChange={(e) => setMinha({ ...minha, atual: e.target.value })} /></Campo>
            <Campo rotulo="Nova senha"><Entrada type="password" autoComplete="new-password" value={minha.nova} onChange={(e) => setMinha({ ...minha, nova: e.target.value })} /></Campo>
          </div>
        </Janela>
      )}
    </div>
  )
}
