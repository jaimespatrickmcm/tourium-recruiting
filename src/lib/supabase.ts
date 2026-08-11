import { createClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL ?? '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY ?? '';

// Em vez de estourar no import (tela branca sem explicação no deploy), a gente
// sinaliza e deixa o main.tsx renderizar uma mensagem legível. As env vars VITE_*
// são injetadas em BUILD time: se faltarem no build do Cloudflare, cai aqui.
export const supabaseConfigMissing = !supabaseUrl || !supabaseAnonKey;

if (supabaseConfigMissing) {
  console.error(
    '[Noren] Faltam env vars do Supabase (VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY). ' +
      'Em local: copie .env.example pra .env.local. No Cloudflare Pages: defina as duas em ' +
      'Settings > Environment Variables (escopo Production) e rode um novo deploy.',
  );
}

export const supabase = createClient<Database>(
  supabaseUrl || 'https://placeholder.supabase.co',
  supabaseAnonKey || 'placeholder-anon-key',
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  },
);
