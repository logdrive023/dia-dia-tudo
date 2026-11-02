// Estado das telas: backend (a porta), sessão (quem está usando), navegação e consultas que se atualizam sozinhas.

import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'
import { ErroNegocio } from '../core/domain/erros'
import type { Backend } from '../core/ports/backend'
import type { Sessao } from '../core/ports/portas'
import type { DadosComando, NomeComando, NomeConsulta, ParamsConsulta, ResultadoComando, ResultadoConsulta } from '../core/services'

export type Params = Record<string, string | number | boolean | undefined>

export interface Navegacao {
  tela: string
  params: Params
}

export interface AppCtx {
  backend: Backend
  sessao: Sessao
  trocarSessao(s: Sessao): void
  nav: Navegacao
  ir(tela: string, params?: Params): void
  voltar(): void
  /** muda os parâmetros da tela atual sem criar passo no histórico (filtros, abas, busca) */
  ajustarParams(p: Params): void
  /** true = há algo digitado e não salvo: sair pede confirmação */
  marcarSujo(sujo: boolean): void
  avisar(texto: string, tipo?: 'ok' | 'erro'): void
}

export const Ctx = createContext<AppCtx | null>(null)

export function useApp(): AppCtx {
  const c = useContext(Ctx)
  if (!c) throw new Error('fora do app')
  return c
}

/**
 * Estado da tela guardado no endereço (#/vendas?aba=x): voltar do detalhe reencontra a lista como estava,
 * e o link pode ser compartilhado. Ex.: const [aba, setAba] = useParamTela('aba', 'todas')
 */
export function useParamTela<T extends string = string>(chave: string, padrao: string): [T, (v: T) => void] {
  const { nav, ajustarParams } = useApp()
  const atual = ((nav.params[chave] as string | undefined) ?? padrao) as T
  return [atual, (v: T) => ajustarParams({ [chave]: v === padrao ? undefined : v })]
}

/** Avisa antes de sair da tela (menu, voltar, voltar do celular, fechar a aba) se houver dado não salvo. */
export function useAvisoSaida(sujo: boolean) {
  const { marcarSujo } = useApp()
  useEffect(() => {
    marcarSujo(sujo)
    return () => marcarSujo(false)
  }, [sujo, marcarSujo])
}

/** Consulta que recarrega quando os dados mudam (qualquer comando) ou quando os parâmetros mudam. */
export function useConsulta<N extends NomeConsulta>(nome: N, params: ParamsConsulta<N>, ativo = true) {
  const { backend, sessao } = useApp()
  const [dados, setDados] = useState<ResultadoConsulta<N>>()
  const [erro, setErro] = useState<string>()
  const [versao, setVersao] = useState(0)
  const chave = JSON.stringify(params ?? {})
  const vivo = useRef(true)
  useEffect(() => backend.aoMudar(() => setVersao((v) => v + 1)), [backend])
  useEffect(() => {
    vivo.current = true
    if (!ativo) return
    backend
      .consulta(nome, JSON.parse(chave))
      .then((r) => {
        if (vivo.current) {
          setDados(r)
          setErro(undefined)
        }
      })
      .catch((e) => vivo.current && setErro(e instanceof Error ? e.message : String(e)))
    return () => {
      vivo.current = false
    }
  }, [backend, nome, chave, versao, ativo, sessao.usuarioId])
  return { dados, erro, carregando: dados === undefined && !erro, recarregar: () => setVersao((v) => v + 1) }
}

/** Executa um comando mostrando a mensagem amigável se a regra recusar. Devolve undefined se falhou. */
export function useComando() {
  const { backend, avisar } = useApp()
  const [ocupado, setOcupado] = useState(false)
  const executar = useCallback(
    async <N extends NomeComando>(nome: N, dados: DadosComando<N>, ok?: string): Promise<ResultadoComando<N> | undefined> => {
      setOcupado(true)
      try {
        const r = await backend.comando(nome, dados)
        if (ok) avisar(ok, 'ok')
        return r
      } catch (e) {
        avisar(e instanceof ErroNegocio || e instanceof Error ? e.message : String(e), 'erro')
        return undefined
      } finally {
        setOcupado(false)
      }
    },
    [backend, avisar],
  )
  return { executar, ocupado }
}
