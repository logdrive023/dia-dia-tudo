// BACKUP: baixa tudo deste aparelho num arquivo JSON (Configurações › Dados e a confirmação do Modo teste).
import type { Backend } from '../../../core/ports/backend'

export async function baixarBackup(backend: Pick<Backend, 'exportar'>) {
  const b = await backend.exportar()
  const url = URL.createObjectURL(new Blob([JSON.stringify(b)], { type: 'application/json' }))
  const a = document.createElement('a')
  a.href = url
  a.download = `backup-tudo-${new Date().toISOString().slice(0, 10)}.json`
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
