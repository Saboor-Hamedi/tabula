import { AppShell } from './features/AppShell'
import { SessionProvider } from './features/SessionProvider'

function App() {
  return (
    <SessionProvider>
      <AppShell />
    </SessionProvider>
  )
}

export default App
