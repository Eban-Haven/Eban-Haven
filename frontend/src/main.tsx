import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { ScrollToTop } from './components/ScrollToTop'
import './index.css'
import App from './App.tsx'

document.documentElement.dataset.theme = 'warm'
document.cookie = 'haven_theme=; path=/; max-age=0; SameSite=Lax'

const tree = (
  <StrictMode>
    <BrowserRouter>
      <ScrollToTop />
      <App />
    </BrowserRouter>
  </StrictMode>
)

createRoot(document.getElementById('root')!).render(tree)
