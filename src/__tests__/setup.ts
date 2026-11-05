import 'fake-indexeddb/auto'

// jsdom não tem estes: o app só usa para mostrar fotos e baixar arquivos
if (typeof URL !== 'undefined' && !URL.createObjectURL) URL.createObjectURL = () => 'blob:teste'
if (typeof URL !== 'undefined' && !URL.revokeObjectURL) URL.revokeObjectURL = () => undefined
if (typeof window !== 'undefined') window.scrollTo = () => undefined

// no GitHub Actions a máquina é mais lenta: espera até 10 s nas buscas da tela (findBy…/waitFor) antes de falhar
import { configure } from '@testing-library/react'
configure({ asyncUtilTimeout: 10000 })
