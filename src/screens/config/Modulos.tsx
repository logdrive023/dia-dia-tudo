// CONFIGURAÇÕES › Módulos: o que o negócio usa e as modalidades próprias (CriarModalidade).
// Uma seção = um arquivo (a lista das seções e onde cada uma aparece fica em ../configSecoes.ts).
import { useState } from 'react'
import { type CampoDef } from '../../core/modulos'
import type { ModuloConfig } from '../../core/modulosConfig'
import { Botao, Campo, Carregando, Cartao, Entrada, Janela, Pilula, Selecao } from '../../ui/base'
import { useComando, useConsulta } from '../../ui/contexto'
import { useT } from '../../ui/i18n'

export function Modulos() {
  const t = useT()
  const { dados } = useConsulta('configuracoes', {})
  const { executar } = useComando()
  const [criar, setCriar] = useState<ModuloConfig>()
  if (!dados) return <Carregando />
  const ativos = dados.config.modulosAtivos
  return (
    <div className="space-y-4">
      <p className="text-sm text-[var(--suave)]">{t('Ligue só o que o negócio usa: menus, painel e relatórios se ajustam sozinhos.')}</p>
      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
        {dados.modulos.map((m) => (
          <Cartao key={m.id} titulo={<>{m.icone} {t(m.nome)} {m.personalizado && <Pilula tom="marca">{t('criado por você')}</Pilula>}</>} acao={
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" className="h-6 w-6" checked={ativos.includes(m.id)} onChange={(e) => executar('salvarConfig', { modulosAtivos: e.target.checked ? [...ativos, m.id] : ativos.filter((x) => x !== m.id), antes: { modulosAtivos: ativos } })} /> {t('Ligado')}</label>
          }>
            <p className="text-sm text-[var(--suave)]">{t(m.descricao)}</p>
            <div className="mt-2 flex flex-wrap gap-1 text-xs">
              {m.temCompra && <Pilula>{t('compra + triagem')}</Pilula>}
              {m.temVenda && <Pilula>{t('venda')}</Pilula>}
              {(m.recursos?.agenda || m.id === 'salao') && <Pilula>{t('agenda')}</Pilula>}
              {(m.recursos?.tabelaPreco || m.id === 'cabelo') && <Pilula>{t('tabela de preço')}</Pilula>}
              {m.telaPropria && <Pilula>{t('tela própria')}</Pilula>}
            </div>
            {m.personalizado && <Botao variante="leve" className="mt-2" onClick={() => setCriar(dados.personalizados.find((x) => x.id === m.id))}>{t('Editar')}</Botao>}
          </Cartao>
        ))}
        <button type="button" onClick={() => setCriar({ id: '', nome: '', icone: '📦', recursos: { estoque: 'peca' }, campos: [] })} className="min-h-32 rounded-2xl border-2 border-dashed border-[var(--marca)] p-4 text-left text-[var(--marca)]">
          <div className="text-2xl">＋</div>
          <div className="font-bold">{t('Criar nova modalidade')}</div>
          <div className="text-sm">{t('Ex.: óculos, roupas, aluguel, serviços gerais… escolhendo recursos que já existem.')}</div>
        </button>
      </div>
      {criar && <CriarModalidade inicial={criar} onFechar={() => setCriar(undefined)} />}
    </div>
  )
}

function CriarModalidade({ inicial, onFechar }: { inicial: ModuloConfig; onFechar(): void }) {
  const t = useT()
  const { executar, ocupado } = useComando()
  const [m, setM] = useState<ModuloConfig>(inicial)
  const [etapas, setEtapas] = useState((inicial.recursos.triagem ?? []).join(', '))
  const r = m.recursos
  const setR = (d: Partial<ModuloConfig['recursos']>) => setM({ ...m, recursos: { ...r, ...d } })
  const salvar = async () => {
    const id = m.id || m.nome.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 30)
    const ok = await executar('salvarModulo', { ...m, id, recursos: { ...r, triagem: etapas.split(',').map((x) => x.trim()).filter(Boolean) } }, t('Modalidade salva e ligada.'))
    if (ok) onFechar()
  }
  return (
    <Janela aberta larga titulo={t('Nova modalidade')} onFechar={onFechar} rodape={<Botao grande className="w-full" disabled={ocupado || !m.nome.trim()} onClick={salvar}>{t('Salvar modalidade')}</Botao>}>
      <div className="space-y-4">
        <div className="grid grid-cols-[5rem_1fr] gap-2">
          <Campo rotulo="Ícone"><Entrada value={m.icone} onChange={(e) => setM({ ...m, icone: e.target.value })} /></Campo>
          <Campo rotulo="Nome"><Entrada value={m.nome} placeholder={t('Ex.: Óculos')} onChange={(e) => setM({ ...m, nome: e.target.value })} /></Campo>
        </div>
        <Campo rotulo="Descrição"><Entrada value={m.descricao ?? ''} onChange={(e) => setM({ ...m, descricao: e.target.value })} /></Campo>
        <Cartao titulo={t('Recursos (combine os que já existem)')}>
          <div className="grid gap-3 md:grid-cols-2">
            <Campo rotulo="Estoque"><Selecao valor={r.estoque || ''} onChange={(v) => setR({ estoque: (v || false) as 'peca' })} vazio="Sem estoque (só serviço)" opcoes={[{ id: 'peca', nome: t('Em peças') }, { id: 'grama', nome: t('Em gramas (como o cabelo)') }]} /></Campo>
            {r.estoque && <Campo rotulo="Etapas da triagem na compra (separadas por vírgula)" ajuda="Depois delas vêm “Pago” e “No estoque”."><Entrada value={etapas} placeholder={t('Chegou, Conferido')} onChange={(e) => setEtapas(e.target.value)} /></Campo>}
            {r.estoque && <label className="flex items-center gap-2 text-sm"><input type="checkbox" className="h-5 w-5" checked={!!r.loteNaCompra} onChange={(e) => setR({ loteNaCompra: e.target.checked })} /> {t('Cada compra vira um lote (com rastreio)')}</label>}
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" className="h-5 w-5" checked={!!r.tabelaPreco} onChange={(e) => setR({ tabelaPreco: e.target.checked })} /> {t('Preço pela tabela medida × comprador (multiplicador do cabelo)')}</label>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" className="h-5 w-5" checked={!!r.agenda} onChange={(e) => setR({ agenda: e.target.checked })} /> {t('Atendimento com agenda, unidade e profissional (como o salão)')}</label>
          </div>
        </Cartao>
        <Cartao titulo={t('Campos próprios')}>
          <ul className="space-y-2">
            {m.campos.map((c, i) => (
              <li key={i} className="grid grid-cols-[1fr_8rem_1fr_auto] gap-2">
                <Entrada placeholder={t('Nome do campo')} value={c.nome} onChange={(e) => setM({ ...m, campos: m.campos.map((x, k) => (k === i ? { ...x, nome: e.target.value, id: x.id || e.target.value.toLowerCase().replace(/\W+/g, '') } : x)) })} />
                <Selecao valor={c.tipo} onChange={(v) => setM({ ...m, campos: m.campos.map((x, k) => (k === i ? { ...x, tipo: v as CampoDef['tipo'] } : x)) })} opcoes={[{ id: 'texto', nome: t('Texto') }, { id: 'numero', nome: t('Número') }, { id: 'lista', nome: t('Lista') }, { id: 'simNao', nome: t('Sim/Não') }]} />
                <Entrada placeholder={c.tipo === 'lista' ? t('Opções: A, B, C') : ''} disabled={c.tipo !== 'lista'} value={(c.opcoes ?? []).join(', ')} onChange={(e) => setM({ ...m, campos: m.campos.map((x, k) => (k === i ? { ...x, opcoes: e.target.value.split(',').map((o) => o.trim()).filter(Boolean) } : x)) })} />
                <button type="button" className="px-2 text-xl" aria-label={t('Tirar')} onClick={() => setM({ ...m, campos: m.campos.filter((_, k) => k !== i) })}>×</button>
              </li>
            ))}
          </ul>
          <Botao variante="secundario" className="mt-2" onClick={() => setM({ ...m, campos: [...m.campos, { id: '', nome: '', tipo: 'texto' }] })}>+ {t('Campo')}</Botao>
        </Cartao>
      </div>
    </Janela>
  )
}

// ---------- atributos do item (campos dinâmicos, sem programar) ----------
