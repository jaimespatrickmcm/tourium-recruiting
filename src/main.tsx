import React from 'react';
import ReactDOM from 'react-dom/client';
import { RouterProvider } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'sonner';
import { AuthProvider } from '@/hooks/use-auth';
import { router } from '@/router';
import { supabaseConfigMissing } from '@/lib/supabase';
import '@/index.css';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60 * 1000,
      refetchOnWindowFocus: false,
    },
  },
});

const rootEl = document.getElementById('root')!;

if (supabaseConfigMissing) {
  // Mensagem legível em vez de tela branca quando o build subiu sem as env vars.
  ReactDOM.createRoot(rootEl).render(
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px',
        fontFamily: 'system-ui, sans-serif',
        background: '#fff',
        color: '#1d1d1f',
      }}
    >
      <div style={{ maxWidth: 520 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 12 }}>
          Configuração incompleta
        </h1>
        <p style={{ fontSize: 15, lineHeight: 1.6, color: '#6b6b70' }}>
          O app subiu sem as variáveis do Supabase. No Cloudflare Pages, defina{' '}
          <code>VITE_SUPABASE_URL</code> e <code>VITE_SUPABASE_ANON_KEY</code> em Settings,
          Environment Variables (escopo Production) e rode um novo deploy. As variáveis precisam
          existir no momento do build.
        </p>
      </div>
    </div>,
  );
} else {
  ReactDOM.createRoot(rootEl).render(
    <React.StrictMode>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <RouterProvider router={router} />
          <Toaster richColors position="top-right" />
        </AuthProvider>
      </QueryClientProvider>
    </React.StrictMode>,
  );
}
