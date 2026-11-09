import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { installGlobalErrorHandlers } from './core/diagnostics'
import './styles/theme.css'
import './styles/app.css'
import App from './App.tsx'

installGlobalErrorHandlers()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
