// VENDER: a entrada é "⚡ Vender cabelo" (Modo caixa) + botões pequenos para os outros módulos (serviço, produto…).
// O assistente por medida (tabela medida × comprador, gramas × fator) fica no link "Sem etiqueta? Vender por medida";
// serviço: unidade, cliente, o que vai fazer, quem atende, agora ou agendar.

import { useState } from 'react'
import { BotaoFecharTurno } from '../../caixa'
import { MenuAcoes, type Acao } from '../../../shared/ui/menuAcoes'
import { ListaVendas } from './ListaVendas'
import { novoId } from '../../../core/domain/ids'
import type { Id } from '../../../core/domain/tipos'
import { Botao, Carregando, Cartao, Confirmar, moedaPadrao } from '../../../shared/ui/base'
import { useApp, useAvisoSaida, useConsulta, useParamTela } from '../../../shared/ui/contexto'
import { Anexos, linkWhatsApp } from '../../../shared/ui/compartilhados'
import { useT } from '../../../shared/ui/i18n'
import { type Carrinho } from '../model/tipos'
import { AssistenteVenda, perguntaDe, rotuloCurto } from '../components/AssistenteVenda'

export function Vender() {
  const t = useT()
  const { ir, sessao, ajustarParams } = useApp()
  const { dados: cfg } = useConsulta('configuracoes', {})
  const [vendaId, setVendaId] = useState(() => novoId())
  const [caminho, setCaminho] = useParamTela('modulo', '')
  const [passo, setPasso] = useParamTela<'itens' | 'pagar'>('passo', 'itens')
  const [carrinho, setCarrinho] = useState<Carrinho>()
  const [trocar, setTrocar] = useState<string>()
  const [concluida, setConcluida] = useState<{ id: Id; texto: string; telefone?: string }>()
  // funcionária: só os caminhos que o admin liberou (Configurações › O que a funcionária faz)
  const nao = new Set(sessao.perfil === 'admin' ? [] : cfg?.config.funcionariaNaoVende ?? [])
  const ativos = (cfg?.modulos ?? []).filter((m) => cfg?.config.modulosAtivos.includes(m.id) && m.temVenda && (m.id === 'cabelo' ? !(nao.has('caixa') && nao.has('medida')) : !nao.has(m.id)))
  const temItens = !!carrinho?.linhas.length
  useAvisoSaida(temItens && !concluida)

  const reiniciar = () => {
    setVendaId(novoId())
    setCarrinho(undefined)
    setConcluida(undefined)
    ajustarParams({ modulo: undefined, passo: undefined, lote: undefined, coluna: undefined, medida: undefined, categoria: undefined })
  }
  const escolher = (id: string) => {
    if (temItens && carrinho!.moduloId !== id) return setTrocar(id)
    setCaminho(id)
  }
  const pergunta = (m: { id: string; nome: string; pergunta?: string }) => (m.pergunta ? t(m.pergunta) : perguntaDe(m.id, m.nome, t))

  if (concluida)
    return (
      <div className="mx-auto max-w-lg space-y-4 text-center">
        <div className="text-5xl">✅</div>
        <h1 className="text-2xl font-bold">{t('Pronto!')}</h1>
        <Cartao className="text-left">
          <pre className="whitespace-pre-wrap font-sans text-sm">{concluida.texto}</pre>
        </Cartao>
        <Anexos donoId={concluida.id} categorias={['comprovante', 'resultado']} />
        <div className="flex flex-col gap-2">
          <a className="min-h-12 rounded-xl bg-[#25d366] px-4 py-3 font-semibold text-white" href={linkWhatsApp(concluida.texto, concluida.telefone)} target="_blank" rel="noreferrer">
            {t('Enviar recibo no WhatsApp')}
          </a>
          <Botao grande onClick={reiniciar}>{t('Nova venda')}</Botao>
          <Botao variante="secundario" onClick={() => ir('venda', { id: concluida.id })}>{t('Ver venda')}</Botao>
          {sessao.perfil === 'admin' && <Botao variante="leve" onClick={() => ir('caixa')}>{t('Ver no caixa')}</Botao>}
        </div>
      </div>
    )

  const mod = ativos.find((m) => m.id === caminho)
  if (!caminho || (cfg && !mod)) {
    const emAndamento = temItens ? ativos.find((m) => m.id === carrinho!.moduloId) : undefined
    const temCabelo = ativos.some((m) => m.id === 'cabelo')
    // o resto (serviço, produto…) vira botões pequenos; cabelo é pelo Modo caixa (ou "por medida", no link)
    const outros = ativos.filter((m) => m.id !== 'cabelo')
    // "+ Nova venda ▾": os mesmos caminhos de antes (cabelo pela pistola/QR primeiro, o mais usado)
    const caminhos: Acao[] = [
      ...(temCabelo ? [
        ...(nao.has('caixa') ? [] : [{ rotulo: 'Vender cabelo (pistola ou QR)', icone: '⚡', onClick: () => ir('vendaRapida') }]),
        ...(nao.has('medida') ? [] : [{ rotulo: 'Cabelo sem etiqueta (por medida)', icone: '📏', onClick: () => escolher('cabelo') }]),
      ] : []),
      ...outros.map((m, k) => ({ rotulo: rotuloCurto(m.id, m.nome, t), icone: m.icone, separar: temCabelo && k === 0, onClick: () => escolher(m.id) })),
    ]
    return (
      <>
        {/* VENDER = o módulo de vendas: o cabeçalho com "+ Nova venda" e a lista de todas as vendas (com filtros) */}
        <ListaVendas
          novaVenda={<div className="flex flex-wrap items-center gap-2"><BotaoFecharTurno /><MenuAcoes principal="+ Nova venda" rotulo="Nova venda" acoes={caminhos} /></div>}
          aviso={emAndamento && (
            <div className="mb-4 flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-[var(--marca)] bg-[var(--marca-suave)] p-3">
              <span className="text-sm font-semibold">{emAndamento.icone} {t('Venda em andamento: {n} item(ns).', { n: carrinho!.linhas.length })}</span>
              <div className="flex gap-2">
                <Botao variante="leve" onClick={() => setTrocar('')}>{t('Descartar')}</Botao>
                <Botao onClick={() => setCaminho(emAndamento.id)}>{t('Continuar')}</Botao>
              </div>
            </div>
          )}
        />
        {trocar !== undefined && (
          <Confirmar
            titulo="Descartar a venda em andamento?"
            texto="Os itens já adicionados vão ser tirados da venda."
            rotulo="Descartar"
            perigo
            onConfirmar={() => {
              setVendaId(novoId())
              setCarrinho(undefined)
              if (trocar) ajustarParams({ modulo: trocar, passo: undefined })
            }}
            onFechar={() => setTrocar(undefined)}
          />
        )}
      </>
    )
  }

  if (!mod) return <Carregando />
  const porTabela = caminho === 'cabelo' || !!mod.recursos?.tabelaPreco
  const atendimento = caminho === 'salao' || !!mod.recursos?.agenda
  const atual: Carrinho = carrinho?.moduloId === caminho ? carrinho : { moduloId: caminho, linhas: [], pagamentos: [] }
  return (
    <AssistenteVenda
      key={vendaId}
      vendaId={vendaId}
      moduloId={caminho}
      porTabela={porTabela}
      atendimento={atendimento}
      titulo={`${mod.icone} ${caminho === 'cabelo' ? t('Vender por medida') : pergunta(mod)}`}
      carrinho={atual}
      onCarrinho={(c) => setCarrinho((x) => ({ ...(x?.moduloId === caminho ? x : atual), ...c, moduloId: caminho }))}
      passo={atual.linhas.length ? passo : 'itens'}
      onPasso={setPasso}
      onVoltar={() => ajustarParams({ modulo: undefined, passo: undefined, lote: undefined, coluna: undefined, medida: undefined, categoria: undefined })}
      onConcluir={(r) => {
        setConcluida(r)
        ajustarParams({ modulo: undefined, passo: undefined, lote: undefined, coluna: undefined, medida: undefined, categoria: undefined })
      }}
      moedaPrincipal={cfg?.config.moedaPrincipal ?? moedaPadrao()}
      nomeNegocio={cfg?.config.nomeNegocio ?? ''}
    />
  )
}
