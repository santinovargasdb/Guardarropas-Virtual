/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string;
  readonly VITE_SUPABASE_ANON_KEY: string;
  // Optional: set to 'false' to hide the stylist chat. The LLM key (GROQ_API_KEY)
  // is server-side only, so there is no VITE_ key for it.
  readonly VITE_STYLIST_ENABLED?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
