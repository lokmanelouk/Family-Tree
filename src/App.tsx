import { DashboardPage } from './pages/DashboardPage'
import { LanguageProvider } from './i18n/LanguageProvider'
import { FamilyQuickLinks } from './components/animata/fabs/FamilyQuickLinks'
import './App.css'

function App() {
  return <LanguageProvider><><DashboardPage /><FamilyQuickLinks /></></LanguageProvider>
}

export default App
