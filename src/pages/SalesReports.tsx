import { useCallback, useEffect, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  ArrowRight,
  BadgeDollarSign,
  BarChart3,
  BriefcaseBusiness,
  CheckCircle2,
  Clock3,
  Download,
  FileSpreadsheet,
  GitBranchPlus,
  Layers3,
  Target,
  TrendingUp,
  Users,
  WalletCards,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useStore } from '@/store/useStore';
import { useAuthStore } from '@/store/useAuthStore';
import { getLeadIdleHours } from '@/lib/leadMetrics';
import type { ReactNode } from 'react';
import type { AppUser } from '@/types/auth';
import type { CampaignSpendEntry, FunnelConfig, FollowUp, Task } from '@/types/crm';
import { PremiumSelect } from '@/components/PremiumSelect';
import { cn } from '@/lib/utils';

type PeriodFilter = '7' | '30' | '90' | 'all';
type OperationFilter = 'all' | 'commercial' | 'prospecting';
type DetailType = 'funnel' | 'owner' | 'campaign';

type ReportRecord = {
  id: string;
  kind: 'commercial' | 'prospecting';
  createdAt: string;
  funnelId?: string;
  ownerUserId?: string;
  status: string;
  closed: boolean;
  lost: boolean;
  sourceName: string;
  sourceId?: string;
  idleHours: number;
  followUps: FollowUp[];
  tasks: Task[];
  estimatedValue: number;
};

type MetricsSummary = {
  total: number;
  won: number;
  lost: number;
  active: number;
  stalled: number;
  overdue: number;
  totalSpend: number;
  wonRevenue: number;
  pipelineValue: number;
  conversion: number;
  cpl: number;
  cac: number;
  roi: number;
};

type StageSummary = {
  id: string;
  name: string;
  color: string;
  total: number;
  share: number;
};

type FunnelSummary = MetricsSummary & {
  id: string;
  name: string;
  operation: 'commercial' | 'prospecting';
  ownersCount: number;
  sourcesCount: number;
  stageRows: StageSummary[];
};

type OwnerSummary = MetricsSummary & {
  id: string;
  name: string;
  campaignsCount: number;
  funnelsCount: number;
};

type CampaignSummary = MetricsSummary & {
  id: string;
  name: string;
  ownersCount: number;
  funnelsCount: number;
};

const ALL_OPERATIONS = 'all';
const UNASSIGNED_OWNER_ID = '__unassigned__';
const NO_CAMPAIGN_ID = '__no_campaign__';

const sortFunnels = (items: FunnelConfig[]) =>
  [...items].sort((a, b) => {
    if (a.operation !== b.operation) return a.operation === 'commercial' ? -1 : 1;
    return a.name.localeCompare(b.name, 'pt-BR');
  });

const isValidPeriod = (value: string | null): value is PeriodFilter =>
  value === '7' || value === '30' || value === '90' || value === 'all';

const isValidOperation = (value: string | null): value is OperationFilter =>
  value === 'all' || value === 'commercial' || value === 'prospecting';

const isValidDetailType = (value: string | null): value is DetailType =>
  value === 'funnel' || value === 'owner' || value === 'campaign';

const getProspectIdleHours = (
  lead: {
    createdAt: string;
    lastInteractionAt?: string;
    followUps?: Array<{ date: string }>;
    tasks?: Array<{ date: string }>;
    notes?: Array<{ createdAt: string }>;
  },
  nowMs = Date.now(),
) => {
  const candidates = [Date.parse(lead.createdAt || ''), Date.parse(lead.lastInteractionAt || '')].filter((value) => !Number.isNaN(value));
  for (const followUp of lead.followUps || []) {
    const time = Date.parse(followUp.date || '');
    if (!Number.isNaN(time)) candidates.push(time);
  }
  for (const task of lead.tasks || []) {
    const time = Date.parse(task.date || '');
    if (!Number.isNaN(time)) candidates.push(time);
  }
  for (const note of lead.notes || []) {
    const time = Date.parse(note.createdAt || '');
    if (!Number.isNaN(time)) candidates.push(time);
  }
  const base = candidates.length > 0 ? Math.max(...candidates) : nowMs;
  return Math.max(0, (nowMs - base) / 36e5);
};

const escapeHtml = (value: string | number) =>
  String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const formatCurrency = (value: number) =>
  `R$ ${value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const formatPercent = (value: number) => `${value.toFixed(1)}%`;

const getPeriodRange = (period: PeriodFilter) => {
  if (period === 'all') return { start: null as Date | null, end: new Date() };
  const end = new Date();
  const start = new Date(end);
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - Number(period) + 1);
  return { start, end };
};

const getOverlapAmount = (entry: CampaignSpendEntry, start: Date | null, end: Date) => {
  const amount = Number(entry.amount) || 0;
  if (!start) return amount;

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

const matchesOwner = (record: ReportRecord, ownerId: string) =>
  ownerId === UNASSIGNED_OWNER_ID ? !record.ownerUserId : record.ownerUserId === ownerId;

const summarizeMetrics = (records: ReportRecord[], totalSpend: number, now: number): MetricsSummary => {
  const total = records.length;
  const won = records.filter((item) => item.closed).length;
  const lost = records.filter((item) => item.lost).length;
  const active = total - won - lost;
  const stalled = records.filter((item) => !item.closed && !item.lost && item.idleHours >= 24).length;
  const overdue = records.reduce(
    (acc, item) => acc + item.followUps.filter((followUp) => followUp.status === 'pendente' && new Date(followUp.date).getTime() < now).length,
    0,
  );
  const wonRevenue = records.reduce((sum, record) => sum + (record.closed ? record.estimatedValue : 0), 0);
  const pipelineValue = records.reduce((sum, record) => sum + record.estimatedValue, 0);
  const conversion = total > 0 ? (won / total) * 100 : 0;
  const cpl = total > 0 ? totalSpend / total : 0;
  const cac = won > 0 ? totalSpend / won : 0;
  const roi = totalSpend > 0 ? ((wonRevenue - totalSpend) / totalSpend) * 100 : 0;

  return {
    total,
    won,
    lost,
    active,
    stalled,
    overdue,
    totalSpend,
    wonRevenue,
    pipelineValue,
    conversion,
    cpl,
    cac,
    roi,
  };
};

const buildStageRows = (records: ReportRecord[], funnel: FunnelConfig): StageSummary[] => {
  const total = records.length;
  return [...(funnel.stages || [])]
    .sort((a, b) => a.order - b.order)
    .map((stage) => {
      const count = records.filter((record) => record.status === stage.id).length;
      return {
        id: stage.id,
        name: stage.name,
        color: stage.color,
        total: count,
        share: total > 0 ? (count / total) * 100 : 0,
      };
    });
};

const getOwnerLabel = (ownerId: string, users: AppUser[], currentUser: AppUser | null) => {
  if (ownerId === UNASSIGNED_OWNER_ID) return 'Sem responsavel';
  const found = users.find((item) => item.id === ownerId) || (currentUser?.id === ownerId ? currentUser : null);
  return found?.name || 'Usuario';
};

export function SalesReports() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { user, users, fetchUsers } = useAuthStore();
  const { funnels, leads, prospectLeads, campaigns, campaignSpendEntries, services } = useStore();

  useEffect(() => {
    fetchUsers().catch(() => null);
  }, [fetchUsers]);

  const allFunnels = useMemo(() => sortFunnels(funnels || []), [funnels]);

  const period = isValidPeriod(searchParams.get('period')) ? searchParams.get('period') : '30';
  const operationFilter = isValidOperation(searchParams.get('operation')) ? searchParams.get('operation') : ALL_OPERATIONS;
  const detailType = isValidDetailType(searchParams.get('detail')) ? searchParams.get('detail') : null;
  const detailId = searchParams.get('entityId');
  const detailOwnerId = searchParams.get('ownerId');
  const now = Date.now();
  const { start: rangeStart, end: rangeEnd } = getPeriodRange(period);

  const updateParams = (updates: Record<string, string | null>) => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      for (const [key, value] of Object.entries(updates)) {
        if (!value) {
          next.delete(key);
          continue;
        }
        next.set(key, value);
      }
      return next;
    }, { replace: true });
  };

  const periodOptions = [
    { value: '7', label: 'Ultimos 7 dias', description: 'Janela curta de leitura', group: 'Periodo' },
    { value: '30', label: 'Ultimos 30 dias', description: 'Visao mensal padrao', group: 'Periodo' },
    { value: '90', label: 'Ultimos 90 dias', description: 'Comparativo trimestral', group: 'Periodo' },
    { value: 'all', label: 'Todo o periodo', description: 'Historico completo', group: 'Periodo' },
  ];

  const operationOptions = [
    { value: 'all', label: 'Toda a operacao', description: 'Comercial e prospeccao juntos', group: 'Escopo' },
    { value: 'commercial', label: 'Somente comercial', description: 'Campanhas e fechamento', group: 'Escopo' },
    { value: 'prospecting', label: 'Somente prospeccao', description: 'Clinicas e qualificacao', group: 'Escopo' },
  ];

  const records = useMemo<ReportRecord[]>(() => {
    const base = [
      ...(leads || []).map((lead) => ({
        id: lead.id,
        kind: 'commercial' as const,
        createdAt: lead.createdAt,
        funnelId: lead.funnelId,
        ownerUserId: lead.ownerUserId,
        status: lead.status,
        closed: lead.status === 'fechado',
        lost: lead.status === 'perdido',
        sourceName: campaigns.find((campaign) => campaign.id === lead.campaignId)?.name || 'Sem campanha',
        sourceId: lead.campaignId,
        idleHours: getLeadIdleHours(lead, now),
        followUps: lead.followUps || [],
        tasks: lead.tasks || [],
        estimatedValue: Number(lead.estimatedValue) || 0,
      })),
      ...(prospectLeads || []).map((lead) => ({
        id: lead.id,
        kind: 'prospecting' as const,
        createdAt: lead.createdAt,
        funnelId: lead.funnelId,
        ownerUserId: lead.ownerUserId,
        status: lead.status,
        closed: lead.status === 'p_fechada',
        lost: lead.status === 'p_perdida',
        sourceName: services.find((service) => service.id === lead.serviceId)?.name || 'Sem servico',
        sourceId: lead.serviceId,
        idleHours: getProspectIdleHours(lead, now),
        followUps: lead.followUps || [],
        tasks: lead.tasks || [],
        estimatedValue: 0,
      })),
    ]
      .filter((item) => !item.ownerUserId || item.ownerUserId === user?.id || user?.role === 'admin')
      .filter((item) => !rangeStart || new Date(item.createdAt) >= rangeStart)
      .filter((item) => operationFilter === ALL_OPERATIONS || item.kind === operationFilter);

    return base;
  }, [campaigns, leads, now, operationFilter, prospectLeads, rangeStart, services, user?.id, user?.role]);

  const campaignSpendTotals = useMemo(() => {
    const totals = new Map<string, number>();
    for (const entry of campaignSpendEntries || []) {
      const allocated = getOverlapAmount(entry, rangeStart, rangeEnd);
      if (allocated <= 0) continue;
      totals.set(entry.campaignId, (totals.get(entry.campaignId) || 0) + allocated);
    }
    return totals;
  }, [campaignSpendEntries, rangeEnd, rangeStart]);

  const baseCampaignLeadCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const record of records) {
      if (record.kind !== 'commercial' || !record.sourceId) continue;
      counts.set(record.sourceId, (counts.get(record.sourceId) || 0) + 1);
    }
    return counts;
  }, [records]);

  const getAllocatedSpend = useCallback((subset: ReportRecord[]) => {
    const subsetCounts = new Map<string, number>();
    for (const record of subset) {
      if (record.kind !== 'commercial' || !record.sourceId) continue;
      subsetCounts.set(record.sourceId, (subsetCounts.get(record.sourceId) || 0) + 1);
    }

    let total = 0;
    for (const [campaignId, subsetCount] of subsetCounts.entries()) {
      const totalCampaignLeads = baseCampaignLeadCounts.get(campaignId) || 0;
      if (totalCampaignLeads <= 0) continue;
      total += (campaignSpendTotals.get(campaignId) || 0) * (subsetCount / totalCampaignLeads);
    }
    return total;
  }, [baseCampaignLeadCounts, campaignSpendTotals]);

  const overallMetrics = useMemo(() => summarizeMetrics(records, getAllocatedSpend(records), now), [getAllocatedSpend, now, records]);

  const funnelSummaries = useMemo<FunnelSummary[]>(() => {
    return allFunnels
      .filter((funnel) => operationFilter === ALL_OPERATIONS || funnel.operation === operationFilter)
      .map((funnel) => {
        const funnelRecords = records.filter((record) => record.funnelId === funnel.id);
        const metrics = summarizeMetrics(funnelRecords, getAllocatedSpend(funnelRecords), now);
        return {
          ...metrics,
          id: funnel.id,
          name: funnel.name,
          operation: funnel.operation,
          ownersCount: new Set(funnelRecords.map((record) => record.ownerUserId || UNASSIGNED_OWNER_ID)).size,
          sourcesCount: new Set(
            funnelRecords
              .filter((record) => record.kind === 'commercial')
              .map((record) => record.sourceId || NO_CAMPAIGN_ID),
          ).size,
          stageRows: buildStageRows(funnelRecords, funnel),
        };
      })
      .filter((item) => item.total > 0)
      .sort((a, b) => b.total - a.total);
  }, [allFunnels, getAllocatedSpend, now, operationFilter, records]);

  const ownerSummaries = useMemo<OwnerSummary[]>(() => {
    const ownerMap = new Map<string, ReportRecord[]>();
    for (const record of records) {
      const key = record.ownerUserId || UNASSIGNED_OWNER_ID;
      if (!ownerMap.has(key)) ownerMap.set(key, []);
      ownerMap.get(key)!.push(record);
    }

    return Array.from(ownerMap.entries())
      .map(([ownerId, ownerRecords]) => {
        const metrics = summarizeMetrics(ownerRecords, getAllocatedSpend(ownerRecords), now);
        return {
          ...metrics,
          id: ownerId,
          name: getOwnerLabel(ownerId, users, user),
          campaignsCount: new Set(
            ownerRecords.filter((record) => record.kind === 'commercial').map((record) => record.sourceId || NO_CAMPAIGN_ID),
          ).size,
          funnelsCount: new Set(ownerRecords.map((record) => record.funnelId || 'sem_funil')).size,
        };
      })
      .sort((a, b) => b.total - a.total);
  }, [getAllocatedSpend, now, records, user, users]);

  const campaignSummaries = useMemo<CampaignSummary[]>(() => {
    const campaignMap = new Map<string, ReportRecord[]>();
    for (const record of records) {
      if (record.kind !== 'commercial') continue;
      const key = record.sourceId || NO_CAMPAIGN_ID;
      if (!campaignMap.has(key)) campaignMap.set(key, []);
      campaignMap.get(key)!.push(record);
    }

    return Array.from(campaignMap.entries())
      .map(([campaignId, campaignRecords]) => {
        const metrics = summarizeMetrics(campaignRecords, getAllocatedSpend(campaignRecords), now);
        return {
          ...metrics,
          id: campaignId,
          name: campaignId === NO_CAMPAIGN_ID
            ? 'Sem campanha'
            : campaigns.find((campaign) => campaign.id === campaignId)?.name || 'Campanha',
          ownersCount: new Set(campaignRecords.map((record) => record.ownerUserId || UNASSIGNED_OWNER_ID)).size,
          funnelsCount: new Set(campaignRecords.map((record) => record.funnelId || 'sem_funil')).size,
        };
      })
      .sort((a, b) => b.total - a.total);
  }, [campaigns, getAllocatedSpend, now, records]);

  const selectedFunnel = detailType === 'funnel' ? funnelSummaries.find((item) => item.id === detailId) : undefined;
  const selectedOwner = detailType === 'owner' ? ownerSummaries.find((item) => item.id === detailId) : undefined;
  const selectedCampaign = detailType === 'campaign' ? campaignSummaries.find((item) => item.id === detailId) : undefined;

  const activeDetail: DetailType | 'overview' = selectedFunnel
    ? 'funnel'
    : selectedOwner
      ? 'owner'
      : selectedCampaign
        ? 'campaign'
        : 'overview';

  const detailRecords = useMemo(() => {
    if (activeDetail === 'funnel' && selectedFunnel) {
      return records.filter((record) => record.funnelId === selectedFunnel.id);
    }
    if (activeDetail === 'owner' && selectedOwner) {
      return records.filter((record) => matchesOwner(record, selectedOwner.id));
    }
    if (activeDetail === 'campaign' && selectedCampaign) {
      return records.filter((record) => {
        const matchesCampaign = selectedCampaign.id === NO_CAMPAIGN_ID ? !record.sourceId : record.sourceId === selectedCampaign.id;
        if (!matchesCampaign || record.kind !== 'commercial') return false;
        if (!detailOwnerId) return true;
        return matchesOwner(record, detailOwnerId);
      });
    }
    return records;
  }, [activeDetail, detailOwnerId, records, selectedCampaign, selectedFunnel, selectedOwner]);

  const detailMetrics = useMemo(
    () => summarizeMetrics(detailRecords, getAllocatedSpend(detailRecords), now),
    [detailRecords, getAllocatedSpend, now],
  );

  const detailOwnerLabel = detailOwnerId ? getOwnerLabel(detailOwnerId, users, user) : null;

  const detailCampaignRows = useMemo<CampaignSummary[]>(() => {
    if (detailRecords.length === 0) return [];
    const campaignMap = new Map<string, ReportRecord[]>();
    for (const record of detailRecords) {
      if (record.kind !== 'commercial') continue;
      const key = record.sourceId || NO_CAMPAIGN_ID;
      if (!campaignMap.has(key)) campaignMap.set(key, []);
      campaignMap.get(key)!.push(record);
    }

    return Array.from(campaignMap.entries())
      .map(([campaignId, subset]) => {
        const metrics = summarizeMetrics(subset, getAllocatedSpend(subset), now);
        return {
          ...metrics,
          id: campaignId,
          name: campaignId === NO_CAMPAIGN_ID
            ? 'Sem campanha'
            : campaigns.find((campaign) => campaign.id === campaignId)?.name || 'Campanha',
          ownersCount: new Set(subset.map((record) => record.ownerUserId || UNASSIGNED_OWNER_ID)).size,
          funnelsCount: new Set(subset.map((record) => record.funnelId || 'sem_funil')).size,
        };
      })
      .sort((a, b) => b.total - a.total);
  }, [campaigns, detailRecords, getAllocatedSpend, now]);

  const detailOwnerRows = useMemo<OwnerSummary[]>(() => {
    if (detailRecords.length === 0) return [];
    const ownerMap = new Map<string, ReportRecord[]>();
    for (const record of detailRecords) {
      const key = record.ownerUserId || UNASSIGNED_OWNER_ID;
      if (!ownerMap.has(key)) ownerMap.set(key, []);
      ownerMap.get(key)!.push(record);
    }

    return Array.from(ownerMap.entries())
      .map(([ownerId, subset]) => {
        const metrics = summarizeMetrics(subset, getAllocatedSpend(subset), now);
        return {
          ...metrics,
          id: ownerId,
          name: getOwnerLabel(ownerId, users, user),
          campaignsCount: new Set(
            subset.filter((record) => record.kind === 'commercial').map((record) => record.sourceId || NO_CAMPAIGN_ID),
          ).size,
          funnelsCount: new Set(subset.map((record) => record.funnelId || 'sem_funil')).size,
        };
      })
      .sort((a, b) => b.total - a.total);
  }, [detailRecords, getAllocatedSpend, now, user, users]);

  const detailFunnelRows = useMemo<FunnelSummary[]>(() => {
    if (detailRecords.length === 0) return [];
    return allFunnels
      .map((funnel) => {
        const subset = detailRecords.filter((record) => record.funnelId === funnel.id);
        const metrics = summarizeMetrics(subset, getAllocatedSpend(subset), now);
        return {
          ...metrics,
          id: funnel.id,
          name: funnel.name,
          operation: funnel.operation,
          ownersCount: new Set(subset.map((record) => record.ownerUserId || UNASSIGNED_OWNER_ID)).size,
          sourcesCount: new Set(
            subset.filter((record) => record.kind === 'commercial').map((record) => record.sourceId || NO_CAMPAIGN_ID),
          ).size,
          stageRows: buildStageRows(subset, funnel),
        };
      })
      .filter((item) => item.total > 0)
      .sort((a, b) => b.total - a.total);
  }, [allFunnels, detailRecords, getAllocatedSpend, now]);

  const detailTitle = activeDetail === 'funnel'
    ? selectedFunnel?.name || 'Funil'
    : activeDetail === 'owner'
      ? selectedOwner?.name || 'Responsavel'
      : activeDetail === 'campaign'
        ? `${selectedCampaign?.name || 'Campanha'}${detailOwnerLabel ? ` · ${detailOwnerLabel}` : ''}`
        : 'Panorama geral da operacao';

  const detailSubtitle = activeDetail === 'funnel'
    ? 'Leitura completa do funil, com etapas, campanhas e distribuicao por responsavel.'
    : activeDetail === 'owner'
      ? 'Visao consolidada do responsavel, com funis e campanhas clicaveis para aprofundamento.'
      : activeDetail === 'campaign'
        ? 'Relatorio detalhado da campanha, com recorte por funil e responsavel quando aplicavel.'
        : 'Visao panoramica com tudo sobre funis, campanhas e vendedores, pronta para drill-down.';

  const exportReport = () => {
    const rows = activeDetail === 'overview'
      ? funnelSummaries.map((item) => [item.name, item.total, item.won, formatPercent(item.conversion), formatCurrency(item.totalSpend), formatCurrency(item.wonRevenue), formatPercent(item.roi)])
      : activeDetail === 'owner'
        ? detailCampaignRows.map((item) => [item.name, item.total, item.won, formatPercent(item.conversion), formatCurrency(item.totalSpend), formatCurrency(item.wonRevenue), formatPercent(item.roi)])
        : activeDetail === 'campaign'
          ? detailOwnerRows.map((item) => [item.name, item.total, item.won, formatPercent(item.conversion), formatCurrency(item.totalSpend), formatCurrency(item.wonRevenue), formatPercent(item.roi)])
          : detailFunnelRows.map((item) => [item.name, item.total, item.won, formatPercent(item.conversion), formatCurrency(item.totalSpend), formatCurrency(item.wonRevenue), formatPercent(item.roi)]);

    const firstColumnLabel = activeDetail === 'overview'
      ? 'Funil'
      : activeDetail === 'owner'
        ? 'Campanha'
        : activeDetail === 'campaign'
          ? 'Responsavel'
          : 'Funil relacionado';

    const html = `
      <html><head><meta charset="utf-8" />
      <style>
        body{font-family:Segoe UI,Arial,sans-serif;padding:24px;color:#111827;background:#fffaf0}
        table{border-collapse:collapse;width:100%;margin-top:16px;background:#fff;border-top:4px solid #d4af37}
        th,td{border:1px solid #e5e7eb;padding:10px 12px;text-align:left;font-size:12px}
        th{background:#f8f0d0;color:#5b4310;text-transform:uppercase;font-size:10px;letter-spacing:.12em}
        .summary{width:100%;border-collapse:separate;border-spacing:12px 0;margin:18px 0}
        .card{border:1px solid #ead9ac;border-radius:14px;padding:12px;background:#fffdf7;min-width:120px}
        .label{font-size:10px;text-transform:uppercase;letter-spacing:.16em;color:#8a6a15}
        .value{font-size:20px;font-weight:700;margin-top:6px;color:#111827}
        .brand{border:1px solid #e5d3a1;border-radius:16px;background:linear-gradient(180deg,#111111 0%,#171717 100%);padding:20px 24px;color:#f5d06f}
        .brand-top{height:4px;background:#d4af37;border-radius:999px;margin-bottom:16px}
        .brand-kicker{font-size:10px;letter-spacing:.32em;text-transform:uppercase;color:#f3d98a}
        .brand-title{font-size:28px;font-family:Georgia,serif;font-weight:700;margin-top:10px;color:#f5d06f}
        .brand-sub{font-size:12px;letter-spacing:.18em;text-transform:uppercase;color:#d7bf7a;margin-top:8px}
        .meta{margin-top:16px;color:#6b7280;font-size:12px}
      </style>
      </head><body>
      <div class="brand"><div class="brand-top"></div><div class="brand-kicker">Relatorio Premium</div><div class="brand-title">CRM M DE PAULA</div><div class="brand-sub">${escapeHtml(detailTitle)}</div></div>
      <p class="meta">Periodo: ${escapeHtml(period)} | Gerado em: ${escapeHtml(new Date().toLocaleString('pt-BR'))}</p>
      <table class="summary"><tr>
        <td class="card"><div class="label">Entradas</div><div class="value">${escapeHtml(detailMetrics.total)}</div></td>
        <td class="card"><div class="label">Fechados</div><div class="value">${escapeHtml(detailMetrics.won)}</div></td>
        <td class="card"><div class="label">Conversao</div><div class="value">${escapeHtml(formatPercent(detailMetrics.conversion))}</div></td>
        <td class="card"><div class="label">Investimento</div><div class="value">${escapeHtml(formatCurrency(detailMetrics.totalSpend))}</div></td>
        <td class="card"><div class="label">Receita</div><div class="value">${escapeHtml(formatCurrency(detailMetrics.wonRevenue))}</div></td>
        <td class="card"><div class="label">ROI</div><div class="value">${escapeHtml(formatPercent(detailMetrics.roi))}</div></td>
      </tr></table>
      <table><thead><tr><th>${firstColumnLabel}</th><th>Entradas</th><th>Fechados</th><th>Conversao</th><th>Investimento</th><th>Receita</th><th>ROI</th></tr></thead><tbody>
      ${rows.map((row) => `<tr>${row.map((cell) => `<td>${escapeHtml(cell)}</td>`).join('')}</tr>`).join('')}
      </tbody></table>
      </body></html>`;

    const blob = new Blob([html], { type: 'application/vnd.ms-excel;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `crm-m-de-paula-relatorio-${new Date().toISOString().slice(0, 10)}.xls`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-6">
      <header className="flex flex-col xl:flex-row xl:items-center xl:justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-serif font-bold gold-text-gradient tracking-tight">Relatorios</h1>
          <p className="text-muted-foreground mt-2 text-[11px] uppercase tracking-widest">
            Panorama navegavel da operacao com drill-down por funil, vendedor e campanha
          </p>
        </div>
        <div className="flex flex-col sm:flex-row gap-3">
          <PremiumSelect
            options={operationOptions}
            value={operationFilter}
            onChange={(nextValue) => updateParams({ operation: nextValue === ALL_OPERATIONS ? null : nextValue, detail: null, entityId: null, ownerId: null })}
            placeholder="Selecionar escopo"
          />
          <PremiumSelect
            options={periodOptions}
            value={period}
            onChange={(nextValue) => updateParams({ period: nextValue })}
            placeholder="Selecionar periodo"
          />
          <button
            onClick={exportReport}
            className="px-4 py-3 rounded-xl bg-primary text-primary-foreground text-xs uppercase tracking-widest font-black inline-flex items-center gap-2"
          >
            <Download className="w-4 h-4" />
            Exportar
          </button>
        </div>
      </header>

      <section className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <MetricCard icon={FileSpreadsheet} label="Entradas" value={overallMetrics.total} />
        <MetricCard icon={CheckCircle2} label="Fechados" value={overallMetrics.won} />
        <MetricCard icon={TrendingUp} label="Conversao" value={formatPercent(overallMetrics.conversion)} />
        <MetricCard icon={WalletCards} label="Investimento" value={formatCurrency(overallMetrics.totalSpend)} />
        <MetricCard icon={BadgeDollarSign} label="Receita fechada" value={formatCurrency(overallMetrics.wonRevenue)} />
        <MetricCard icon={Target} label="ROI" value={formatPercent(overallMetrics.roi)} />
        <MetricCard icon={Layers3} label="Pipeline" value={formatCurrency(overallMetrics.pipelineValue)} />
        <MetricCard icon={Clock3} label="Follow-up atrasado" value={overallMetrics.overdue} />
      </section>

      <section className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <OverviewPanel
          title="Funis estrategicos"
          description="Clique em um funil para abrir o detalhamento por etapas."
          icon={GitBranchPlus}
          emptyMessage="Nenhum funil com dados neste periodo."
        >
          {funnelSummaries.map((funnel) => (
            <button
              key={funnel.id}
              type="button"
              onClick={() => updateParams({ detail: 'funnel', entityId: funnel.id, ownerId: null })}
              className="w-full rounded-2xl border border-border bg-background/40 p-4 text-left transition-all hover:border-gold-500/40 hover:bg-accent/30"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-[10px] uppercase tracking-[0.2em] text-gold-500/60">
                    {funnel.operation === 'commercial' ? 'Comercial' : 'Prospeccao'}
                  </p>
                  <h3 className="text-sm font-bold text-foreground mt-1">{funnel.name}</h3>
                </div>
                <ArrowRight className="w-4 h-4 text-primary shrink-0" />
              </div>
              <div className="grid grid-cols-3 gap-3 mt-4 text-sm">
                <StatPill label="Entradas" value={funnel.total} />
                <StatPill label="Fechados" value={funnel.won} />
                <StatPill label="Conversao" value={formatPercent(funnel.conversion)} />
              </div>
              <div className="mt-4 space-y-2">
                {funnel.stageRows.slice(0, 3).map((stage) => (
                  <ProgressRow key={stage.id} label={stage.name} value={stage.total} percentage={stage.share} color={stage.color} />
                ))}
              </div>
            </button>
          ))}
        </OverviewPanel>

        <OverviewPanel
          title="Equipe"
          description="Clique em um vendedor para abrir o relatorio individual."
          icon={Users}
          emptyMessage="Nenhum responsavel com dados neste periodo."
        >
          {ownerSummaries.map((owner) => (
            <button
              key={owner.id}
              type="button"
              onClick={() => updateParams({ detail: 'owner', entityId: owner.id, ownerId: null })}
              className="w-full rounded-2xl border border-border bg-background/40 p-4 text-left transition-all hover:border-gold-500/40 hover:bg-accent/30"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-bold text-foreground">{owner.name}</p>
                  <p className="text-[10px] uppercase tracking-[0.18em] text-gold-500/60 mt-1">
                    {owner.campaignsCount} campanhas · {owner.funnelsCount} funis
                  </p>
                </div>
                <ArrowRight className="w-4 h-4 text-primary shrink-0" />
              </div>
              <div className="grid grid-cols-3 gap-3 mt-4 text-sm">
                <StatPill label="Entradas" value={owner.total} />
                <StatPill label="Fechados" value={owner.won} />
                <StatPill label="ROI" value={formatPercent(owner.roi)} />
              </div>
            </button>
          ))}
        </OverviewPanel>

        <OverviewPanel
          title="Campanhas"
          description="Clique em uma campanha para ver o relatorio detalhado."
          icon={BriefcaseBusiness}
          emptyMessage="Nenhuma campanha com dados neste periodo."
        >
          {campaignSummaries.map((campaign) => (
            <button
              key={campaign.id}
              type="button"
              onClick={() => updateParams({ detail: 'campaign', entityId: campaign.id, ownerId: null })}
              className="w-full rounded-2xl border border-border bg-background/40 p-4 text-left transition-all hover:border-gold-500/40 hover:bg-accent/30"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-bold text-foreground">{campaign.name}</p>
                  <p className="text-[10px] uppercase tracking-[0.18em] text-gold-500/60 mt-1">
                    {campaign.ownersCount} responsaveis · {campaign.funnelsCount} funis
                  </p>
                </div>
                <ArrowRight className="w-4 h-4 text-primary shrink-0" />
              </div>
              <div className="grid grid-cols-3 gap-3 mt-4 text-sm">
                <StatPill label="Entradas" value={campaign.total} />
                <StatPill label="Fechados" value={campaign.won} />
                <StatPill label="ROI" value={formatPercent(campaign.roi)} />
              </div>
            </button>
          ))}
        </OverviewPanel>
      </section>

      <section className="bg-card rounded-3xl border border-border shadow-2xl overflow-hidden">
        <div className="px-5 py-4 border-b border-border bg-accent/70 space-y-3">
          <div className="flex flex-wrap items-center gap-2 text-[10px] uppercase tracking-[0.18em] text-gold-500/70">
            <button type="button" onClick={() => updateParams({ detail: null, entityId: null, ownerId: null })} className="hover:text-primary transition-colors">
              Geral
            </button>
            {activeDetail === 'owner' && selectedOwner ? (
              <>
                <ChevronText />
                <span className="text-primary">{selectedOwner.name}</span>
              </>
            ) : null}
            {activeDetail === 'funnel' && selectedFunnel ? (
              <>
                <ChevronText />
                <span className="text-primary">{selectedFunnel.name}</span>
              </>
            ) : null}
            {activeDetail === 'campaign' && selectedCampaign ? (
              <>
                {detailOwnerLabel ? (
                  <>
                    <ChevronText />
                    <button type="button" onClick={() => updateParams({ detail: 'owner', entityId: detailOwnerId, ownerId: null })} className="hover:text-primary transition-colors">
                      {detailOwnerLabel}
                    </button>
                  </>
                ) : null}
                <ChevronText />
                <span className="text-primary">{selectedCampaign.name}</span>
              </>
            ) : null}
          </div>
          <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-4">
            <div>
              <h2 className="text-xl md:text-2xl font-serif font-bold gold-text-gradient">{detailTitle}</h2>
              <p className="text-sm text-muted-foreground mt-2">{detailSubtitle}</p>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 min-w-full lg:min-w-[520px]">
              <MetricMiniCard label="Entradas" value={detailMetrics.total} />
              <MetricMiniCard label="Fechados" value={detailMetrics.won} />
              <MetricMiniCard label="Conversao" value={formatPercent(detailMetrics.conversion)} />
              <MetricMiniCard label="ROI" value={formatPercent(detailMetrics.roi)} />
            </div>
          </div>
        </div>

        <div className="p-5 md:p-6 space-y-6">
          {activeDetail === 'overview' ? (
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
              <DataTableSection
                title="Top funis"
                description="Os funis abaixo concentram a maior parte das entradas no periodo."
                icon={GitBranchPlus}
                emptyMessage="Nenhum funil para listar."
                columns={['Funil', 'Entradas', 'Fechados', 'Conversao', 'Etapas ativas']}
                rows={funnelSummaries.map((item) => ({
                  key: item.id,
                  onClick: () => updateParams({ detail: 'funnel', entityId: item.id, ownerId: null }),
                  cells: [
                    item.name,
                    String(item.total),
                    String(item.won),
                    formatPercent(item.conversion),
                    `${item.stageRows.filter((stage) => stage.total > 0).length}/${item.stageRows.length}`,
                  ],
                }))}
              />
              <DataTableSection
                title="Top vendedores"
                description="Clicando em um vendedor, voce abre o panorama dele e depois aprofunda nas campanhas."
                icon={Users}
                emptyMessage="Nenhum responsavel para listar."
                columns={['Responsavel', 'Entradas', 'Fechados', 'Conversao', 'Campanhas']}
                rows={ownerSummaries.map((item) => ({
                  key: item.id,
                  onClick: () => updateParams({ detail: 'owner', entityId: item.id, ownerId: null }),
                  cells: [
                    item.name,
                    String(item.total),
                    String(item.won),
                    formatPercent(item.conversion),
                    String(item.campaignsCount),
                  ],
                }))}
              />
            </div>
          ) : null}

          {activeDetail === 'funnel' && selectedFunnel ? (
            <div className="grid grid-cols-1 xl:grid-cols-[1.25fr,0.9fr] gap-6">
              <PanelCard title="Distribuicao por etapa" description="Grafico de etapa a etapa dentro do funil." icon={BarChart3}>
                <div className="space-y-3">
                  {selectedFunnel.stageRows.length === 0 ? (
                    <EmptyState message="Nenhuma etapa configurada para este funil." />
                  ) : (
                    selectedFunnel.stageRows.map((stage) => (
                      <ProgressRow key={stage.id} label={stage.name} value={stage.total} percentage={stage.share} color={stage.color} emphasize />
                    ))
                  )}
                </div>
              </PanelCard>

              <div className="space-y-6">
                <DataTableSection
                  title="Responsaveis do funil"
                  description="Clique em um responsavel para continuar o drill-down."
                  icon={Users}
                  emptyMessage="Nenhum responsavel com registros neste funil."
                  columns={['Responsavel', 'Entradas', 'Fechados', 'Conversao', 'ROI']}
                  rows={detailOwnerRows.map((item) => ({
                    key: item.id,
                    onClick: () => updateParams({ detail: 'owner', entityId: item.id, ownerId: null }),
                    cells: [item.name, String(item.total), String(item.won), formatPercent(item.conversion), formatPercent(item.roi)],
                  }))}
                />
                <DataTableSection
                  title={selectedFunnel.operation === 'commercial' ? 'Campanhas do funil' : 'Servicos do funil'}
                  description="Aprofunde para ver detalhes especificos por campanha."
                  icon={BriefcaseBusiness}
                  emptyMessage="Nenhuma origem vinculada neste funil."
                  columns={[selectedFunnel.operation === 'commercial' ? 'Campanha' : 'Servico', 'Entradas', 'Fechados', 'Conversao', 'ROI']}
                  rows={detailCampaignRows.map((item) => ({
                    key: item.id,
                    onClick: selectedFunnel.operation === 'commercial'
                      ? () => updateParams({ detail: 'campaign', entityId: item.id, ownerId: null })
                      : undefined,
                    cells: [item.name, String(item.total), String(item.won), formatPercent(item.conversion), formatPercent(item.roi)],
                  }))}
                />
              </div>
            </div>
          ) : null}

          {activeDetail === 'owner' && selectedOwner ? (
            <div className="grid grid-cols-1 xl:grid-cols-[1.1fr,0.9fr] gap-6">
              <DataTableSection
                title="Campanhas do vendedor"
                description="Clique em uma campanha para abrir o relatorio especifico deste vendedor naquela campanha."
                icon={BriefcaseBusiness}
                emptyMessage="Nenhuma campanha encontrada para este responsavel."
                columns={['Campanha', 'Entradas', 'Fechados', 'Conversao', 'ROI']}
                rows={detailCampaignRows.map((item) => ({
                  key: item.id,
                  onClick: () => updateParams({ detail: 'campaign', entityId: item.id, ownerId: selectedOwner.id }),
                  cells: [item.name, String(item.total), String(item.won), formatPercent(item.conversion), formatPercent(item.roi)],
                }))}
              />
              <div className="space-y-6">
                <DataTableSection
                  title="Funis do vendedor"
                  description="Mapa dos funis em que este responsavel atua."
                  icon={GitBranchPlus}
                  emptyMessage="Nenhum funil encontrado para este responsavel."
                  columns={['Funil', 'Entradas', 'Fechados', 'Conversao', 'Ativos']}
                  rows={detailFunnelRows.map((item) => ({
                    key: item.id,
                    onClick: () => updateParams({ detail: 'funnel', entityId: item.id, ownerId: null }),
                    cells: [item.name, String(item.total), String(item.won), formatPercent(item.conversion), String(item.active)],
                  }))}
                />
                <PanelCard title="Disciplina operacional" description="Indicadores de rotina e resposta deste responsavel." icon={Clock3}>
                  <div className="grid grid-cols-2 gap-3">
                    <MetricMiniCard label="Sem acao 24h+" value={selectedOwner.stalled} />
                    <MetricMiniCard label="Follow-up atrasado" value={selectedOwner.overdue} />
                    <MetricMiniCard label="Investimento alocado" value={formatCurrency(selectedOwner.totalSpend)} />
                    <MetricMiniCard label="Pipeline" value={formatCurrency(selectedOwner.pipelineValue)} />
                  </div>
                </PanelCard>
              </div>
            </div>
          ) : null}

          {activeDetail === 'campaign' && selectedCampaign ? (
            <div className="grid grid-cols-1 xl:grid-cols-[1fr,1fr] gap-6">
              {!detailOwnerId ? (
                <DataTableSection
                  title="Responsaveis da campanha"
                  description="Clique em um responsavel para ver esta campanha filtrada apenas por ele."
                  icon={Users}
                  emptyMessage="Nenhum responsavel com registros nesta campanha."
                  columns={['Responsavel', 'Entradas', 'Fechados', 'Conversao', 'ROI']}
                  rows={detailOwnerRows.map((item) => ({
                    key: item.id,
                    onClick: () => updateParams({ detail: 'campaign', entityId: selectedCampaign.id, ownerId: item.id }),
                    cells: [item.name, String(item.total), String(item.won), formatPercent(item.conversion), formatPercent(item.roi)],
                  }))}
                />
              ) : (
                <PanelCard title="Contexto da campanha" description="Voce esta vendo a campanha filtrada por um unico responsavel." icon={Users}>
                  <div className="grid grid-cols-2 gap-3">
                    <MetricMiniCard label="Responsavel" value={detailOwnerLabel || '-'} />
                    <MetricMiniCard label="Entradas" value={detailMetrics.total} />
                    <MetricMiniCard label="Investimento alocado" value={formatCurrency(detailMetrics.totalSpend)} />
                    <MetricMiniCard label="Receita fechada" value={formatCurrency(detailMetrics.wonRevenue)} />
                  </div>
                </PanelCard>
              )}

              <div className="space-y-6">
                <DataTableSection
                  title="Funis dentro da campanha"
                  description="Veja em quais funis essa campanha performa melhor."
                  icon={GitBranchPlus}
                  emptyMessage="Nenhum funil encontrado para esta campanha."
                  columns={['Funil', 'Entradas', 'Fechados', 'Conversao', 'ROI']}
                  rows={detailFunnelRows.map((item) => ({
                    key: item.id,
                    onClick: () => updateParams({ detail: 'funnel', entityId: item.id, ownerId: null }),
                    cells: [item.name, String(item.total), String(item.won), formatPercent(item.conversion), formatPercent(item.roi)],
                  }))}
                />

                <PanelCard title="Leitura executiva" description="Resumo rapido da eficiencia desta campanha." icon={Target}>
                  <div className="grid grid-cols-2 gap-3">
                    <MetricMiniCard label="CPL" value={formatCurrency(detailMetrics.cpl)} />
                    <MetricMiniCard label="CAC" value={formatCurrency(detailMetrics.cac)} />
                    <MetricMiniCard label="Pipeline" value={formatCurrency(detailMetrics.pipelineValue)} />
                    <MetricMiniCard label="Ativos" value={detailMetrics.active} />
                  </div>
                </PanelCard>
              </div>
            </div>
          ) : null}
        </div>
      </section>
    </div>
  );
}

function MetricCard({ icon: Icon, label, value }: { icon: LucideIcon; label: string; value: string | number }) {
  return (
    <div className="bg-card border border-border rounded-xl p-3.5 flex items-center gap-3 shadow-xl">
      <div className="w-9 h-9 rounded-lg bg-accent border border-border flex items-center justify-center text-primary">
        <Icon className="w-4 h-4" />
      </div>
      <div>
        <p className="text-[10px] uppercase tracking-widest text-gold-500/60">{label}</p>
        <p className="text-base font-serif font-bold">{value}</p>
      </div>
    </div>
  );
}

function MetricMiniCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-2xl border border-border bg-background/40 px-4 py-3">
      <p className="text-[10px] uppercase tracking-[0.18em] text-gold-500/60">{label}</p>
      <p className="text-sm font-bold text-foreground mt-1">{value}</p>
    </div>
  );
}

function StatPill({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-xl border border-border bg-card/60 px-3 py-2">
      <p className="text-[9px] uppercase tracking-[0.18em] text-gold-500/60">{label}</p>
      <p className="text-sm font-bold text-foreground mt-1">{value}</p>
    </div>
  );
}

function OverviewPanel({
  title,
  description,
  icon: Icon,
  emptyMessage,
  children,
}: {
  title: string;
  description: string;
  icon: LucideIcon;
  emptyMessage: string;
  children: ReactNode;
}) {
  const hasChildren = Array.isArray(children) ? children.length > 0 : Boolean(children);

  return (
    <section className="bg-card rounded-3xl border border-border shadow-2xl overflow-hidden">
      <div className="px-5 py-4 border-b border-border bg-accent flex items-start gap-3">
        <div className="w-10 h-10 rounded-2xl border border-border bg-background/60 flex items-center justify-center text-primary shrink-0">
          <Icon className="w-5 h-5" />
        </div>
        <div>
          <h2 className="text-base font-serif font-bold">{title}</h2>
          <p className="text-sm text-muted-foreground mt-1">{description}</p>
        </div>
      </div>
      <div className="p-5 space-y-3">
        {hasChildren ? children : <EmptyState message={emptyMessage} compact />}
      </div>
    </section>
  );
}

function PanelCard({
  title,
  description,
  icon: Icon,
  children,
}: {
  title: string;
  description: string;
  icon: LucideIcon;
  children: ReactNode;
}) {
  return (
    <section className="rounded-3xl border border-border bg-background/40 overflow-hidden">
      <div className="px-5 py-4 border-b border-border bg-card/80 flex items-start gap-3">
        <div className="w-10 h-10 rounded-2xl border border-border bg-background/60 flex items-center justify-center text-primary shrink-0">
          <Icon className="w-5 h-5" />
        </div>
        <div>
          <h3 className="text-base font-serif font-bold">{title}</h3>
          <p className="text-sm text-muted-foreground mt-1">{description}</p>
        </div>
      </div>
      <div className="p-5">{children}</div>
    </section>
  );
}

function DataTableSection({
  title,
  description,
  icon: Icon,
  columns,
  rows,
  emptyMessage,
}: {
  title: string;
  description: string;
  icon: LucideIcon;
  columns: string[];
  rows: Array<{ key: string; cells: string[]; onClick?: () => void }>;
  emptyMessage: string;
}) {
  return (
    <PanelCard title={title} description={description} icon={Icon}>
      <div className="overflow-x-auto scrollbar-none">
        <table className="w-full text-sm">
          <thead className="text-[10px] uppercase tracking-[0.18em] text-gold-500/70 border-b border-border">
            <tr>
              {columns.map((column) => (
                <th key={column} className="px-3 py-3 text-left font-black">{column}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="px-3 py-8">
                  <EmptyState message={emptyMessage} compact />
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr key={row.key} className="border-b border-border/50 last:border-b-0">
                  {row.cells.map((cell, index) => (
                    <td key={`${row.key}-${index}`} className="px-3 py-3 align-middle">
                      {index === 0 && row.onClick ? (
                        <button type="button" onClick={row.onClick} className="font-semibold text-left text-foreground hover:text-primary transition-colors inline-flex items-center gap-2">
                          <span>{cell}</span>
                          <ArrowRight className="w-3.5 h-3.5" />
                        </button>
                      ) : (
                        <span className={cn(index === 0 ? 'font-semibold text-foreground' : 'text-muted-foreground')}>
                          {cell}
                        </span>
                      )}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </PanelCard>
  );
}

function ProgressRow({
  label,
  value,
  percentage,
  color,
  emphasize = false,
}: {
  label: string;
  value: number;
  percentage: number;
  color?: string;
  emphasize?: boolean;
}) {
  return (
    <div className={cn('space-y-2 rounded-2xl border border-border bg-card/50 px-4 py-3', emphasize ? 'shadow-lg' : '')}>
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: color || '#D4AF37' }} />
          <span className="text-sm font-semibold text-foreground truncate">{label}</span>
        </div>
        <div className="text-right shrink-0">
          <p className="text-sm font-bold text-foreground">{value}</p>
          <p className="text-[10px] uppercase tracking-[0.18em] text-gold-500/60">{formatPercent(percentage)}</p>
        </div>
      </div>
      <div className="h-2 rounded-full bg-border/80 overflow-hidden">
        <div
          className="h-full rounded-full transition-all"
          style={{ width: `${Math.max(percentage, value > 0 ? 6 : 0)}%`, backgroundColor: color || '#D4AF37' }}
        />
      </div>
    </div>
  );
}

function EmptyState({ message, compact = false }: { message: string; compact?: boolean }) {
  return (
    <div className={cn('rounded-2xl border border-dashed border-border text-center text-muted-foreground', compact ? 'px-4 py-6' : 'px-6 py-10')}>
      {message}
    </div>
  );
}

function ChevronText() {
  return <span className="text-gold-500/40">/</span>;
}
