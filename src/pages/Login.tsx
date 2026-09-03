import { useState } from 'react';
import { useLocation, useNavigate, Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { Input } from '@/components/ui/input';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { BrandCtaButton } from '@/components/brand-cta';
import { supabase } from '@/lib/supabase';

const loginSchema = z.object({
  email: z.string().email('Email inválido'),
});

type LoginForm = z.infer<typeof loginSchema>;

export function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const [submitting, setSubmitting] = useState(false);

  const form = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '' },
  });

  async function onSubmit(values: LoginForm) {
    setSubmitting(true);
    try {
      const { error } = await supabase.auth.signInWithOtp({
        email: values.email,
        options: { shouldCreateUser: false },
      });
      if (error) throw error;
      toast.success('Código enviado pro seu email.');
      const from = (location.state as { from?: { pathname?: string; search?: string } } | null)?.from;
      const returnTo = from?.pathname?.startsWith('/')
        ? `${from.pathname}${from.search ?? ''}`
        : undefined;
      navigate('/verify-otp', { state: { email: values.email, flow: 'login', returnTo } });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao enviar código.';
      toast.error(message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="relative min-h-screen flex items-center justify-center bg-white px-4 py-12 overflow-hidden">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[640px] bg-[radial-gradient(ellipse_at_top,rgba(14,165,233,0.10),transparent_60%)]" />

      <div className="relative w-full max-w-md">
        <div className="text-center mb-8">
          <Link
            to="/"
            className="inline-block font-satoshi font-bold text-[28px] tracking-[-0.6px] text-ink"
          >
            Noren
          </Link>
        </div>

        <div className="bg-white rounded-panel border border-line-soft shadow-e3 p-8 md:p-10">
          <div className="mb-7">
            <h1 className="font-satoshi font-bold text-[26px] tracking-[-0.4px] text-ink leading-tight mb-2">
              Entrar
            </h1>
            <p className="text-callout text-ink-muted leading-relaxed">
              A gente manda um código de 6 dígitos pro seu email. Sem senha pra decorar.
            </p>
          </div>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-footnote font-semibold text-ink">Email</FormLabel>
                    <FormControl>
                      <Input
                        type="email"
                        autoComplete="email"
                        placeholder="voce@empresa.com"
                        className="h-11 rounded-tile border-line-soft text-callout"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="pt-2 flex flex-col items-center gap-4">
                <BrandCtaButton type="submit" disabled={submitting} className="w-full justify-center">
                  {submitting ? 'Enviando código...' : 'Receber código de acesso'}
                </BrandCtaButton>
                <p className="text-callout text-ink-subtle text-center">
                  Não tem conta?{' '}
                  <Link to="/signup" className="text-ink font-semibold hover:underline">
                    Criar conta
                  </Link>
                </p>
              </div>
            </form>
          </Form>
        </div>
      </div>
    </main>
  );
}
