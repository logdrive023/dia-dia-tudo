// MINHA VITRINE (administrador): o que vai para a loja do comprador e como ela aparece. Padrões da casa: cabeçalho com a
// ação principal ("Ver como o cliente vê"), a nota "o que entra na vitrine", 4 números, os PACOTES (no padrão "Eu
// escolho": a fila "Prontos para a vitrine" — disponíveis e com etiqueta — e o que já está "Na vitrine") e o GERADOR
// (textos, cores, banner e fundo com prévia ao vivo).
// CELULAR: em sub-abas (Vitrine · Prontos · Loja), uma coisa por vez; os números levam à aba. No computador
// tudo aparece um embaixo do outro (as abas somem).
// A regra (o que entra e o que o comprador vê) é do serviço: src/core/services/vitrine.ts. A página do comprador: Loja.tsx.
import type { ConfigVitrine, EntradaVitrine } from '../../../core/services/vitrine'
import { Abas, Botao, Campo, Carregando, Entrada, Escolha, Pilula, Titulo, Vazio, cx, gramasTexto } from '../../../shared/ui/base'
import { useApp, useComando, useConsulta, useParamTela } from '../../../shared/ui/contexto'
import { MenuAcoes } from '../../../shared/ui/menuAcoes'
import { useT } from '../../../shared/ui/i18n'
import { Chave } from '../../../shared/ui/interruptor'
import { NotaTela } from '../../../shared/ui/notaTela'
import { GrupoNumeros, NumeroGrande } from '../../../shared/ui/numeroGrande'
import { TabelaDados } from '../../../shared/ui/tabelaDados'
import { GeradorVitrine } from '../components/GeradorVitrine'
import { linkDaLoja } from './Loja'

export function MinhaVitrine() {
  const t = useT()
  const { avisar, ir } = useApp()
  const { dados } = useConsulta('vitrine', {})
  const { dados: conf } = useConsulta('configuracoes', {})
  const { dados: tabelas } = useConsulta('tabelasPreco', { moduloId: 'cabelo' })
  const { executar, ocupado } = useComando()
  const [aba, setAba] = useParamTela<'na' | 'prontos' | 'loja'>('aba', 'na')
  if (!dados || !conf) return <Carregando />
  /** no celular só a aba aberta aparece; no computador, tudo */
  const so = (x: typeof aba) => cx(aba !== x && 'hidden sm:block')
  const atual: ConfigVitrine = { ativa: true, ocultos: [], ...(conf.config.vitrine ?? {}) }
  const salvar = (v: Partial<ConfigVitrine>, aviso?: string) => executar('salvarConfig', { vitrine: { ...atual, ...v } } as never, aviso)
  const entrada: EntradaVitrine = dados.entrada ?? 'escolher'
  const escolher = entrada === 'escolher'
  const visiveis = dados.pacotes.filter((x) => !x.oculto)
  const fora = dados.pacotes.filter((x) => x.oculto)
  const semEtiqueta = dados.semEtiqueta ?? { pacotes: 0, gramas: 0 }
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
  /** pôr ou tirar da vitrine: no "Eu escolho" mexe na lista dos escolhidos; no automático, na dos escondidos */
  const naVitrine = (ids: string[], entrar: boolean, aviso?: string) => {
    const tirar = (lista: string[] = []) => lista.filter((y) => !ids.includes(y))
    return salvar(escolher
      ? { publicados: entrar ? [...new Set([...(atual.publicados ?? []), ...ids])] : tirar(atual.publicados) }
      : { ocultos: entrar ? tirar(atual.ocultos) : [...new Set([...atual.ocultos, ...ids])] }, aviso)
  }
  /** trocar o modo sem a vitrine mudar na hora: o que está nela continua, o que está fora continua fora */
  const trocarEntrada = (v: EntradaVitrine) => salvar(v === 'escolher'
    ? { entrada: v, publicados: visiveis.map((x) => x.id) }
    : { entrada: v, ocultos: fora.map((x) => x.id) }, t(v === 'escolher' ? 'Agora você escolhe o que vai para a vitrine.' : 'Agora todo pacote pronto entra sozinho na vitrine.'))
  const modo = dados.loja.modoPreco
  const salvarPreco = (id: string, v: string) => salvar({ precos: { ...atual.precos, [id]: v.trim() } })
  /** modo "Preço por pacote": salva ao sair do campo (só se mudou) */
  const campoPreco = (x: P) => {
    const salvo = atual.precos?.[x.id] ?? ''
    return <Entrada key={salvo} aria-label={`${t('Preço por grama')} ${x.codigo ?? ''}`} inputMode="decimal" placeholder="0,00" className="num w-24 text-right" defaultValue={salvo} onBlur={(e) => { if (e.target.value.trim() !== salvo) void salvarPreco(x.id, e.target.value) }} />
  }
  const precoTexto = (x: P) => (x.preco ? `${x.preco.moeda === 'BOB' ? 'Bs' : x.preco.moeda} ${x.preco.fator}/g` : t(modo === 'contato' ? 'Entrar em contato' : modo === 'individual' ? 'sem preço digitado' : 'sem preço na tabela'))
  const kg = (g: number) => (g >= 1000 ? `${(g / 1000).toLocaleString(undefined, { maximumFractionDigits: 1 })} kg` : gramasTexto(g))
  const rotuloPor = t(escolher ? 'Pôr na vitrine' : 'Mostrar na vitrine')
  const rotuloTirar = t(escolher ? 'Tirar da vitrine' : 'Esconder da vitrine')
  /** uma lista de pacotes (a mesma peça nas duas: fila de prontos e o que está na vitrine) */
  const lista = (linhas: P[]) => (
    <TabelaDados<P>
      linhas={linhas}
      chave={(x) => x.id}
      colunas={[
        { id: 'pacote', titulo: 'Pacote', classe: 'w-full min-w-[12rem]', celula: (x) => <span><b className="font-mono text-[var(--marca)]">{x.codigo}</b> <span className="font-semibold">{x.medida} cm{x.categoria && x.categoria !== 'Normal' ? ` · ${t(x.categoria)}` : ''}</span>{x.cor && <span className="text-[var(--suave)]"> · {t(x.cor)}</span>}</span> },
        { id: 'gramas', titulo: 'Disponível', direita: true, classe: 'whitespace-nowrap', celula: (x) => kg(x.gramas) },
        ...(modo === 'contato' ? [] : [{ id: 'preco', titulo: 'Preço/g', direita: true, classe: 'whitespace-nowrap', celula: (x: P) => (modo === 'individual' ? campoPreco(x) : precoTexto(x)) }]),
        { id: 'na', titulo: 'Na vitrine', classe: 'whitespace-nowrap', celula: (x) => <Chave ligado={!x.oculto} rotulo={`${t('Na vitrine')} ${x.codigo ?? ''}`} travado={ocupado} onChange={(v) => void naVitrine([x.id], v)} /> },
      ]}
      celular={{
        titulo: (x) => `${x.medida} cm${x.cor ? ` · ${t(x.cor)}` : ''}`,
        valor: (x) => kg(x.gramas),
        codigo: (x) => x.codigo ?? '',
        situacao: (x) => ({ texto: t(x.oculto ? (escolher ? 'Fora da vitrine' : 'Escondido') : 'Na vitrine'), tom: x.oculto ? 'suave' : 'bom' }),
        resumo: precoTexto,
        aberto: (x) => <div className="space-y-2">
          {modo === 'individual' && <Campo rotulo="Preço por grama">{campoPreco(x)}</Campo>}
          <Botao variante={x.oculto ? 'primario' : 'secundario'} disabled={ocupado} onClick={() => void naVitrine([x.id], !!x.oculto)}>{x.oculto ? `🛍️ ${rotuloPor}` : rotuloTirar}</Botao>
        </div>,
      }}
    />
  )
  return (
    <div>
      <Titulo subtitulo={t('O que vai para a sua loja e como o comprador vê.')}
        acao={<div className="flex items-center gap-2">
          <Botao variante="secundario" className="hidden sm:inline-flex" onClick={copiar}>🔗 {t('Copiar link')}</Botao>
          <Botao onClick={abrirLoja}>👁 {t('Ver como o cliente vê')}</Botao>
          <MenuAcoes className="sm:hidden" pergunta="O que fazer com a loja?" acoes={[{ rotulo: 'Copiar link', icone: '🔗', descricao: t('Para mandar a loja no WhatsApp.'), onClick: () => void copiar() }]} />
        </div>}>
        {t('Minha vitrine')}
      </Titulo>

      <NotaTela icone="🛍️" className="mb-3">
        <b>{t('O que pode ir para a vitrine')}:</b> {t('o cabelo disponível no estoque (já separado na triagem, com saldo) e com etiqueta.')}{' '}
        {t(escolher ? 'Ele não entra sozinho: fica em “Prontos para a vitrine” até você pôr. Fora da vitrine continua à venda no caixa.' : 'Todo pacote pronto entra sozinho; esconda o que não quiser mostrar. Fora da vitrine continua à venda no caixa.')}
      </NotaTela>

      <GrupoNumeros colunas={4}>
        <NumeroGrande rotulo="Na vitrine" icone="🛍️" valor={String(visiveis.length)} ativo={aba === 'na'} onClick={() => setAba('na')} tom={atual.ativa ? 'bom' : undefined} selos={atual.ativa ? undefined : [{ texto: t('Vitrine desligada'), tom: 'alerta' }]} />
        <NumeroGrande rotulo="Peso na vitrine" icone="⚖️" valor={kg(visiveis.reduce((s, x) => s + x.gramas, 0))} />
        <NumeroGrande rotulo={escolher ? 'Prontos, fora' : 'Escondidos'} icone={escolher ? '⏳' : '🙈'} valor={String(fora.length)} tom={escolher && fora.length ? 'alerta' : undefined} ativo={aba === 'prontos'} onClick={() => setAba('prontos')}
          ajuda={escolher ? 'Disponíveis e com etiqueta, esperando você pôr na vitrine. Continuam à venda no caixa.' : 'Pacotes prontos que você tirou da vitrine (continuam no estoque e à venda no caixa).'} />
        <NumeroGrande rotulo="Sem etiqueta" icone="🏷" valor={String(semEtiqueta.pacotes)} sub={semEtiqueta.pacotes ? kg(semEtiqueta.gramas) : undefined} onClick={semEtiqueta.pacotes ? () => ir('etiquetas') : undefined}
          ajuda="Disponíveis no estoque, mas ainda sem etiqueta: só podem ir para a vitrine depois de imprimir (ou marcar) a etiqueta." />
      </GrupoNumeros>

      <div className="sm:hidden">
        <Abas variante="sublinhado" atual={aba} onChange={(v) => setAba(v as typeof aba)} abas={[
          { id: 'na', nome: 'Vitrine', extra: <Pilula pequena tom="bom">{visiveis.length}</Pilula>, pergunta: 'O que o comprador vê agora.' },
          { id: 'prontos', nome: escolher ? 'Prontos' : 'Escondidos', extra: <Pilula pequena tom={escolher && fora.length ? 'alerta' : 'suave'}>{fora.length}</Pilula>,
            pergunta: escolher ? 'Com etiqueta, esperando você pôr na vitrine.' : 'Prontos que você tirou da vitrine.' },
          { id: 'loja', nome: 'Loja', pergunta: 'O que entra e como a loja aparece: textos, cores e preços.' },
        ]} />
      </div>

      <section className="mb-6 space-y-3">
        <div className={cx('flex-col gap-2 rounded-2xl border border-[var(--borda)] bg-[var(--cartao)] p-3 sm:flex-row sm:items-center sm:justify-between', aba === 'loja' ? 'flex' : 'hidden', 'sm:flex')}>
          <div className="min-w-0">
            <p className="text-sm font-semibold">{t('O que entra na vitrine')}</p>
            <p className="text-xs text-[var(--suave)]">{t(escolher ? 'Você escolhe cada pacote (recomendado).' : 'Todo pacote pronto entra sozinho.')}</p>
          </div>
          <Escolha<EntradaVitrine> rotulo="O que entra na vitrine" valor={entrada} onChange={(v) => v !== entrada && void trocarEntrada(v)} opcoes={[{ id: 'escolher', nome: 'Eu escolho' }, { id: 'automatico', nome: 'Tudo que estiver pronto' }]} />
        </div>

        {semEtiqueta.pacotes > 0 && (
          <NotaTela icone="🏷" className={so('prontos')}>
            {t('{n} pacote(s) disponível(is) ainda sem etiqueta ({g}): para irem à vitrine, imprima ou marque a etiqueta.', { n: semEtiqueta.pacotes, g: kg(semEtiqueta.gramas) })}{' '}
            <button type="button" onClick={() => ir('etiquetas')} className="alvo-amplo font-semibold text-[var(--marca)] underline-offset-2 hover:underline">{t('Ir para Etiquetas')} ›</button>
          </NotaTela>
        )}

        {/* a FILA: prontos que ainda não estão na vitrine (no automático, os escondidos) */}
        {(escolher || fora.length > 0) && (
          <div className={cx('space-y-2', so('prontos'))}>
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs font-bold uppercase tracking-wider text-[var(--suave)]">{t(escolher ? 'Prontos para a vitrine ({n})' : 'Escondidos ({n})', { n: fora.length })}</p>
              {fora.length > 1 && <Botao variante="secundario" className="shrink-0 whitespace-nowrap" disabled={ocupado} onClick={() => void naVitrine(fora.map((x) => x.id), true, t('{n} pacote(s) na vitrine.', { n: fora.length }))}>🛍️ {t('Pôr todos ({n})', { n: fora.length })}</Botao>}
            </div>
            {fora.length ? lista(fora) : <Vazio compacto texto={dados.pacotes.length ? 'Todos os pacotes prontos já estão na vitrine.' : 'Nenhum pacote pronto ainda: entram aqui os pacotes separados na triagem e com etiqueta.'} />}
          </div>
        )}

        <div className={cx('space-y-2', so('na'))}>
          <p className="text-xs font-bold uppercase tracking-wider text-[var(--suave)]">{t('Na vitrine ({n})', { n: visiveis.length })}</p>
          {visiveis.length ? lista(visiveis) : <Vazio compacto texto={escolher ? 'Nada na vitrine ainda: escolha em “Prontos para a vitrine”.' : 'Nenhum pacote pronto. Entram aqui os pacotes separados na triagem e com etiqueta impressa.'} />}
        </div>
      </section>

      <div className={so('loja')}>
      <GeradorVitrine publicado={atual} nomeNegocio={conf.config.nomeNegocio} dados={{ ...dados, pacotes: visiveis, gramas: visiveis.reduce((x, p) => x + p.gramas, 0) }} colunasPreco={colunas.map((c) => ({ id: c.id, nome: c.nome }))} salvar={salvar} ocupado={ocupado} />
      </div>
    </div>
  )
}
