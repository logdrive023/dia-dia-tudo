// ESTOQUE › JANELAS: salvar um filtro favorito, marcar vários lotes de uma vez e ajustar o saldo de um lote.
import { useState } from 'react'
import type { Id } from '../../../core/domain/tipos'
import type { CampoDef } from '../../../core/modulos'
import { Botao, Campo, Entrada, Escolha, GramasInput, Janela, Selecao, fmt } from '../../../shared/ui/base'
import { useComando, useConsulta } from '../../../shared/ui/contexto'
import { useT } from '../../../shared/ui/i18n'

export function SalvarFavorito({ onSalvar, onFechar }: { onSalvar(nome: string): void; onFechar(): void }) {
  const t = useT()
  const [nome, setNome] = useState('')
  const salvar = () => nome.trim() && (onSalvar(nome.trim()), onFechar())
  return (
    <Janela aberta titulo={t('Salvar filtro')} onFechar={onFechar} rodape={<Botao grande className="w-full" disabled={!nome.trim()} onClick={salvar}>{t('Salvar')}</Botao>}>
      <Campo rotulo="Nome do filtro"><Entrada autoFocus value={nome} placeholder={t('Ex.: 60 cm loiro para separar')} onChange={(e) => setNome(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && salvar()} /></Campo>
      <p className="mt-2 text-xs text-[var(--suave)]">{t('Fica guardado neste aparelho; um toque aplica de novo.')}</p>
    </Janela>
  )
}

/** Mudar um atributo (situação, cor, categoria…) de vários lotes de uma vez; cada lote fica com o "antes → depois" no log. */
export function MarcarLotes({ ids, campos, onFechar, onFeito }: { ids: Id[]; campos: CampoDef[]; onFechar(): void; onFeito(): void }) {
  const t = useT()
  const { executar, ocupado } = useComando()
  const opcoes = campos.filter((c) => c.tipo === 'lista' || c.tipo === 'simNao')
  const [campoId, setCampoId] = useState(opcoes[0]?.id ?? '')
  const [valor, setValor] = useState('')
  const c = opcoes.find((x) => x.id === campoId)
  const enviar = async () => {
    if (!c) return
    const v = valor === '' ? null : c.tipo === 'simNao' ? valor === 'true' : valor
    const r = await executar('marcarLotes', { ids, campos: { [c.id]: v } }, t('{n} lote(s) alterado(s).', { n: ids.length }))
    if (r) (onFeito(), onFechar())
  }
  return (
    <Janela aberta titulo={t('Mudar atributo de {n} lote(s)', { n: ids.length })} onFechar={onFechar} rodape={<Botao grande className="w-full" disabled={ocupado || !c} onClick={enviar}>{t('Aplicar')}</Botao>}>
      <div className="space-y-3">
        <Campo rotulo="Atributo"><Selecao valor={campoId} onChange={(v) => (setCampoId(v), setValor(''))} opcoes={opcoes.map((x) => ({ id: x.id, nome: x.nome }))} /></Campo>
        {c && <Campo rotulo="Novo valor"><Selecao valor={valor} onChange={setValor} vazio="— sem valor —" opcoes={c.tipo === 'simNao' ? [{ id: 'true', nome: 'Sim' }, { id: 'false', nome: 'Não' }] : (c.opcoes ?? []).map((o) => ({ id: o, nome: o }))} /></Campo>}
        <p className="text-xs text-[var(--suave)]">{t('Cada lote fica com o antes → depois no histórico. O nome do lote acompanha a mudança.')}</p>
      </div>
    </Janela>
  )
}

export function Ajustar({ itemId, onFechar }: { itemId: Id; onFechar(): void }) {
  const t = useT()
  const { dados } = useConsulta('fichaItem', { id: itemId })
  const { executar, ocupado } = useComando()
  const [novo, setNovo] = useState<number>()
  const [motivo, setMotivo] = useState<'ajuste' | 'perda'>('ajuste')
  const [desc, setDesc] = useState('')
  if (!dados) return null
  return (
    <Janela aberta titulo={`${t('Ajustar')} · ${dados.item.nome}`} onFechar={onFechar} rodape={<Botao grande className="w-full" disabled={ocupado || novo === undefined} onClick={async () => (await executar('ajustarEstoque', { itemId, novoSaldo: novo!, motivo, descricao: desc }, t('Estoque ajustado.'))) && onFechar()}>{t('Salvar')}</Botao>}>
      <div className="space-y-3">
        <p className="text-sm">{t('Agora')}: <b>{fmt(dados.item.saldo, dados.item.unidade === 'grama' ? 'gramas' : 'numero')}</b></p>
        <Escolha rotulo="Motivo" valor={motivo} onChange={(v) => setMotivo(v as typeof motivo)} opcoes={[{ id: 'ajuste', nome: 'Contei e é outro número' }, { id: 'perda', nome: 'Perda / quebra' }]} />
        <Campo rotulo="Quantidade certa">{dados.item.unidade === 'grama' ? <GramasInput valor={novo} onChange={setNovo} /> : <Entrada inputMode="numeric" onChange={(e) => setNovo(Number(e.target.value))} />}</Campo>
        <Campo rotulo="Motivo"><Entrada value={desc} onChange={(e) => setDesc(e.target.value)} /></Campo>
      </div>
    </Janela>
  )
}
