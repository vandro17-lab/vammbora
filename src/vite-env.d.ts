/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL?: string;
  readonly VITE_SUPABASE_ANON_KEY?: string;
  readonly VITE_USE_SUPABASE?: string;
  readonly VITE_DEMO_MOTORISTA?: string;
  readonly VITE_DEMO_BUSCA?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
