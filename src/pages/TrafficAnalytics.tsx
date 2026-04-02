import { useEffect, useMemo, type ComponentType } from 'react';
import { useStore } from '@/store/useStore';
import { useAuthStore } from '@/store/useAuthStore';
import { BarChart3, Users, CheckCircle2, TrendingUp, AlertTriangle, Target, Download, CalendarRange } from 'lucide-react';

export function TrafficAnalytics() {
  const { user } = useAuthStore();
  const { leads, campaigns, adGroups, ads, weeklySnapshots, ensureWeeklySnapshot } = useStore();

  useEffect(() => {
    ensureWeeklySnapshot();
  }, [ensureWeeklySnapshot]);

  const stats = useMemo(() => {
    const total = leads.length;
    const closed = leads.filter((l) => l.status === 'fechado').length;
    const lost = leads.filter((l) => l.status === 'perdido').length;
    const active = total - closed - lost;
    const conversion = total > 0 ? (closed / total) * 100 : 0;

    const campaignRows = campaigns
      .map((campaign) => {
        const campaignLeads = leads.filter((lead) => lead.campaignId === campaign.id);
        const entries = campaignLeads.length;
        const won = campaignLeads.filter((lead) => lead.status === 'fechado').length;
        const notes = campaignLeads.reduce((acc, lead) => acc + (lead.notes?.length || 0), 0);
        const followUpsDone = campaignLeads.reduce(
          (acc, lead) => acc + (lead.followUps || []).filter((f) => f.status === 'concluido').length,
          0
        );

        return {
          id: campaign.id,
          name: campaign.name,
          entries,
          won,
          notes,
          followUpsDone,
          conversion: entries > 0 ? (won / entries) * 100 : 0,
        };
      })
      .sort((a, b) => b.entries - a.entries);

    const topCreative = ads
      .map((ad) => {
        const count = leads.filter((lead) => lead.adId === ad.id).length;
        const adGroup = adGroups.find((g) => g.id === ad.adGroupId);
        const campaign = campaigns.find((c) => c.id === adGroup?.campaignId);
        return {
          adId: ad.id,
          adName: ad.name,
          campaignName: campaign?.name || 'Sem campanha',
          leads: count,
        };
      })
      .sort((a, b) => b.leads - a.leads)
      .slice(0, 5);

    return { total, closed, lost, active, conversion, campaignRows, topCreative };
  }, [leads, campaigns, adGroups, ads]);

  const latestWeekly = useMemo(() => weeklySnapshots?.[0] || null, [weeklySnapshots]);

  const exportWeeklyTrafficCsv = () => {
    if (!latestWeekly) return;

    const campaignHeader = 'Campanha,Leads,Fechados,Conversao\n';
    const campaignLines = (latestWeekly.traffic.campaignRows || [])
      .map((row) => `"${row.name.replace(/"/g, '""')}",${row.entries},${row.closed},${row.conversionRate.toFixed(1)}%`)
      .join('\n');

    const creativeHeader = '\n\nCriativo,Campanha,Leads\n';
    const creativeLines = (latestWeekly.traffic.topCreative || [])
      .map((row) => `"${row.adName.replace(/"/g, '""')}","${row.campaignName.replace(/"/g, '""')}",${row.leads}`)
      .join('\n');

    const summary = `Semana,${latestWeekly.weekKey}\nEntradas,${latestWeekly.traffic.total}\nFechados,${latestWeekly.traffic.closed}\nPerdidos,${latestWeekly.traffic.lost}\nConversao,${latestWeekly.traffic.conversion.toFixed(1)}%\n\n`;
    const csv = `${summary}${campaignHeader}${campaignLines}${creativeHeader}${creativeLines}`;
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `relatorio-semanal-trafego-${latestWeekly.weekKey}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="p-10 max-w-7xl mx-auto space-y-8">
      <header>
        <h1 className="text-4xl font-serif font-bold gold-text-gradient tracking-tight">Painel de Trafego</h1>
        <p className="text-muted-foreground mt-2 text-xs uppercase tracking-widest">
          Visao de performance para gestor de trafego e direcao comercial
        </p>
        {user?.sector && (
          <p className="text-[10px] text-gold-500/60 uppercase tracking-widest mt-2">Perfil atual: {user.sector}</p>
        )}
      </header>

      <section className="bg-card rounded-2xl border border-border shadow-2xl overflow-hidden">
        <div className="p-6 border-b border-border bg-accent flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div className="flex items-center gap-3">
            <CalendarRange className="w-5 h-5 text-primary" />
            <h2 className="text-lg font-serif font-bold">Relatorio Semanal Automatico</h2>
          </div>
          <button
            type="button"
            onClick={exportWeeklyTrafficCsv}
            disabled={!latestWeekly}
            className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-xs uppercase tracking-widest font-black flex items-center gap-2 disabled:opacity-50"
          >
            <Download className="w-4 h-4" />
            Exportar Semanal
          </button>
        </div>
        <div className="p-6 text-sm text-muted-foreground">
          {latestWeekly ? (
            <p>Semana {latestWeekly.weekKey}: {latestWeekly.traffic.total} leads, {latestWeekly.traffic.closed} fechados, conversao {latestWeekly.traffic.conversion.toFixed(1)}%.</p>
          ) : (
            <p>Nenhum snapshot semanal disponivel ainda.</p>
          )}
        </div>
      </section>

      <section className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <StatCard icon={Users} label="Entradas" value={stats.total} />
        <StatCard icon={CheckCircle2} label="Fechados" value={stats.closed} />
        <StatCard icon={AlertTriangle} label="Perdidos" value={stats.lost} />
        <StatCard icon={TrendingUp} label="Conversao" value={`${stats.conversion.toFixed(1)}%`} />
      </section>

      <section className="bg-card rounded-2xl border border-border shadow-2xl overflow-hidden">
        <div className="p-6 border-b border-border bg-accent flex items-center gap-3">
          <BarChart3 className="w-5 h-5 text-primary" />
          <h2 className="text-lg font-serif font-bold">Campanhas e Conversao</h2>
        </div>
        <div className="overflow-x-auto scrollbar-none">
          <table className="w-full text-sm">
            <thead className="text-[10px] uppercase tracking-widest text-gold-500/60 border-b border-border">
              <tr>
                <th className="px-4 py-3 text-left">Campanha</th>
                <th className="px-4 py-3 text-left">Leads</th>
                <th className="px-4 py-3 text-left">Fechados</th>
                <th className="px-4 py-3 text-left">Conversao</th>
                <th className="px-4 py-3 text-left">Notas</th>
                <th className="px-4 py-3 text-left">Follow-ups concluidos</th>
              </tr>
            </thead>
            <tbody>
              {stats.campaignRows.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">Nenhuma campanha cadastrada.</td>
                </tr>
              ) : (
                stats.campaignRows.map((row) => (
                  <tr key={row.id} className="border-b border-border/50 hover:bg-accent/40">
                    <td className="px-4 py-3 font-semibold">{row.name}</td>
                    <td className="px-4 py-3">{row.entries}</td>
                    <td className="px-4 py-3">{row.won}</td>
                    <td className="px-4 py-3">{row.conversion.toFixed(1)}%</td>
                    <td className="px-4 py-3">{row.notes}</td>
                    <td className="px-4 py-3">{row.followUpsDone}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="bg-card rounded-2xl border border-border shadow-2xl overflow-hidden">
        <div className="p-6 border-b border-border bg-accent flex items-center gap-3">
          <Target className="w-5 h-5 text-primary" />
          <h2 className="text-lg font-serif font-bold">Top Criativos por Volume de Leads</h2>
        </div>
        <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-4">
          {stats.topCreative.length === 0 ? (
            <p className="text-muted-foreground">Nenhum criativo com leads vinculados ainda.</p>
          ) : (
            stats.topCreative.map((item) => (
              <div key={item.adId} className="p-4 rounded-xl border border-border bg-background/40">
                <p className="text-xs uppercase tracking-widest text-gold-500/60">{item.campaignName}</p>
                <p className="font-bold mt-1">{item.adName}</p>
                <p className="text-sm text-muted-foreground mt-1">Leads: {item.leads}</p>
              </div>
            ))
          )}
        </div>
      </section>
    </div>
  );
}

function StatCard({ icon: Icon, label, value }: { icon: ComponentType<{ className?: string }>; label: string; value: string | number }) {
  return (
    <div className="bg-card border border-border rounded-xl p-5 flex items-center gap-3 shadow-xl">
      <div className="w-10 h-10 rounded-lg bg-accent border border-border flex items-center justify-center text-primary">
        <Icon className="w-5 h-5" />
      </div>
      <div>
        <p className="text-[10px] uppercase tracking-widest text-gold-500/60">{label}</p>
        <p className="text-xl font-serif font-bold">{value}</p>
      </div>
    </div>
  );
}
