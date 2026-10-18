import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { Capacitor } from '@capacitor/core'
import './index.css'
import App from './App.tsx'

// Ensure Capacitor is available globally for native platform checks
if (typeof window !== 'undefined') {
  (window as any).Capacitor = Capacitor;
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

