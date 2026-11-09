// MINHA VITRINE (administrador): os pacotes prontos para vender (separados na triagem, com etiqueta, com saldo) e como
// o comprador de fora vê. Padrões da casa: cabeçalho com a ação principal ("Ver como o cliente vê"), 4 números,
// o GERADOR (textos, cores, banner e fundo com prévia ao vivo) e a lista com o interruptor "na vitrine" por pacote.
// A regra (o que entra e o que o comprador vê) é do serviço: src/core/services/vitrine.ts. A página do comprador: Loja.tsx.
import type { ConfigVitrine } from '../../../core/services/vitrine'
import { Botao, Carregando, Titulo, Vazio, cx, gramasTexto } from '../../../shared/ui/base'
import { useApp, useComando, useConsulta } from '../../../shared/ui/contexto'
import { useT } from '../../../shared/ui/i18n'
import { Chave } from '../../../shared/ui/interruptor'
import { GrupoNumeros, NumeroGrande } from '../../../shared/ui/numeroGrande'
import { TabelaDados } from '../../../shared/ui/tabelaDados'
import { GeradorVitrine } from '../components/GeradorVitrine'
import { linkDaLoja } from './Loja'

export function MinhaVitrine() {
  const t = useT()
  const { avisar } = useApp()
  const { dados } = useConsulta('vitrine', {})
  const { dados: conf } = useConsulta('configuracoes', {})
  const { dados: tabelas } = useConsulta('tabelasPreco', { moduloId: 'cabelo' })
  const { executar, ocupado } = useComando()
  if (!dados || !conf) return <Carregando />
  const atual: ConfigVitrine = { ativa: true, mostrarPreco: true, ocultos: [], ...(conf.config.vitrine ?? {}) }
  const salvar = (v: Partial<ConfigVitrine>, aviso?: string) => executar('salvarConfig', { vitrine: { ...atual, ...v } } as never, aviso)
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

      <GeradorVitrine publicado={atual} nomeNegocio={conf.config.nomeNegocio} dados={{ ...dados, pacotes: visiveis, gramas: visiveis.reduce((x, p) => x + p.gramas, 0) }} colunasPreco={colunas.map((c) => ({ id: c.id, nome: c.nome }))} salvar={salvar} ocupado={ocupado} />

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
  )
}
