/**
 * Reference: https://haven-hope-flow.base44.app/
 * Public imagery and copy tokens aligned to that deployment.
 */
export const IMAGES = {
  hero: 'https://media.base44.com/images/public/69d42d81e80694d948166a17/f70d70bda_generated_923f61bf.png',
  mission:
    'https://media.base44.com/images/public/69d42d81e80694d948166a17/90c218973_generated_9e96d4b1.png',
} as const

/** Display name in nav, footer, and body copy (matches reference UI). */
export const SITE_DISPLAY_NAME = 'Haven of Hope'

/** Exact browser tab title from the reference HTML `<title>`. */
export const SITE_BROWSER_TITLE = 'HavenOfHope Management'

export const DEFAULT_SITE_NAME = SITE_DISPLAY_NAME

/** Reference `og:description` / meta description. */
export const SITE_META_DESCRIPTION =
  'A comprehensive platform to manage survivor rehabilitation programs, track case outcomes, and provide transparent impact reporting for supporters.'

export const PUBLIC_CONTACT = {
  infoEmail: 'info@havenofhope.org',
  privacyEmail: 'privacy@havenofhope.org',
  phone: '+1 (555) HOPE-NOW',
  addressLine: 'P.O. Box 12345, United States',
} as const
