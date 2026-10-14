import { DashboardPage } from './pages/DashboardPage'
import { LanguageProvider } from './i18n/LanguageProvider'
import './App.css'

function App() {
  return <LanguageProvider><DashboardPage /></LanguageProvider>
}

export default App
