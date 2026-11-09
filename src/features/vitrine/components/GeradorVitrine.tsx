// GERADOR DA VITRINE: à esquerda os controles (textos, cores, banner, fundo), à direita a PRÉVIA AO VIVO — a mesma peça
// da loja do comprador, lendo o rascunho (nada é salvo até "Salvar e publicar"). Celular: uma coisa de cada vez
// (Ajustar | Prévia); computador: lado a lado, com a prévia acompanhando a rolagem.
import { useEffect, useState } from 'react'
import { BANNER_MAX, type ConfigVitrine, bannerValido, corValida } from '../../../core/services/vitrine'
import { Botao, Campo, Cartao, Entrada, Escolha, Selecao, cx } from '../../../shared/ui/base'
import { comprimirImagem } from '../../../shared/ui/compartilhados'
import { useApp } from '../../../shared/ui/contexto'
import { useT } from '../../../shared/ui/i18n'
import { Interruptor } from '../../../shared/ui/interruptor'
import { useRascunhoVitrine } from '../hooks/useRascunhoVitrine'
import { OPCOES_FUNDO, PALETAS, estiloLoja, primariaLegivel } from '../model/aparencia'
import { ConteudoLoja, type DadosLoja } from './ConteudoLoja'
import { MensagensWhatsapp } from './MensagensWhatsapp'

/** a cor: o seletor do aparelho + o código (#7c3aed); enquanto digita um código incompleto, a prévia fica na última válida */
function CampoCor({ rotulo, valor, onChange }: { rotulo: string; valor: string; onChange(v: string): void }) {
  const t = useT()
  const [texto, setTexto] = useState(valor)
  useEffect(() => setTexto(valor), [valor])
  return (
    <div>
      <p className="mb-1 text-sm font-semibold text-[var(--suave)]">{t(rotulo)}</p>
      <div className="flex items-center gap-2">
        <input type="color" aria-label={t(rotulo)} value={valor} onChange={(e) => onChange(e.target.value)} className="h-11 w-12 shrink-0 cursor-pointer rounded-xl border border-[var(--borda)] bg-[var(--cartao)] p-1" />
        <Entrada aria-label={`${t(rotulo)} (${t('código')})`} className="num min-w-0 flex-1" value={texto} maxLength={7} autoComplete="off" spellCheck={false}
          onChange={(e) => { const v = e.target.value.trim(); setTexto(v); if (corValida(v)) onChange(v.toLowerCase()) }} onBlur={() => setTexto(valor)} />
      </div>
    </div>
  )
}

function lerComoDados(b: Blob) {
  return new Promise<string>((ok, erro) => {
    const r = new FileReader()
    r.onload = () => ok(String(r.result))
    r.onerror = () => erro(r.error)
    r.readAsDataURL(b)
  })
}

export function GeradorVitrine({ publicado, nomeNegocio, dados, colunasPreco, salvar, ocupado }: {
  publicado: ConfigVitrine
  nomeNegocio: string
  /** a loja como está (os pacotes visíveis vão para a prévia) */
  dados: DadosLoja
  colunasPreco: { id: string; nome: string }[]
  salvar(v: Partial<ConfigVitrine>, aviso?: string): Promise<unknown>
  ocupado: boolean
}) {
  const t = useT()
  const { avisar } = useApp()
  const { rascunho: r, sujo, mudar, mudarAparencia, desfazer } = useRascunhoVitrine(publicado)
  const a = r.aparencia
  const [painel, setPainel] = useState<'ajustar' | 'previa'>('ajustar')
  const [aparelho, setAparelho] = useState<'celular' | 'computador'>('celular')
  const [enviando, setEnviando] = useState(false)
  const publicar = async () => {
    if (await salvar({ nome: r.nome, descricao: r.descricao, whatsapp: r.whatsapp, aparencia: a, mensagens: r.mensagens }, t('Vitrine publicada.'))) desfazer()
  }
  const enviarBanner = async (f?: File) => {
    if (!f) return
    setEnviando(true)
    try {
      const url = await lerComoDados(await comprimirImagem(f, 1400))
      if (url.length > BANNER_MAX || !bannerValido(url)) avisar(t('Não deu para usar esta imagem: envie um JPG, PNG ou WebP menor.'), 'erro')
      else mudarAparencia({ banner: url })
    } catch {
      avisar(t('Não deu para usar esta imagem: envie um JPG, PNG ou WebP menor.'), 'erro')
    } finally {
      setEnviando(false)
    }
  }
  const modoPreco = publicado.modoPreco ?? 'contato'
  // o que a prévia mostra: a loja de verdade com o rascunho por cima
  const previa: DadosLoja = { ...dados, loja: { ...dados.loja, nome: r.nome.trim() || nomeNegocio, descricao: r.descricao.trim() || undefined, whatsapp: r.whatsapp.replace(/[^\d+]/g, '') || undefined, mensagens: r.mensagens, aparencia: a } }
  const estreita = aparelho === 'celular'
  return (
    <section aria-label={t('Gerador da vitrine')} className="mb-6">
      {/* publicar: sempre à vista, com o estado do rascunho */}
      <div className="sticky top-2 z-20 mb-3 flex flex-wrap items-center gap-2 rounded-2xl border border-[var(--borda)] bg-[var(--cartao)] p-2 pl-4 shadow-sm">
        <p role="status" className={cx('min-w-0 flex-1 text-sm font-semibold', sujo ? 'text-[var(--alerta)]' : 'text-[var(--suave)]')}>{t(sujo ? 'Alterações ainda não publicadas' : 'Tudo publicado')}</p>
        {sujo && <Botao variante="leve" onClick={desfazer}>{t('Desfazer')}</Botao>}
        <Botao disabled={!sujo || ocupado} carregando={ocupado} onClick={publicar}>{t('Salvar e publicar')}</Botao>
      </div>
      <div className="mb-3 lg:hidden">
        <Escolha<'ajustar' | 'previa'> rotulo="Ajustar ou ver a prévia" valor={painel} onChange={setPainel} opcoes={[{ id: 'ajustar', nome: '🎛 Ajustar' }, { id: 'previa', nome: '👁 Prévia' }]} />
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.25fr)] lg:items-start">
        <div className={cx('space-y-4', painel !== 'ajustar' && 'hidden lg:block')}>
          <Cartao titulo={t('Textos da loja')}>
            <div className="space-y-3">
              <Campo rotulo="Nome da loja"><Entrada value={r.nome} placeholder={nomeNegocio} onChange={(e) => mudar({ nome: e.target.value })} /></Campo>
              <Campo rotulo="Frase do topo" ajuda="A frase pequena acima do nome. Ex.: Direto da Bolívia para o seu salão."><Entrada value={a.slogan ?? ''} maxLength={80} placeholder={t('Vitrine de cabelo')} onChange={(e) => mudarAparencia({ slogan: e.target.value })} /></Campo>
              <Campo rotulo="Texto de apresentação"><Entrada value={r.descricao} placeholder={t('Ex.: Cabelo natural boliviano, separado por medida.')} onChange={(e) => mudar({ descricao: e.target.value })} /></Campo>
              <Campo rotulo="WhatsApp para pedidos" ajuda="Com o código do país. O botão “Quero este” abre uma conversa com a mensagem pronta. Ex.: +591 70000000."><Entrada inputMode="tel" value={r.whatsapp} placeholder="+591 70000000" onChange={(e) => mudar({ whatsapp: e.target.value })} /></Campo>
            </div>
          </Cartao>

          <Cartao titulo={t('Cores')}>
            <div className="flex flex-wrap gap-2" role="group" aria-label={t('Combinações prontas')}>
              {PALETAS.map((p) => {
                const ativa = p.primaria === a.corPrimaria.toLowerCase() && p.secundaria === a.corSecundaria.toLowerCase()
                return (
                  <button key={p.nome} type="button" aria-pressed={ativa} title={t(p.nome)} aria-label={t(p.nome)} onClick={() => mudarAparencia({ corPrimaria: p.primaria, corSecundaria: p.secundaria })}
                    className={cx('h-11 w-11 rounded-full ring-offset-2 ring-offset-[var(--cartao)] transition active:scale-95', ativa ? 'ring-2 ring-[var(--texto)]' : 'ring-1 ring-[var(--borda)]')}
                    style={{ background: `linear-gradient(135deg, ${p.primaria} 50%, ${p.secundaria} 50%)` }} />
                )
              })}
            </div>
            <div className="mt-3 grid gap-3 xs:grid-cols-2">
              <CampoCor rotulo="Cor principal" valor={a.corPrimaria} onChange={(v) => mudarAparencia({ corPrimaria: v })} />
              <CampoCor rotulo="Cor de apoio" valor={a.corSecundaria} onChange={(v) => mudarAparencia({ corSecundaria: v })} />
            </div>
            {!primariaLegivel(a) && <p className="mt-2 rounded-xl bg-[var(--alerta)]/10 p-2 text-xs text-[var(--alerta)]">⚠️ {t('Essa cor some no fundo dos cartões: o preço vai aparecer na cor do texto, para continuar legível.')}</p>}
          </Cartao>

          <Cartao titulo={t('Banner do topo')} ajuda="A imagem atrás do nome da loja. Ela é reduzida no aparelho e o texto continua legível por cima. Sem banner, o topo usa as suas cores.">
            {bannerValido(a.banner) && <img src={a.banner} alt={t('Banner atual')} className="mb-2 h-24 w-full rounded-xl object-cover" />}
            <div className="flex flex-wrap gap-2">
              <label className={cx('inline-flex min-h-11 cursor-pointer items-center rounded-xl bg-[var(--marca-suave)] px-4 text-sm font-semibold text-[var(--marca)]', enviando && 'cursor-wait opacity-60')}>
                🖼 {t(enviando ? 'Preparando…' : a.banner ? 'Trocar imagem' : 'Enviar imagem')}
                <input type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" disabled={enviando} onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; void enviarBanner(f) }} />
              </label>
              {a.banner && <Botao variante="leve" className="min-h-11" onClick={() => mudarAparencia({ banner: undefined })}>{t('Tirar banner')}</Botao>}
            </div>
          </Cartao>

          <Cartao titulo={t('Fundo da página')}>
            <div role="radiogroup" aria-label={t('Fundo da página')} className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {OPCOES_FUNDO.map((f) => (
                <button key={f.id} type="button" role="radio" aria-checked={a.fundo === f.id} onClick={() => mudarAparencia({ fundo: f.id })}
                  className={cx('rounded-2xl border-2 p-2 text-left transition active:scale-[0.98]', a.fundo === f.id ? 'border-[var(--marca)] bg-[var(--marca-suave)]' : 'border-[var(--borda)]')}>
                  <span aria-hidden className="flex h-12 items-end justify-center overflow-hidden rounded-lg border border-[var(--borda)]" style={estiloLoja({ ...a, fundo: f.id })}><span className="h-8 w-3/5 rounded-t-md bg-[var(--cartao)]" /></span>
                  <b className="mt-1 block text-sm">{t(f.nome)}</b>
                  <span className="block text-xs text-[var(--suave)]">{t(f.dica)}</span>
                </button>
              ))}
            </div>
          </Cartao>

          <MensagensWhatsapp valor={r.mensagens} onChange={(m) => mudar({ mensagens: m })} loja={previa.loja.nome} pacote={dados.pacotes[0]} semPreco={modoPreco === 'contato' || !dados.pacotes[0]?.preco} />

          {/* estes valem na hora (não fazem parte do rascunho) */}
          <Cartao titulo={t('Funcionamento')} ajuda="Entra na vitrine o cabelo já separado na triagem, com etiqueta e com saldo. Estes ajustes valem na hora.">
            <div className="space-y-3">
              <Interruptor ligado={publicado.ativa} onChange={(v) => void salvar({ ativa: v }, t(v ? 'Vitrine ligada.' : 'Vitrine desligada: o comprador não vê nada.'))} titulo="Vitrine ligada" texto="Desligada, o link mostra “vitrine fechada”. Você continua vendo a prévia aqui." />
              <div>
                <p className="mb-1 text-sm font-semibold text-[var(--suave)]">{t('Preço na vitrine')}</p>
                <Escolha rotulo="Preço na vitrine" valor={modoPreco} onChange={(v) => void salvar({ modoPreco: v })} opcoes={[{ id: 'contato', nome: 'Entrar em contato' }, { id: 'tabela', nome: 'Preço da tabela' }, { id: 'individual', nome: 'Preço por pacote' }]} />
                <p className="mt-1 text-xs text-[var(--suave)]">{t(modoPreco === 'contato' ? 'O comprador não vê valor: o botão chama a loja no WhatsApp.' : modoPreco === 'tabela' ? 'Mostra o preço por grama que está na sua tabela.' : 'Digite o preço de cada pacote na lista “Pacotes prontos”, aqui embaixo.')}</p>
              </div>
              {modoPreco === 'tabela' && colunasPreco.length > 0 && (
                <Campo rotulo="Qual preço mostrar"><Selecao valor={publicado.colunaId} vazio="O primeiro da tabela" onChange={(v) => void salvar({ colunaId: v || undefined })} opcoes={colunasPreco} /></Campo>
              )}
            </div>
          </Cartao>
        </div>

        {/* PRÉVIA AO VIVO: a mesma peça da loja, com o rascunho */}
        <div className={cx('lg:sticky lg:top-20', painel !== 'previa' && 'hidden lg:block')}>
          <div className="mb-2 flex items-center justify-between gap-2">
            <p className="text-xs font-bold uppercase tracking-wider text-[var(--suave)]">👁 {t('Prévia ao vivo')}</p>
            <div className="hidden lg:block">
              <Escolha<'celular' | 'computador'> rotulo="Ver a prévia como" valor={aparelho} onChange={setAparelho} opcoes={[{ id: 'celular', nome: '📱' }, { id: 'computador', nome: '🖥' }]} />
            </div>
          </div>
          <div data-testid="previa-vitrine" className={cx('mx-auto max-h-[75vh] overflow-y-auto overscroll-contain rounded-3xl border border-[var(--borda)] shadow-lg', estreita ? 'lg:max-w-[390px]' : 'w-full')}>
            <ConteudoLoja dados={previa} colunas={estreita ? 2 : 3} limite={12} />
          </div>
        </div>
      </div>
    </section>
  )
}
