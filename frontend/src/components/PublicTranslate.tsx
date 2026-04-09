import { useEffect, useId, useState } from 'react'
import { useLocation } from 'react-router-dom'

const STORAGE_KEY = 'haven_public_language'

const languageOptions = [
  { code: 'en', label: 'English' },
  { code: 'ak', label: 'Akan' },
  { code: 'tw', label: 'Twi' },
  { code: 'ee', label: 'Ewe' },
  { code: 'gaa', label: 'Ga' },
  { code: 'dag', label: 'Dagbani' },
  { code: 'ha', label: 'Hausa' },
  { code: 'fr', label: 'French' },
] as const

export type PublicLanguageCode = (typeof languageOptions)[number]['code']

function isSupportedLanguage(value: string | null): value is PublicLanguageCode {
  return languageOptions.some((language) => language.code === value)
}

export function getStoredPublicLanguage(): PublicLanguageCode {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    return isSupportedLanguage(stored) ? stored : 'en'
  } catch {
    return 'en'
  }
}

export function setStoredPublicLanguage(language: PublicLanguageCode) {
  try {
    localStorage.setItem(STORAGE_KEY, language)
  } catch {
    /* ignore storage errors */
  }
}

export function buildGoogleTranslateUrl(targetUrl: string, language: PublicLanguageCode) {
  const params = new URLSearchParams({
    sl: 'en',
    tl: language,
    u: targetUrl,
  })

  return `https://translate.google.com/translate?${params.toString()}`
}

function shouldBypassTranslateRedirect() {
  return window.location.hostname.includes('translate.google.')
}

export function PublicTranslationSync() {
  const location = useLocation()

  useEffect(() => {
    const language = getStoredPublicLanguage()
    if (language === 'en' || shouldBypassTranslateRedirect()) {
      return
    }

    const translatedUrl = buildGoogleTranslateUrl(window.location.href, language)
    window.location.replace(translatedUrl)
  }, [location.pathname, location.search, location.hash])

  useEffect(() => {
    function onDocumentClick(event: MouseEvent) {
      const language = getStoredPublicLanguage()
      if (language === 'en') {
        return
      }

      const target = event.target
      if (!(target instanceof Element)) {
        return
      }

      const anchor = target.closest('a[href]') as HTMLAnchorElement | null
      if (!anchor) {
        return
      }

      if (
        anchor.target === '_blank' ||
        anchor.hasAttribute('download') ||
        anchor.getAttribute('rel')?.includes('external')
      ) {
        return
      }

      const href = anchor.getAttribute('href')
      if (!href || href.startsWith('#') || href.startsWith('mailto:') || href.startsWith('tel:')) {
        return
      }

      const url = new URL(anchor.href, window.location.origin)
      if (url.origin !== window.location.origin || url.pathname.startsWith('/admin')) {
        return
      }

      event.preventDefault()
      window.location.assign(buildGoogleTranslateUrl(url.toString(), language))
    }

    document.addEventListener('click', onDocumentClick)
    return () => document.removeEventListener('click', onDocumentClick)
  }, [])

  return null
}

export function PublicTranslate() {
  const selectId = useId()
  const [language, setLanguage] = useState<PublicLanguageCode>(() => getStoredPublicLanguage())

  function onLanguageChange(event: React.ChangeEvent<HTMLSelectElement>) {
    const nextLanguage = event.target.value as PublicLanguageCode
    setLanguage(nextLanguage)
    setStoredPublicLanguage(nextLanguage)

    if (nextLanguage === 'en') {
      window.location.assign(window.location.href)
      return
    }

    window.location.assign(buildGoogleTranslateUrl(window.location.href, nextLanguage))
  }

  return (
    <div className="max-w-full rounded-2xl border border-border bg-muted/40 p-3">
      <label
        htmlFor={selectId}
        className="block text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground"
      >
        Translate
      </label>
      <select
        id={selectId}
        value={language}
        onChange={onLanguageChange}
        className="mt-2 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/20"
        aria-label="Translate public pages"
      >
        {languageOptions.map((option) => (
          <option key={option.code} value={option.code}>
            {option.label}
          </option>
        ))}
      </select>
      <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">
        Public pages open through Google Translate. Admin pages stay in English.
      </p>
    </div>
  )
}
