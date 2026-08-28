import React from 'react'
import ReactDOM from 'react-dom/client'
import '@fontsource/plus-jakarta-sans/400.css'
import '@fontsource/plus-jakarta-sans/500.css'
import '@fontsource/plus-jakarta-sans/600.css'
import '@fontsource/plus-jakarta-sans/700.css'
import App from './App'
import './index.css'
import { initI18n } from './i18n'
import { applyBrandTheme, DEFAULT_BRAND_COLOR } from './lib/theme'

async function bootstrap() {
  applyBrandTheme(DEFAULT_BRAND_COLOR)
  const language = await window.api.app.getLanguage()
  await initI18n(language)

  ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>,
  )
}

bootstrap()
