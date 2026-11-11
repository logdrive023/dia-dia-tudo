// MINHA VITRINE (administrador): o que vai para a loja do comprador e como ela aparece. Padrões da casa: cabeçalho com a
// ação principal ("Ver como o cliente vê"), a nota "o que entra na vitrine", 4 números, os PACOTES (no padrão "Eu
// escolho": a fila "Prontos para a vitrine" — disponíveis e com etiqueta — e o que já está "Na vitrine") e o GERADOR
// (textos, cores, banner e fundo com prévia ao vivo).
// PACOTES: uma lista só (todos os prontos, na ordem de medida) com o filtro Todos · Na vitrine · Fora.
// CELULAR: em sub-abas (Pacotes · Loja), uma coisa por vez; os números levam à aba. No computador
// tudo aparece um embaixo do outro (as abas somem).
// A regra (o que entra e o que o comprador vê) é do serviço: src/core/services/vitrine.ts. A página do comprador: Loja.tsx.
import type { ConfigVitrine, EntradaVitrine } from '../../../core/services/vitrine'
import { Abas, Botao, Carregando, Entrada, Escolha, Pilula, Titulo, Vazio, cx } from '../../../shared/ui/base'
import { useApp, useComando, useConsulta, useParamTela } from '../../../shared/ui/contexto'
import { MenuAcoes } from '../../../shared/ui/menuAcoes'
import { useT } from '../../../shared/ui/i18n'
import { NotaTela } from '../../../shared/ui/notaTela'
import { GrupoNumeros, NumeroGrande } from '../../../shared/ui/numeroGrande'
import { GeradorVitrine } from '../components/GeradorVitrine'
import { ListaPacotesVitrine, kg } from '../components/ListaPacotesVitrine'
import { linkDaLoja } from './Loja'

export function MinhaVitrine() {
  const t = useT()
  const { avisar, ir } = useApp()
  const { dados } = useConsulta('vitrine', {})
  const { dados: conf } = useConsulta('configuracoes', {})
  const { dados: tabelas } = useConsulta('tabelasPreco', { moduloId: 'cabelo' })
  const { executar, ocupado } = useComando()
  const [abaTxt, setAba] = useParamTela<'pacotes' | 'loja'>('aba', 'pacotes')
  const aba = abaTxt === 'loja' ? 'loja' : 'pacotes'
  const [filtro, setFiltro] = useParamTela<'todos' | 'na' | 'fora'>('ver', 'todos')
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
  const salvarLimite = (id: string, g: number) => salvar({ limites: { ...atual.limites, [id]: g } }, t(g ? 'Quantidade na vitrine salva.' : 'A vitrine mostra o pacote inteiro.'))
  /** a lista de pacotes (a mesma peça nas duas: fila de prontos e o que está na vitrine) */
  const lista = (linhas: P[]) => (
    <ListaPacotesVitrine linhas={linhas} escolher={escolher} ocupado={ocupado} precoTexto={precoTexto}
      preco={modo === 'contato' ? undefined : (x) => (modo === 'individual' ? campoPreco(x as P) : precoTexto(x as P))}
      onNaVitrine={(ids, entrar) => void naVitrine(ids, entrar)} onLimite={(id, g) => void salvarLimite(id, g)} />
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
        <NumeroGrande rotulo="Na vitrine" icone="🛍️" valor={String(visiveis.length)} ativo={filtro === 'na'} onClick={() => (setAba('pacotes'), setFiltro('na'))} tom={atual.ativa ? 'bom' : undefined} selos={atual.ativa ? undefined : [{ texto: t('Vitrine desligada'), tom: 'alerta' }]} />
        <NumeroGrande rotulo="Peso na vitrine" icone="⚖️" valor={kg(visiveis.reduce((s, x) => s + x.gramas, 0))} />
        <NumeroGrande rotulo={escolher ? 'Prontos, fora' : 'Escondidos'} icone={escolher ? '⏳' : '🙈'} valor={String(fora.length)} tom={escolher && fora.length ? 'alerta' : undefined} ativo={filtro === 'fora'} onClick={() => (setAba('pacotes'), setFiltro('fora'))}
          ajuda={escolher ? 'Disponíveis e com etiqueta, esperando você pôr na vitrine. Continuam à venda no caixa.' : 'Pacotes prontos que você tirou da vitrine (continuam no estoque e à venda no caixa).'} />
        <NumeroGrande rotulo="Sem etiqueta" icone="🏷" valor={String(semEtiqueta.pacotes)} sub={semEtiqueta.pacotes ? kg(semEtiqueta.gramas) : undefined} onClick={semEtiqueta.pacotes ? () => ir('etiquetas') : undefined}
          ajuda="Disponíveis no estoque, mas ainda sem etiqueta: só podem ir para a vitrine depois de imprimir (ou marcar) a etiqueta." />
      </GrupoNumeros>

      <div className="sm:hidden">
        <Abas variante="sublinhado" atual={aba} onChange={(v) => setAba(v as typeof aba)} abas={[
          { id: 'pacotes', nome: 'Pacotes', extra: <Pilula pequena tom="bom">{dados.pacotes.length}</Pilula>, pergunta: 'Os pacotes prontos: ligue o que vai para a vitrine.' },
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
          <NotaTela icone="🏷" className={so('pacotes')}>
            {t('{n} pacote(s) disponível(is) ainda sem etiqueta ({g}): para irem à vitrine, imprima ou marque a etiqueta.', { n: semEtiqueta.pacotes, g: kg(semEtiqueta.gramas) })}{' '}
            <button type="button" onClick={() => ir('etiquetas')} className="alvo-amplo font-semibold text-[var(--marca)] underline-offset-2 hover:underline">{t('Ir para Etiquetas')} ›</button>
          </NotaTela>
        )}

        {/* PACOTES: uma lista só, com o filtro; a linha não muda de lugar ao pôr/tirar */}
        <div className={cx('space-y-2', so('pacotes'))}>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <Escolha<'todos' | 'na' | 'fora'> rotulo="Ver" valor={filtro} onChange={setFiltro} opcoes={[
              { id: 'todos', nome: `${t('Todos')} (${dados.pacotes.length})` },
              { id: 'na', nome: `${t('Na vitrine')} (${visiveis.length})` },
              { id: 'fora', nome: `${t(escolher ? 'Fora' : 'Escondidos')} (${fora.length})` },
            ]} />
            {fora.length > 1 && filtro !== 'na' && <Botao variante="secundario" className="shrink-0 whitespace-nowrap" disabled={ocupado} onClick={() => void naVitrine(fora.map((x) => x.id), true, t('{n} pacote(s) na vitrine.', { n: fora.length }))}>🛍️ {t('Pôr todos ({n})', { n: fora.length })}</Botao>}
          </div>
          {(() => {
            const linhas = filtro === 'na' ? visiveis : filtro === 'fora' ? fora : dados.pacotes
            if (linhas.length) return lista(linhas)
            const texto = !dados.pacotes.length ? 'Nenhum pacote pronto ainda: entram aqui os pacotes separados na triagem e com etiqueta.'
              : filtro === 'na' ? 'Nada na vitrine ainda: ligue os pacotes em “Fora”.' : 'Todos os pacotes prontos já estão na vitrine.'
            return <Vazio compacto texto={texto} />
          })()}
        </div>
      </section>

      <div className={so('loja')}>
      <GeradorVitrine publicado={atual} nomeNegocio={conf.config.nomeNegocio} dados={{ ...dados, pacotes: visiveis, gramas: visiveis.reduce((x, p) => x + p.gramas, 0) }} colunasPreco={colunas.map((c) => ({ id: c.id, nome: c.nome }))} salvar={salvar} ocupado={ocupado} />
      </div>
    </div>
  )
}
