// QR DA ETIQUETA (…#/q/<código aleatório>) — o que acontece ao ler o QR de um pacote:
//   · quem ENTROU: o servidor diz qual é o pacote (pacoteDoQr) e a tela abre o pacote (a funcionária vê a visão de
//     vender, o administrador a ficha). Etiqueta cancelada (reimpressa) → aviso "etiqueta antiga", nada abre.
//   · quem NÃO entrou: <EtiquetaInterna> — uma página neutra. Sem nome do negócio, sem lista de usuários de teste, sem
//     dados de exemplo, sem nada do pacote: só "etiqueta de uso interno" e o botão para entrar.
// O código do QR é aleatório (domain/ids.ts novoCodigoQr): não diz id, data, medida nem cor. Com a API, ele passa a ser
// um token assinado pelo servidor (DIAGNOSTICO-API.md §12).
import { useEffect } from 'react'
import { Botao, Carregando, ErroTela } from '../../../shared/ui/base'
import { useApp, useConsulta } from '../../../shared/ui/contexto'
import { useT } from '../../../shared/ui/i18n'

export function AbrirQr() {
  const { nav, ir, voltar } = useApp()
  const codigo = String(nav.params.id ?? '')
  const { dados, erro } = useConsulta('pacoteDoQr', { codigo }, !!codigo)
  useEffect(() => {
    if (dados?.id) {
      // troca o endereço do QR pelo do pacote (voltar não cai de novo no QR)
      history.replaceState(null, '', `#/lotes/${encodeURIComponent(dados.id)}`)
      ir('lote', { id: dados.id })
    }
  }, [dados?.id, ir])
  if (erro) return <ErroTela texto={erro} onVoltar={voltar} />
  return <Carregando texto="Abrindo o pacote…" />
}

/** quem leu o QR sem ter entrado: página neutra (não diz de quem é nem o que é) */
export function EtiquetaInterna({ onEntrar }: { onEntrar(): void }) {
  const t = useT()
  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--fundo)] p-6 text-center">
      <div className="w-full max-w-sm space-y-4">
        <div aria-hidden className="mx-auto flex h-16 w-16 items-center justify-center rounded-3xl bg-[var(--marca-suave)] text-3xl">🔒</div>
        <h1 className="text-xl font-black">{t('Etiqueta de uso interno')}</h1>
        <p className="text-sm text-[var(--suave)]">{t('Este código é para a equipe. Para ver o pacote, entre com o seu usuário.')}</p>
        <Botao grande className="w-full" onClick={onEntrar}>{t('Entrar')}</Botao>
      </div>
    </div>
  )
}
