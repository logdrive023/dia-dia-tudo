// COBRAR NO WHATSAPP (adiantamento e empréstimo) — a mesma ideia das mensagens da vitrine:
//   Español | Português  →  o texto (pronto ou o seu), editável  →  "+ Nome", "+ Quanto falta"… inserem os dados
//   →  a PRÉVIA com os dados DESTA conta  →  💬 Abrir no WhatsApp (sai com o texto da tela)
//   O texto mudado vale só para esta mensagem; "Usar sempre este texto" guarda como o padrão (só o administrador).
import { useRef, useState } from 'react'
import type { TipoCobranca } from '../../../core/services/cobranca'
import { Botao, Campo, Escolha, Janela } from '../../../shared/ui/base'
import { linkWhatsApp } from '../../../shared/ui/compartilhados'
import { useApp, useComando, useConsulta } from '../../../shared/ui/contexto'
import { type Idioma, useDicionario, useT } from '../../../shared/ui/i18n'
import { PreviaWhatsapp, variaveisFora } from '../../../shared/ui/previaWhatsapp'
import { VARIAVEIS_COBRANCA, mensagemCobranca, modeloCobranca, textoProntoCobranca } from '../model/cobranca'

const MAX = 600

export function JanelaCobranca({ tipo, valores, telefone, onFechar }: {
  tipo: TipoCobranca
  /** os dados desta conta (nome, falta, parcelas…); o nome da loja vem da configuração */
  valores: Record<string, string>
  telefone?: string
  onFechar(): void
}) {
  const t = useT()
  const { sessao } = useApp()
  const admin = sessao.perfil === 'admin'
  useDicionario('es') // o texto pronto em espanhol
  const { dados: conf } = useConsulta('configuracoes', {})
  const { executar, ocupado } = useComando()
  const salvos = conf?.config.cobrancas
  const [idioma, setIdioma] = useState<Idioma>('es')
  const [texto, setTexto] = useState<string>()
  const area = useRef<HTMLTextAreaElement>(null)
  const padrao = modeloCobranca(idioma, tipo, salvos)
  const atual = texto ?? padrao
  const todos = { loja: conf?.config.nomeNegocio ?? '', ...valores }
  const msg = mensagemCobranca(atual, todos)
  const variaveis = VARIAVEIS_COBRANCA[tipo]
  const estranhas = variaveisFora(atual, variaveis.map((v) => v.id))
  const proprio = !!salvos?.[idioma]?.[tipo]
  const mudou = atual.trim() !== padrao.trim()
  const inserir = (id: string) => {
    const de = area.current?.selectionStart ?? atual.length
    const ate = area.current?.selectionEnd ?? de
    setTexto(`${atual.slice(0, de)}{${id}}${atual.slice(ate)}`)
  }
  /** guarda (ou apaga, com '') o texto padrão deste idioma */
  const guardar = (novo: string, aviso: string) => executar('salvarConfig', { cobrancas: { ...salvos, [idioma]: { ...salvos?.[idioma], [tipo]: novo } } } as never, aviso)
  const enviar = () => {
    window.open(linkWhatsApp(msg, telefone), '_blank', 'noopener')
    onFechar()
  }
  return (
    <Janela aberta titulo={`💬 ${t('Cobrar no WhatsApp')}`} onFechar={onFechar} rodape={
      <div className="space-y-2">
        {!telefone && <p className="text-xs text-[var(--alerta)]">{t('Esta pessoa não tem WhatsApp cadastrado: o WhatsApp vai pedir para escolher o contato.')}</p>}
        <Botao grande className="w-full !bg-[#25d366]" disabled={!msg.trim()} onClick={enviar}>💬 {t('Abrir no WhatsApp')}</Botao>
      </div>
    }>
      <div className="space-y-3">
        <Escolha<Idioma> rotulo="Idioma da mensagem" valor={idioma} onChange={(v) => (setIdioma(v), setTexto(undefined))} opcoes={[{ id: 'es', nome: 'Español' }, { id: 'pt', nome: 'Português' }]} />
        <Campo rotulo="Mensagem" ajuda="Já vem pronta. Mude o que quiser: a mudança vale para esta mensagem; para guardar como padrão, toque em “Usar sempre este texto”.">
          <textarea ref={area} rows={6} maxLength={MAX} className="w-full rounded-xl border border-[var(--borda)] bg-[var(--cartao)] p-3 text-base outline-none focus:border-[var(--marca)]" value={atual} onChange={(e) => setTexto(e.target.value)} />
        </Campo>
        <div>
          <p className="mb-1 text-xs text-[var(--suave)]">{t('Inserir no texto')}</p>
          <div className="flex flex-wrap gap-2">
            {variaveis.map((v) => <button key={v.id} type="button" onClick={() => inserir(v.id)} className="min-h-10 toque:min-h-11 rounded-full bg-[var(--marca-suave)] px-3 text-sm font-semibold text-[var(--marca)] transition duration-100 active:scale-[0.97] motion-reduce:transform-none">+ {t(v.rotulo)}</button>)}
          </div>
        </div>
        {estranhas.length > 0 && <p role="alert" className="text-xs font-semibold text-[var(--alerta)]">{t('A pessoa vai ver isto escrito assim: {v}. Use os botões acima.', { v: estranhas.map((x) => `{${x}}`).join(', ') })}</p>}
        <PreviaWhatsapp texto={msg} testId="previa-cobranca" />
        {admin && (mudou || proprio) && (
          <div className="flex flex-wrap gap-2">
            {mudou && <Botao variante="secundario" className="flex-1" disabled={ocupado || estranhas.length > 0} onClick={async () => (await guardar(atual, t('Texto guardado: as próximas cobranças já saem assim.'))) && setTexto(undefined)}>💾 {t('Usar sempre este texto')}</Botao>}
            {(mudou || proprio) && <Botao variante="leve" className="flex-1" disabled={ocupado} onClick={async () => (proprio ? (await guardar('', t('Voltou ao texto pronto.'))) && setTexto(undefined) : setTexto(textoProntoCobranca(idioma, tipo)))}>↺ {t('Voltar ao texto pronto')}</Botao>}
          </div>
        )}
      </div>
    </Janela>
  )
}
