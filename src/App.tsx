import { AuthGate } from './components/auth/AuthGate'
import { LanguageProvider } from './i18n/LanguageProvider'
import './App.css'

function App() {
  return <LanguageProvider><AuthGate /></LanguageProvider>
}

export default App
