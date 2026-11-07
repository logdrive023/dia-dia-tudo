// NAVEGAÇÃO DO APP: a pilha de telas, o endereço (#/…), o "voltar" (do app, do navegador e do celular), a rolagem
// devolvida ao voltar e a PROTEÇÃO DE "SAIR SEM SALVAR" (dado não salvo → menu, voltar e voltar do celular perguntam).
// A regra de para onde voltar é de destinoVoltar (shared/navegacao/rotas) — a trilha usa a mesma.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { type Navegacao, type Params } from '../shared/ui/contexto'
import { destinoVoltar, hashParaNav, navParaHash, normalizarNav } from '../shared/navegacao/rotas'

export function useNavegacao(inicio: () => Navegacao) {
  // abre direto no endereço da barra (ex.: #/pedidos/P-0007), se houver
  const [pilha, setPilha] = useState<Navegacao[]>(() => [hashParaNav(window.location.hash) ?? inicio()])
  const nav = pilha[pilha.length - 1]
  const pilhaRef = useRef(pilha)
  pilhaRef.current = pilha

  // ---------- "sair sem salvar" ----------
  const sujoRef = useRef(false)
  const [saida, setSaida] = useState<() => void>()
  const marcarSujo = useCallback((s: boolean) => {
    sujoRef.current = s
  }, [])
  useEffect(() => {
    const f = (e: BeforeUnloadEvent) => {
      if (sujoRef.current) e.preventDefault()
    }
    window.addEventListener('beforeunload', f)
    return () => window.removeEventListener('beforeunload', f)
  }, [])
  const protegido = useCallback(<A extends unknown[]>(acao: (...a: A) => void) => (...a: A) => {
    if (!sujoRef.current) return acao(...a)
    setSaida(() => () => {
      sujoRef.current = false
      acao(...a)
    })
  }, [])

  // ---------- ir / voltar / ajustar ----------
  const ir = useCallback((tela: string, params: Params = {}) => {
    const n = normalizarNav({ tela, params })
    // a tela de agora guarda onde a pessoa estava (o "voltar" devolve a rolagem)
    history.replaceState({ ...(history.state ?? {}), rolagem: window.scrollY }, '', window.location.hash)
    setPilha((p) => [...p.slice(-30), n])
    history.pushState(null, '', navParaHash(n))
    window.scrollTo(0, 0)
  }, [])
  // regra IR E VOLTAR: veio de outra tela → volta para ela (com a aba e os filtros); veio de um formulário (ex.: Nova
  // compra → Pedido) → vai para a lista da área, nunca para o formulário enviado
  const voltar = useCallback(() => {
    const d = destinoVoltar(pilhaRef.current)
    if (d.modo === 'anterior') return history.back()
    // a lista já está mais atrás no histórico: volta até ela (mantém filtros)
    if (d.modo === 'pular') return history.go(d.passos)
    setPilha((p) => [...p.slice(0, -1), d.alvo])
    history.replaceState(null, '', navParaHash(d.alvo))
  }, [])
  const origem = useMemo(() => (pilha.length ? destinoVoltar(pilha).alvo : undefined), [pilha])
  const ajustarParams = useCallback((p: Params) => {
    setPilha((pl) => {
      const atual = pl[pl.length - 1]
      const params = { ...atual.params, ...p }
      for (const k of Object.keys(params)) if (params[k] === undefined || params[k] === '') delete params[k]
      const n = { tela: atual.tela, params }
      history.replaceState(null, '', navParaHash(n))
      return [...pl.slice(0, -1), n]
    })
  }, [])
  /** depois de entrar: recomeça a pilha no endereço da barra (ou na tela inicial do perfil) */
  const recomecar = useCallback((n: Navegacao) => setPilha([hashParaNav(window.location.hash) ?? n]), [])

  // "voltar"/"avançar" do navegador e do celular seguem o endereço (a rolagem quem devolve é o app, depois de carregar)
  useEffect(() => {
    if ('scrollRestoration' in history) history.scrollRestoration = 'manual'
    const f = () => {
      if (sujoRef.current) {
        const ali = pilhaRef.current[pilhaRef.current.length - 1]
        history.pushState(null, '', navParaHash(ali))
        setSaida(() => () => {
          sujoRef.current = false
          history.go(-2)
        })
        return
      }
      const n = hashParaNav(window.location.hash)
      if (n) setPilha((p) => (p.length > 1 ? p.slice(0, -1) : [n]).map((x, i, a) => (i === a.length - 1 ? n : x)))
      // devolve a rolagem de quando saiu desta tela: a página carrega aos poucos, então tenta até caber (até ~2 s)
      const y = (history.state as { rolagem?: number } | null)?.rolagem
      if (y) {
        let k = 0
        const tentar = () => {
          if (document.documentElement.scrollHeight - window.innerHeight >= y || k > 40) return window.scrollTo(0, y)
          k++
          setTimeout(tentar, 50)
        }
        setTimeout(tentar, 0)
      }
    }
    window.addEventListener('popstate', f)
    return () => window.removeEventListener('popstate', f)
  }, [])
  useEffect(() => {
    if (!window.location.hash) history.replaceState(null, '', navParaHash(nav))
  }, [nav])

  const irSeguro = useMemo(() => protegido(ir), [protegido, ir])
  const voltarSeguro = useMemo(() => protegido(voltar), [protegido, voltar])
  return { nav, origem, ir: irSeguro, voltar: voltarSeguro, ajustarParams, marcarSujo, recomecar, saida, cancelarSaida: () => setSaida(undefined) }
}
