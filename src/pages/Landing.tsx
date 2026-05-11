export function Landing() {
  return (
    <main className="min-h-screen flex items-center justify-center bg-background">
      <div className="max-w-2xl text-center px-6 py-24">
        <h1 className="text-5xl font-semibold tracking-tight mb-6">Nuren</h1>
        <p className="text-lg text-muted-foreground mb-10 leading-relaxed">
          Configure o DNA da sua empresa, e a IA analisa cada candidato sob essa lente
          específica. Recrutamento que entende o seu contexto.
        </p>
        <a
          href="/login"
          className="inline-flex items-center justify-center rounded-md bg-primary text-primary-foreground h-11 px-8 text-sm font-medium hover:bg-primary/90 transition-colors"
        >
          Entrar
        </a>
      </div>
    </main>
  );
}
