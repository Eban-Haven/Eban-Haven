/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Base URL of the .NET API (no trailing slash). Empty = same-origin `/api`. */
  readonly VITE_API_BASE_URL?: string
  /** Google Identity Services OAuth client ID for donor login/registration. */
  readonly VITE_GOOGLE_CLIENT_ID?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
