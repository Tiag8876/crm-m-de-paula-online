import { useCallback, useEffect, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  ArrowRight,
  BadgeDollarSign,
  BarChart3,
  CalendarRange,
  CheckCircle2,
  ChevronRight,
  Clock3,
  Download,
  Filter,
  Target,
  TrendingDown,
  TrendingUp,
  Users,
  WalletCards,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import type { AppUser } from '@/types/auth';
import type { Campaign, CampaignSpendEntry, FunnelConfig, FollowUp, StageSemantic, Task } from '@/types/crm';
import { PremiumSelect } from '@/components/PremiumSelect';
import { useAuthStore } from '@/store/useAuthStore';
import { useStore } from '@/store/useStore';
import { getStageSemantic, isClosedSemantic, isLostSemantic } from '@/lib/funnelStages';
import { getLeadIdleHours } from '@/lib/leadMetrics';
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
  sourceId?: string;
  sourceName: string;
  stageId: string;
  semantic: StageSemantic;
  closed: boolean;
  lost: boolean;
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

type FunnelSummary = MetricsSummary & {
  id: string;
  name: string;
  operation: FunnelConfig['operation'];
  linkedCampaignId?: string;
  linkedCampaignName?: string;
  ownersCount: number;
  stageCount: number;
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
  funnelCount: number;
  ownerCount: number;
};

type TimelinePoint = {
  key: string;
  label: string;
  entradas: number;
  fechados: number;
  perdidos: number;
};

type StagePoint = {
  id: string;
  name: string;
  total: number;
  share: number;
  color: string;
};

type RankingItem = {
  id: string;
  label: string;
  supporting: string;
  value: string;
  secondaryValue: string;
  onClick?: () => void;
};

const ALL_OPERATIONS = 'all';
const NO_OWNER_ID = '__no_owner__';
const NO_CAMPAIGN_ID = '__no_campaign__';
const CHART_COLORS = ['#D4AF37', '#10B981', '#3B82F6', '#F59E0B', '#8B5CF6', '#EF4444', '#06B6D4', '#EC4899'];

const SEMANTIC_META: Record<StageSemantic, { label: string; color: string; order: number }> = {
  new: { label: 'Novos', color: '#D4AF37', order: 0 },
  contact: { label: 'Contato', color: '#3B82F6', order: 1 },
  waiting: { label: 'Aguardando', color: '#F59E0B', order: 2 },
  meeting: { label: 'Reuniao', color: '#8B5CF6', order: 3 },
  qualified: { label: 'Qualificados', color: '#06B6D4', order: 4 },
  proposal: { label: 'Proposta', color: '#6366F1', order: 5 },
  negotiation: { label: 'Negociacao', color: '#EC4899', order: 6 },
  inspection: { label: 'Inspecao', color: '#22C55E', order: 7 },
  won: { label: 'Fechados', color: '#10B981', order: 8 },
  lost: { label: 'Perdidos', color: '#EF4444', order: 9 },
  other: { label: 'Personalizada', color: '#64748B', order: 10 },
};

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

const isValidPeriod = (value: string | null): value is PeriodFilter =>
  value === '7' || value === '30' || value === '90' || value === 'all';

const isValidOperation = (value: string | null): value is OperationFilter =>
  value === 'all' || value === 'commercial' || value === 'prospecting';

const isValidDetail = (value: string | null): value is DetailType =>
  value === 'campaign' || value === 'owner' || value === 'funnel';

const getProspectIdleHours = (
  lead: { createdAt: string; lastInteractionAt?: string; followUps?: Array<{ date: string }>; tasks?: Array<{ date: string }>; notes?: Array<{ createdAt: string }> },
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
  return overlapDays > 0 ? amount * (overlapDays / totalDays) : 0;
};

const summarizeMetrics = (records: ReportRecord[], totalSpend: number, nowMs: number): MetricsSummary => {
  const total = records.length;
  const won = records.filter((record) => record.closed).length;
  const lost = records.filter((record) => record.lost).length;
  const active = Math.max(0, total - won - lost);
  const stalled = records.filter((record) => !record.closed && !record.lost && record.idleHours >= 24).length;
  const overdue = records.reduce((sum, record) => sum + record.followUps.filter((followUp) => followUp.status === 'pendente' && new Date(followUp.date).getTime() < nowMs).length, 0);
  const wonRevenue = records.reduce((sum, record) => sum + (record.closed ? record.estimatedValue : 0), 0);
  const pipelineValue = records.reduce((sum, record) => sum + record.estimatedValue, 0);
  const conversion = total > 0 ? (won / total) * 100 : 0;
  const cpl = total > 0 ? totalSpend / total : 0;
  const cac = won > 0 ? totalSpend / won : 0;
  const roi = totalSpend > 0 ? ((wonRevenue - totalSpend) / totalSpend) * 100 : 0;
  return { total, won, lost, active, stalled, overdue, totalSpend, wonRevenue, pipelineValue, conversion, cpl, cac, roi };
};

const sortFunnels = (funnels: FunnelConfig[]) =>
  [...funnels].sort((a, b) => (a.operation !== b.operation ? (a.operation === 'commercial' ? -1 : 1) : a.name.localeCompare(b.name, 'pt-BR')));

const getOwnerLabel = (ownerId: string, users: AppUser[], currentUser: AppUser | null) => {
  if (ownerId === NO_OWNER_ID) return 'Sem responsavel';
  const found = users.find((item) => item.id === ownerId) || (currentUser?.id === ownerId ? currentUser : null);
  return found?.name || 'Usuario';
};

const buildTimeline = (records: ReportRecord[], period: PeriodFilter): TimelinePoint[] => {
  const groupByMonth = period === 'all';
  const formatter = new Intl.DateTimeFormat('pt-BR', groupByMonth ? { month: 'short', year: '2-digit' } : { day: '2-digit', month: 'short' });
  const buckets = new Map<string, TimelinePoint>();
  for (const record of records) {
    const date = new Date(record.createdAt);
    if (Number.isNaN(date.getTime())) continue;
    const bucket = new Date(date);
    bucket.setHours(0, 0, 0, 0);
    if (groupByMonth) bucket.setDate(1);
    const key = bucket.toISOString();
    if (!buckets.has(key)) buckets.set(key, { key, label: formatter.format(bucket), entradas: 0, fechados: 0, perdidos: 0 });
    const point = buckets.get(key)!;
    point.entradas += 1;
    if (record.closed) point.fechados += 1;
    if (record.lost) point.perdidos += 1;
  }
  return Array.from(buckets.values()).sort((a, b) => a.key.localeCompare(b.key));
};

const buildSemanticStageData = (records: ReportRecord[]): StagePoint[] => {
  const counts = new Map<StageSemantic, number>();
  for (const record of records) counts.set(record.semantic, (counts.get(record.semantic) || 0) + 1);
  const total = records.length || 1;
  return Object.entries(SEMANTIC_META)
    .map(([semantic, meta]) => ({
      id: semantic,
      name: meta.label,
      total: counts.get(semantic as StageSemantic) || 0,
      share: ((counts.get(semantic as StageSemantic) || 0) / total) * 100,
      color: meta.color,
    }))
    .filter((item) => item.total > 0)
    .sort((a, b) => SEMANTIC_META[a.id as StageSemantic].order - SEMANTIC_META[b.id as StageSemantic].order);
};

const buildFunnelStageData = (records: ReportRecord[], funnel: FunnelConfig | undefined): StagePoint[] => {
  if (!funnel) return buildSemanticStageData(records);
  const total = records.length || 1;
  return [...(funnel.stages || [])]
    .sort((a, b) => a.order - b.order)
    .map((stage) => {
      const count = records.filter((record) => record.stageId === stage.id).length;
      return { id: stage.id, name: stage.name, total: count, share: (count / total) * 100, color: stage.color };
    })
    .filter((item) => item.total > 0);
};

const buildCampaignRows = (records: ReportRecord[], campaigns: Campaign[], getAllocatedSpend: (subset: ReportRecord[]) => number, nowMs: number): CampaignSummary[] => {
  const map = new Map<string, ReportRecord[]>();
  for (const record of records) {
    if (record.kind !== 'commercial') continue;
    const key = record.sourceId || NO_CAMPAIGN_ID;
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(record);
  }
  return Array.from(map.entries())
    .map(([campaignId, subset]) => {
      const metrics = summarizeMetrics(subset, getAllocatedSpend(subset), nowMs);
      return {
        ...metrics,
        id: campaignId,
        name: campaignId === NO_CAMPAIGN_ID ? 'Sem campanha' : campaigns.find((campaign) => campaign.id === campaignId)?.name || 'Campanha',
        funnelCount: new Set(subset.map((record) => record.funnelId || 'sem_funil')).size,
        ownerCount: new Set(subset.map((record) => record.ownerUserId || NO_OWNER_ID)).size,
      };
    })
    .sort((a, b) => b.total - a.total);
};

const buildOwnerRows = (
  records: ReportRecord[],
  users: AppUser[],
  currentUser: AppUser | null,
  getAllocatedSpend: (subset: ReportRecord[]) => number,
  nowMs: number,
): OwnerSummary[] => {
  const map = new Map<string, ReportRecord[]>();
  for (const record of records) {
    const key = record.ownerUserId || NO_OWNER_ID;
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(record);
  }
  return Array.from(map.entries())
    .map(([ownerId, subset]) => {
      const metrics = summarizeMetrics(subset, getAllocatedSpend(subset), nowMs);
      return {
        ...metrics,
        id: ownerId,
        name: getOwnerLabel(ownerId, users, currentUser),
        campaignsCount: new Set(subset.filter((record) => record.kind === 'commercial').map((record) => record.sourceId || NO_CAMPAIGN_ID)).size,
        funnelsCount: new Set(subset.map((record) => record.funnelId || 'sem_funil')).size,
      };
    })
    .sort((a, b) => b.total - a.total);
};

const buildFunnelRows = (
  records: ReportRecord[],
  funnels: FunnelConfig[],
  campaigns: Campaign[],
  getAllocatedSpend: (subset: ReportRecord[]) => number,
  nowMs: number,
): FunnelSummary[] =>
  funnels
    .map((funnel) => {
      const subset = records.filter((record) => record.funnelId === funnel.id);
      const metrics = summarizeMetrics(subset, getAllocatedSpend(subset), nowMs);
      const linkedCampaign = funnel.linkedCampaignId ? campaigns.find((campaign) => campaign.id === funnel.linkedCampaignId) : undefined;
      return {
        ...metrics,
        id: funnel.id,
        name: funnel.name,
        operation: funnel.operation,
        linkedCampaignId: funnel.linkedCampaignId,
        linkedCampaignName: linkedCampaign?.name,
        ownersCount: new Set(subset.map((record) => record.ownerUserId || NO_OWNER_ID)).size,
        stageCount: (funnel.stages || []).length,
      };
    })
    .filter((item) => item.total > 0)
    .sort((a, b) => b.total - a.total);

const buildHtmlTable = (title: string, columns: string[], rows: string[][]) => `
  <section style="margin-top:24px">
    <h2 style="font-size:18px;margin-bottom:10px;color:#111827">${title}</h2>
    <table style="width:100%;border-collapse:collapse;background:#fff;border:1px solid #e5e7eb">
      <thead><tr>${columns.map((column) => `<th style="padding:10px;border:1px solid #e5e7eb;background:#faf3d8;text-align:left;font-size:11px;letter-spacing:.12em;text-transform:uppercase;color:#7c5a0a">${column}</th>`).join('')}</tr></thead>
      <tbody>${rows.map((row) => `<tr>${row.map((cell) => `<td style="padding:10px;border:1px solid #e5e7eb;font-size:12px;color:#111827">${cell}</td>`).join('')}</tr>`).join('')}</tbody>
    </table>
  </section>
`;

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
  const detailType = isValidDetail(searchParams.get('detail')) ? searchParams.get('detail') : null;
  const detailId = searchParams.get('entityId');
  const detailOwnerId = searchParams.get('ownerId');
  const nowMs = Date.now();
  const { start: rangeStart, end: rangeEnd } = getPeriodRange(period);

  const updateParams = (updates: Record<string, string | null>) => {
    setSearchParams((previous) => {
      const next = new URLSearchParams(previous);
      for (const [key, value] of Object.entries(updates)) {
        if (!value) next.delete(key);
        else next.set(key, value);
      }
      return next;
    }, { replace: true });
  };

  const periodOptions = [
    { value: '7', label: 'Ultimos 7 dias', description: 'Leitura curta', group: 'Periodo' },
    { value: '30', label: 'Ultimos 30 dias', description: 'Janela principal', group: 'Periodo' },
    { value: '90', label: 'Ultimos 90 dias', description: 'Comparativo trimestral', group: 'Periodo' },
    { value: 'all', label: 'Historico completo', description: 'Tudo que existe', group: 'Periodo' },
  ];
  const operationOptions = [
    { value: 'all', label: 'Toda a operacao', description: 'Comercial e prospeccao', group: 'Escopo' },
    { value: 'commercial', label: 'Somente comercial', description: 'Campanhas e fechamento', group: 'Escopo' },
    { value: 'prospecting', label: 'Somente prospeccao', description: 'Qualificacao e retorno', group: 'Escopo' },
  ];

  const records = useMemo<ReportRecord[]>(() => {
    const commercial = (leads || []).map((lead) => {
      const funnel = allFunnels.find((item) => item.id === lead.funnelId) || allFunnels.find((item) => item.operation === 'commercial');
      const semantic = getStageSemantic(funnel, lead.status, 'commercial');
      const sourceId = lead.campaignId || funnel?.linkedCampaignId;
      const sourceName = sourceId ? campaigns.find((campaign) => campaign.id === sourceId)?.name || 'Campanha' : 'Sem campanha';
      return {
        id: lead.id,
        kind: 'commercial' as const,
        createdAt: lead.createdAt,
        funnelId: lead.funnelId,
        ownerUserId: lead.ownerUserId,
        sourceId,
        sourceName,
        stageId: lead.status,
        semantic,
        closed: isClosedSemantic(semantic),
        lost: isLostSemantic(semantic),
        idleHours: getLeadIdleHours(lead, nowMs),
        followUps: lead.followUps || [],
        tasks: lead.tasks || [],
        estimatedValue: Number(lead.estimatedValue) || 0,
      };
    });
    const prospecting = (prospectLeads || []).map((lead) => {
      const funnel = allFunnels.find((item) => item.id === lead.funnelId) || allFunnels.find((item) => item.operation === 'prospecting');
      const semantic = getStageSemantic(funnel, lead.status, 'prospecting');
      return {
        id: lead.id,
        kind: 'prospecting' as const,
        createdAt: lead.createdAt,
        funnelId: lead.funnelId,
        ownerUserId: lead.ownerUserId,
        sourceId: lead.serviceId,
        sourceName: services.find((service) => service.id === lead.serviceId)?.name || 'Sem servico',
        stageId: lead.status,
        semantic,
        closed: isClosedSemantic(semantic),
        lost: isLostSemantic(semantic),
        idleHours: getProspectIdleHours(lead, nowMs),
        followUps: lead.followUps || [],
        tasks: lead.tasks || [],
        estimatedValue: 0,
      };
    });
    return [...commercial, ...prospecting]
      .filter((record) => user?.role === 'admin' || !record.ownerUserId || record.ownerUserId === user?.id)
      .filter((record) => !rangeStart || new Date(record.createdAt) >= rangeStart)
      .filter((record) => operationFilter === ALL_OPERATIONS || record.kind === operationFilter);
  }, [allFunnels, campaigns, leads, nowMs, operationFilter, prospectLeads, rangeStart, services, user?.id, user?.role]);

  const campaignLeadCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const record of records) {
      if (record.kind !== 'commercial' || !record.sourceId) continue;
      counts.set(record.sourceId, (counts.get(record.sourceId) || 0) + 1);
    }
    return counts;
  }, [records]);

  const campaignSpendTotals = useMemo(() => {
    const totals = new Map<string, number>();
    for (const entry of campaignSpendEntries || []) {
      const allocated = getOverlapAmount(entry, rangeStart, rangeEnd);
      if (allocated <= 0) continue;
      totals.set(entry.campaignId, (totals.get(entry.campaignId) || 0) + allocated);
    }
    return totals;
  }, [campaignSpendEntries, rangeEnd, rangeStart]);

  const getAllocatedSpend = useCallback((subset: ReportRecord[]) => {
    const subsetCounts = new Map<string, number>();
    for (const record of subset) {
      if (record.kind !== 'commercial' || !record.sourceId) continue;
      subsetCounts.set(record.sourceId, (subsetCounts.get(record.sourceId) || 0) + 1);
    }
    let total = 0;
    for (const [campaignId, subsetCount] of subsetCounts.entries()) {
      const fullCount = campaignLeadCounts.get(campaignId) || 0;
      if (fullCount <= 0) continue;
      total += (campaignSpendTotals.get(campaignId) || 0) * (subsetCount / fullCount);
    }
    return total;
  }, [campaignLeadCounts, campaignSpendTotals]);

  const overallMetrics = useMemo(() => summarizeMetrics(records, getAllocatedSpend(records), nowMs), [getAllocatedSpend, nowMs, records]);
  const funnelRows = useMemo(() => buildFunnelRows(records, allFunnels.filter((funnel) => operationFilter === ALL_OPERATIONS || funnel.operation === operationFilter), campaigns, getAllocatedSpend, nowMs), [allFunnels, campaigns, getAllocatedSpend, nowMs, operationFilter, records]);
  const ownerRows = useMemo(() => buildOwnerRows(records, users, user, getAllocatedSpend, nowMs), [getAllocatedSpend, nowMs, records, user, users]);
  const campaignRows = useMemo(() => buildCampaignRows(records, campaigns, getAllocatedSpend, nowMs), [campaigns, getAllocatedSpend, nowMs, records]);

  const selectedCampaign = detailType === 'campaign' ? campaignRows.find((item) => item.id === detailId) : undefined;
  const selectedOwner = detailType === 'owner' ? ownerRows.find((item) => item.id === detailId) : undefined;
  const selectedFunnel = detailType === 'funnel' ? funnelRows.find((item) => item.id === detailId) : undefined;

  const detailRecords = useMemo(() => {
    if (selectedCampaign) {
      return records.filter((record) => {
        if (record.kind !== 'commercial') return false;
        const matchCampaign = selectedCampaign.id === NO_CAMPAIGN_ID ? !record.sourceId : record.sourceId === selectedCampaign.id;
        if (!matchCampaign) return false;
        if (!detailOwnerId) return true;
        return detailOwnerId === NO_OWNER_ID ? !record.ownerUserId : record.ownerUserId === detailOwnerId;
      });
    }
    if (selectedOwner) return records.filter((record) => (selectedOwner.id === NO_OWNER_ID ? !record.ownerUserId : record.ownerUserId === selectedOwner.id));
    if (selectedFunnel) return records.filter((record) => record.funnelId === selectedFunnel.id);
    return records;
  }, [detailOwnerId, records, selectedCampaign, selectedFunnel, selectedOwner]);

  const detailMetrics = useMemo(() => summarizeMetrics(detailRecords, getAllocatedSpend(detailRecords), nowMs), [detailRecords, getAllocatedSpend, nowMs]);

  const primaryDetailFunnel = useMemo(() => {
    if (selectedFunnel) return allFunnels.find((funnel) => funnel.id === selectedFunnel.id);
    if (!selectedCampaign) return undefined;
    const linkedFunnels = allFunnels.filter((funnel) => funnel.linkedCampaignId === selectedCampaign.id);
    if (linkedFunnels.length === 1) return linkedFunnels[0];
    const counts = new Map<string, number>();
    for (const record of detailRecords) {
      if (!record.funnelId) continue;
      counts.set(record.funnelId, (counts.get(record.funnelId) || 0) + 1);
    }
    const top = Array.from(counts.entries()).sort((a, b) => b[1] - a[1])[0];
    return top ? allFunnels.find((funnel) => funnel.id === top[0]) : undefined;
  }, [allFunnels, detailRecords, selectedCampaign, selectedFunnel]);

  const overviewTimeline = useMemo(() => buildTimeline(records, period), [period, records]);
  const detailTimeline = useMemo(() => buildTimeline(detailRecords, period), [detailRecords, period]);
  const overviewStageData = useMemo(() => buildSemanticStageData(records), [records]);
  const detailStageData = useMemo(() => buildFunnelStageData(detailRecords, primaryDetailFunnel), [detailRecords, primaryDetailFunnel]);

  const topCampaignChart = campaignRows.slice(0, 6).map((item) => ({ id: item.id, name: item.name.length > 18 ? `${item.name.slice(0, 18)}...` : item.name, total: item.total }));
  const topOwnerChart = ownerRows.slice(0, 6).map((item) => ({ id: item.id, name: item.name.length > 16 ? `${item.name.slice(0, 16)}...` : item.name, total: item.total, fechados: item.won }));
  const topFunnelChart = funnelRows.slice(0, 6).map((item) => ({ id: item.id, name: item.name.length > 20 ? `${item.name.slice(0, 20)}...` : item.name, total: item.total }));

  const detailComparisonRows = useMemo(() => {
    if (selectedCampaign) return buildOwnerRows(detailRecords, users, user, getAllocatedSpend, nowMs);
    if (selectedOwner) return buildCampaignRows(detailRecords, campaigns, getAllocatedSpend, nowMs);
    if (selectedFunnel) return buildOwnerRows(detailRecords, users, user, getAllocatedSpend, nowMs);
    return [];
  }, [campaigns, detailRecords, getAllocatedSpend, nowMs, selectedCampaign, selectedFunnel, selectedOwner, user, users]);

  const detailComparisonChart = detailComparisonRows.slice(0, 6).map((item) => ({
    id: item.id,
    name: item.name.length > 18 ? `${item.name.slice(0, 18)}...` : item.name,
    total: item.total,
  }));

  const detailSecondaryFunnels = useMemo(() => buildFunnelRows(detailRecords, allFunnels, campaigns, getAllocatedSpend, nowMs), [allFunnels, campaigns, detailRecords, getAllocatedSpend, nowMs]);
  const biggestBottleneck = [...overviewStageData.filter((stage) => !['Fechados', 'Perdidos'].includes(stage.name))].sort((a, b) => b.total - a.total)[0];
  const bestCampaign = campaignRows.find((item) => item.total > 0);
  const bestOwner = ownerRows.find((item) => item.total > 0);
  const linkedFunnelsCount = funnelRows.filter((item) => item.linkedCampaignId).length;
  const canViewFinancials = user?.role === 'admin';

  const ownerCampaignRows = useMemo(
    () => (selectedOwner ? buildCampaignRows(detailRecords, campaigns, getAllocatedSpend, nowMs) : []),
    [campaigns, detailRecords, getAllocatedSpend, nowMs, selectedOwner],
  );
  const ownerFunnelRows = useMemo(
    () => (selectedOwner ? buildFunnelRows(detailRecords, allFunnels, campaigns, getAllocatedSpend, nowMs) : []),
    [allFunnels, campaigns, detailRecords, getAllocatedSpend, nowMs, selectedOwner],
  );
  const campaignOwnerRows = useMemo(
    () => (selectedCampaign ? buildOwnerRows(detailRecords, users, user, getAllocatedSpend, nowMs) : []),
    [detailRecords, getAllocatedSpend, nowMs, selectedCampaign, user, users],
  );
  const campaignFunnelRows = useMemo(
    () => (selectedCampaign ? buildFunnelRows(detailRecords, allFunnels, campaigns, getAllocatedSpend, nowMs) : []),
    [allFunnels, campaigns, detailRecords, getAllocatedSpend, nowMs, selectedCampaign],
  );
  const funnelOwnerRows = useMemo(
    () => (selectedFunnel ? buildOwnerRows(detailRecords, users, user, getAllocatedSpend, nowMs) : []),
    [detailRecords, getAllocatedSpend, nowMs, selectedFunnel, user, users],
  );
  const funnelCampaignRows = useMemo(
    () => (selectedFunnel ? buildCampaignRows(detailRecords, campaigns, getAllocatedSpend, nowMs) : []),
    [campaigns, detailRecords, getAllocatedSpend, nowMs, selectedFunnel],
  );

  const detailTitle = selectedCampaign
    ? `Campanha: ${selectedCampaign.name}${detailOwnerId ? ` / ${getOwnerLabel(detailOwnerId, users, user)}` : ''}`
    : selectedOwner
      ? `Vendedor: ${selectedOwner.name}`
      : selectedFunnel
        ? `Funil: ${selectedFunnel.name}`
        : null;

  const exportReport = () => {
    const summaryRows = [
      ['Entradas', String(detailTitle ? detailMetrics.total : overallMetrics.total)],
      ['Fechados', String(detailTitle ? detailMetrics.won : overallMetrics.won)],
      ['Perdidos', String(detailTitle ? detailMetrics.lost : overallMetrics.lost)],
      ['Conversao', detailTitle ? formatPercent(detailMetrics.conversion) : formatPercent(overallMetrics.conversion)],
    ];
    if (canViewFinancials) {
      summaryRows.push(
        ['Investimento', detailTitle ? formatCurrency(detailMetrics.totalSpend) : formatCurrency(overallMetrics.totalSpend)],
        ['Receita', detailTitle ? formatCurrency(detailMetrics.wonRevenue) : formatCurrency(overallMetrics.wonRevenue)],
        ['ROI', detailTitle ? formatPercent(detailMetrics.roi) : formatPercent(overallMetrics.roi)],
      );
    }
    const focusRows = (detailTitle ? detailComparisonRows : campaignRows.slice(0, 12)).map((item) => [
      item.name,
      String(item.total),
      String(item.won),
      String(item.lost),
      formatPercent(item.conversion),
      ...(canViewFinancials
        ? [formatCurrency(item.totalSpend), formatCurrency(item.wonRevenue), formatPercent(item.roi)]
        : []),
    ]);
    const focusColumns = ['Nome', 'Entradas', 'Fechados', 'Perdidos', 'Conversao', ...(canViewFinancials ? ['Investimento', 'Receita', 'ROI'] : [])];
    const html = `<html><head><meta charset="utf-8" /></head><body style="font-family:Segoe UI,Arial,sans-serif;padding:24px;background:#fffaf0;color:#111827"><div style="background:linear-gradient(180deg,#111111 0%,#171717 100%);border-radius:18px;padding:24px;color:#f5d06f"><div style="height:4px;background:#d4af37;border-radius:999px;margin-bottom:14px"></div><div style="font-size:11px;text-transform:uppercase;letter-spacing:.22em;color:#f3d98a">CRM M De Paula</div><h1 style="margin:12px 0 0;font-size:28px">${detailTitle || 'Panorama geral'}</h1><p style="margin:8px 0 0;color:#d7bf7a;font-size:12px">Periodo ${period} | Gerado em ${new Date().toLocaleString('pt-BR')}</p></div>${buildHtmlTable('Resumo executivo', ['Indicador', 'Valor'], summaryRows)}${buildHtmlTable(detailTitle ? 'Aprofundamento atual' : 'Campanhas em destaque', focusColumns, focusRows)}</body></html>`;
    const blob = new Blob([html], { type: 'application/vnd.ms-excel;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `crm-m-de-paula-relatorio-${new Date().toISOString().slice(0, 10)}.xls`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const campaignRanking: RankingItem[] = campaignRows.slice(0, 5).map((item) => ({ id: item.id, label: item.name, supporting: `${item.ownerCount} responsaveis / ${item.funnelCount} funis`, value: `${item.total} leads`, secondaryValue: `${formatPercent(item.conversion)} conv.`, onClick: () => updateParams({ detail: 'campaign', entityId: item.id, ownerId: null }) }));
  const ownerRanking: RankingItem[] = ownerRows.slice(0, 5).map((item) => ({ id: item.id, label: item.name, supporting: `${item.campaignsCount} campanhas / ${item.funnelsCount} funis`, value: `${item.won} fechados`, secondaryValue: `${formatPercent(item.conversion)} conv.`, onClick: () => updateParams({ detail: 'owner', entityId: item.id, ownerId: null }) }));
  const funnelRanking: RankingItem[] = funnelRows.slice(0, 5).map((item) => ({ id: item.id, label: item.name, supporting: item.linkedCampaignName ? `Vinculado a ${item.linkedCampaignName}` : `${item.stageCount} etapas`, value: `${item.total} entradas`, secondaryValue: `${formatPercent(item.conversion)} conv.`, onClick: () => updateParams({ detail: 'funnel', entityId: item.id, ownerId: null }) }));

  return (
    <div className="p-4 md:p-8 max-w-[1600px] mx-auto space-y-6">
      <section className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-2xl font-serif font-bold text-foreground">Relatorios</h1>
        </div>
        <div className="grid w-full gap-3 md:grid-cols-3 lg:w-auto lg:min-w-[760px]">
          <PremiumSelect options={operationOptions} value={operationFilter} onChange={(nextValue) => updateParams({ operation: nextValue === ALL_OPERATIONS ? null : nextValue, detail: null, entityId: null, ownerId: null })} placeholder="Selecionar escopo" />
          <PremiumSelect options={periodOptions} value={period} onChange={(nextValue) => updateParams({ period: nextValue })} placeholder="Selecionar periodo" />
          <button type="button" onClick={exportReport} className="inline-flex items-center justify-center gap-2 rounded-xl border border-border bg-card px-4 py-3 text-xs font-black uppercase tracking-[0.16em] text-foreground transition hover:border-gold-500/40">
            <Download className="h-4 w-4" />
            Exportar
          </button>
        </div>
      </section>

      {!detailTitle ? (
        <>
          <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
            <MetricCard icon={BarChart3} label="Entradas" value={overallMetrics.total} helper="volume no periodo" />
            <MetricCard icon={CheckCircle2} label="Fechados" value={overallMetrics.won} helper={formatPercent(overallMetrics.conversion)} />
            <MetricCard icon={TrendingDown} label="Perdidos" value={overallMetrics.lost} helper={`${overallMetrics.active} ativos`} />
            <MetricCard icon={Clock3} label="Leads parados" value={overallMetrics.stalled} helper="sem interacao por 24h+" />
            <MetricCard icon={CalendarRange} label="Follow-up atrasado" value={overallMetrics.overdue} helper="fila de retorno pendente" />
          </section>

          {canViewFinancials ? (
            <section className="grid gap-4 md:grid-cols-3">
              <MetricCard icon={WalletCards} label="Investimento" value={formatCurrency(overallMetrics.totalSpend)} helper={`${formatCurrency(overallMetrics.cpl)} por lead`} />
              <MetricCard icon={BadgeDollarSign} label="Receita" value={formatCurrency(overallMetrics.wonRevenue)} helper={`${formatPercent(overallMetrics.roi)} de ROI`} />
              <MetricCard icon={Target} label="Pipeline" value={formatCurrency(overallMetrics.pipelineValue)} helper={`${overallMetrics.active} oportunidades abertas`} />
            </section>
          ) : null}
        </>
      ) : null}

      {!detailTitle ? (
        <>
      <section className="grid gap-6 xl:grid-cols-[1.6fr_1fr]">
        <ChartCard title="Evolucao do periodo" description="Entradas, fechamentos e perdas na mesma linha para leitura rapida." actionLabel="Filtros ativos" actionValue={`${period} / ${operationFilter === 'all' ? 'toda operacao' : operationFilter}`}>
          <ResponsiveContainer width="100%" height={320}>
            <AreaChart data={overviewTimeline}>
              <defs><linearGradient id="entriesGradient" x1="0" x2="0" y1="0" y2="1"><stop offset="5%" stopColor="#D4AF37" stopOpacity={0.5} /><stop offset="95%" stopColor="#D4AF37" stopOpacity={0.05} /></linearGradient><linearGradient id="wonGradient" x1="0" x2="0" y1="0" y2="1"><stop offset="5%" stopColor="#10B981" stopOpacity={0.45} /><stop offset="95%" stopColor="#10B981" stopOpacity={0.05} /></linearGradient></defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.15)" />
              <XAxis dataKey="label" stroke="#94A3B8" fontSize={12} />
              <YAxis stroke="#94A3B8" fontSize={12} />
              <Tooltip contentStyle={{ background: '#111827', border: '1px solid rgba(212,175,55,0.25)', borderRadius: 16 }} />
              <Area type="monotone" dataKey="entradas" stroke="#D4AF37" fill="url(#entriesGradient)" strokeWidth={3} />
              <Area type="monotone" dataKey="fechados" stroke="#10B981" fill="url(#wonGradient)" strokeWidth={3} />
              <Area type="monotone" dataKey="perdidos" stroke="#EF4444" fill="transparent" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title={operationFilter === 'prospecting' ? 'Funis com maior volume' : 'Campanhas em destaque'} description={operationFilter === 'prospecting' ? 'Onde a prospeccao mais se concentra.' : 'Top campanhas para abrir e aprofundar no funil.'}>
          <ResponsiveContainer width="100%" height={320}>
            <BarChart data={operationFilter === 'prospecting' ? topFunnelChart : topCampaignChart} layout="vertical" margin={{ left: 20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.12)" />
              <XAxis type="number" stroke="#94A3B8" fontSize={12} />
              <YAxis dataKey="name" type="category" width={110} stroke="#94A3B8" fontSize={12} />
              <Tooltip contentStyle={{ background: '#111827', border: '1px solid rgba(212,175,55,0.25)', borderRadius: 16 }} />
              <Bar dataKey="total" radius={[0, 12, 12, 0]}>{(operationFilter === 'prospecting' ? topFunnelChart : topCampaignChart).map((entry, index) => <Cell key={entry.id} fill={CHART_COLORS[index % CHART_COLORS.length]} />)}</Bar>
            </BarChart>
          </ResponsiveContainer>
          {operationFilter !== 'prospecting' ? <div className="mt-4 grid gap-2">{campaignRows.slice(0, 5).map((campaign) => <QuickActionRow key={campaign.id} title={campaign.name} subtitle={`${campaign.ownerCount} responsaveis / ${campaign.funnelCount} funis`} metric={`${formatPercent(campaign.conversion)} conv.`} onClick={() => updateParams({ detail: 'campaign', entityId: campaign.id, ownerId: null })} />)}</div> : null}
        </ChartCard>
      </section>

      <section className="grid gap-6 xl:grid-cols-3">
        <ChartCard title="Distribuicao das etapas" description="Mostra em que ponto a operacao esta ficando presa hoje.">
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie data={overviewStageData} dataKey="total" nameKey="name" innerRadius={70} outerRadius={110} paddingAngle={3}>
                {overviewStageData.map((entry) => <Cell key={entry.id} fill={entry.color} />)}
              </Pie>
              <Tooltip contentStyle={{ background: '#111827', border: '1px solid rgba(212,175,55,0.25)', borderRadius: 16 }} />
            </PieChart>
          </ResponsiveContainer>
          <div className="mt-4 space-y-2">{overviewStageData.slice(0, 5).map((stage) => <ProgressRow key={stage.id} label={stage.name} value={stage.total} percentage={stage.share} color={stage.color} />)}</div>
        </ChartCard>

        <ChartCard title="Equipe" description="Volume e conversao para achar quem precisa de apoio ou onde acelerar.">
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={topOwnerChart}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.12)" />
              <XAxis dataKey="name" stroke="#94A3B8" fontSize={12} />
              <YAxis stroke="#94A3B8" fontSize={12} />
              <Tooltip contentStyle={{ background: '#111827', border: '1px solid rgba(212,175,55,0.25)', borderRadius: 16 }} />
              <Bar dataKey="fechados" fill="#10B981" radius={[12, 12, 0, 0]} />
              <Bar dataKey="total" fill="#D4AF37" radius={[12, 12, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
          <div className="mt-4 grid gap-2">{ownerRows.slice(0, 5).map((owner) => <QuickActionRow key={owner.id} title={owner.name} subtitle={`${owner.campaignsCount} campanhas / ${owner.funnelsCount} funis`} metric={`${owner.won} fechados`} onClick={() => updateParams({ detail: 'owner', entityId: owner.id, ownerId: null })} />)}</div>
        </ChartCard>

        <ChartCard title="Funis vinculados" description="Quais funis ja estao ligados a campanhas e quais ainda estao soltos.">
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={topFunnelChart}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.12)" />
              <XAxis dataKey="name" stroke="#94A3B8" fontSize={12} />
              <YAxis stroke="#94A3B8" fontSize={12} />
              <Tooltip contentStyle={{ background: '#111827', border: '1px solid rgba(212,175,55,0.25)', borderRadius: 16 }} />
              <Bar dataKey="total" fill="#8B5CF6" radius={[12, 12, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
          <div className="mt-4 grid gap-2">{funnelRows.slice(0, 5).map((funnel) => <QuickActionRow key={funnel.id} title={funnel.name} subtitle={funnel.linkedCampaignName ? `Vinculado a ${funnel.linkedCampaignName}` : 'Sem campanha vinculada'} metric={`${funnel.total} entradas`} onClick={() => updateParams({ detail: 'funnel', entityId: funnel.id, ownerId: null })} />)}</div>
        </ChartCard>
      </section>

      <section className="grid gap-4 xl:grid-cols-3">
        <InsightCard icon={TrendingUp} title="Melhor campanha agora" description={bestCampaign ? `${bestCampaign.name} lidera o volume do periodo.` : 'Ainda nao ha campanha suficiente para comparar.'} metric={bestCampaign ? `${bestCampaign.total} leads / ${formatPercent(bestCampaign.conversion)}` : 'Sem dados'} />
        <InsightCard icon={TrendingDown} title="Maior gargalo" description={biggestBottleneck ? `${biggestBottleneck.name} concentra a maior fila ativa.` : 'Sem gargalo relevante no periodo.'} metric={biggestBottleneck ? `${biggestBottleneck.total} registros / ${formatPercent(biggestBottleneck.share)}` : 'Sem dados'} />
        <InsightCard icon={Filter} title="Arquitetura do CRM" description={`${linkedFunnelsCount} funis ja estao vinculados a campanhas para leitura mais precisa nos relatorios.`} metric={bestOwner ? `${bestOwner.name} lidera com ${bestOwner.won} fechados` : 'Equipe ainda sem destaque'} />
      </section>

      <section className="grid gap-6 xl:grid-cols-3">
        <RankingCard title="Campanhas para abrir agora" description="O clique abre a leitura da campanha dentro desta pagina." items={campaignRanking} />
        <RankingCard title="Vendedores para aprofundar" description="Abrindo o vendedor, voce desce para as campanhas dele." items={ownerRanking} />
        <RankingCard title="Funis que pedem leitura" description="Abre o detalhamento por etapa, com campanha vinculada quando existir." items={funnelRanking} />
      </section>
        </>
      ) : null}

      {detailTitle ? (
        <section className="rounded-[32px] border border-border bg-card shadow-[0_24px_80px_rgba(0,0,0,0.18)] overflow-hidden">
          <div className="border-b border-border bg-[radial-gradient(circle_at_top_right,_rgba(212,175,55,0.18),_transparent_28%),linear-gradient(180deg,_rgba(17,17,17,0.96)_0%,_rgba(24,24,24,0.92)_100%)] px-6 py-5">
            <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
              <div>
                <div className="flex flex-wrap items-center gap-2 text-[11px] uppercase tracking-[0.18em] text-gold-300/70">
                  <button type="button" className="transition hover:text-gold-100" onClick={() => updateParams({ detail: null, entityId: null, ownerId: null })}>Geral</button>
                  {selectedOwner ? <><ChevronRight className="h-4 w-4" /><span className="text-gold-100">{selectedOwner.name}</span></> : null}
                  {selectedCampaign ? <>{detailOwnerId ? <><ChevronRight className="h-4 w-4" /><button type="button" className="transition hover:text-gold-100" onClick={() => updateParams({ detail: 'owner', entityId: detailOwnerId, ownerId: null })}>{getOwnerLabel(detailOwnerId, users, user)}</button></> : null}<ChevronRight className="h-4 w-4" /><span className="text-gold-100">{selectedCampaign.name}</span></> : null}
                  {selectedFunnel ? <><ChevronRight className="h-4 w-4" /><span className="text-gold-100">{selectedFunnel.name}</span></> : null}
                </div>
                <h2 className="mt-3 text-2xl md:text-3xl font-serif font-bold text-white">{detailTitle}</h2>
                <p className="mt-2 text-sm text-white/65 max-w-3xl">{selectedCampaign ? (primaryDetailFunnel ? `Leitura completa da campanha com foco no funil ${primaryDetailFunnel.name}.` : 'Leitura completa da campanha com distribuicao por etapa, responsavel e conversao.') : selectedOwner ? 'Panorama do vendedor com campanhas, funis, produtividade e gargalos.' : 'Aprofundamento do funil com etapas, campanha vinculada e equipe envolvida.'}</p>
              </div>
              <button type="button" onClick={() => updateParams({ detail: null, entityId: null, ownerId: null })} className="inline-flex items-center gap-2 self-start rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-xs font-black uppercase tracking-[0.18em] text-white/80 transition hover:bg-white/10">Fechar detalhe</button>
            </div>
            <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
              <HeroMetricCard icon={BarChart3} label="Entradas" value={detailMetrics.total} helper="volume deste recorte" />
              <HeroMetricCard icon={CheckCircle2} label="Fechados" value={detailMetrics.won} helper={formatPercent(detailMetrics.conversion)} />
              <HeroMetricCard icon={TrendingDown} label="Perdidos" value={detailMetrics.lost} helper={`${detailMetrics.active} ativos`} />
              <HeroMetricCard icon={Clock3} label="Leads parados" value={detailMetrics.stalled} helper={`${detailMetrics.overdue} follow-ups atrasados`} />
              <HeroMetricCard icon={CalendarRange} label="Follow-ups" value={detailMetrics.overdue} helper="atrasados no recorte" />
            </div>
          </div>
          <div className="p-6 space-y-6">
            {canViewFinancials ? (
              <section className="grid gap-4 md:grid-cols-3">
                <MetricCard icon={WalletCards} label="Investimento" value={formatCurrency(detailMetrics.totalSpend)} helper={`CAC ${formatCurrency(detailMetrics.cac)}`} />
                <MetricCard icon={BadgeDollarSign} label="Receita" value={formatCurrency(detailMetrics.wonRevenue)} helper={`ROI ${formatPercent(detailMetrics.roi)}`} />
                <MetricCard icon={Target} label="Pipeline" value={formatCurrency(detailMetrics.pipelineValue)} helper="valor em andamento" />
              </section>
            ) : null}

            <div className="grid gap-6 xl:grid-cols-[1.45fr_1fr]">
              <ChartCard title="Linha do tempo deste recorte" description="Ajuda a entender se o detalhe clicado acelerou ou travou.">
                <ResponsiveContainer width="100%" height={280}>
                  <AreaChart data={detailTimeline}>
                    <defs><linearGradient id="detailGradient" x1="0" x2="0" y1="0" y2="1"><stop offset="5%" stopColor="#D4AF37" stopOpacity={0.45} /><stop offset="95%" stopColor="#D4AF37" stopOpacity={0.04} /></linearGradient></defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.12)" />
                    <XAxis dataKey="label" stroke="#94A3B8" fontSize={12} />
                    <YAxis stroke="#94A3B8" fontSize={12} />
                    <Tooltip contentStyle={{ background: '#111827', border: '1px solid rgba(212,175,55,0.25)', borderRadius: 16 }} />
                    <Area type="monotone" dataKey="entradas" stroke="#D4AF37" fill="url(#detailGradient)" strokeWidth={3} />
                    <Area type="monotone" dataKey="fechados" stroke="#10B981" fill="transparent" strokeWidth={2} />
                    <Area type="monotone" dataKey="perdidos" stroke="#EF4444" fill="transparent" strokeWidth={2} />
                  </AreaChart>
                </ResponsiveContainer>
              </ChartCard>

              <ChartCard title={primaryDetailFunnel ? `Etapas do funil ${primaryDetailFunnel.name}` : 'Distribuicao das etapas'} description={primaryDetailFunnel ? 'Aqui voce enxerga exatamente onde esta o gargalo deste recorte.' : 'Leitura do recorte atual por significado de etapa.'}>
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={detailStageData} layout="vertical" margin={{ left: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.12)" />
                    <XAxis type="number" stroke="#94A3B8" fontSize={12} />
                    <YAxis dataKey="name" type="category" width={120} stroke="#94A3B8" fontSize={12} />
                    <Tooltip contentStyle={{ background: '#111827', border: '1px solid rgba(212,175,55,0.25)', borderRadius: 16 }} />
                    <Bar dataKey="total" radius={[0, 12, 12, 0]}>{detailStageData.map((entry) => <Cell key={entry.id} fill={entry.color} />)}</Bar>
                  </BarChart>
                </ResponsiveContainer>
              </ChartCard>
            </div>

            <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
              <ChartCard title={selectedCampaign ? 'Equipe dentro desta campanha' : selectedOwner ? 'Campanhas dentro deste vendedor' : 'Equipe dentro deste funil'} description="O clique aprofunda mais um nivel quando fizer sentido.">
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={detailComparisonChart}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.12)" />
                    <XAxis dataKey="name" stroke="#94A3B8" fontSize={12} />
                    <YAxis stroke="#94A3B8" fontSize={12} />
                    <Tooltip contentStyle={{ background: '#111827', border: '1px solid rgba(212,175,55,0.25)', borderRadius: 16 }} />
                    <Bar dataKey="total" fill="#D4AF37" radius={[12, 12, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
                <div className="mt-4 grid gap-2">{detailComparisonRows.slice(0, 5).map((item) => <QuickActionRow key={item.id} title={item.name} subtitle={`${item.total} entradas / ${item.won} fechados`} metric={`${formatPercent(item.conversion)} conv.`} onClick={selectedOwner ? () => updateParams({ detail: 'campaign', entityId: item.id, ownerId: selectedOwner.id }) : selectedCampaign || selectedFunnel ? () => updateParams({ detail: 'owner', entityId: item.id, ownerId: null }) : undefined} />)}</div>
              </ChartCard>

              <div className="grid gap-6">
                <ChartCard title="Leituras rapidas deste detalhe" description="Resumo gerencial para agir sem interpretar tudo manualmente.">
                  <div className="space-y-3">
                    <DetailInsightRow label="Gargalo atual" value={detailStageData.length > 0 ? `${[...detailStageData].sort((a, b) => b.total - a.total)[0].name} (${[...detailStageData].sort((a, b) => b.total - a.total)[0].total})` : 'Sem dados'} />
                    <DetailInsightRow label="Funil principal" value={primaryDetailFunnel ? primaryDetailFunnel.name : 'Nao identificado'} />
                    {canViewFinancials ? <DetailInsightRow label="ROI deste recorte" value={formatPercent(detailMetrics.roi)} /> : null}
                    {canViewFinancials ? <DetailInsightRow label="Pipeline aberto" value={formatCurrency(detailMetrics.pipelineValue)} /> : null}
                  </div>
                </ChartCard>
                <ChartCard title="Funis relacionados" description="Especialmente util ao abrir vendedor ou campanha.">
                  <div className="space-y-2">{detailSecondaryFunnels.slice(0, 5).map((funnel) => <QuickActionRow key={funnel.id} title={funnel.name} subtitle={funnel.linkedCampaignName ? `Vinculado a ${funnel.linkedCampaignName}` : 'Sem campanha vinculada'} metric={`${funnel.total} entradas`} onClick={() => updateParams({ detail: 'funnel', entityId: funnel.id, ownerId: null })} />)}{detailSecondaryFunnels.length === 0 ? <EmptyInlineState message="Nenhum funil relacionado para mostrar." /> : null}</div>
                </ChartCard>
              </div>
            </div>

            {selectedOwner ? (
              <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
                <ChartCard title="Campanhas deste vendedor" description="Resultado por campanha operada por este vendedor.">
                  <div className="space-y-2">
                    {ownerCampaignRows.map((item) => (
                      <QuickActionRow
                        key={item.id}
                        title={item.name}
                        subtitle={`${item.total} entradas / ${item.lost} perdidos`}
                        metric={`${item.won} fechados`}
                        onClick={() => updateParams({ detail: 'campaign', entityId: item.id, ownerId: selectedOwner.id })}
                      />
                    ))}
                    {ownerCampaignRows.length === 0 ? <EmptyInlineState message="Nenhuma campanha encontrada para este vendedor." /> : null}
                  </div>
                </ChartCard>

                <ChartCard title="Funis deste vendedor" description="Leitura do vendedor por funil.">
                  <div className="space-y-2">
                    {ownerFunnelRows.map((item) => (
                      <QuickActionRow
                        key={item.id}
                        title={item.name}
                        subtitle={item.linkedCampaignName ? `Campanha ${item.linkedCampaignName}` : `${item.stageCount} etapas`}
                        metric={`${item.total} entradas`}
                        onClick={() => updateParams({ detail: 'funnel', entityId: item.id, ownerId: null })}
                      />
                    ))}
                    {ownerFunnelRows.length === 0 ? <EmptyInlineState message="Nenhum funil encontrado para este vendedor." /> : null}
                  </div>
                </ChartCard>
              </div>
            ) : null}

            {selectedCampaign ? (
              <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
                <ChartCard title="Equipe nesta campanha" description="Resultado por vendedor dentro desta campanha.">
                  <div className="space-y-2">
                    {campaignOwnerRows.map((item) => (
                      <QuickActionRow
                        key={item.id}
                        title={item.name}
                        subtitle={`${item.total} entradas / ${item.lost} perdidos`}
                        metric={`${item.won} fechados`}
                        onClick={() => updateParams({ detail: 'owner', entityId: item.id, ownerId: null })}
                      />
                    ))}
                    {campaignOwnerRows.length === 0 ? <EmptyInlineState message="Nenhum vendedor encontrado nesta campanha." /> : null}
                  </div>
                </ChartCard>

                <ChartCard title="Funis desta campanha" description="Quais funis estao absorvendo melhor esta origem.">
                  <div className="space-y-2">
                    {campaignFunnelRows.map((item) => (
                      <QuickActionRow
                        key={item.id}
                        title={item.name}
                        subtitle={`${item.stageCount} etapas / ${item.ownersCount} responsaveis`}
                        metric={`${item.total} entradas`}
                        onClick={() => updateParams({ detail: 'funnel', entityId: item.id, ownerId: null })}
                      />
                    ))}
                    {campaignFunnelRows.length === 0 ? <EmptyInlineState message="Nenhum funil encontrado para esta campanha." /> : null}
                  </div>
                </ChartCard>
              </div>
            ) : null}

            {selectedFunnel ? (
              <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
                <ChartCard title="Equipe neste funil" description="Quem opera esse funil e como esta convertendo.">
                  <div className="space-y-2">
                    {funnelOwnerRows.map((item) => (
                      <QuickActionRow
                        key={item.id}
                        title={item.name}
                        subtitle={`${item.total} entradas / ${item.lost} perdidos`}
                        metric={`${item.won} fechados`}
                        onClick={() => updateParams({ detail: 'owner', entityId: item.id, ownerId: null })}
                      />
                    ))}
                    {funnelOwnerRows.length === 0 ? <EmptyInlineState message="Nenhum vendedor encontrado neste funil." /> : null}
                  </div>
                </ChartCard>

                <ChartCard title="Campanhas relacionadas" description="Campanha vinculada e origens presentes neste funil.">
                  <div className="space-y-2">
                    {funnelCampaignRows.map((item) => (
                      <QuickActionRow
                        key={item.id}
                        title={item.name}
                        subtitle={`${item.ownerCount} responsaveis / ${item.funnelCount} funis`}
                        metric={`${item.total} entradas`}
                        onClick={() => updateParams({ detail: 'campaign', entityId: item.id, ownerId: null })}
                      />
                    ))}
                    {funnelCampaignRows.length === 0 ? <EmptyInlineState message="Nenhuma campanha encontrada para este funil." /> : null}
                  </div>
                </ChartCard>
              </div>
            ) : null}
          </div>
        </section>
      ) : null}
    </div>
  );
}

function HeroMetricCard({ icon: Icon, label, value, helper }: { icon: LucideIcon; label: string; value: string | number; helper: string }) {
  return <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-4 backdrop-blur-sm"><div className="flex items-start justify-between gap-4"><div><p className="text-[10px] uppercase tracking-[0.22em] text-white/55">{label}</p><p className="mt-2 text-2xl font-black text-white">{value}</p></div><div className="rounded-xl border border-gold-500/30 bg-gold-500/15 p-3 text-gold-100"><Icon className="h-5 w-5" /></div></div><p className="mt-3 text-xs text-white/55">{helper}</p></div>;
}

function MetricCard({ icon: Icon, label, value, helper }: { icon: LucideIcon; label: string; value: string | number; helper: string }) {
  return <div className="rounded-2xl border border-border bg-card px-5 py-4 shadow-[0_16px_50px_rgba(0,0,0,0.08)]"><div className="flex items-center justify-between gap-3"><div><p className="text-[10px] uppercase tracking-[0.18em] text-gold-500/70">{label}</p><p className="mt-2 text-xl font-black text-foreground">{value}</p></div><div className="rounded-xl bg-gold-500/12 p-3 text-primary"><Icon className="h-5 w-5" /></div></div><p className="mt-3 text-xs text-muted-foreground">{helper}</p></div>;
}

function ChartCard({ title, description, actionLabel, actionValue, children }: { title: string; description: string; actionLabel?: string; actionValue?: string; children: ReactNode }) {
  return <div className="rounded-[28px] border border-border bg-card p-5 shadow-[0_22px_80px_rgba(0,0,0,0.08)]"><div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between"><div><h3 className="text-lg font-semibold text-foreground">{title}</h3><p className="mt-1 text-sm text-muted-foreground">{description}</p></div>{actionLabel && actionValue ? <div className="rounded-2xl border border-gold-500/20 bg-gold-500/10 px-3 py-2 text-right"><p className="text-[10px] uppercase tracking-[0.18em] text-gold-500/70">{actionLabel}</p><p className="mt-1 text-xs font-semibold text-foreground">{actionValue}</p></div> : null}</div><div className="mt-5">{children}</div></div>;
}

function InsightCard({ icon: Icon, title, description, metric }: { icon: LucideIcon; title: string; description: string; metric: string }) {
  return <div className="rounded-[28px] border border-border bg-card p-5 shadow-[0_18px_60px_rgba(0,0,0,0.08)]"><div className="flex items-start gap-3"><div className="rounded-2xl bg-gold-500/12 p-3 text-primary"><Icon className="h-5 w-5" /></div><div><h3 className="text-lg font-semibold text-foreground">{title}</h3><p className="mt-2 text-sm text-muted-foreground">{description}</p><p className="mt-4 text-sm font-black uppercase tracking-[0.16em] text-primary">{metric}</p></div></div></div>;
}

function RankingCard({ title, description, items }: { title: string; description: string; items: RankingItem[] }) {
  return <div className="rounded-[28px] border border-border bg-card p-5 shadow-[0_18px_60px_rgba(0,0,0,0.08)]"><h3 className="text-lg font-semibold text-foreground">{title}</h3><p className="mt-1 text-sm text-muted-foreground">{description}</p><div className="mt-5 space-y-2">{items.length === 0 ? <EmptyInlineState message="Nada para listar neste periodo." /> : null}{items.map((item) => <button key={item.id} type="button" onClick={item.onClick} className={cn('flex w-full items-center justify-between gap-4 rounded-2xl border border-border bg-background/40 px-4 py-3 text-left transition hover:border-gold-500/30 hover:bg-accent/30', !item.onClick && 'cursor-default hover:border-border hover:bg-background/40')}><div className="min-w-0"><p className="truncate text-sm font-semibold text-foreground">{item.label}</p><p className="truncate text-[11px] uppercase tracking-[0.16em] text-muted-foreground">{item.supporting}</p></div><div className="shrink-0 text-right"><p className="text-sm font-black text-foreground">{item.value}</p><p className="text-[11px] uppercase tracking-[0.16em] text-primary">{item.secondaryValue}</p></div></button>)}</div></div>;
}

function QuickActionRow({ title, subtitle, metric, onClick }: { title: string; subtitle: string; metric: string; onClick?: () => void }) {
  return <button type="button" onClick={onClick} className={cn('flex w-full items-center justify-between gap-3 rounded-2xl border border-border bg-background/30 px-4 py-3 text-left transition hover:border-gold-500/30 hover:bg-accent/30', !onClick && 'cursor-default hover:border-border hover:bg-background/30')}><div className="min-w-0"><p className="truncate text-sm font-semibold text-foreground">{title}</p><p className="truncate text-[11px] uppercase tracking-[0.16em] text-muted-foreground">{subtitle}</p></div><div className="flex items-center gap-2 shrink-0"><span className="text-xs font-black uppercase tracking-[0.16em] text-primary">{metric}</span>{onClick ? <ArrowRight className="h-4 w-4 text-primary" /> : null}</div></button>;
}

function ProgressRow({ label, value, percentage, color }: { label: string; value: number; percentage: number; color: string }) {
  return <div><div className="mb-2 flex items-center justify-between gap-3"><span className="truncate text-sm font-medium text-foreground">{label}</span><span className="shrink-0 text-xs uppercase tracking-[0.16em] text-muted-foreground">{value} / {formatPercent(percentage)}</span></div><div className="h-2 rounded-full bg-muted"><div className="h-2 rounded-full" style={{ width: `${Math.max(percentage, 4)}%`, backgroundColor: color }} /></div></div>;
}

function DetailInsightRow({ label, value }: { label: string; value: string }) {
  return <div className="rounded-2xl border border-border bg-background/30 px-4 py-3"><p className="text-[10px] uppercase tracking-[0.18em] text-gold-500/70">{label}</p><p className="mt-2 text-sm font-semibold text-foreground">{value}</p></div>;
}

function EmptyInlineState({ message }: { message: string }) {
  return <div className="rounded-2xl border border-dashed border-border px-4 py-6 text-sm text-muted-foreground">{message}</div>;
}
