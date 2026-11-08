import { ErrorBoundary } from './features/common/ErrorBoundary'
import { AppShell } from './features/AppShell'
import { SessionProvider } from './features/SessionProvider'

function App() {
  return (
    <ErrorBoundary>
      <SessionProvider>
        <AppShell />
      </SessionProvider>
    </ErrorBoundary>
  )
}

export default App
