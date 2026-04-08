/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Base URL of the .NET API (no trailing slash). Empty = same-origin `/api`. */
  readonly VITE_API_BASE_URL?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
