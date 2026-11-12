import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { installGlobalErrorHandlers } from './core/diagnostics'
import './styles/theme.css'
import './styles/app.css'
import './features/landing/styles/landing.css'
import './features/header/header.css'
import './features/posts/styles/posts.css'
import './features/shell/shell.css'
import './features/dashboard/dashboard.css'
import './features/billing/billing.css'
import App from './App.tsx'

installGlobalErrorHandlers()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
