import { useEffect, useMemo, type ComponentType } from 'react';
import { useStore } from '@/store/useStore';
import { useAuthStore } from '@/store/useAuthStore';
import { BarChart3, Users, CheckCircle2, TrendingUp, AlertTriangle, Target, CalendarRange, WalletCards, BadgeDollarSign } from 'lucide-react';

const formatCurrency = (value: number) =>
  `R$ ${value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const formatPercent = (value: number) => `${value.toFixed(1)}%`;

const getOverlapAmount = (entry: { amount: number; startDate: string; endDate: string }, start: Date, end: Date) => {
  const amount = Number(entry.amount) || 0;
  const entryStart = new Date(`${entry.startDate}T00:00:00`);
  const entryEnd = new Date(`${entry.endDate}T23:59:59.999`);
  if (Number.isNaN(entryStart.getTime()) || Number.isNaN(entryEnd.getTime())) return 0;
  if (entryEnd < start || entryStart > end) return 0;

  const overlapStart = entryStart > start ? entryStart : start;
  const overlapEnd = entryEnd < end ? entryEnd : end;
  const dayMs = 24 * 60 * 60 * 1000;
  const totalDays = Math.max(1, Math.ceil((entryEnd.getTime() - entryStart.getTime() + 1) / dayMs));
  const overlapDays = Math.max(0, Math.ceil((overlapEnd.getTime() - overlapStart.getTime() + 1) / dayMs));
  if (overlapDays <= 0) return 0;
  return amount * (overlapDays / totalDays);
};

export function TrafficAnalytics() {
  const { user } = useAuthStore();
  const { leads, campaigns, campaignSpendEntries, adGroups, ads, weeklySnapshots, ensureWeeklySnapshot } = useStore();

  useEffect(() => {
    ensureWeeklySnapshot();
  }, [ensureWeeklySnapshot]);

  const currentMonthRange = useMemo(() => {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    const end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
    return { start, end };
  }, []);

  const stats = useMemo(() => {
    const total = leads.length;
    const closed = leads.filter((l) => l.status === 'fechado').length;
    const lost = leads.filter((l) => l.status === 'perdido').length;
    const active = total - closed - lost;
    const conversion = total > 0 ? (closed / total) * 100 : 0;

    const spendByCampaign = new Map<string, number>();
    for (const entry of campaignSpendEntries || []) {
      const allocated = getOverlapAmount(entry, currentMonthRange.start, currentMonthRange.end);
      if (allocated <= 0) continue;
      spendByCampaign.set(entry.campaignId, (spendByCampaign.get(entry.campaignId) || 0) + allocated);
    }

    const campaignRows = campaigns
      .map((campaign) => {
        const campaignLeads = leads.filter((lead) => lead.campaignId === campaign.id);
        const entries = campaignLeads.length;
        const wonLeads = campaignLeads.filter((lead) => lead.status === 'fechado');
        const won = wonLeads.length;
        const notes = campaignLeads.reduce((acc, lead) => acc + (lead.notes?.length || 0), 0);
        const followUpsDone = campaignLeads.reduce(
          (acc, lead) => acc + (lead.followUps || []).filter((f) => f.status === 'concluido').length,
          0
        );
        const revenue = wonLeads.reduce((acc, lead) => acc + (Number(lead.estimatedValue) || 0), 0);
        const spend = spendByCampaign.get(campaign.id) || 0;
        const roi = spend > 0 ? ((revenue - spend) / spend) * 100 : 0;

        return {
          id: campaign.id,
          name: campaign.name,
          entries,
          won,
          notes,
          followUpsDone,
          revenue,
          spend,
          roi,
          conversion: entries > 0 ? (won / entries) * 100 : 0,
        };
      })
      .sort((a, b) => b.entries - a.entries);

    const totalSpend = campaignRows.reduce((sum, row) => sum + row.spend, 0);
    const totalRevenue = campaignRows.reduce((sum, row) => sum + row.revenue, 0);
    const roi = totalSpend > 0 ? ((totalRevenue - totalSpend) / totalSpend) * 100 : 0;

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

    return { total, closed, lost, active, conversion, totalSpend, totalRevenue, roi, campaignRows, topCreative };
  }, [adGroups, ads, campaignSpendEntries, campaigns, currentMonthRange.end, currentMonthRange.start, leads]);

  const latestWeekly = useMemo(() => weeklySnapshots?.[0] || null, [weeklySnapshots]);

  return (
    <div className="p-10 max-w-7xl mx-auto space-y-8">
      <header>
        <h1 className="text-4xl font-serif font-bold gold-text-gradient tracking-tight">Painel de Tráfego</h1>
        <p className="text-muted-foreground mt-2 text-xs uppercase tracking-widest">
          Visão de performance para gestor de tráfego e direção comercial
        </p>
        {user?.sector && (
          <p className="text-[10px] text-gold-500/60 uppercase tracking-widest mt-2">Perfil atual: {user.sector}</p>
        )}
      </header>

      <section className="bg-card rounded-2xl border border-border shadow-2xl overflow-hidden">
        <div className="p-6 border-b border-border bg-accent flex items-center gap-3">
          <CalendarRange className="w-5 h-5 text-primary" />
          <h2 className="text-lg font-serif font-bold">Resumo mensal automático</h2>
        </div>
        <div className="p-6 text-sm text-muted-foreground">
          {latestWeekly ? (
            <p>Base semanal mais recente: {latestWeekly.weekKey}. O painel consolida investimento, receita e ROI do mês corrente.</p>
          ) : (
            <p>Nenhum snapshot semanal disponível ainda.</p>
          )}
        </div>
      </section>

      <section className="grid grid-cols-1 md:grid-cols-3 xl:grid-cols-6 gap-4">
        <StatCard icon={Users} label="Entradas" value={stats.total} />
        <StatCard icon={CheckCircle2} label="Fechados" value={stats.closed} />
        <StatCard icon={AlertTriangle} label="Perdidos" value={stats.lost} />
        <StatCard icon={TrendingUp} label="Conversão" value={formatPercent(stats.conversion)} />
        <StatCard icon={WalletCards} label="Investimento" value={formatCurrency(stats.totalSpend)} />
        <StatCard icon={BadgeDollarSign} label="ROI" value={formatPercent(stats.roi)} />
      </section>

      <section className="bg-card rounded-2xl border border-border shadow-2xl overflow-hidden">
        <div className="p-6 border-b border-border bg-accent flex items-center gap-3">
          <BarChart3 className="w-5 h-5 text-primary" />
          <h2 className="text-lg font-serif font-bold">Campanhas e conversão</h2>
        </div>
        <div className="overflow-x-auto scrollbar-none">
          <table className="w-full text-sm border-t-4 border-t-gold-500/70">
            <thead className="bg-gold-500/10 text-[10px] uppercase tracking-widest text-gold-500/80 border-b border-border">
              <tr>
                <th className="px-4 py-3 text-left">Campanha</th>
                <th className="px-4 py-3 text-left">Leads</th>
                <th className="px-4 py-3 text-left">Fechados</th>
                <th className="px-4 py-3 text-left">Conversão</th>
                <th className="px-4 py-3 text-left">Investimento</th>
                <th className="px-4 py-3 text-left">Receita</th>
                <th className="px-4 py-3 text-left">ROI</th>
                <th className="px-4 py-3 text-left">Notas</th>
                <th className="px-4 py-3 text-left">Follow-ups concluídos</th>
              </tr>
            </thead>
            <tbody>
              {stats.campaignRows.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-4 py-8 text-center text-muted-foreground">Nenhuma campanha cadastrada.</td>
                </tr>
              ) : (
                stats.campaignRows.map((row) => (
                  <tr key={row.id} className="border-b border-border/50 hover:bg-accent/40">
                    <td className="px-4 py-3 font-semibold">{row.name}</td>
                    <td className="px-4 py-3">{row.entries}</td>
                    <td className="px-4 py-3">{row.won}</td>
                    <td className="px-4 py-3">{formatPercent(row.conversion)}</td>
                    <td className="px-4 py-3">{formatCurrency(row.spend)}</td>
                    <td className="px-4 py-3">{formatCurrency(row.revenue)}</td>
                    <td className="px-4 py-3">{formatPercent(row.roi)}</td>
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
          <h2 className="text-lg font-serif font-bold">Top criativos por volume de leads</h2>
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
