// CONFIGURAÇÕES › Usuários: quem entra no sistema, perfil e acesso.
// Uma seção = um arquivo (a lista das seções e onde cada uma aparece fica em ../configSecoes.ts).
import { useState } from 'react'
import { novoId } from '../../../core/domain/ids'
import { faltaNaSenha } from '../../../core/domain/senha'
import { nomeProprio } from '../../../core/domain/textoFormatado'
import { Botao, Campo, Carregando, Entrada, Info, Pilula, Selecao, cx, loc } from '../../../shared/ui/base'
import { useApp, useComando, useConsulta } from '../../../shared/ui/contexto'
import { useT } from '../../../shared/ui/i18n'
import { Interruptor } from '../../../shared/ui/interruptor'
import { GrupoCampos, JanelaCadastro } from '../../../shared/ui/janelaCadastro'
import { SenhaInput } from '../../../shared/ui/senhaInput'
import { Paginada } from '../../../shared/ui/paginacao'

const senhaBoa = (s: string) => !faltaNaSenha(s).length

export function Usuarios() {
  const t = useT()
  const { sessao } = useApp()
  const { dados } = useConsulta('usuarios', {})
  const { dados: pessoas } = useConsulta('pessoas', {})
  const { dados: locais } = useConsulta('locais', {})
  const { executar, ocupado } = useComando()
  // versao = a do usuário quando o formulário abriu (outro administrador mudou no meio → recusa, não reativa ninguém)
  const [ed, setEd] = useState<{ id: string; login: string; nome: string; perfil: 'admin' | 'funcionario'; pessoaId?: string; localId?: string; senha?: string; ativo: boolean; novo: boolean; versao?: number }>()
  const [minha, setMinha] = useState(false)
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <Botao onClick={() => setEd({ id: novoId(), login: '', nome: '', perfil: 'funcionario', ativo: true, novo: true })}>+ {t('Usuário')}</Botao>
        <Botao variante="secundario" onClick={() => setMinha(true)}>{t('Trocar minha senha')}</Botao>
      </div>
      <p className="flex items-center text-sm text-[var(--suave)]">{t('Cada ação do sistema fica registrada no nome do usuário que entrou.')}<Info texto="Administrador vê e faz tudo. Funcionário só vende/atende, vê a própria agenda, a unidade e as próprias comissões. Ex.: Sofia entra e vê só os horários dela." /></p>
      {!dados ? <Carregando /> : (
        <Paginada itens={dados} unidade="usuário(s)" reiniciar={String(dados.length)}>{(pagina) => (
          <ul className="grid gap-2 md:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
          {pagina.map((u) => (
            <li key={u.id}>
              <button type="button" className={cx('w-full rounded-xl border bg-[var(--cartao)] p-3 text-left', u.ativo ? 'border-[var(--borda)]' : 'border-dashed border-[var(--borda)] opacity-60')} onClick={() => setEd({ id: u.id, login: u.login, nome: u.nome, perfil: u.perfil, pessoaId: u.pessoaId, localId: u.localId, ativo: u.ativo, novo: false, versao: u.versao })}>
                <div className="flex items-center justify-between gap-2"><b>{u.nome}</b><Pilula tom={u.perfil === 'admin' ? 'marca' : 'neutro'}>{t(u.perfil === 'admin' ? 'Administrador' : 'Funcionário')}</Pilula></div>
                <div className="text-xs text-[var(--suave)]"><span className="font-mono">{u.login}</span>{u.local ? ` · ${u.local}` : ''}{u.ultimoAcesso ? ` · ${t('último acesso')} ${new Date(u.ultimoAcesso).toLocaleString(loc())}` : ''}{!u.ativo ? ` · ${t('desativado')}` : ''}</div>
              </button>
            </li>
          ))}
        </ul>
        )}</Paginada>
      )}
      {ed && (
        <JanelaCadastro titulo={ed.novo ? 'Novo usuário' : 'Editar usuário'} onFechar={() => setEd(undefined)} ocupado={ocupado}
          podeSalvar={!!ed.login.trim() && !!ed.nome.trim() && (ed.senha ? senhaBoa(ed.senha) : !ed.novo)}
          onSalvar={async () => (await executar('salvarUsuario', { id: ed.id, login: ed.login.trim().toLowerCase(), nome: nomeProprio(ed.nome), perfil: ed.perfil, pessoaId: ed.pessoaId, localId: ed.localId, senha: ed.senha || undefined, ativo: ed.ativo, versaoBase: ed.novo ? undefined : ed.versao }, t('Salvo.'))) && setEd(undefined)}>
          <GrupoCampos titulo="Quem é">
            <Campo rotulo="Nome"><Entrada value={ed.nome} onChange={(e) => setEd({ ...ed, nome: e.target.value })} onBlur={() => setEd({ ...ed, nome: nomeProprio(ed.nome) })} /></Campo>
            <Campo rotulo="É a pessoa" ajuda="Liga o usuário à funcionária: a agenda e as comissões dela aparecem para ela."><Selecao valor={ed.pessoaId} vazio="—" onChange={(v) => setEd({ ...ed, pessoaId: v || undefined })} opcoes={(pessoas ?? []).filter((p) => p.papeis.includes('funcionario') || p.papeis.includes('profissional')).map((p) => ({ id: p.id, nome: p.nome }))} /></Campo>
            <Campo rotulo="Perfil"><Selecao valor={ed.perfil} onChange={(v) => setEd({ ...ed, perfil: v as 'admin' })} opcoes={[{ id: 'admin', nome: t('Administrador') }, { id: 'funcionario', nome: t('Funcionário') }]} /></Campo>
            <Campo rotulo="Unidade"><Selecao valor={ed.localId} vazio="Todas" onChange={(v) => setEd({ ...ed, localId: v || undefined })} opcoes={(locais ?? []).map((l) => ({ id: l.id, nome: l.nome }))} /></Campo>
            <p className="text-xs text-[var(--suave)] sm:col-span-2">{t(ed.perfil === 'admin' ? 'Administrador vê e faz tudo.' : 'Funcionário só vende e atende: vê a unidade, a própria agenda e as próprias comissões.')}</p>
          </GrupoCampos>
          <GrupoCampos titulo="Acesso">
            <Campo rotulo="Usuário (para entrar)" ajuda="Letras minúsculas, sem espaço. Ex.: sofia"><Entrada autoCapitalize="none" spellCheck={false} value={ed.login} onChange={(e) => setEd({ ...ed, login: e.target.value.replace(/\s/g, '').toLowerCase() })} /></Campo>
            <Campo comoDiv rotulo={ed.novo ? 'Senha' : 'Nova senha (deixe vazio para manter)'} ajuda="A senha é guardada embaralhada: ninguém consegue ver a senha atual, nem o administrador. Esqueceu? Defina ou gere uma nova aqui e passe para a pessoa."><SenhaInput rotulo={ed.novo ? 'Senha' : 'Nova senha'} nova gerar opcional={!ed.novo} valor={ed.senha ?? ''} onChange={(senha) => setEd({ ...ed, senha })} /></Campo>
            {!ed.novo && ed.id !== sessao.usuarioId && <div className="sm:col-span-2"><Interruptor ligado={ed.ativo} onChange={(ativo) => setEd({ ...ed, ativo })} titulo="Ativo (pode entrar)" texto="Desligado, a pessoa não entra mais; o que ela fez continua no histórico." /></div>}
          </GrupoCampos>
        </JanelaCadastro>
      )}
      {minha && <TrocarMinhaSenha onFechar={() => setMinha(false)} />}
    </div>
  )
}

/** TROCAR MINHA SENHA: a mesma janela para o admin (Usuários) e para a funcionária (Configurações) */
export function TrocarMinhaSenha({ onFechar }: { onFechar(): void }) {
  const t = useT()
  const { executar, ocupado } = useComando()
  const [minha, setMinha] = useState({ atual: '', nova: '' })
  return (
    <JanelaCadastro titulo="Trocar minha senha" onFechar={onFechar} ocupado={ocupado} podeSalvar={!!minha.atual && senhaBoa(minha.nova)}
      onSalvar={async () => (await executar('trocarMinhaSenha', minha, t('Senha trocada.'))) && onFechar()}>
      <GrupoCampos colunas={1}>
        <Campo comoDiv rotulo="Senha atual"><SenhaInput rotulo="Senha atual" valor={minha.atual} onChange={(atual) => setMinha({ ...minha, atual })} /></Campo>
        <Campo comoDiv rotulo="Nova senha"><SenhaInput rotulo="Nova senha" nova valor={minha.nova} onChange={(nova) => setMinha({ ...minha, nova })} /></Campo>
      </GrupoCampos>
    </JanelaCadastro>
  )
}
