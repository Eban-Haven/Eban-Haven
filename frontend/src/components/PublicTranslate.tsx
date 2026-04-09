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

export function buildGoogleTranslateUrl(targetUrl: string, language: PublicLanguageCode) {
  if (language === 'en') {
    return targetUrl
  }

  const params = new URLSearchParams({
    sl: 'en',
    tl: language,
    u: targetUrl,
  })

  return `https://translate.google.com/translate?${params.toString()}`
}

export function PublicTranslate() {
  const currentUrl = typeof window === 'undefined' ? '' : window.location.href

  return (
    <div className="max-w-full rounded-2xl border border-border bg-muted/40 p-3">
      <p className="block text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
        Translate
      </p>
      <div className="mt-2 flex flex-wrap gap-2">
        <a
          href={currentUrl}
          className="rounded-full border border-border bg-background px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:border-primary hover:text-primary"
        >
          English
        </a>
        {languageOptions
          .filter((option) => option.code !== 'en')
          .map((option) => (
            <a
              key={option.code}
              href={buildGoogleTranslateUrl(currentUrl, option.code)}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-full border border-border bg-background px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:border-primary hover:text-primary"
            >
              {option.label}
            </a>
          ))}
      </div>
      <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">
        Translated public pages open in a new tab. This page stays in English.
      </p>
    </div>
  )
}
