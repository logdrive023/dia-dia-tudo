import 'fake-indexeddb/auto'

// jsdom não tem estes: o app só usa para mostrar fotos e baixar arquivos
if (!URL.createObjectURL) URL.createObjectURL = () => 'blob:teste'
if (!URL.revokeObjectURL) URL.revokeObjectURL = () => undefined
window.scrollTo = () => undefined
