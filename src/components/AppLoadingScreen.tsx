interface AppLoadingScreenProps {
  title?: string;
  subtitle?: string;
}

export function AppLoadingScreen({
  title = 'Carregando CRM M de Paula',
  subtitle = 'Preparando ambiente e dados do sistema...',
}: AppLoadingScreenProps) {
  return (
    <div className="min-h-screen bg-background relative overflow-hidden flex items-center justify-center">
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute -top-28 -left-24 w-72 h-72 rounded-full bg-primary/10 blur-3xl" />
        <div className="absolute -bottom-20 -right-16 w-72 h-72 rounded-full bg-primary/10 blur-3xl" />
      </div>

      <div className="relative z-10 w-full max-w-md mx-auto px-6">
        <div className="rounded-2xl border border-border bg-card/90 backdrop-blur-sm p-8 shadow-2xl text-center">
          <img
            src="/logo-m-de-paula.png"
            alt="CRM M de Paula"
            className="w-16 h-16 mx-auto mb-5 rounded-full border border-border bg-background/70 p-1"
          />

          <h1 className="text-2xl font-serif font-bold gold-text-gradient">{title}</h1>
          <p className="mt-3 text-sm text-muted-foreground">{subtitle}</p>

          <div className="mt-7 flex items-center justify-center gap-3">
            <span className="w-2.5 h-2.5 rounded-full bg-primary animate-bounce [animation-delay:0ms]" />
            <span className="w-2.5 h-2.5 rounded-full bg-primary/80 animate-bounce [animation-delay:120ms]" />
            <span className="w-2.5 h-2.5 rounded-full bg-primary/60 animate-bounce [animation-delay:240ms]" />
          </div>
        </div>
      </div>
    </div>
  );
}

