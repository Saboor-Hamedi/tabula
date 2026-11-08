import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { installGlobalErrorHandlers } from './core/diagnostics'
import './styles/theme.css'
import './styles/app.css'
import App from './App.tsx'

installGlobalErrorHandlers()

if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    void navigator.serviceWorker.register('/sw.js').catch(() => undefined)
  })
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
