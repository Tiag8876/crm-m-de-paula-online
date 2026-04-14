import { BarChart3, Megaphone } from 'lucide-react';
import { Campaigns } from './Campaigns';

export function TrafficAnalytics() {
  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-6">
      <header className="space-y-4">
        <div>
          <h1 className="text-3xl md:text-4xl font-serif font-bold gold-text-gradient tracking-tight">Painel de Tráfego</h1>
          <p className="text-muted-foreground mt-2 text-[11px] uppercase tracking-widest">
            Gestão operacional de campanhas, conjuntos, criativos e investimento
          </p>
        </div>

        <section className="rounded-2xl border border-border bg-card p-5 shadow-2xl">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-2xl border border-border bg-accent/60 flex items-center justify-center text-primary shrink-0">
              <BarChart3 className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-serif font-bold">Análises migradas para Relatórios</h2>
              <p className="text-sm text-muted-foreground mt-1">
                O painel de tráfego agora fica focado na operação das campanhas. A leitura gerencial e os gráficos executivos estão concentrados na página de relatórios.
              </p>
            </div>
          </div>
        </section>
      </header>

      <section className="rounded-2xl border border-border bg-card shadow-2xl overflow-hidden">
        <div className="px-5 py-4 border-b border-border bg-accent flex items-center gap-3">
          <Megaphone className="w-5 h-5 text-primary" />
          <h2 className="text-base font-serif font-bold">Estrutura de campanhas</h2>
        </div>
        <div className="p-4">
          <Campaigns embedded />
        </div>
      </section>
    </div>
  );
}
