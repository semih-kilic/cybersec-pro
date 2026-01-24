import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import ErrorBoundary from './components/ErrorBoundary'
import App from './App'

const rootElement = document.getElementById('root')
if (!rootElement) {
  console.error('❌ Root element not found!')
  throw new Error('Root element not found')
}

try {
  createRoot(rootElement).render(
    <StrictMode>
      <ErrorBoundary>
        <App />
      </ErrorBoundary>
    </StrictMode>,
  )
} catch (error) {
  console.error('❌ Failed to render application')
  document.body.innerHTML = `
    <div style="min-height:100vh;background:#0D1117;color:#F85149;display:flex;align-items:center;justify-content:center;font-family:sans-serif;padding:20px;text-align:center;">
      <div>
        <h1 style="font-size:48px;margin-bottom:20px">⚠️ Render Error</h1>
        <p>Failed to initialize application</p>
        <button onclick="location.reload()" style="margin-top:20px;padding:12px 24px;background:#367BF0;color:white;border:none;border-radius:8px;cursor:pointer">Reload</button>
      </div>
    </div>
  `
}
