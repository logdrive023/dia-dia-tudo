// O TEXTO DO WHATSAPP (gerador da vitrine): já vem pronto e cada idioma pode ser reescrito, com a prévia da mensagem
// mudando enquanto digita. Faz parte do rascunho: só vale para o comprador depois de "Salvar e publicar".
import { useRef, useState } from 'react'
import type { MensagensVitrine, ModoPrecoVitrine, PacoteVitrine, TipoMensagemVitrine } from '../../../core/services/vitrine'
import { Botao, Campo, Cartao, Escolha } from '../../../shared/ui/base'
import { type Idioma, useDicionario, useT } from '../../../shared/ui/i18n'
import { PreviaWhatsapp } from '../../../shared/ui/previaWhatsapp'
import { kg } from '../model/formato'
import { VARIAVEIS_MENSAGEM, mensagemLista, mensagemLoja, mensagemPacote, textoPronto, variaveisDesconhecidas } from '../model/mensagem'

const MAX = 500
const classeTexto = 'w-full rounded-xl border border-[var(--borda)] bg-[var(--cartao)] p-3 text-base outline-none focus:border-[var(--marca)]'
const EXEMPLOS: PacoteVitrine[] = [
  { id: 'exemplo-1', codigo: 'L-0001', medida: 60, categoria: 'Normal', cor: 'Preto', gramas: 1000 },
  { id: 'exemplo-2', codigo: 'L-0002', medida: 50, categoria: 'Normal', cor: 'Castanho', gramas: 500 },
  { id: 'exemplo-3', codigo: 'L-0003', medida: 40, categoria: 'Normal', cor: 'Loiro', gramas: 250 },
]
type Qual = 'pacote' | 'lista' | 'loja'

export function MensagensWhatsapp({ valor, onChange, loja, pacotes, modoPreco }: {
  valor?: MensagensVitrine
  onChange(m: MensagensVitrine | undefined): void
  loja: string
  /** os pacotes da vitrine, para a prévia ficar real */
  pacotes: PacoteVitrine[]
  modoPreco: ModoPrecoVitrine
}) {
  const t = useT()
  const area = useRef<HTMLTextAreaElement>(null)
  useDicionario('es') // o texto pronto em espanhol
  const [idioma, setIdioma] = useState<Idioma>('es')
  const [qual, setQual] = useState<Qual>('pacote')
  const tipos: TipoMensagemVitrine[] = qual === 'loja' ? ['loja'] : [qual, 'perguntaPreco']
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
  const exemplos = pacotes.length ? pacotes.slice(0, 3) : EXEMPLOS
  const semPreco = modoPreco === 'contato' || !exemplos[0].preco
  const previa = qual === 'pacote' ? mensagemPacote(idioma, exemplos[0], loja, kg(exemplos[0].gramas), semPreco, valor) : qual === 'lista' ? mensagemLista(idioma, exemplos, loja, modoPreco, valor) : mensagemLoja(idioma, loja, valor)
  const variaveis = VARIAVEIS_MENSAGEM.filter((v) => (v.em as readonly string[]).includes(qual))
  return (
    <Cartao titulo={t('Mensagem do WhatsApp')} ajuda="O texto que já aparece escrito quando o comprador toca no botão. Ele ainda pode mudar antes de enviar. Ex.: troque a saudação pelo jeito da sua loja.">
      <div className="space-y-3">
        <Escolha<Idioma> rotulo="Idioma da mensagem" valor={idioma} onChange={setIdioma} opcoes={[{ id: 'es', nome: 'Español' }, { id: 'pt', nome: 'Português' }]} />
        <Escolha<Qual> rotulo="Qual mensagem" valor={qual} onChange={setQual} opcoes={[{ id: 'pacote', nome: 'Um pacote' }, { id: 'lista', nome: 'Lista de compras' }, { id: 'loja', nome: 'Botão da loja' }]} />
        <Campo rotulo={qual === 'pacote' ? 'Mensagem do pacote' : qual === 'lista' ? 'Mensagem da lista' : 'Mensagem da loja'}>
          <textarea ref={area} rows={qual === 'lista' ? 6 : 4} maxLength={MAX} className={classeTexto} value={texto(qual)} onChange={(e) => mudar(qual, e.target.value)} />
        </Campo>
        <div>
          <p className="mb-1 text-xs text-[var(--suave)]">{t('Inserir no texto')}</p>
          <div className="flex flex-wrap gap-2">
            {variaveis.map((v) => <button key={v.id} type="button" onClick={() => inserir(v.id)} className="min-h-10 toque:min-h-11 rounded-full bg-[var(--marca-suave)] px-3 text-sm font-semibold text-[var(--marca)] transition duration-100 active:scale-[0.97] motion-reduce:transform-none">+ {t(v.rotulo)}</button>)}
          </div>
        </div>
        {qual !== 'loja' && (
          <Campo rotulo="Pergunta quando o preço não aparece" ajuda="Vai no fim da mensagem quando o comprador não vê o valor. Deixe em branco para não perguntar.">
            <textarea rows={2} maxLength={MAX} className={classeTexto} value={texto('perguntaPreco')} onChange={(e) => mudar('perguntaPreco', e.target.value)} />
          </Campo>
        )}
        {estranhas.length > 0 && <p role="alert" className="text-xs font-semibold text-[var(--alerta)]">{t('O comprador vai ver isto escrito assim: {v}. Use os botões acima.', { v: estranhas.map((x) => `{${x}}`).join(', ') })}</p>}
        <PreviaWhatsapp texto={previa} />
        {personalizado && <Botao variante="leve" className="w-full" onClick={restaurar}>↺ {t('Voltar ao texto pronto')}</Botao>}
      </div>
    </Cartao>
  )
}
