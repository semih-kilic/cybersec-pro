import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import './index.css'
import { i18nReady } from './i18n'

const mount = () => {
  ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>,
  )
}

// Translations are fetched as their own chunk, so wait for the active language
// before the first paint — otherwise the UI flashes raw translation keys. On a
// load failure we still mount (degraded to the key fallback) rather than
// leaving the user with a blank page.
i18nReady.then(mount).catch(mount)
