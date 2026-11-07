// Casca do app: só JUNTA as peças — cada responsabilidade mora no seu arquivo:
//   useSessao     (useSessao.ts)    o backend (criado uma vez) e quem está usando
//   useNavegacao  (useNavegacao.ts) pilha de telas, endereço, voltar, rolagem e "sair sem salvar"
//   useAviso/Aviso (Aviso.tsx)      o aviso rápido que some sozinho
//   ComIdioma · Preparar · Tela · NovaVersao · Recuperacao (Moldura.tsx)
//   TELAS e SO_ADMIN (telas.ts)     o mapa das telas e quem pode abrir
// Aqui: a escolha do que mostrar (vitrine pública · etiqueta pelo QR · entrar · o app com menu) e o câmbio do dia.
import { useEffect, useState } from 'react'
import { EtiquetaInterna } from '../features/lote'
import { Loja } from '../features/vitrine'
import { Entrar } from '../features/acesso'
import { atualizarCambio } from '../adapters/cambio'
import { Confirmar } from '../shared/ui/base'
import { Conversor } from '../shared/ui/compartilhados'
import { type AppCtx, Ctx } from '../shared/ui/contexto'
import { Shell } from './Shell'
import { Aviso, useAviso } from './Aviso'
import { ComIdioma, NovaVersao, Preparar, Recuperacao, Tela } from './Moldura'
import { telaInicial } from './telas'
import { useNavegacao } from './useNavegacao'
import { useSessao } from './useSessao'

export default function App() {
  const { backend, sessao, trocarSessao } = useSessao()
  const navegacao = useNavegacao(() => ({ tela: telaInicial(sessao.perfil), params: {} }))
  const { nav, saida, cancelarSaida, recomecar } = navegacao
  const { aviso, avisar, fechar: fecharAviso } = useAviso()
  // chegou pelo QR sem ter entrado: primeiro a página neutra; "Entrar" mostra o login
  const [entrarPeloQr, setEntrarPeloQr] = useState(false)
  useEffect(() => {
    if (backend.tipo !== 'api') atualizarCambio(backend).catch(() => undefined)
  }, [backend])

  const ctx: AppCtx = { backend, sessao, trocarSessao, nav, origem: navegacao.origem, ir: navegacao.ir, voltar: navegacao.voltar, avisar, ajustarParams: navegacao.ajustarParams, marcarSujo: navegacao.marcarSujo }
  return (
    <Ctx.Provider value={ctx}>
      <ComIdioma>
        <Preparar>
          {/* a VITRINE do comprador (#/loja): página de loja, sem menu e sem login */}
          {nav.tela === 'loja' ? <Loja /> : !sessao.usuarioId && nav.tela === 'qr' && !entrarPeloQr ? <EtiquetaInterna onEntrar={() => setEntrarPeloQr(true)} /> : !sessao.usuarioId ? (
            <Entrar semTeste={nav.tela === 'qr'} onEntrou={(s) => (trocarSessao(s), recomecar({ tela: telaInicial(s.perfil), params: {} }))} />
          ) : (
            <>
              <Shell>
                <Recuperacao chave={nav.tela}>
                  <Tela />
                </Recuperacao>
              </Shell>
              <Conversor />
            </>
          )}
        </Preparar>
        <NovaVersao />
        {saida && (
          <Confirmar titulo="Sair sem salvar?" texto="O que você digitou nesta tela ainda não foi salvo e vai ser perdido." rotulo="Sair sem salvar" perigo onConfirmar={() => saida()} onFechar={cancelarSaida} />
        )}
        {aviso && <Aviso texto={aviso.texto} tipo={aviso.tipo} onFechar={fecharAviso} />}
      </ComIdioma>
    </Ctx.Provider>
  )
}
