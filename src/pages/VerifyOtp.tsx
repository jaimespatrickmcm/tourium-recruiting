import { useEffect, useState } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { toast } from 'sonner';
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSeparator,
  InputOTPSlot,
} from '@/components/ui/input-otp';
import { supabase } from '@/lib/supabase';

const RESEND_COOLDOWN_SECONDS = 60;

// Module-level Set: sobrevive a StrictMode double-mount (refs por-instância
// não bastam porque cada mount cria um novo ref). Marca cada tentativa
// email+token pra impedir double-call que consome o OTP duas vezes.
const attemptedTokens = new Set<string>();

type VerifyState = {
  email?: string;
  flow?: 'signup' | 'login';
};

export function VerifyOtp() {
  const navigate = useNavigate();
  const location = useLocation();
  const state = (location.state as VerifyState | null) ?? {};
  const email = state.email;
  const flow = state.flow ?? 'login';

  const [code, setCode] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [resending, setResending] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    if (!email) navigate('/login', { replace: true });
  }, [email, navigate]);

  useEffect(() => {
    if (cooldown <= 0) return;
    const id = setTimeout(() => setCooldown((s) => s - 1), 1000);
    return () => clearTimeout(id);
  }, [cooldown]);

  useEffect(() => {
    if (!email || code.length !== 8 || verifying) return;
    const key = `${email}:${code}`;
    if (attemptedTokens.has(key)) return;
    attemptedTokens.add(key);
    void verify(code);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code, email]);

  async function verify(token: string) {
    if (!email) return;
    setVerifying(true);
    // Pra signup, shouldCreateUser=true → token tipo 'email'.
    // Pra login de usuário existente, shouldCreateUser=false → Supabase gera token tipo 'recovery'.
    // Tenta o tipo correto baseado no flow, com fallback pro outro caso o backend tenha mudado.
    const primaryType: 'email' | 'recovery' = flow === 'signup' ? 'email' : 'recovery';
    const secondaryType: 'email' | 'recovery' = primaryType === 'email' ? 'recovery' : 'email';

    let result = await supabase.auth.verifyOtp({ email, token, type: primaryType });
    if (result.error) {
      console.warn(`[verifyOtp] type=${primaryType} failed, trying ${secondaryType}:`, result.error);
      result = await supabase.auth.verifyOtp({ email, token, type: secondaryType });
    }
    setVerifying(false);
    if (result.error) {
      console.error('[verifyOtp] both types failed:', result.error);
      const msg = result.error.message ?? 'Código inválido';
      const isInvalid = /invalid|expired/i.test(msg);
      toast.error(
        isInvalid
          ? 'Código inválido ou expirado. Peça um novo abaixo.'
          : `Falha: ${msg}`,
      );
      setCode('');
      return;
    }
    toast.success(flow === 'signup' ? 'Conta criada. Bem-vindo ao Noren.' : 'Logado.');
    navigate('/app', { replace: true });
  }

  async function resend() {
    if (!email) return;
    setResending(true);
    // Limpa cache de tentativas anteriores deste email pra permitir o novo código
    for (const k of attemptedTokens) {
      if (k.startsWith(`${email}:`)) attemptedTokens.delete(k);
    }
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { shouldCreateUser: flow === 'signup' },
    });
    setResending(false);
    if (error) {
      toast.error('Falha ao reenviar código.');
      return;
    }
    toast.success('Novo código enviado.');
    setCooldown(RESEND_COOLDOWN_SECONDS);
    setCode('');
  }

  if (!email) return null;

  return (
    <main className="relative min-h-screen flex items-center justify-center bg-white px-4 py-12 overflow-hidden">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[640px] bg-[radial-gradient(ellipse_at_top,rgba(14,165,233,0.10),transparent_60%)]" />

      <div className="relative w-full max-w-md">
        <div className="text-center mb-8">
          <Link
            to="/"
            className="inline-block font-satoshi font-bold text-[28px] tracking-[-0.6px] text-[#1d1d1f]"
          >
            Noren
          </Link>
        </div>

        <div className="bg-white rounded-[28px] border border-gray-200 shadow-[0_20px_60px_-20px_rgba(15,15,30,0.12)] p-8 md:p-10">
          <div className="mb-7">
            <h1 className="font-satoshi font-bold text-[26px] tracking-[-0.4px] text-[#1d1d1f] leading-tight mb-2">
              Confirme seu acesso
            </h1>
            <p className="text-[15px] text-[#6b6b70] leading-relaxed">
              Mandamos um código de 8 dígitos pra{' '}
              <strong className="text-[#1d1d1f]">{email}</strong>. Cole ou digite aqui.
            </p>
          </div>

          <div className="flex flex-col items-center gap-6">
            <InputOTP
              maxLength={8}
              value={code}
              onChange={setCode}
              disabled={verifying}
              autoFocus
            >
              <InputOTPGroup>
                <InputOTPSlot index={0} className="h-12 w-11 rounded-xl text-xl font-bold" />
                <InputOTPSlot index={1} className="h-12 w-11 rounded-xl text-xl font-bold" />
                <InputOTPSlot index={2} className="h-12 w-11 rounded-xl text-xl font-bold" />
                <InputOTPSlot index={3} className="h-12 w-11 rounded-xl text-xl font-bold" />
              </InputOTPGroup>
              <InputOTPSeparator />
              <InputOTPGroup>
                <InputOTPSlot index={4} className="h-12 w-11 rounded-xl text-xl font-bold" />
                <InputOTPSlot index={5} className="h-12 w-11 rounded-xl text-xl font-bold" />
                <InputOTPSlot index={6} className="h-12 w-11 rounded-xl text-xl font-bold" />
                <InputOTPSlot index={7} className="h-12 w-11 rounded-xl text-xl font-bold" />
              </InputOTPGroup>
            </InputOTP>

            {verifying && (
              <p className="text-[13px] text-[#8a8a8f]">Verificando...</p>
            )}

            <button
              type="button"
              disabled={cooldown > 0 || resending}
              onClick={resend}
              className="text-[14px] text-[#6b6b70] hover:text-[#1d1d1f] transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-medium"
            >
              {cooldown > 0
                ? `Reenviar em ${cooldown}s`
                : resending
                ? 'Reenviando...'
                : 'Reenviar código'}
            </button>

            <p className="text-[14px] text-[#8a8a8f] text-center pt-2 border-t w-full">
              Email errado?{' '}
              <Link
                to={flow === 'signup' ? '/signup' : '/login'}
                className="text-[#1d1d1f] font-semibold hover:underline"
              >
                Voltar
              </Link>
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}
