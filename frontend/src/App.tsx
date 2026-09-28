import { useState } from 'react'
import CatalogScreen from './components/CatalogScreen'
import WaitingRoom from './components/WaitingRoom'
import WelcomeScreen from './components/WelcomeScreen'

type Screen = 'welcome' | 'catalog' | 'waiting-room'

export default function App() {
  const [screen, setScreen] = useState<Screen>('welcome')

  if (screen === 'catalog') {
    return <CatalogScreen onNarrativeSelect={() => setScreen('waiting-room')} />
  }

  if (screen === 'waiting-room') {
    return <WaitingRoom onReturnToChapters={() => setScreen('catalog')} />
  }

  return <WelcomeScreen onContinue={() => setScreen('catalog')} />
}
