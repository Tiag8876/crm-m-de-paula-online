const DEFAULT_METADATA = {
  notes: [],
  followUps: [],
  tasks: [],
  logs: [],
  documents: [],
  customFields: {},
  aiInsight: null,
};

const parseJson = (value, fallback) => {
  if (value === null || value === undefined) return fallback;
  if (typeof value === "object") return value;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
};

const asArray = (value) => (Array.isArray(value) ? value : []);
const asObject = (value) => (value && typeof value === "object" && !Array.isArray(value) ? value : {});

const normalizeLeadMetadata = (lead = {}) => ({
  notes: asArray(lead.notes),
  followUps: asArray(lead.followUps),
  tasks: asArray(lead.tasks),
  logs: asArray(lead.logs),
  documents: asArray(lead.documents),
  customFields: asObject(lead.customFields),
  aiInsight: typeof lead.aiInsight === "string" ? lead.aiInsight : null,
});

const mapFunnelRow = (funnelRow, stageRows) => ({
  id: funnelRow.id,
  name: funnelRow.name,
  description: funnelRow.description || undefined,
  operation: funnelRow.operation || "commercial",
  areaOfLawId: funnelRow.area_of_law_id || undefined,
  linkedCampaignId: funnelRow.linked_campaign_id || undefined,
  stages: stageRows
    .filter((stage) => stage.funnel_id === funnelRow.id)
    .sort((a, b) => a.position - b.position)
    .map((stage) => ({
      id: stage.id,
      name: stage.name,
      color: stage.color,
      order: stage.position,
      semanticKey: stage.semantic_key || undefined,
    })),
  fieldSchema: asArray(parseJson(funnelRow.field_schema, [])),
  objections: asArray(parseJson(funnelRow.objections, [])),
  playbook: funnelRow.playbook || "",
  createdAt: new Date(funnelRow.created_at).toISOString(),
  updatedAt: new Date(funnelRow.updated_at).toISOString(),
});

const mapLeadRow = (row) => {
  const metadata = {
    ...DEFAULT_METADATA,
    ...asObject(parseJson(row.metadata, {})),
  };

  return {
    id: row.id,
    name: row.name,
    phone: row.phone || "",
    email: row.email || undefined,
    cpf: row.cpf || undefined,
    status: row.stage_id || "",
    ownerUserId: row.owner_user_id || undefined,
    lossReasonCode: row.loss_reason_code || undefined,
    lossReasonDetail: row.loss_reason_detail || undefined,
    campaignId: row.campaign_id || undefined,
    adGroupId: row.ad_group_id || undefined,
    adId: row.ad_id || undefined,
    areaOfLawId: row.area_of_law_id || undefined,
    serviceId: row.service_id || undefined,
    serviceIds: asArray(row.service_ids),
    sourceId: row.source_id || undefined,
    sourceDetails: row.source_details || undefined,
    funnelId: row.funnel_id || undefined,
    notes: asArray(metadata.notes),
    followUps: asArray(metadata.followUps),
    tasks: asArray(metadata.tasks),
    logs: asArray(metadata.logs),
    documents: asArray(metadata.documents),
    createdAt: new Date(row.created_at).toISOString(),
    lastInteractionAt: row.last_interaction_at ? new Date(row.last_interaction_at).toISOString() : undefined,
    estimatedValue: Number(row.contract_value || 0),
    legalArea: row.legal_area || undefined,
    aiInsight: typeof metadata.aiInsight === "string" ? metadata.aiInsight : undefined,
    customFields: asObject(metadata.customFields),
  };
};

const mapActivityRow = (row) => ({
  id: row.id,
  leadId: row.lead_id,
  type: row.type,
  description: row.description || "",
  metadata: asObject(parseJson(row.metadata, {})),
  createdBy: row.created_by || undefined,
  createdAt: new Date(row.created_at).toISOString(),
});

const mapReceivableRow = (row) => {
  const dueDate = row.due_date ? new Date(row.due_date) : null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const computedStatus = row.status === "pending" && dueDate && dueDate < today ? "overdue" : row.status;

  return {
    id: row.id,
    leadId: row.lead_id,
    description: row.description,
    amount: Number(row.amount || 0),
    dueDate: row.due_date,
    paidDate: row.paid_date,
    status: computedStatus,
    paymentMethod: row.payment_method || undefined,
    invoiceNumber: row.invoice_number || undefined,
    notes: row.notes || undefined,
    createdAt: new Date(row.created_at).toISOString(),
    updatedAt: new Date(row.updated_at).toISOString(),
  };
};

export const runProperSchemaMigration = async (query) => {
  await query(`CREATE EXTENSION IF NOT EXISTS pgcrypto;`);
  await query(`
    CREATE TABLE IF NOT EXISTS funnels (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      name TEXT NOT NULL,
      color TEXT DEFAULT '#d4af37',
      position INTEGER DEFAULT 0,
      operation TEXT NOT NULL DEFAULT 'commercial',
      description TEXT,
      area_of_law_id TEXT,
      linked_campaign_id TEXT,
      field_schema JSONB NOT NULL DEFAULT '[]'::jsonb,
      objections JSONB NOT NULL DEFAULT '[]'::jsonb,
      playbook TEXT,
      metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS funnel_stages (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      funnel_id UUID NOT NULL REFERENCES funnels(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      position INTEGER DEFAULT 0,
      color TEXT DEFAULT '#6b7280',
      semantic_key TEXT DEFAULT 'other',
      metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS leads (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      funnel_id UUID REFERENCES funnels(id) ON DELETE SET NULL,
      stage_id UUID REFERENCES funnel_stages(id) ON DELETE SET NULL,
      owner_user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
      name TEXT NOT NULL,
      email TEXT,
      phone TEXT,
      company TEXT,
      cpf TEXT,
      legal_area TEXT,
      campaign_id TEXT,
      ad_group_id TEXT,
      ad_id TEXT,
      area_of_law_id TEXT,
      service_id TEXT,
      service_ids TEXT[] DEFAULT '{}',
      source_id TEXT,
      source_details TEXT,
      loss_reason_code TEXT,
      loss_reason_detail TEXT,
      notes TEXT,
      tags TEXT[] DEFAULT '{}',
      contract_value NUMERIC(15,2) DEFAULT 0,
      contract_currency TEXT DEFAULT 'BRL',
      last_interaction_at TIMESTAMPTZ,
      metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS lead_activities (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      lead_id UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
      type TEXT NOT NULL,
      description TEXT,
      metadata JSONB DEFAULT '{}'::jsonb,
      created_by TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS receivables (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      lead_id UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
      description TEXT NOT NULL,
      amount NUMERIC(15,2) NOT NULL,
      due_date DATE NOT NULL,
      paid_date DATE,
      status TEXT NOT NULL DEFAULT 'pending',
      payment_method TEXT,
      invoice_number TEXT,
      notes TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE INDEX IF NOT EXISTS idx_leads_funnel_id ON leads(funnel_id);
    CREATE INDEX IF NOT EXISTS idx_leads_stage_id ON leads(stage_id);
    CREATE INDEX IF NOT EXISTS idx_receivables_lead_id ON receivables(lead_id);
    CREATE INDEX IF NOT EXISTS idx_receivables_status ON receivables(status);
    CREATE INDEX IF NOT EXISTS idx_receivables_due_date ON receivables(due_date);
  `);
};

export const loadFunnelsFromDb = async (query) => {
  const funnelsResult = await query(`SELECT * FROM funnels ORDER BY position ASC, created_at ASC`);
  const stagesResult = await query(`SELECT * FROM funnel_stages ORDER BY position ASC, created_at ASC`);
  return funnelsResult.rows.map((row) => mapFunnelRow(row, stagesResult.rows));
};

export const loadLeadsFromDb = async (query, filters = {}) => {
  const clauses = [];
  const params = [];
  if (filters.funnelId) {
    params.push(filters.funnelId);
    clauses.push(`funnel_id = $${params.length}`);
  }
  if (filters.stageId) {
    params.push(filters.stageId);
    clauses.push(`stage_id = $${params.length}`);
  }
  if (filters.leadId) {
    params.push(filters.leadId);
    clauses.push(`id = $${params.length}`);
  }
  const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
  const result = await query(`SELECT * FROM leads ${where} ORDER BY created_at DESC`, params);
  return result.rows.map(mapLeadRow);
};

export const loadLeadDetailsFromDb = async (query, leadId) => {
  const leadResult = await query(`SELECT * FROM leads WHERE id = $1`, [leadId]);
  if (!leadResult.rows[0]) return null;
  const activitiesResult = await query(`SELECT * FROM lead_activities WHERE lead_id = $1 ORDER BY created_at DESC`, [leadId]);
  const receivablesResult = await query(`SELECT * FROM receivables WHERE lead_id = $1 ORDER BY due_date ASC, created_at ASC`, [leadId]);
  return {
    lead: mapLeadRow(leadResult.rows[0]),
    activities: activitiesResult.rows.map(mapActivityRow),
    receivables: receivablesResult.rows.map(mapReceivableRow),
  };
};

export const loadReceivablesSummary = async (query) => {
  const totalsResult = await query(`
    SELECT
      COALESCE(SUM(CASE WHEN status = 'pending' AND due_date >= CURRENT_DATE THEN amount ELSE 0 END), 0) AS total_pending,
      COALESCE(SUM(CASE WHEN status = 'paid' THEN amount ELSE 0 END), 0) AS total_paid,
      COALESCE(SUM(CASE WHEN status = 'pending' AND due_date < CURRENT_DATE THEN amount ELSE 0 END), 0) AS total_overdue
    FROM receivables
  `);
  const groupedResult = await query(`
    SELECT
      TO_CHAR(DATE_TRUNC('month', due_date), 'YYYY-MM') AS month_key,
      COALESCE(SUM(CASE WHEN status = 'pending' AND due_date >= CURRENT_DATE THEN amount ELSE 0 END), 0) AS total_pending,
      COALESCE(SUM(CASE WHEN status = 'paid' THEN amount ELSE 0 END), 0) AS total_paid,
      COALESCE(SUM(CASE WHEN status = 'pending' AND due_date < CURRENT_DATE THEN amount ELSE 0 END), 0) AS total_overdue
    FROM receivables
    GROUP BY DATE_TRUNC('month', due_date)
    ORDER BY DATE_TRUNC('month', due_date) ASC
  `);

  return {
    totals: {
      pending: Number(totalsResult.rows[0]?.total_pending || 0),
      paid: Number(totalsResult.rows[0]?.total_paid || 0),
      overdue: Number(totalsResult.rows[0]?.total_overdue || 0),
    },
    byMonth: groupedResult.rows.map((row) => ({
      month: row.month_key,
      pending: Number(row.total_pending || 0),
      paid: Number(row.total_paid || 0),
      overdue: Number(row.total_overdue || 0),
    })),
  };
};

export const buildLegacyStateFromRelational = async (query, baseState) => {
  const [funnels, leads] = await Promise.all([loadFunnelsFromDb(query), loadLeadsFromDb(query)]);
  return {
    ...baseState,
    funnels,
    leads,
  };
};

export const syncFunnelsFromLegacyState = async (client, incomingFunnels = []) => {
  const funnelIds = new Set();
  for (const [position, funnel] of incomingFunnels.entries()) {
    if (!funnel?.id) continue;
    funnelIds.add(funnel.id);
    await client.query(
      `INSERT INTO funnels (id, name, color, position, operation, description, area_of_law_id, linked_campaign_id, field_schema, objections, playbook, metadata, created_at, updated_at)
       VALUES ($1, $2, COALESCE($3, '#d4af37'), $4, $5, $6, $7, $8, $9::jsonb, $10::jsonb, $11, $12::jsonb, $13, $14)
       ON CONFLICT (id) DO UPDATE SET
         name = EXCLUDED.name,
         color = EXCLUDED.color,
         position = EXCLUDED.position,
         operation = EXCLUDED.operation,
         description = EXCLUDED.description,
         area_of_law_id = EXCLUDED.area_of_law_id,
         linked_campaign_id = EXCLUDED.linked_campaign_id,
         field_schema = EXCLUDED.field_schema,
         objections = EXCLUDED.objections,
         playbook = EXCLUDED.playbook,
         metadata = EXCLUDED.metadata,
         updated_at = EXCLUDED.updated_at`,
      [
        funnel.id,
        funnel.name,
        funnel.color || null,
        position,
        funnel.operation || "commercial",
        funnel.description || null,
        funnel.areaOfLawId || null,
        funnel.linkedCampaignId || null,
        JSON.stringify(asArray(funnel.fieldSchema)),
        JSON.stringify(asArray(funnel.objections)),
        funnel.playbook || null,
        JSON.stringify({}),
        funnel.createdAt || new Date().toISOString(),
        funnel.updatedAt || new Date().toISOString(),
      ],
    );

    const stageIds = new Set();
    for (const [stagePosition, stage] of asArray(funnel.stages).entries()) {
      if (!stage?.id) continue;
      stageIds.add(stage.id);
      await client.query(
        `INSERT INTO funnel_stages (id, funnel_id, name, position, color, semantic_key, metadata, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, '{}'::jsonb, $7, $8)
         ON CONFLICT (id) DO UPDATE SET
           funnel_id = EXCLUDED.funnel_id,
           name = EXCLUDED.name,
           position = EXCLUDED.position,
           color = EXCLUDED.color,
           semantic_key = EXCLUDED.semantic_key,
           updated_at = EXCLUDED.updated_at`,
        [
          stage.id,
          funnel.id,
          stage.name,
          stage.order ?? stagePosition,
          stage.color || "#6b7280",
          stage.semanticKey || "other",
          funnel.createdAt || new Date().toISOString(),
          funnel.updatedAt || new Date().toISOString(),
        ],
      );
    }

    await client.query(`DELETE FROM funnel_stages WHERE funnel_id = $1 AND NOT (id = ANY($2::uuid[]))`, [funnel.id, [...stageIds]]);
  }

  if (funnelIds.size > 0) {
    await client.query(`DELETE FROM funnels WHERE NOT (id = ANY($1::uuid[]))`, [[...funnelIds]]);
  }
};

export const syncLeadsFromLegacyState = async (client, incomingLeads = [], actorUserId, isAdmin = false) => {
  const editableResult = isAdmin
    ? await client.query(`SELECT id FROM leads`)
    : await client.query(`SELECT id FROM leads WHERE owner_user_id = $1 OR owner_user_id IS NULL`, [actorUserId]);

  const editableIds = new Set(editableResult.rows.map((row) => row.id));
  const incomingIds = new Set();

  for (const lead of incomingLeads) {
    if (!lead?.id) continue;
    incomingIds.add(lead.id);
    await client.query(
      `INSERT INTO leads (
        id, funnel_id, stage_id, owner_user_id, name, email, phone, cpf, legal_area, campaign_id, ad_group_id, ad_id,
        area_of_law_id, service_id, service_ids, source_id, source_details, loss_reason_code, loss_reason_detail,
        contract_value, contract_currency, last_interaction_at, metadata, created_at, updated_at
      )
      VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12,
        $13, $14, $15::text[], $16, $17, $18, $19,
        $20, 'BRL', $21, $22::jsonb, $23, $24
      )
      ON CONFLICT (id) DO UPDATE SET
        funnel_id = EXCLUDED.funnel_id,
        stage_id = EXCLUDED.stage_id,
        owner_user_id = EXCLUDED.owner_user_id,
        name = EXCLUDED.name,
        email = EXCLUDED.email,
        phone = EXCLUDED.phone,
        cpf = EXCLUDED.cpf,
        legal_area = EXCLUDED.legal_area,
        campaign_id = EXCLUDED.campaign_id,
        ad_group_id = EXCLUDED.ad_group_id,
        ad_id = EXCLUDED.ad_id,
        area_of_law_id = EXCLUDED.area_of_law_id,
        service_id = EXCLUDED.service_id,
        service_ids = EXCLUDED.service_ids,
        source_id = EXCLUDED.source_id,
        source_details = EXCLUDED.source_details,
        loss_reason_code = EXCLUDED.loss_reason_code,
        loss_reason_detail = EXCLUDED.loss_reason_detail,
        contract_value = EXCLUDED.contract_value,
        last_interaction_at = EXCLUDED.last_interaction_at,
        metadata = EXCLUDED.metadata,
        updated_at = EXCLUDED.updated_at`,
      [
        lead.id,
        lead.funnelId || null,
        lead.status || null,
        lead.ownerUserId || null,
        lead.name,
        lead.email || null,
        lead.phone || null,
        lead.cpf || null,
        lead.legalArea || null,
        lead.campaignId || null,
        lead.adGroupId || null,
        lead.adId || null,
        lead.areaOfLawId || null,
        lead.serviceId || null,
        asArray(lead.serviceIds),
        lead.sourceId || null,
        lead.sourceDetails || null,
        lead.lossReasonCode || null,
        lead.lossReasonDetail || null,
        Number(lead.estimatedValue || 0),
        lead.lastInteractionAt || null,
        JSON.stringify(normalizeLeadMetadata(lead)),
        lead.createdAt || new Date().toISOString(),
        lead.lastInteractionAt || lead.createdAt || new Date().toISOString(),
      ],
    );
  }

  const removableIds = [...editableIds].filter((id) => !incomingIds.has(id));
  if (removableIds.length > 0) {
    await client.query(`DELETE FROM leads WHERE id = ANY($1::uuid[])`, [removableIds]);
  }
};

export const migrateFromLegacyBlobState = async (client, state) => {
  const normalizedState = parseJson(state, {});
  await syncFunnelsFromLegacyState(client, asArray(normalizedState.funnels));
  await syncLeadsFromLegacyState(client, asArray(normalizedState.leads), null, true);
};

export const parseLegacyState = (rawState, fallback) => parseJson(rawState, fallback);
export const serializeReceivableRow = mapReceivableRow;
export const serializeActivityRow = mapActivityRow;
