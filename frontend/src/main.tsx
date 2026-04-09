import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { GoogleOAuthProvider } from '@react-oauth/google'
import { ScrollToTop } from './components/ScrollToTop'
import './index.css'
import App from './App.tsx'

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined

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

createRoot(document.getElementById('root')!).render(
  GOOGLE_CLIENT_ID
    ? <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>{tree}</GoogleOAuthProvider>
    : tree,
)
