import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { Input } from '@/components/ui/input';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { BrandCtaButton } from '@/components/brand-cta';
import { supabase } from '@/lib/supabase';

const signupSchema = z.object({
  fullName: z.string().min(2, 'Mínimo 2 caracteres').max(80),
  companyName: z.string().min(2, 'Mínimo 2 caracteres').max(120),
  email: z.string().email('Email inválido'),
});

type SignupForm = z.infer<typeof signupSchema>;

export function Signup() {
  const navigate = useNavigate();
  const [submitting, setSubmitting] = useState(false);

  const form = useForm<SignupForm>({
    resolver: zodResolver(signupSchema),
    defaultValues: { fullName: '', companyName: '', email: '' },
  });

  async function onSubmit(values: SignupForm) {
    setSubmitting(true);
    try {
      const { error } = await supabase.auth.signInWithOtp({
        email: values.email,
        options: {
          shouldCreateUser: true,
          data: { full_name: values.fullName, company_name: values.companyName },
        },
      });
      if (error) throw error;
      toast.success('Código enviado pro seu email.');
      navigate('/verify-otp', { state: { email: values.email, flow: 'signup' } });
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
            className="inline-block font-satoshi font-bold text-[28px] tracking-[-0.6px] text-[#1d1d1f]"
          >
            Noren
          </Link>
        </div>

        <div className="bg-white rounded-[28px] border border-gray-200 shadow-[0_20px_60px_-20px_rgba(15,15,30,0.12)] p-8 md:p-10">
          <div className="mb-7">
            <h1 className="font-satoshi font-bold text-[26px] tracking-[-0.4px] text-[#1d1d1f] leading-tight mb-2">
              Criar conta
            </h1>
            <p className="text-[15px] text-[#6b6b70] leading-relaxed">
              Sem senha. A gente manda um código de 6 dígitos pro seu email. Toda vez.
            </p>
          </div>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="fullName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-[13px] font-semibold text-[#1d1d1f]">Seu nome</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="Maria Silva"
                        autoComplete="name"
                        className="h-11 rounded-xl border-gray-200 text-[15px]"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="companyName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-[13px] font-semibold text-[#1d1d1f]">
                      Nome da empresa
                    </FormLabel>
                    <FormControl>
                      <Input
                        placeholder="Acme Inc"
                        className="h-11 rounded-xl border-gray-200 text-[15px]"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-[13px] font-semibold text-[#1d1d1f]">
                      Email de trabalho
                    </FormLabel>
                    <FormControl>
                      <Input
                        type="email"
                        placeholder="voce@empresa.com"
                        autoComplete="email"
                        className="h-11 rounded-xl border-gray-200 text-[15px]"
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
                <p className="text-[14px] text-[#8a8a8f] text-center">
                  Já tem conta?{' '}
                  <Link to="/login" className="text-[#1d1d1f] font-semibold hover:underline">
                    Entrar
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
