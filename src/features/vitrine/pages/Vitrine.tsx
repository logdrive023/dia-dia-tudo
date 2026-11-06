// MINHA VITRINE (administrador): os pacotes prontos para vender (separados na triagem, com etiqueta, com saldo) e como
// o comprador de fora vê. Padrões da casa: cabeçalho com a ação principal ("Ver como o cliente vê"), 4 números,
// a loja em um cartão (liga/desliga, nome, texto, WhatsApp, preço) e a lista com o interruptor "na vitrine" por pacote.
// A regra (o que entra e o que o comprador vê) é do serviço: src/core/services/vitrine.ts. A página do comprador: Loja.tsx.
import { useState } from 'react'
import type { ConfigVitrine } from '../../../core/services/vitrine'
import { Botao, Campo, Carregando, Cartao, Entrada, Selecao, Titulo, Vazio, cx, gramasTexto } from '../../../shared/ui/base'
import { useApp, useComando, useConsulta } from '../../../shared/ui/contexto'
import { useT } from '../../../shared/ui/i18n'
import { Chave, Interruptor } from '../../../shared/ui/interruptor'
import { GrupoNumeros, NumeroGrande } from '../../../shared/ui/numeroGrande'
import { TabelaDados } from '../../../shared/ui/tabelaDados'
import { CartaoPacoteVitrine, linkDaLoja } from './Loja'

export function MinhaVitrine() {
  const t = useT()
  const { avisar } = useApp()
  const { dados } = useConsulta('vitrine', {})
  const { dados: conf } = useConsulta('configuracoes', {})
  const { dados: tabelas } = useConsulta('tabelasPreco', { moduloId: 'cabelo' })
  const { executar, ocupado } = useComando()
  const [texto, setTexto] = useState<{ nome: string; descricao: string; whatsapp: string }>()
  if (!dados || !conf) return <Carregando />
  const atual: ConfigVitrine = { ativa: true, mostrarPreco: true, ocultos: [], ...(conf.config.vitrine ?? {}) }
  const salvar = (v: Partial<ConfigVitrine>, aviso?: string) => executar('salvarConfig', { vitrine: { ...atual, ...v } } as never, aviso)
  const form = texto ?? { nome: atual.nome ?? '', descricao: atual.descricao ?? '', whatsapp: atual.whatsapp ?? '' }
  const sujo = texto && (texto.nome !== (atual.nome ?? '') || texto.descricao !== (atual.descricao ?? '') || texto.whatsapp !== (atual.whatsapp ?? ''))
  const visiveis = dados.pacotes.filter((x) => !x.oculto)
  const colunas = [...new Map((tabelas ?? []).flatMap((tb) => tb.colunas).map((c) => [c.id, c])).values()]
  const abrirLoja = () => window.open(linkDaLoja(), '_blank', 'noopener')
  const copiar = async () => {
    try {
      await navigator.clipboard.writeText(linkDaLoja())
      avisar(t('Link copiado.'), 'ok')
    } catch {
      avisar(linkDaLoja(), 'ok')
    }
  }
  type P = (typeof dados.pacotes)[number]
  const kg = (g: number) => (g >= 1000 ? `${(g / 1000).toLocaleString(undefined, { maximumFractionDigits: 1 })} kg` : gramasTexto(g))
  return (
    <div>
      <Titulo subtitulo={t('Os pacotes prontos para vender, como o comprador vê.')}
        acao={<div className="flex flex-wrap gap-2"><Botao variante="secundario" onClick={copiar}>🔗 {t('Copiar link')}</Botao><Botao onClick={abrirLoja}>👁 {t('Ver como o cliente vê')}</Botao></div>}>
        {t('Minha vitrine')}
      </Titulo>

      <GrupoNumeros colunas={4}>
        <NumeroGrande rotulo="Na vitrine" icone="🛍️" valor={String(visiveis.length)} tom={atual.ativa ? 'bom' : undefined} selos={atual.ativa ? undefined : [{ texto: t('vitrine desligada'), tom: 'alerta' }]} />
        <NumeroGrande rotulo="Disponível" icone="⚖️" valor={kg(visiveis.reduce((s, x) => s + x.gramas, 0))} />
        <NumeroGrande rotulo="Medidas" icone="📏" valor={String(new Set(visiveis.map((x) => x.medida)).size)} />
        <NumeroGrande rotulo="Escondidos" icone="🙈" valor={String(dados.pacotes.length - visiveis.length)} ajuda="Pacotes prontos que você tirou da vitrine (continuam no estoque e à venda no caixa)." />
      </GrupoNumeros>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
        <Cartao titulo={t('A loja')} ajuda="O que o comprador vê no topo da vitrine e para onde vai o “Quero este”. Entra na vitrine o cabelo já separado na triagem, com etiqueta e com saldo.">
          <div className="space-y-3">
            <Interruptor ligado={atual.ativa} onChange={(v) => salvar({ ativa: v }, t(v ? 'Vitrine ligada.' : 'Vitrine desligada: o comprador não vê nada.'))} titulo="Vitrine ligada" texto="Desligada, o link mostra “vitrine fechada”. Você continua vendo a prévia aqui." />
            <Campo rotulo="Nome da loja"><Entrada value={form.nome} placeholder={conf.config.nomeNegocio} onChange={(e) => setTexto({ ...form, nome: e.target.value })} /></Campo>
            <Campo rotulo="Texto de apresentação"><Entrada value={form.descricao} placeholder={t('Ex.: Cabelo natural boliviano, separado por medida.')} onChange={(e) => setTexto({ ...form, descricao: e.target.value })} /></Campo>
            <Campo rotulo="WhatsApp para pedidos" ajuda="Com o código do país. O botão “Quero este” abre uma conversa com a mensagem pronta. Ex.: +591 70000000."><Entrada inputMode="tel" value={form.whatsapp} placeholder="+591 70000000" onChange={(e) => setTexto({ ...form, whatsapp: e.target.value })} /></Campo>
            {sujo && <div className="flex justify-end gap-2"><Botao variante="leve" onClick={() => setTexto(undefined)}>{t('Desfazer')}</Botao><Botao disabled={ocupado} onClick={async () => (await salvar(form, t('Salvo.'))) && setTexto(undefined)}>{t('Salvar')}</Botao></div>}
            <Interruptor ligado={atual.mostrarPreco} onChange={(v) => salvar({ mostrarPreco: v })} titulo="Mostrar o preço" texto="O preço por grama da tabela (e o valor do pacote inteiro). Desligado, aparece “Consultar preço”." />
            {atual.mostrarPreco && colunas.length > 0 && (
              <Campo rotulo="Preço de qual coluna da tabela"><Selecao valor={atual.colunaId} vazio="A primeira coluna" onChange={(v) => salvar({ colunaId: v || undefined })} opcoes={colunas.map((c) => ({ id: c.id, nome: c.nome }))} /></Campo>
            )}
          </div>
        </Cartao>

        <section className="space-y-2">
          <p className="text-xs font-bold uppercase tracking-wider text-[var(--suave)]">{t('Pacotes prontos ({n})', { n: dados.pacotes.length })}</p>
          {!dados.pacotes.length ? <Vazio texto="Nenhum pacote pronto. Entram aqui os pacotes separados na triagem e com etiqueta impressa." /> : (
            <TabelaDados<P>
              linhas={dados.pacotes}
              chave={(x) => x.id}
              colunas={[
                { id: 'pacote', titulo: 'Pacote', classe: 'w-full min-w-[12rem]', celula: (x) => <span className={cx(x.oculto && 'opacity-50')}><b className="font-mono text-[var(--marca)]">{x.codigo}</b> <span className="font-semibold">{x.medida} cm{x.categoria !== 'Normal' ? ` · ${t(x.categoria)}` : ''}{x.cor ? ` · ${t(x.cor)}` : ''}</span></span> },
                { id: 'gramas', titulo: 'Disponível', direita: true, classe: 'whitespace-nowrap', celula: (x) => kg(x.gramas) },
                { id: 'preco', titulo: 'Preço/g', direita: true, classe: 'whitespace-nowrap', celula: (x) => (x.preco ? `${x.preco.moeda === 'BOB' ? 'Bs' : x.preco.moeda} ${x.preco.fator}` : '—') },
                { id: 'na', titulo: 'Na vitrine', classe: 'whitespace-nowrap', celula: (x) => <Chave ligado={!x.oculto} rotulo={`${t('Na vitrine')} ${x.codigo ?? ''}`} travado={ocupado} onChange={(v) => salvar({ ocultos: v ? atual.ocultos.filter((y) => y !== x.id) : [...atual.ocultos, x.id] })} /> },
              ]}
              celular={{
                titulo: (x) => `${x.medida} cm${x.cor ? ` · ${t(x.cor)}` : ''}`,
                valor: (x) => kg(x.gramas),
                codigo: (x) => x.codigo ?? '',
                situacao: (x) => ({ texto: t(x.oculto ? 'Escondido' : 'Na vitrine'), tom: x.oculto ? 'suave' : 'bom' }),
                resumo: (x) => (x.preco ? `${x.preco.moeda === 'BOB' ? 'Bs' : x.preco.moeda} ${x.preco.fator}/g` : t('sem preço na tabela')),
                aberto: (x) => <Botao variante="secundario" onClick={() => salvar({ ocultos: x.oculto ? atual.ocultos.filter((y) => y !== x.id) : [...atual.ocultos, x.id] })}>{t(x.oculto ? 'Mostrar na vitrine' : 'Esconder da vitrine')}</Botao>,
              }}
            />
          )}
        </section>
      </div>

      {visiveis.length > 0 && (
        <section className="mt-6">
          <p className="mb-2 text-xs font-bold uppercase tracking-wider text-[var(--suave)]">{t('Prévia: os primeiros da vitrine')}</p>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4">
            {visiveis.slice(0, 4).map((x) => <CartaoPacoteVitrine key={x.id} p={x} whatsapp={dados.loja.whatsapp} loja={dados.loja.nome} mostrarPreco={dados.loja.mostrarPreco} />)}
          </div>
        </section>
      )}
    </div>
  )
}
