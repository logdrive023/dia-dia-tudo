// O TEXTO DO WHATSAPP (gerador da vitrine): já vem pronto e cada idioma pode ser reescrito, com a prévia da mensagem
// mudando enquanto digita. Faz parte do rascunho: só vale para o comprador depois de "Salvar e publicar".
import { useRef, useState } from 'react'
import type { MensagensVitrine, PacoteVitrine, TipoMensagemVitrine } from '../../../core/services/vitrine'
import { Botao, Campo, Cartao, Escolha } from '../../../shared/ui/base'
import { type Idioma, useT } from '../../../shared/ui/i18n'
import { VARIAVEIS_MENSAGEM, mensagemLoja, mensagemPacote, textoPronto, variaveisDesconhecidas } from '../model/mensagem'
import { kg } from './ConteudoLoja'

const MAX = 500
const classeTexto = 'w-full rounded-xl border border-[var(--borda)] bg-[var(--cartao)] p-3 text-base outline-none focus:border-[var(--marca)]'
const EXEMPLO: PacoteVitrine = { id: 'exemplo', codigo: 'L-0001', medida: 60, categoria: 'Normal', cor: 'Preto', gramas: 1000 }

export function MensagensWhatsapp({ valor, onChange, loja, pacote, semPreco }: {
  valor?: MensagensVitrine
  onChange(m: MensagensVitrine | undefined): void
  loja: string
  /** o primeiro pacote da vitrine, para a prévia ficar real */
  pacote?: PacoteVitrine
  /** a loja não mostra preço: a pergunta do valor vai junto */
  semPreco: boolean
}) {
  const t = useT()
  const area = useRef<HTMLTextAreaElement>(null)
  const [idioma, setIdioma] = useState<Idioma>('es')
  const [qual, setQual] = useState<'pacote' | 'loja'>('pacote')
  const tipos: TipoMensagemVitrine[] = qual === 'pacote' ? ['pacote', 'perguntaPreco'] : ['loja']
  const texto = (tipo: TipoMensagemVitrine) => valor?.[idioma]?.[tipo] ?? textoPronto(idioma, tipo)
  const mudar = (tipo: TipoMensagemVitrine, v: string) => onChange({ ...valor, [idioma]: { ...valor?.[idioma], [tipo]: v } })
  const inserir = (id: string) => {
    const atual = texto(qual)
    const de = area.current?.selectionStart ?? atual.length
    const ate = area.current?.selectionEnd ?? de
    mudar(qual, `${atual.slice(0, de)}{${id}}${atual.slice(ate)}`)
  }
  const personalizado = tipos.some((x) => valor?.[idioma]?.[x] !== undefined)
  const restaurar = () => {
    const doIdioma = { ...valor?.[idioma] }
    for (const x of tipos) delete doIdioma[x]
    onChange({ ...valor, [idioma]: doIdioma })
  }
  const estranhas = [...new Set(tipos.flatMap((x) => variaveisDesconhecidas(texto(x))))]
  const exemplo = pacote ?? EXEMPLO
  const previa = qual === 'pacote' ? mensagemPacote(idioma, exemplo, loja, kg(exemplo.gramas), semPreco, valor) : mensagemLoja(idioma, loja, valor)
  const variaveis = qual === 'pacote' ? VARIAVEIS_MENSAGEM : VARIAVEIS_MENSAGEM.filter((v) => v.id === 'loja')
  return (
    <Cartao titulo={t('Mensagem do WhatsApp')} ajuda="O texto que já aparece escrito quando o comprador toca no botão. Ele ainda pode mudar antes de enviar. Ex.: troque a saudação pelo jeito da sua loja.">
      <div className="space-y-3">
        <Escolha<Idioma> rotulo="Idioma da mensagem" valor={idioma} onChange={setIdioma} opcoes={[{ id: 'es', nome: 'Español' }, { id: 'pt', nome: 'Português' }]} />
        <Escolha<'pacote' | 'loja'> rotulo="Qual mensagem" valor={qual} onChange={setQual} opcoes={[{ id: 'pacote', nome: 'Botão do pacote' }, { id: 'loja', nome: 'Botão da loja' }]} />
        <Campo rotulo={qual === 'pacote' ? 'Mensagem do pacote' : 'Mensagem da loja'}>
          <textarea ref={area} rows={4} maxLength={MAX} className={classeTexto} value={texto(qual)} onChange={(e) => mudar(qual, e.target.value)} />
        </Campo>
        <div>
          <p className="mb-1 text-xs text-[var(--suave)]">{t('Inserir no texto')}</p>
          <div className="flex flex-wrap gap-2">
            {variaveis.map((v) => <button key={v.id} type="button" onClick={() => inserir(v.id)} className="min-h-10 rounded-full bg-[var(--marca-suave)] px-3 text-sm font-semibold text-[var(--marca)]">+ {t(v.rotulo)}</button>)}
          </div>
        </div>
        {qual === 'pacote' && (
          <Campo rotulo="Pergunta quando o preço não aparece" ajuda="Vai no fim da mensagem quando o comprador não vê o valor. Deixe em branco para não perguntar.">
            <textarea rows={2} maxLength={MAX} className={classeTexto} value={texto('perguntaPreco')} onChange={(e) => mudar('perguntaPreco', e.target.value)} />
          </Campo>
        )}
        {estranhas.length > 0 && <p role="alert" className="text-xs font-semibold text-[var(--alerta)]">{t('O comprador vai ver isto escrito assim: {v}. Use os botões acima.', { v: estranhas.map((x) => `{${x}}`).join(', ') })}</p>}
        <div>
          <p className="mb-1 text-xs font-bold uppercase tracking-wider text-[var(--suave)]">{t('Prévia no WhatsApp')}</p>
          <div className="rounded-xl bg-[#e5ddd5] p-3">
            <p data-testid="previa-whatsapp" className="ml-auto w-fit max-w-[90%] whitespace-pre-wrap break-words rounded-lg bg-[#dcf8c6] px-3 py-2 text-sm text-[#111111]">{previa}</p>
          </div>
        </div>
        {personalizado && <Botao variante="leve" className="w-full" onClick={restaurar}>↺ {t('Voltar ao texto pronto')}</Botao>}
      </div>
    </Cartao>
  )
}
