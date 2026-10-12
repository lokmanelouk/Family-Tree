import { DashboardPage } from './pages/DashboardPage'
import { LanguageProvider } from './i18n/LanguageProvider'
import { FamilyQuickLinks } from './components/animata/fabs/FamilyQuickLinks'
import { SharedTreePage } from './pages/SharedTreePage'
import './App.css'

function App() {
  const isSharedView = new URLSearchParams(window.location.hash.slice(1)).has('shared')
  return <LanguageProvider>{isSharedView ? <SharedTreePage /> : <><DashboardPage /><FamilyQuickLinks /></>}</LanguageProvider>
}

export default App
