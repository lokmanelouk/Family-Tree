import { LocalTreeGate } from './components/local/LocalTreeGate'
import { LanguageProvider } from './i18n/LanguageProvider'
import './App.css'

function App() {
  return <LanguageProvider><LocalTreeGate /></LanguageProvider>
}

export default App
