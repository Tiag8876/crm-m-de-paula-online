const dashboardScopeClause = (isAdmin) => (isAdmin ? "" : "WHERE (l.owner_user_id IS NULL OR l.owner_user_id = $1)");
const dashboardScopeParams = (user, isAdmin) => (isAdmin ? [] : [user.id]);

const leadBaseCte = (scopeClause) => `
  WITH scoped_leads AS (
    SELECT l.*
    FROM leads l
    ${scopeClause}
  ),
  lead_base AS (
    SELECT
      l.id,
      l.name,
      l.phone,
      l.owner_user_id,
      l.funnel_id,
      l.stage_id,
      l.metadata,
      l.created_at,
      f.name AS funnel_name,
      COALESCE(f.operation, 'commercial') AS operation,
      CASE
        WHEN fs.semantic_key IN ('won', 'lost') THEN fs.semantic_key
        WHEN LOWER(COALESCE(fs.name, '')) LIKE '%fechad%' OR LOWER(COALESCE(fs.name, '')) LIKE '%ganh%' THEN 'won'
        WHEN LOWER(COALESCE(fs.name, '')) LIKE '%perdid%' THEN 'lost'
        ELSE COALESCE(NULLIF(fs.semantic_key, ''), 'other')
      END AS stage_semantic,
      GREATEST(
        l.created_at,
        COALESCE(l.last_interaction_at, l.created_at),
        COALESCE((
          SELECT MAX(NULLIF(note.value->>'createdAt', '')::timestamptz)
          FROM jsonb_array_elements(CASE WHEN jsonb_typeof(l.metadata->'notes') = 'array' THEN l.metadata->'notes' ELSE '[]'::jsonb END) AS note(value)
          WHERE NULLIF(note.value->>'createdAt', '') IS NOT NULL
        ), l.created_at),
        COALESCE((
          SELECT MAX(NULLIF(doc.value->>'createdAt', '')::timestamptz)
          FROM jsonb_array_elements(CASE WHEN jsonb_typeof(l.metadata->'documents') = 'array' THEN l.metadata->'documents' ELSE '[]'::jsonb END) AS doc(value)
          WHERE NULLIF(doc.value->>'createdAt', '') IS NOT NULL
        ), l.created_at),
        COALESCE((
          SELECT MAX(NULLIF(task.value->>'date', '')::timestamptz)
          FROM jsonb_array_elements(CASE WHEN jsonb_typeof(l.metadata->'tasks') = 'array' THEN l.metadata->'tasks' ELSE '[]'::jsonb END) AS task(value)
          WHERE NULLIF(task.value->>'date', '') IS NOT NULL
        ), l.created_at),
        COALESCE((
          SELECT MAX(NULLIF(followup.value->>'date', '')::timestamptz)
          FROM jsonb_array_elements(CASE WHEN jsonb_typeof(l.metadata->'followUps') = 'array' THEN l.metadata->'followUps' ELSE '[]'::jsonb END) AS followup(value)
          WHERE NULLIF(followup.value->>'date', '') IS NOT NULL
        ), l.created_at)
      ) AS last_activity_at,
      (
        SELECT COUNT(*)::int
        FROM jsonb_array_elements(CASE WHEN jsonb_typeof(l.metadata->'followUps') = 'array' THEN l.metadata->'followUps' ELSE '[]'::jsonb END) AS followup(value)
        WHERE followup.value->>'status' = 'pendente'
          AND (NULLIF(followup.value->>'date', '')::timestamptz AT TIME ZONE 'America/Sao_Paulo')::date = (NOW() AT TIME ZONE 'America/Sao_Paulo')::date
      ) AS followups_due_today,
      (
        SELECT followup.value
        FROM jsonb_array_elements(CASE WHEN jsonb_typeof(l.metadata->'followUps') = 'array' THEN l.metadata->'followUps' ELSE '[]'::jsonb END) AS followup(value)
        WHERE followup.value->>'status' = 'pendente'
          AND NULLIF(followup.value->>'date', '') IS NOT NULL
        ORDER BY NULLIF(followup.value->>'date', '')::timestamptz ASC
        LIMIT 1
      ) AS next_follow_up,
      (
        SELECT MIN(NULLIF(followup.value->>'date', '')::timestamptz)
        FROM jsonb_array_elements(CASE WHEN jsonb_typeof(l.metadata->'followUps') = 'array' THEN l.metadata->'followUps' ELSE '[]'::jsonb END) AS followup(value)
        WHERE followup.value->>'status' = 'pendente'
          AND NULLIF(followup.value->>'date', '') IS NOT NULL
      ) AS next_follow_up_at
    FROM scoped_leads l
    LEFT JOIN funnels f ON f.id = l.funnel_id
    LEFT JOIN funnel_stages fs ON fs.id = l.stage_id
  )
`;

const toNumber = (value) => Number(value || 0);
const toIso = (value) => (value instanceof Date ? value.toISOString() : value || null);

export const loadDashboardData = async (query, user, isAdmin) => {
  const scopeClause = dashboardScopeClause(isAdmin);
  const params = dashboardScopeParams(user, isAdmin);
  const cte = leadBaseCte(scopeClause);

  const [metricsResult, priorityResult, agendaResult, funnelResult] = await Promise.all([
    query(
      `${cte}
       SELECT
         COUNT(*)::int AS total,
         COUNT(*) FILTER (WHERE stage_semantic = 'won')::int AS won,
         COUNT(*) FILTER (WHERE stage_semantic NOT IN ('won', 'lost') AND last_activity_at <= NOW() - INTERVAL '24 hours')::int AS stalled,
         COALESCE(SUM(followups_due_today), 0)::int AS due_today
       FROM lead_base`,
      params,
    ),
    query(
      `${cte}
       SELECT
         id,
         name,
         phone,
         stage_id,
         owner_user_id,
         funnel_id,
         created_at,
         next_follow_up,
         next_follow_up_at,
         GREATEST(0, EXTRACT(EPOCH FROM (NOW() - last_activity_at)) / 3600) AS idle_hours,
         (next_follow_up_at < NOW() OR (next_follow_up_at IS NULL AND last_activity_at <= NOW() - INTERVAL '48 hours')) AS overdue
       FROM lead_base
       WHERE stage_semantic NOT IN ('won', 'lost')
       ORDER BY
         CASE WHEN (next_follow_up_at < NOW() OR (next_follow_up_at IS NULL AND last_activity_at <= NOW() - INTERVAL '48 hours')) THEN 0 ELSE 1 END,
         CASE WHEN next_follow_up_at IS NOT NULL THEN 0 ELSE 1 END,
         last_activity_at ASC
       LIMIT 6`,
      params,
    ),
    query(
      `${cte}
       SELECT *
       FROM (
         SELECT
           CONCAT(lb.id, '-', followup.value->>'id') AS id,
           lb.name AS label,
           'followup' AS kind,
           NULL::text AS title,
           NULLIF(followup.value->>'date', '')::timestamptz AS scheduled_at,
           CONCAT('/leads/', lb.id) AS path
         FROM lead_base lb
         CROSS JOIN LATERAL jsonb_array_elements(CASE WHEN jsonb_typeof(lb.metadata->'followUps') = 'array' THEN lb.metadata->'followUps' ELSE '[]'::jsonb END) AS followup(value)
         WHERE followup.value->>'status' = 'pendente'
           AND (NULLIF(followup.value->>'date', '')::timestamptz AT TIME ZONE 'America/Sao_Paulo')::date = (NOW() AT TIME ZONE 'America/Sao_Paulo')::date
         UNION ALL
         SELECT
           CONCAT(lb.id, '-', task.value->>'id') AS id,
           lb.name AS label,
           'task' AS kind,
           task.value->>'title' AS title,
           NULLIF(task.value->>'date', '')::timestamptz AS scheduled_at,
           CONCAT('/leads/', lb.id) AS path
         FROM lead_base lb
         CROSS JOIN LATERAL jsonb_array_elements(CASE WHEN jsonb_typeof(lb.metadata->'tasks') = 'array' THEN lb.metadata->'tasks' ELSE '[]'::jsonb END) AS task(value)
         WHERE task.value->>'status' = 'pendente'
           AND (NULLIF(task.value->>'date', '')::timestamptz AT TIME ZONE 'America/Sao_Paulo')::date = (NOW() AT TIME ZONE 'America/Sao_Paulo')::date
       ) agenda
       ORDER BY scheduled_at ASC
       LIMIT 6`,
      params,
    ),
    query(
      `${cte}
       SELECT
         funnel_id AS id,
         funnel_name AS name,
         operation,
         COUNT(*)::int AS total,
         COUNT(*) FILTER (WHERE stage_semantic NOT IN ('won', 'lost') AND last_activity_at <= NOW() - INTERVAL '24 hours')::int AS stalled,
         COUNT(*) FILTER (WHERE stage_semantic = 'won')::int AS won
       FROM lead_base
       WHERE funnel_id IS NOT NULL
       GROUP BY funnel_id, funnel_name, operation
       HAVING COUNT(*) > 0
       ORDER BY COUNT(*) DESC
       LIMIT 4`,
      params,
    ),
  ]);

  const metricsRow = metricsResult.rows[0] || {};
  const total = toNumber(metricsRow.total);
  const won = toNumber(metricsRow.won);

  return {
    metrics: {
      total,
      won,
      stalled: toNumber(metricsRow.stalled),
      dueToday: toNumber(metricsRow.due_today),
      conversion: total > 0 ? (won / total) * 100 : 0,
    },
    priorityQueue: priorityResult.rows.map((row) => ({
      id: row.id,
      name: row.name,
      subtitle: row.phone || "",
      status: row.stage_id || "",
      createdAt: toIso(row.created_at),
      detailPath: `/leads/${row.id}`,
      funnelId: row.funnel_id || undefined,
      ownerUserId: row.owner_user_id || undefined,
      idleHours: toNumber(row.idle_hours),
      nextFollowUp: row.next_follow_up || null,
      overdue: Boolean(row.overdue),
    })),
    agenda: agendaResult.rows.map((row) => ({
      id: row.id,
      label: row.label,
      kind: row.kind,
      title: row.title || "",
      scheduledAt: toIso(row.scheduled_at),
      path: row.path,
    })),
    funnelHighlights: funnelResult.rows.map((row) => ({
      id: row.id,
      name: row.name || "Sem funil",
      operation: row.operation || "commercial",
      total: toNumber(row.total),
      stalled: toNumber(row.stalled),
      won: toNumber(row.won),
    })),
  };
};
