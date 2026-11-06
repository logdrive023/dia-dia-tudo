import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './app/App'
import './index.css'
import { aplicarTema, lerTema } from './shared/ui/tema'

// tema do aparelho antes da primeira tela (sem piscar claro → escuro)
aplicarTema(lerTema())

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
