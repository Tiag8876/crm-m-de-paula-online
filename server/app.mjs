import express from "express";
import cors from "cors";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { randomUUID } from "node:crypto";
import { Pool } from "pg";
import { runRelationalTablesMigration } from "./migrate.mjs";
import {
  buildLegacyStateFromRelational,
  loadFunnelsFromDb,
  loadLeadDetailsFromDb,
  loadLeadsFromDb,
  loadReceivablesSummary,
  parseLegacyState,
  runProperSchemaMigration,
  serializeActivityRow,
  serializeReceivableRow,
  syncFunnelsFromLegacyState,
  syncLeadsFromLegacyState,
} from "./relational-crm.mjs";

const app = express();
const port = Number(process.env.API_PORT || 3001);
const jwtSecret = process.env.JWT_SECRET || "lawcrm-dev-secret-change-this";
const tokenExpiresIn = "12h";
const databaseUrl = process.env.DATABASE_URL || process.env.POSTGRES_URL || process.env.POSTGRES_PRISMA_URL || "";
const allowPublicSetup = process.env.ALLOW_PUBLIC_SETUP === "true";
const bootstrapAdmin = {
  name: (process.env.ADMIN_BOOTSTRAP_NAME || "").trim(),
  email: (process.env.ADMIN_BOOTSTRAP_EMAIL || "").trim().toLowerCase(),
  password: (process.env.ADMIN_BOOTSTRAP_PASSWORD || "").trim(),
};
const fallbackBootstrapName = "Administrador do Sistema";

let pool = null;
let databaseReadyPromise = null;

const DEFAULT_STAGES = [
  { id: "novo", name: "Novo Lead", color: "#D4AF37", order: 0 },
  { id: "em_contato", name: "Em Contato", color: "#3B82F6", order: 1 },
  { id: "aguardando_resposta", name: "Aguardando Resposta", color: "#F59E0B", order: 2 },
  { id: "reuniao_agendada", name: "Reuniao Agendada", color: "#8B5CF6", order: 3 },
  { id: "fechado", name: "Contrato Fechado", color: "#10B981", order: 4 },
  { id: "perdido", name: "Perdido", color: "#EF4444", order: 5 },
];

const DEFAULT_PROSPECT_STAGES = [
  { id: "p_novo", name: "Novo Cadastro", color: "#D4AF37", order: 0 },
  { id: "p_primeira_ligacao", name: "Primeira Ligacao", color: "#3B82F6", order: 1 },
  { id: "p_sem_contato", name: "Sem Contato", color: "#F59E0B", order: 2 },
  { id: "p_retorno", name: "Retorno Agendado", color: "#8B5CF6", order: 3 },
  { id: "p_qualificada", name: "Qualificada", color: "#06B6D4", order: 4 },
  { id: "p_proposta", name: "Proposta Enviada", color: "#6366F1", order: 5 },
  { id: "p_negociacao", name: "Negociacao", color: "#EC4899", order: 6 },
  { id: "p_fechada", name: "Fechada", color: "#10B981", order: 7 },
  { id: "p_perdida", name: "Perdida", color: "#EF4444", order: 8 },
  { id: "p_inspecao", name: "Inspecao", color: "#22C55E", order: 9 },
];

const buildDefaultState = () => ({
  leads: [],
  campaigns: [],
  adGroups: [],
  ads: [],
  areasOfLaw: [],
  services: [],
  standardTasks: [],
  kanbanStages: DEFAULT_STAGES,
  prospectLeads: [],
  prospectKanbanStages: DEFAULT_PROSPECT_STAGES,
  prospectObjections: [
    "Sem orcamento no momento",
    "Ja possui assessoria",
    "Sem tempo para implementar agora",
    "Nao viu valor na proposta",
  ],
  prospectPlaybook:
    "1) Abertura: confirme nome da clinica e responsavel.\n" +
    "2) Diagnostico: pergunte sobre desafios juridicos e sanitarios atuais.\n" +
    "3) Valor: explique como a assessoria reduz risco e organiza a operacao.\n" +
    "4) Objecoes: registre motivo e avance para proximo passo.\n" +
    "5) Fechamento: agende retorno com data e hora.",
  dailyInsight: null,
});

const parseStateSafely = (rawState) => {
  if (!rawState) return buildDefaultState();
  if (typeof rawState === "object") return rawState;
  try {
    return JSON.parse(rawState);
  } catch {
    return buildDefaultState();
  }
};

const serializeTimestamp = (value) => {
  if (!value) return null;
  if (value instanceof Date) return value.toISOString();
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return String(value);
  return parsed.toISOString();
};

const getEntitySyncTimestamp = (item) => {
  if (!item || typeof item !== "object") return null;
  return serializeTimestamp(item.lastInteractionAt || item.updatedAt || item.createdAt || null);
};

const isIncomingEntityNewer = (existingItem, incomingItem) => {
  const existingTime = getEntitySyncTimestamp(existingItem);
  const incomingTime = getEntitySyncTimestamp(incomingItem);

  if (!incomingTime) return true;
  if (!existingTime) return true;

  return new Date(incomingTime).getTime() >= new Date(existingTime).getTime();
};

const isDatabaseConfigured = () => Boolean(databaseUrl);

const withUtf8ConnectionString = (rawUrl) => {
  try {
    const parsed = new URL(rawUrl);
    parsed.searchParams.set("client_encoding", "UTF8");
    return parsed.toString();
  } catch {
    return rawUrl;
  }
};

const sendError = (res, status, message, code) =>
  res.status(status).json({
    error: true,
    message,
    code,
  });

const sanitizeText = (value) => {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
};

const asNumericValue = (value) => {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : 0;
};

const normalizeDateOnly = (value) => {
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString().slice(0, 10);
};

const normalizeSemanticActivityDescription = (previousFunnelName, nextFunnelName, previousStageName, nextStageName) => {
  if (previousFunnelName && nextFunnelName && previousFunnelName !== nextFunnelName) {
    return `Lead movido do funil '${previousFunnelName}' para o funil '${nextFunnelName}'`;
  }
  if (previousStageName && nextStageName && previousStageName !== nextStageName) {
    return `Lead movido da etapa '${previousStageName}' para '${nextStageName}'`;
  }
  return "Lead movimentado no funil";
};

const createPool = () => {
  if (!databaseUrl) {
    throw new Error("DATABASE_URL nao configurada.");
  }

  const useSsl = !/(localhost|127\.0\.0\.1)/i.test(databaseUrl);
  return new Pool({
    connectionString: withUtf8ConnectionString(databaseUrl),
    ssl: useSsl ? { rejectUnauthorized: false } : false,
    max: 10,
  });
};

const getPool = () => {
  if (!pool) {
    pool = createPool();
    pool.on("connect", (client) => {
      void client.query("SET client_encoding TO 'UTF8'");
    });
  }
  return pool;
};

const query = async (text, params = []) => getPool().query(text, params);

const withTransaction = async (callback) => {
  const client = await getPool().connect();
  try {
    await client.query("BEGIN");
    const result = await callback(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
};

const runMigrations = async () => {
  await query(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      avatar_url TEXT,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL CHECK (role IN ('admin','user')),
      sector TEXT NOT NULL,
      active BOOLEAN NOT NULL DEFAULT TRUE,
      created_at TIMESTAMPTZ NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL
    );

    CREATE TABLE IF NOT EXISTS app_state (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      state_json JSONB NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL,
      updated_by TEXT REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS audit_logs (
      id TEXT PRIMARY KEY,
      user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
      action TEXT NOT NULL,
      details TEXT,
      created_at TIMESTAMPTZ NOT NULL
    );

    CREATE TABLE IF NOT EXISTS state_revisions (
      id TEXT PRIMARY KEY,
      state_json JSONB NOT NULL,
      created_at TIMESTAMPTZ NOT NULL,
      updated_by TEXT REFERENCES users(id) ON DELETE SET NULL
    );
  `);

  await query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_url TEXT`);
  await runProperSchemaMigration(query);
  await runRelationalTablesMigration(query);

  await query(
    `INSERT INTO app_state (id, state_json, updated_at, updated_by)
     VALUES (1, $1::jsonb, $2, NULL)
     ON CONFLICT (id) DO NOTHING`,
    [JSON.stringify(buildDefaultState()), new Date().toISOString()]
  );
};

const getMissingBootstrapFields = () => {
  const missing = [];
  if (!bootstrapAdmin.email) missing.push("ADMIN_BOOTSTRAP_EMAIL");
  if (!bootstrapAdmin.password) missing.push("ADMIN_BOOTSTRAP_PASSWORD");
  return missing;
};

const getBootstrapAdminName = () => bootstrapAdmin.name || fallbackBootstrapName;

const shouldBootstrapAdmin = () => getMissingBootstrapFields().length === 0;

const seedInitialAdminIfConfigured = async () => {
  if (!shouldBootstrapAdmin()) return false;

  const existingUsers = await query("SELECT COUNT(*)::int AS count FROM users");
  if (Number(existingUsers.rows[0]?.count || 0) > 0) {
    return false;
  }

  const now = new Date().toISOString();
  const adminId = randomUUID();

  await withTransaction(async (client) => {
    await client.query(
      `INSERT INTO users (id, name, email, password_hash, role, sector, active, created_at, updated_at)
       VALUES ($1, $2, $3, $4, 'admin', 'Diretoria', TRUE, $5, $6)`,
      [adminId, getBootstrapAdminName(), bootstrapAdmin.email, bcrypt.hashSync(bootstrapAdmin.password, 10), now, now]
    );

    await client.query(
      `INSERT INTO app_state (id, state_json, updated_at, updated_by)
       VALUES (1, $1::jsonb, $2, $3)
       ON CONFLICT (id) DO UPDATE SET state_json = EXCLUDED.state_json, updated_at = EXCLUDED.updated_at, updated_by = EXCLUDED.updated_by`,
      [JSON.stringify(buildDefaultState()), now, adminId]
    );

    await audit(adminId, "bootstrap_admin_created", "Administrador inicial provisionado por ambiente", client.query.bind(client));
  });

  return true;
};

const ensureDatabaseReady = async () => {
  if (!isDatabaseConfigured()) {
    throw new Error("DATABASE_URL nao configurada.");
  }

  if (!databaseReadyPromise) {
    databaseReadyPromise = (async () => {
      await runMigrations();
      await seedInitialAdminIfConfigured();
    })().catch((error) => {
      databaseReadyPromise = null;
      throw error;
    });
  }

  await databaseReadyPromise;
};

app.use(cors());
app.use(express.json({ limit: "15mb" }));
app.use((_req, res, next) => {
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
  res.setHeader("Pragma", "no-cache");
  res.setHeader("Expires", "0");
  next();
});

const toPublicUser = (row) => ({
  id: row.id,
  name: row.name,
  email: row.email,
  avatarUrl: row.avatar_url || undefined,
  role: row.role,
  sector: row.sector,
  active: Boolean(row.active),
  createdAt: serializeTimestamp(row.created_at),
  updatedAt: serializeTimestamp(row.updated_at),
});

const isSystemAdmin = (user) => {
  if (!user) return false;
  if (user.role === "admin") return true;
  const sector = String(user.sector || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9 ]/g, "")
    .toLowerCase()
    .trim();

  if (/(comerc|venda|vendedor|traf|midia|marketing)/.test(sector)) {
    return false;
  }

  if (/(diret|admin|propriet|owner)/.test(sector)) {
    return true;
  }

  if (/(gest|gerenc)/.test(sector)) {
    return true;
  }

  return false;
};

const scopedStateForUser = (state, user) => {
  if (isSystemAdmin(user)) {
    return state;
  }

  const userId = user.id;
  const leads = Array.isArray(state?.leads)
    ? state.leads.filter((lead) => !lead?.ownerUserId || lead?.ownerUserId === userId)
    : [];
  const prospectLeads = Array.isArray(state?.prospectLeads)
    ? state.prospectLeads.filter((lead) => !lead?.ownerUserId || lead?.ownerUserId === userId)
    : [];
  const allowedLeadIds = new Set(leads.map((lead) => lead.id));

  return {
    ...state,
    leads,
    prospectLeads,
    notifications: Array.isArray(state?.notifications)
      ? state.notifications.filter((item) => item?.leadId && allowedLeadIds.has(item.leadId))
      : [],
  };
};

const mergeOwnedEntities = (existingItems, incomingItems, userId) => {
  const existing = Array.isArray(existingItems) ? existingItems : [];
  const incoming = Array.isArray(incomingItems) ? incomingItems : [];

  const incomingById = new Map(incoming.filter((item) => item?.id).map((item) => [item.id, item]));
  const next = [];
  for (const item of existing) {
    const canEdit = item?.ownerUserId === userId || !item?.ownerUserId;
    if (!canEdit) {
      next.push(item);
      continue;
    }
    const incomingVersion = incomingById.get(item.id);
    if (!incomingVersion) {
      continue;
    }
    if (!isIncomingEntityNewer(item, incomingVersion)) {
      next.push(item);
      continue;
    }
    const nextOwner = Object.prototype.hasOwnProperty.call(incomingVersion, "ownerUserId")
      ? incomingVersion?.ownerUserId || undefined
      : item?.ownerUserId || undefined;
    next.push({ ...incomingVersion, ownerUserId: nextOwner });
  }

  for (const item of incoming) {
    if (!item?.id) continue;
    const exists = existing.some((current) => current?.id === item.id);
    if (exists) continue;
    next.push({ ...item, ownerUserId: item?.ownerUserId || userId });
  }

  return next;
};

const mergeEntitiesById = (existingItems, incomingItems) => {
  const existing = Array.isArray(existingItems) ? existingItems : [];
  const incoming = Array.isArray(incomingItems) ? incomingItems : [];
  const next = [];

  for (const item of incoming) {
    if (!item?.id) continue;
    const current = existing.find((existingItem) => existingItem?.id === item.id);
    if (!current || isIncomingEntityNewer(current, item)) {
      next.push(item);
      continue;
    }
    next.push(current);
  }

  return next;
};

const mergeStateForUser = (currentState, incomingState, user) => {
  if (isSystemAdmin(user)) {
    return {
      ...currentState,
      ...incomingState,
      leads: mergeEntitiesById(currentState?.leads, incomingState?.leads),
      prospectLeads: mergeEntitiesById(currentState?.prospectLeads, incomingState?.prospectLeads),
    };
  }

  return {
    ...currentState,
    leads: mergeOwnedEntities(currentState?.leads, incomingState?.leads, user.id),
    prospectLeads: mergeOwnedEntities(currentState?.prospectLeads, incomingState?.prospectLeads, user.id),
  };
};

const audit = async (userId, action, details = null, executor = query) => {
  await executor(
    "INSERT INTO audit_logs (id, user_id, action, details, created_at) VALUES ($1, $2, $3, $4, $5)",
    [randomUUID(), userId || null, action, details, new Date().toISOString()]
  );
};

const signToken = (user) => jwt.sign(
  {
    sub: user.id,
    role: user.role,
    email: user.email,
  },
  jwtSecret,
  { expiresIn: tokenExpiresIn }
);

const ensureLeadPermission = (leadRow, user) => {
  if (!leadRow) return { allowed: false, reason: "Lead nao encontrado", status: 404, code: "LEAD_NOT_FOUND" };
  if (isSystemAdmin(user)) return { allowed: true };
  if (!leadRow.owner_user_id || leadRow.owner_user_id === user.id) return { allowed: true };
  return { allowed: false, reason: "Voce nao tem acesso a este lead", status: 403, code: "LEAD_FORBIDDEN" };
};

const findLeadRow = async (leadId) => {
  const result = await query("SELECT * FROM leads WHERE id = $1", [leadId]);
  return result.rows[0] || null;
};

const findFunnelsSnapshot = async () => {
  const funnels = await loadFunnelsFromDb(query);
  return {
    funnels,
    stagesById: new Map(funnels.flatMap((funnel) => funnel.stages.map((stage) => [stage.id, { ...stage, funnelId: funnel.id, funnelName: funnel.name }]))),
    funnelsById: new Map(funnels.map((funnel) => [funnel.id, funnel])),
  };
};

app.get(["/api/health", "/health"], async (_req, res) => {
  if (!isDatabaseConfigured()) {
    return sendError(res, 503, "DATABASE_URL nao configurada", "DATABASE_NOT_CONFIGURED");
  }

  try {
    await ensureDatabaseReady();
    return res.json({ ok: true, database: "connected", mode: "online" });
  } catch (error) {
    return sendError(res, 503, error instanceof Error ? error.message : "Banco indisponivel", "DATABASE_UNAVAILABLE");
  }
});

app.use(async (_req, _res, next) => {
  try {
    await ensureDatabaseReady();
    next();
  } catch (error) {
    next(error);
  }
});

const authRequired = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return sendError(res, 401, "Nao autenticado", "AUTH_REQUIRED");
  }

  const token = authHeader.slice(7);
  try {
    const payload = jwt.verify(token, jwtSecret);
    const { rows } = await query("SELECT * FROM users WHERE id = $1", [payload.sub]);
    const user = rows[0];
    if (!user || !user.active) {
      return sendError(res, 401, "Sessao invalida", "INVALID_SESSION");
    }
    req.user = toPublicUser(user);
    return next();
  } catch {
    return sendError(res, 401, "Token invalido", "INVALID_TOKEN");
  }
};

const adminRequired = (req, res, next) => {
  if (!isSystemAdmin(req.user)) {
    return sendError(res, 403, "Acesso restrito ao administrador", "ADMIN_REQUIRED");
  }
  return next();
};

app.get(["/api/setup/status", "/setup/status", "/api/setup-status", "/setup-status"], async (_req, res) => {
  const result = await query("SELECT COUNT(*)::int AS count FROM users");
  const initialized = Number(result.rows[0]?.count || 0) > 0;
  res.json({
    initialized,
    needsSetup: !initialized,
    publicSetupAllowed: allowPublicSetup,
    bootstrapConfigured: shouldBootstrapAdmin(),
    missingBootstrapFields: getMissingBootstrapFields(),
    bootstrapNameFallbackApplied: !bootstrapAdmin.name,
  });
});

app.post(["/api/setup/initialize", "/setup/initialize", "/api/setup-initialize", "/setup-initialize"], async (req, res) => {
  if (!allowPublicSetup) {
    return sendError(res, 403, "Provisionamento publico desabilitado nesta instancia.", "PUBLIC_SETUP_DISABLED");
  }

  const status = await query("SELECT COUNT(*)::int AS count FROM users");
  if (Number(status.rows[0]?.count || 0) > 0) {
    return sendError(res, 409, "Setup inicial ja foi concluido", "SETUP_ALREADY_COMPLETED");
  }

  const { name, email, password } = req.body || {};
  if (!name || !email || !password) {
    return sendError(res, 400, "name, email e password sao obrigatorios", "INVALID_SETUP_PAYLOAD");
  }

  const normalizedEmail = String(email).toLowerCase();
  const now = new Date().toISOString();
  const adminId = randomUUID();

  try {
    await withTransaction(async (client) => {
      await client.query(
        `INSERT INTO users (id, name, email, password_hash, role, sector, active, created_at, updated_at)
         VALUES ($1, $2, $3, $4, 'admin', 'Diretoria', TRUE, $5, $6)`,
        [adminId, String(name), normalizedEmail, bcrypt.hashSync(String(password), 10), now, now]
      );

      await client.query(
        `INSERT INTO app_state (id, state_json, updated_at, updated_by)
         VALUES (1, $1::jsonb, $2, $3)
         ON CONFLICT (id) DO UPDATE SET state_json = EXCLUDED.state_json, updated_at = EXCLUDED.updated_at, updated_by = EXCLUDED.updated_by`,
        [JSON.stringify(buildDefaultState()), now, adminId]
      );

      await audit(adminId, "setup_initialized", "Primeiro administrador criado", client.query.bind(client));
    });
  } catch (error) {
    return sendError(res, 500, error instanceof Error ? error.message : "Falha ao concluir setup inicial", "SETUP_FAILED");
  }

  return res.status(201).json({ ok: true });
});

app.post(["/api/auth/login", "/auth/login", "/api/auth-login", "/auth-login"], async (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) {
    return sendError(res, 400, "Email e senha sao obrigatorios", "INVALID_LOGIN_PAYLOAD");
  }

  const normalizedEmail = String(email).toLowerCase();
  const result = await query("SELECT * FROM users WHERE email = $1", [normalizedEmail]);
  const user = result.rows[0];

  if (!user || !user.active) {
    await audit(null, "login_failed", `email=${normalizedEmail}`);
    return sendError(res, 401, "Credenciais invalidas", "INVALID_CREDENTIALS");
  }

  const valid = bcrypt.compareSync(String(password), user.password_hash);
  if (!valid) {
    await audit(user.id, "login_failed", "senha incorreta");
    return sendError(res, 401, "Credenciais invalidas", "INVALID_CREDENTIALS");
  }

  const publicUser = toPublicUser(user);
  const token = signToken(publicUser);
  await audit(user.id, "login_success", null);
  return res.json({ token, user: publicUser });
});

app.get(["/api/auth/me", "/auth/me", "/api/auth-me", "/auth-me"], authRequired, (req, res) => {
  res.json({ user: req.user });
});

app.get(["/api/users", "/users"], authRequired, adminRequired, async (_req, res) => {
  const result = await query("SELECT * FROM users ORDER BY created_at DESC");
  res.json({ users: result.rows.map(toPublicUser) });
});

app.get(["/api/users/assignable", "/users/assignable", "/api/users-assignable", "/users-assignable"], authRequired, async (_req, res) => {
  const result = await query(
    "SELECT * FROM users WHERE active = TRUE ORDER BY CASE WHEN role = 'admin' THEN 0 ELSE 1 END, name ASC"
  );
  res.json({ users: result.rows.map(toPublicUser) });
});

app.post(["/api/users", "/users"], authRequired, adminRequired, async (req, res) => {
  const { name, email, password, role, sector, active } = req.body || {};
  if (!name || !email || !password || !role || !sector) {
    return sendError(res, 400, "name, email, password, role e sector sao obrigatorios", "INVALID_USER_PAYLOAD");
  }
  if (!["admin", "user"].includes(role)) {
    return sendError(res, 400, "role invalido", "INVALID_USER_ROLE");
  }

  const normalizedEmail = String(email).toLowerCase();
  const exists = await query("SELECT id FROM users WHERE email = $1", [normalizedEmail]);
  if (exists.rows[0]) {
    return sendError(res, 409, "Email ja cadastrado", "EMAIL_ALREADY_EXISTS");
  }

  const id = randomUUID();
  const now = new Date().toISOString();
  await query(
    `INSERT INTO users (id, name, email, password_hash, role, sector, active, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
    [id, String(name), normalizedEmail, bcrypt.hashSync(String(password), 10), role, String(sector), active === false ? false : true, now, now]
  );

  const created = await query("SELECT * FROM users WHERE id = $1", [id]);
  await audit(req.user.id, "user_created", `id=${id}`);
  return res.status(201).json({ user: toPublicUser(created.rows[0]) });
});

app.put(["/api/users/:id", "/users/:id"], authRequired, adminRequired, async (req, res) => {
  const { id } = req.params;
  const currentResult = await query("SELECT * FROM users WHERE id = $1", [id]);
  const current = currentResult.rows[0];
  if (!current) {
    return sendError(res, 404, "Usuario nao encontrado", "USER_NOT_FOUND");
  }

  const { name, email, avatarUrl, role, sector, active, password } = req.body || {};
  const nextName = name ?? current.name;
  const nextEmail = email ? String(email).toLowerCase() : current.email;
  const nextAvatarUrl = typeof avatarUrl === "string" ? avatarUrl.trim() || null : current.avatar_url;
  const nextRole = role ?? current.role;
  const nextSector = sector ?? current.sector;
  const nextActive = typeof active === "boolean" ? active : current.active;

  if (!["admin", "user"].includes(nextRole)) {
    return sendError(res, 400, "role invalido", "INVALID_USER_ROLE");
  }

  const emailOwner = await query("SELECT id FROM users WHERE email = $1 AND id <> $2", [nextEmail, id]);
  if (emailOwner.rows[0]) {
    return sendError(res, 409, "Email ja utilizado por outro usuario", "EMAIL_ALREADY_EXISTS");
  }

  const passwordHash = password ? bcrypt.hashSync(String(password), 10) : current.password_hash;
  const now = new Date().toISOString();

  await query(
    `UPDATE users
     SET name = $1, email = $2, avatar_url = $3, password_hash = $4, role = $5, sector = $6, active = $7, updated_at = $8
     WHERE id = $9`,
    [nextName, nextEmail, nextAvatarUrl, passwordHash, nextRole, nextSector, nextActive, now, id]
  );

  const updated = await query("SELECT * FROM users WHERE id = $1", [id]);
  await audit(req.user.id, "user_updated", `id=${id}`);
  return res.json({ user: toPublicUser(updated.rows[0]) });
});

app.put(["/api/profile", "/profile", "/api/profile-update", "/profile-update"], authRequired, async (req, res) => {
  const currentResult = await query("SELECT * FROM users WHERE id = $1", [req.user.id]);
  const current = currentResult.rows[0];
  if (!current) {
    return sendError(res, 404, "Usuario nao encontrado", "USER_NOT_FOUND");
  }

  const { name, email, avatarUrl, currentPassword, newPassword } = req.body || {};
  const wantsSensitiveChange = typeof email === "string" || typeof newPassword === "string";

  if (wantsSensitiveChange) {
    if (!currentPassword || !bcrypt.compareSync(String(currentPassword), current.password_hash)) {
      return sendError(res, 400, "Senha atual invalida para alterar email ou senha", "INVALID_CURRENT_PASSWORD");
    }
  }

  const nextName = typeof name === "string" && name.trim() ? name.trim() : current.name;
  const nextEmail = typeof email === "string" && email.trim() ? email.trim().toLowerCase() : current.email;
  const nextAvatarUrl = typeof avatarUrl === "string" ? avatarUrl.trim() || null : current.avatar_url;

  const emailOwner = await query("SELECT id FROM users WHERE email = $1 AND id <> $2", [nextEmail, req.user.id]);
  if (emailOwner.rows[0]) {
    return sendError(res, 409, "Email ja utilizado por outro usuario", "EMAIL_ALREADY_EXISTS");
  }

  const nextPasswordHash =
    typeof newPassword === "string" && newPassword.trim()
      ? bcrypt.hashSync(String(newPassword), 10)
      : current.password_hash;

  const now = new Date().toISOString();
  await query(
    `UPDATE users
     SET name = $1, email = $2, avatar_url = $3, password_hash = $4, updated_at = $5
     WHERE id = $6`,
    [nextName, nextEmail, nextAvatarUrl, nextPasswordHash, now, req.user.id]
  );

  const updated = await query("SELECT * FROM users WHERE id = $1", [req.user.id]);
  await audit(req.user.id, "profile_updated", "Perfil atualizado pelo proprio usuario");
  return res.json({ user: toPublicUser(updated.rows[0]) });
});

app.delete(["/api/users/:id", "/users/:id"], authRequired, adminRequired, async (req, res) => {
  const { id } = req.params;
  const currentResult = await query("SELECT * FROM users WHERE id = $1", [id]);
  const current = currentResult.rows[0];
  if (!current) {
    return sendError(res, 404, "Usuario nao encontrado", "USER_NOT_FOUND");
  }

  if (id === req.user.id) {
    return sendError(res, 400, "Nao e permitido excluir o proprio usuario logado", "SELF_DELETE_FORBIDDEN");
  }

  if (current.role === "admin" && current.active) {
    const admins = await query("SELECT COUNT(*)::int AS count FROM users WHERE role = 'admin' AND active = TRUE");
    if (Number(admins.rows[0]?.count || 0) <= 1) {
      return sendError(res, 400, "Nao e permitido excluir o ultimo administrador ativo", "LAST_ADMIN_DELETE_FORBIDDEN");
    }
  }

  await withTransaction(async (client) => {
    const stateResult = await client.query("SELECT state_json FROM app_state WHERE id = 1");
    const stateRow = stateResult.rows[0];

    if (stateRow) {
      const parsed = parseStateSafely(stateRow.state_json);
      if (parsed && Array.isArray(parsed.leads)) {
        parsed.leads = parsed.leads.map((lead) =>
          lead?.ownerUserId === id ? { ...lead, ownerUserId: null } : lead
        );
      }

      await client.query(
        "UPDATE app_state SET state_json = $1::jsonb, updated_at = $2, updated_by = $3 WHERE id = 1",
        [JSON.stringify(parsed), new Date().toISOString(), req.user.id]
      );
    }

    await client.query("DELETE FROM users WHERE id = $1", [id]);
    await audit(req.user.id, "user_deleted", `id=${id}`, client.query.bind(client));
  });

  return res.json({ ok: true });
});

app.get(["/api/funnels", "/funnels"], authRequired, async (_req, res) => {
  const funnels = await loadFunnelsFromDb(query);
  return res.json({ funnels });
});

app.post(["/api/funnels", "/funnels"], authRequired, async (req, res) => {
  const { name, color, operation, description, areaOfLawId, linkedCampaignId, fieldSchema, objections, playbook } = req.body || {};
  if (!name) {
    return sendError(res, 400, "Nome do funil e obrigatorio", "FUNNEL_NAME_REQUIRED");
  }

  const now = new Date().toISOString();
  const funnelId = randomUUID();
  await query(
    `INSERT INTO funnels (id, name, color, position, operation, description, area_of_law_id, linked_campaign_id, field_schema, objections, playbook, metadata, created_at, updated_at)
     VALUES (
      $1, $2, COALESCE($3, '#d4af37'),
      COALESCE((SELECT MAX(position) + 1 FROM funnels), 0),
      $4, $5, $6, $7, $8::jsonb, $9::jsonb, $10, '{}'::jsonb, $11, $12
     )`,
    [
      funnelId,
      String(name).trim(),
      color || null,
      operation || "commercial",
      sanitizeText(description),
      areaOfLawId || null,
      linkedCampaignId || null,
      JSON.stringify(Array.isArray(fieldSchema) ? fieldSchema : []),
      JSON.stringify(Array.isArray(objections) ? objections : []),
      sanitizeText(playbook),
      now,
      now,
    ],
  );

  const stageId = randomUUID();
  await query(
    `INSERT INTO funnel_stages (id, funnel_id, name, position, color, semantic_key, metadata, created_at, updated_at)
     VALUES ($1, $2, 'Novo Lead', 0, '#d4af37', 'new', '{}'::jsonb, $3, $4)`,
    [stageId, funnelId, now, now],
  );

  const funnel = (await loadFunnelsFromDb(query)).find((item) => item.id === funnelId);
  await audit(req.user.id, "funnel_created", `id=${funnelId}`);
  return res.status(201).json({ funnel });
});

app.put(["/api/funnels/:id", "/funnels/:id"], authRequired, async (req, res) => {
  const { id } = req.params;
  const current = await query("SELECT id FROM funnels WHERE id = $1", [id]);
  if (!current.rows[0]) {
    return sendError(res, 404, "Funil nao encontrado", "FUNNEL_NOT_FOUND");
  }

  const { name, color, position, operation, description, areaOfLawId, linkedCampaignId, fieldSchema, objections, playbook } = req.body || {};
  const now = new Date().toISOString();
  await query(
    `UPDATE funnels
     SET name = COALESCE($1, name),
         color = COALESCE($2, color),
         position = COALESCE($3, position),
         operation = COALESCE($4, operation),
         description = COALESCE($5, description),
         area_of_law_id = $6,
         linked_campaign_id = $7,
         field_schema = COALESCE($8::jsonb, field_schema),
         objections = COALESCE($9::jsonb, objections),
         playbook = COALESCE($10, playbook),
         updated_at = $11
     WHERE id = $12`,
    [
      sanitizeText(name),
      color || null,
      Number.isFinite(Number(position)) ? Number(position) : null,
      operation || null,
      sanitizeText(description),
      areaOfLawId || null,
      linkedCampaignId || null,
      Array.isArray(fieldSchema) ? JSON.stringify(fieldSchema) : null,
      Array.isArray(objections) ? JSON.stringify(objections) : null,
      typeof playbook === "string" ? playbook : null,
      now,
      id,
    ],
  );

  const funnel = (await loadFunnelsFromDb(query)).find((item) => item.id === id);
  await audit(req.user.id, "funnel_updated", `id=${id}`);
  return res.json({ funnel });
});

app.delete(["/api/funnels/:id", "/funnels/:id"], authRequired, async (req, res) => {
  const { id } = req.params;
  const current = await query("SELECT id FROM funnels WHERE id = $1", [id]);
  if (!current.rows[0]) {
    return sendError(res, 404, "Funil nao encontrado", "FUNNEL_NOT_FOUND");
  }

  await query("DELETE FROM funnels WHERE id = $1", [id]);
  await audit(req.user.id, "funnel_deleted", `id=${id}`);
  return res.json({ ok: true });
});

app.post(["/api/funnels/:funnelId/stages", "/funnels/:funnelId/stages"], authRequired, async (req, res) => {
  const { funnelId } = req.params;
  const { name, position, color, semanticKey } = req.body || {};
  if (!name) {
    return sendError(res, 400, "Nome da etapa e obrigatorio", "STAGE_NAME_REQUIRED");
  }

  const funnel = await query("SELECT id FROM funnels WHERE id = $1", [funnelId]);
  if (!funnel.rows[0]) {
    return sendError(res, 404, "Funil nao encontrado", "FUNNEL_NOT_FOUND");
  }

  const now = new Date().toISOString();
  const id = randomUUID();
  await query(
    `INSERT INTO funnel_stages (id, funnel_id, name, position, color, semantic_key, metadata, created_at, updated_at)
     VALUES (
       $1, $2, $3,
       COALESCE($4, (SELECT COALESCE(MAX(position) + 1, 0) FROM funnel_stages WHERE funnel_id = $2)),
       COALESCE($5, '#6b7280'), COALESCE($6, 'other'), '{}'::jsonb, $7, $8
     )`,
    [id, funnelId, String(name).trim(), Number.isFinite(Number(position)) ? Number(position) : null, color || null, semanticKey || null, now, now],
  );

  const stages = (await loadFunnelsFromDb(query)).find((item) => item.id === funnelId)?.stages || [];
  const stage = stages.find((item) => item.id === id);
  await audit(req.user.id, "funnel_stage_created", `id=${id}`);
  return res.status(201).json({ stage });
});

app.put(["/api/stages/:id", "/stages/:id"], authRequired, async (req, res) => {
  const { id } = req.params;
  const { name, position, color, semanticKey } = req.body || {};
  const current = await query("SELECT id, funnel_id FROM funnel_stages WHERE id = $1", [id]);
  if (!current.rows[0]) {
    return sendError(res, 404, "Etapa nao encontrada", "STAGE_NOT_FOUND");
  }

  await query(
    `UPDATE funnel_stages
     SET name = COALESCE($1, name),
         position = COALESCE($2, position),
         color = COALESCE($3, color),
         semantic_key = COALESCE($4, semantic_key),
         updated_at = $5
     WHERE id = $6`,
    [
      sanitizeText(name),
      Number.isFinite(Number(position)) ? Number(position) : null,
      color || null,
      semanticKey || null,
      new Date().toISOString(),
      id,
    ],
  );

  const stages = (await loadFunnelsFromDb(query)).find((item) => item.id === current.rows[0].funnel_id)?.stages || [];
  const stage = stages.find((item) => item.id === id);
  return res.json({ stage });
});

app.delete(["/api/stages/:id", "/stages/:id"], authRequired, async (req, res) => {
  const { id } = req.params;
  const current = await query("SELECT id FROM funnel_stages WHERE id = $1", [id]);
  if (!current.rows[0]) {
    return sendError(res, 404, "Etapa nao encontrada", "STAGE_NOT_FOUND");
  }

  await query("DELETE FROM funnel_stages WHERE id = $1", [id]);
  await audit(req.user.id, "funnel_stage_deleted", `id=${id}`);
  return res.json({ ok: true });
});

app.get(["/api/leads", "/leads"], authRequired, async (req, res) => {
  const filters = {
    funnelId: typeof req.query.funnel_id === "string" ? req.query.funnel_id : undefined,
    stageId: typeof req.query.stage_id === "string" ? req.query.stage_id : undefined,
  };
  const leads = await loadLeadsFromDb(query, filters);
  const scoped = isSystemAdmin(req.user)
    ? leads
    : leads.filter((lead) => !lead.ownerUserId || lead.ownerUserId === req.user.id);
  return res.json({ leads: scoped });
});

app.get(["/api/leads/:id", "/leads/:id"], authRequired, async (req, res) => {
  const details = await loadLeadDetailsFromDb(query, req.params.id);
  const leadRow = await findLeadRow(req.params.id);
  const permission = ensureLeadPermission(leadRow, req.user);
  if (!permission.allowed) {
    return sendError(res, permission.status, permission.reason, permission.code);
  }
  if (!details) {
    return sendError(res, 404, "Lead nao encontrado", "LEAD_NOT_FOUND");
  }
  return res.json(details);
});

app.post(["/api/leads", "/leads"], authRequired, async (req, res) => {
  const {
    funnel_id,
    stage_id,
    name,
    email,
    phone,
    company,
    notes,
    cpf,
    legal_area,
    campaign_id,
    ad_group_id,
    ad_id,
    area_of_law_id,
    service_id,
    service_ids,
    source_id,
    source_details,
    loss_reason_code,
    loss_reason_detail,
    contract_value,
  } = req.body || {};

  if (!name) {
    return sendError(res, 400, "Nome do lead e obrigatorio", "LEAD_NAME_REQUIRED");
  }

  const id = randomUUID();
  const now = new Date().toISOString();
  await query(
    `INSERT INTO leads (
      id, funnel_id, stage_id, owner_user_id, name, email, phone, company, notes, cpf, legal_area,
      campaign_id, ad_group_id, ad_id, area_of_law_id, service_id, service_ids, source_id, source_details,
      loss_reason_code, loss_reason_detail, contract_value, contract_currency, metadata, created_at, updated_at
    ) VALUES (
      $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11,
      $12, $13, $14, $15, $16, $17::text[], $18, $19,
      $20, $21, $22, 'BRL', $23::jsonb, $24, $25
    )`,
    [
      id,
      funnel_id || null,
      stage_id || null,
      isSystemAdmin(req.user) ? req.body?.owner_user_id || null : req.user.id,
      String(name).trim(),
      sanitizeText(email),
      sanitizeText(phone),
      sanitizeText(company),
      sanitizeText(notes),
      sanitizeText(cpf),
      sanitizeText(legal_area),
      campaign_id || null,
      ad_group_id || null,
      ad_id || null,
      area_of_law_id || null,
      service_id || null,
      Array.isArray(service_ids) ? service_ids : [],
      source_id || null,
      sanitizeText(source_details),
      sanitizeText(loss_reason_code),
      sanitizeText(loss_reason_detail),
      asNumericValue(contract_value),
      JSON.stringify({
        notes: [],
        followUps: [],
        tasks: [],
        logs: [],
        documents: [],
        customFields: {},
        aiInsight: null,
      }),
      now,
      now,
    ],
  );

  const details = await loadLeadDetailsFromDb(query, id);
  await audit(req.user.id, "lead_created", `id=${id}`);
  return res.status(201).json(details);
});

app.put(["/api/leads/:id", "/leads/:id"], authRequired, async (req, res) => {
  const { id } = req.params;
  const current = await findLeadRow(id);
  const permission = ensureLeadPermission(current, req.user);
  if (!permission.allowed) {
    return sendError(res, permission.status, permission.reason, permission.code);
  }

  const body = req.body || {};
  const metadata = parseLegacyState(current.metadata, {});
  const nextContractValue = Object.prototype.hasOwnProperty.call(body, "contract_value")
    ? asNumericValue(body.contract_value)
    : Object.prototype.hasOwnProperty.call(body, "estimatedValue")
      ? asNumericValue(body.estimatedValue)
      : Number(current.contract_value || 0);

  const nextMetadata = {
    notes: Array.isArray(body.notes) ? body.notes : Array.isArray(metadata.notes) ? metadata.notes : [],
    followUps: Array.isArray(body.followUps) ? body.followUps : Array.isArray(metadata.followUps) ? metadata.followUps : [],
    tasks: Array.isArray(body.tasks) ? body.tasks : Array.isArray(metadata.tasks) ? metadata.tasks : [],
    logs: Array.isArray(body.logs) ? body.logs : Array.isArray(metadata.logs) ? metadata.logs : [],
    documents: Array.isArray(body.documents) ? body.documents : Array.isArray(metadata.documents) ? metadata.documents : [],
    customFields: body.customFields && typeof body.customFields === "object" ? body.customFields : metadata.customFields || {},
    aiInsight: typeof body.aiInsight === "string" ? body.aiInsight : metadata.aiInsight || null,
  };

  await query(
    `UPDATE leads
     SET funnel_id = COALESCE($1, funnel_id),
         stage_id = COALESCE($2, stage_id),
         owner_user_id = $3,
         name = COALESCE($4, name),
         email = $5,
         phone = $6,
         company = $7,
         notes = $8,
         cpf = $9,
         legal_area = $10,
         campaign_id = $11,
         ad_group_id = $12,
         ad_id = $13,
         area_of_law_id = $14,
         service_id = $15,
         service_ids = $16::text[],
         source_id = $17,
         source_details = $18,
         loss_reason_code = $19,
         loss_reason_detail = $20,
         contract_value = $21,
         metadata = $22::jsonb,
         last_interaction_at = $23,
         updated_at = $24
     WHERE id = $25`,
    [
      body.funnel_id || body.funnelId || null,
      body.stage_id || body.status || null,
      isSystemAdmin(req.user) ? body.owner_user_id || body.ownerUserId || current.owner_user_id || null : current.owner_user_id || req.user.id,
      sanitizeText(body.name) || current.name,
      Object.prototype.hasOwnProperty.call(body, "email") ? sanitizeText(body.email) : current.email,
      Object.prototype.hasOwnProperty.call(body, "phone") ? sanitizeText(body.phone) : current.phone,
      Object.prototype.hasOwnProperty.call(body, "company") ? sanitizeText(body.company) : current.company,
      Object.prototype.hasOwnProperty.call(body, "notesText") ? sanitizeText(body.notesText) : current.notes,
      Object.prototype.hasOwnProperty.call(body, "cpf") ? sanitizeText(body.cpf) : current.cpf,
      Object.prototype.hasOwnProperty.call(body, "legalArea") ? sanitizeText(body.legalArea) : current.legal_area,
      Object.prototype.hasOwnProperty.call(body, "campaign_id") || Object.prototype.hasOwnProperty.call(body, "campaignId") ? body.campaign_id || body.campaignId || null : current.campaign_id,
      Object.prototype.hasOwnProperty.call(body, "ad_group_id") || Object.prototype.hasOwnProperty.call(body, "adGroupId") ? body.ad_group_id || body.adGroupId || null : current.ad_group_id,
      Object.prototype.hasOwnProperty.call(body, "ad_id") || Object.prototype.hasOwnProperty.call(body, "adId") ? body.ad_id || body.adId || null : current.ad_id,
      Object.prototype.hasOwnProperty.call(body, "area_of_law_id") || Object.prototype.hasOwnProperty.call(body, "areaOfLawId") ? body.area_of_law_id || body.areaOfLawId || null : current.area_of_law_id,
      Object.prototype.hasOwnProperty.call(body, "service_id") || Object.prototype.hasOwnProperty.call(body, "serviceId") ? body.service_id || body.serviceId || null : current.service_id,
      Object.prototype.hasOwnProperty.call(body, "service_ids") || Object.prototype.hasOwnProperty.call(body, "serviceIds") ? (body.service_ids || body.serviceIds || []) : current.service_ids || [],
      Object.prototype.hasOwnProperty.call(body, "source_id") || Object.prototype.hasOwnProperty.call(body, "sourceId") ? body.source_id || body.sourceId || null : current.source_id,
      Object.prototype.hasOwnProperty.call(body, "source_details") || Object.prototype.hasOwnProperty.call(body, "sourceDetails") ? sanitizeText(body.source_details || body.sourceDetails) : current.source_details,
      Object.prototype.hasOwnProperty.call(body, "loss_reason_code") || Object.prototype.hasOwnProperty.call(body, "lossReasonCode") ? sanitizeText(body.loss_reason_code || body.lossReasonCode) : current.loss_reason_code,
      Object.prototype.hasOwnProperty.call(body, "loss_reason_detail") || Object.prototype.hasOwnProperty.call(body, "lossReasonDetail") ? sanitizeText(body.loss_reason_detail || body.lossReasonDetail) : current.loss_reason_detail,
      nextContractValue,
      JSON.stringify(nextMetadata),
      body.lastInteractionAt || body.last_interaction_at || new Date().toISOString(),
      new Date().toISOString(),
      id,
    ],
  );

  const details = await loadLeadDetailsFromDb(query, id);
  await audit(req.user.id, "lead_updated", `id=${id}`);
  return res.json(details);
});

app.patch(["/api/leads/:id", "/leads/:id"], authRequired, async (req, res) => {
  const { id } = req.params;
  const { funnel_id, stage_id } = req.body || {};
  if (!funnel_id || !stage_id) {
    return sendError(res, 400, "funnel_id e stage_id são obrigatórios", "MOVE_PAYLOAD_INVALID");
  }

  const current = await findLeadRow(id);
  const permission = ensureLeadPermission(current, req.user);
  if (!permission.allowed) {
    return sendError(res, permission.status, permission.reason, permission.code);
  }

  const snapshot = await findFunnelsSnapshot();
  const nextFunnel = snapshot.funnelsById.get(funnel_id);
  const nextStage = snapshot.stagesById.get(stage_id);
  const previousFunnel = current.funnel_id ? snapshot.funnelsById.get(current.funnel_id) : undefined;
  const previousStage = current.stage_id ? snapshot.stagesById.get(current.stage_id) : undefined;
  if (!nextFunnel) {
    return sendError(res, 404, "Funil de destino não encontrado", "DESTINATION_FUNNEL_NOT_FOUND");
  }
  if (!nextStage || nextStage.funnelId !== funnel_id) {
    return sendError(res, 400, "Etapa de destino inválida para o funil selecionado", "DESTINATION_STAGE_INVALID");
  }

  await withTransaction(async (client) => {
    const now = new Date().toISOString();
    await client.query(
      `UPDATE leads
       SET funnel_id = $1, stage_id = $2, last_interaction_at = $3, updated_at = $4
       WHERE id = $5`,
      [funnel_id, stage_id, now, now, id],
    );

    await client.query(
      `INSERT INTO lead_activities (id, lead_id, type, description, metadata, created_by, created_at)
       VALUES ($1, $2, $3, $4, $5::jsonb, $6, $7)`,
      [
        randomUUID(),
        id,
        previousFunnel?.id !== nextFunnel.id ? "funnel_change" : "stage_change",
        normalizeSemanticActivityDescription(previousFunnel?.name, nextFunnel.name, previousStage?.name, nextStage.name),
        JSON.stringify({
          fromFunnelId: previousFunnel?.id || null,
          toFunnelId: nextFunnel.id,
          fromStageId: previousStage?.id || null,
          toStageId: nextStage.id,
        }),
        req.user.id,
        now,
      ],
    );
  });

  const details = await loadLeadDetailsFromDb(query, id);
  if (!details?.lead) {
    return sendError(res, 404, "Lead não encontrado", "LEAD_NOT_FOUND");
  }

  return res.json(details.lead);
});

app.delete(["/api/leads/:id", "/leads/:id"], authRequired, async (req, res) => {
  const { id } = req.params;
  const current = await findLeadRow(id);
  const permission = ensureLeadPermission(current, req.user);
  if (!permission.allowed) {
    return sendError(res, permission.status, permission.reason, permission.code);
  }

  await query("DELETE FROM leads WHERE id = $1", [id]);
  await audit(req.user.id, "lead_deleted", `id=${id}`);
  return res.json({ ok: true });
});

app.patch(["/api/leads/:id/move", "/leads/:id/move"], authRequired, async (req, res) => {
  const { id } = req.params;
  const { funnel_id, stage_id } = req.body || {};
  if (!funnel_id || !stage_id) {
    return sendError(res, 400, "funnel_id e stage_id sao obrigatorios", "MOVE_PAYLOAD_INVALID");
  }

  const current = await findLeadRow(id);
  const permission = ensureLeadPermission(current, req.user);
  if (!permission.allowed) {
    return sendError(res, permission.status, permission.reason, permission.code);
  }

  const snapshot = await findFunnelsSnapshot();
  const nextFunnel = snapshot.funnelsById.get(funnel_id);
  const nextStage = snapshot.stagesById.get(stage_id);
  const previousFunnel = current.funnel_id ? snapshot.funnelsById.get(current.funnel_id) : undefined;
  const previousStage = current.stage_id ? snapshot.stagesById.get(current.stage_id) : undefined;
  if (!nextFunnel) {
    return sendError(res, 404, "Funil de destino nao encontrado", "DESTINATION_FUNNEL_NOT_FOUND");
  }
  if (!nextStage || nextStage.funnelId !== funnel_id) {
    return sendError(res, 400, "Etapa de destino invalida para o funil selecionado", "DESTINATION_STAGE_INVALID");
  }

  await withTransaction(async (client) => {
    const now = new Date().toISOString();
    await client.query(
      `UPDATE leads
       SET funnel_id = $1, stage_id = $2, last_interaction_at = $3, updated_at = $4
       WHERE id = $5`,
      [funnel_id, stage_id, now, now, id],
    );

    await client.query(
      `INSERT INTO lead_activities (id, lead_id, type, description, metadata, created_by, created_at)
       VALUES ($1, $2, $3, $4, $5::jsonb, $6, $7)`,
      [
        randomUUID(),
        id,
        previousFunnel?.id !== nextFunnel.id ? "funnel_change" : "stage_change",
        normalizeSemanticActivityDescription(previousFunnel?.name, nextFunnel.name, previousStage?.name, nextStage.name),
        JSON.stringify({
          fromFunnelId: previousFunnel?.id || null,
          toFunnelId: nextFunnel.id,
          fromStageId: previousStage?.id || null,
          toStageId: nextStage.id,
        }),
        req.user.id,
        now,
      ],
    );
  });

  const details = await loadLeadDetailsFromDb(query, id);
  return res.json(details);
});

app.get(["/api/leads/:id/receivables", "/leads/:id/receivables"], authRequired, async (req, res) => {
  const leadRow = await findLeadRow(req.params.id);
  const permission = ensureLeadPermission(leadRow, req.user);
  if (!permission.allowed) {
    return sendError(res, permission.status, permission.reason, permission.code);
  }

  const result = await query("SELECT * FROM receivables WHERE lead_id = $1 ORDER BY due_date ASC, created_at ASC", [req.params.id]);
  return res.json({ receivables: result.rows.map(serializeReceivableRow) });
});

app.post(["/api/leads/:id/receivables", "/leads/:id/receivables"], authRequired, async (req, res) => {
  const leadRow = await findLeadRow(req.params.id);
  const permission = ensureLeadPermission(leadRow, req.user);
  if (!permission.allowed) {
    return sendError(res, permission.status, permission.reason, permission.code);
  }

  const { description, amount, dueDate, paymentMethod, notes, invoiceNumber } = req.body || {};
  if (!description || !dueDate) {
    return sendError(res, 400, "Descricao e vencimento sao obrigatorios", "RECEIVABLE_REQUIRED_FIELDS");
  }

  const id = randomUUID();
  const now = new Date().toISOString();
  await query(
    `INSERT INTO receivables (id, lead_id, description, amount, due_date, status, payment_method, invoice_number, notes, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, 'pending', $6, $7, $8, $9, $10)`,
    [id, req.params.id, String(description).trim(), asNumericValue(amount), normalizeDateOnly(dueDate), paymentMethod || null, sanitizeText(invoiceNumber), sanitizeText(notes), now, now],
  );

  const created = await query("SELECT * FROM receivables WHERE id = $1", [id]);
  await query(
    `INSERT INTO lead_activities (id, lead_id, type, description, metadata, created_by, created_at)
     VALUES ($1, $2, 'payment', $3, $4::jsonb, $5, $6)`,
    [
      randomUUID(),
      req.params.id,
      `Recebivel criado: ${String(description).trim()}`,
      JSON.stringify({ receivableId: id, amount: asNumericValue(amount) }),
      req.user.id,
      now,
    ],
  );
  return res.status(201).json(serializeReceivableRow(created.rows[0]));
});

app.put(["/api/receivables/:id", "/receivables/:id"], authRequired, async (req, res) => {
  const receivableResult = await query("SELECT * FROM receivables WHERE id = $1", [req.params.id]);
  const receivable = receivableResult.rows[0];
  if (!receivable) {
    return sendError(res, 404, "Recebivel nao encontrado", "RECEIVABLE_NOT_FOUND");
  }

  const leadRow = await findLeadRow(receivable.lead_id);
  const permission = ensureLeadPermission(leadRow, req.user);
  if (!permission.allowed) {
    return sendError(res, permission.status, permission.reason, permission.code);
  }

  const body = req.body || {};
  const nextStatus = body.status || receivable.status;
  const nextPaidDate = nextStatus === "paid"
    ? normalizeDateOnly(body.paidDate || body.paid_date || new Date().toISOString())
    : body.status === "pending" || body.status === "cancelled"
      ? null
      : receivable.paid_date;

  await query(
    `UPDATE receivables
     SET description = COALESCE($1, description),
         amount = COALESCE($2, amount),
         due_date = COALESCE($3, due_date),
         paid_date = $4,
         status = COALESCE($5, status),
         payment_method = $6,
         invoice_number = $7,
         notes = $8,
         updated_at = $9
     WHERE id = $10`,
    [
      sanitizeText(body.description),
      Object.prototype.hasOwnProperty.call(body, "amount") ? asNumericValue(body.amount) : null,
      normalizeDateOnly(body.dueDate || body.due_date),
      nextPaidDate,
      nextStatus,
      Object.prototype.hasOwnProperty.call(body, "paymentMethod") || Object.prototype.hasOwnProperty.call(body, "payment_method") ? body.paymentMethod || body.payment_method || null : receivable.payment_method,
      Object.prototype.hasOwnProperty.call(body, "invoiceNumber") || Object.prototype.hasOwnProperty.call(body, "invoice_number") ? sanitizeText(body.invoiceNumber || body.invoice_number) : receivable.invoice_number,
      Object.prototype.hasOwnProperty.call(body, "notes") ? sanitizeText(body.notes) : receivable.notes,
      new Date().toISOString(),
      req.params.id,
    ],
  );

  const updated = await query("SELECT * FROM receivables WHERE id = $1", [req.params.id]);
  return res.json(serializeReceivableRow(updated.rows[0]));
});

app.delete(["/api/receivables/:id", "/receivables/:id"], authRequired, async (req, res) => {
  const receivableResult = await query("SELECT * FROM receivables WHERE id = $1", [req.params.id]);
  const receivable = receivableResult.rows[0];
  if (!receivable) {
    return sendError(res, 404, "Recebivel nao encontrado", "RECEIVABLE_NOT_FOUND");
  }

  const leadRow = await findLeadRow(receivable.lead_id);
  const permission = ensureLeadPermission(leadRow, req.user);
  if (!permission.allowed) {
    return sendError(res, permission.status, permission.reason, permission.code);
  }

  await query("DELETE FROM receivables WHERE id = $1", [req.params.id]);
  return res.json({ ok: true });
});

app.get(["/api/receivables/summary", "/receivables/summary"], authRequired, async (_req, res) => {
  const summary = await loadReceivablesSummary(query);
  return res.json(summary);
});

app.get(["/api/state", "/state"], authRequired, async (req, res) => {
  const result = await query("SELECT state_json, updated_at FROM app_state WHERE id = 1");
  const row = result.rows[0];
  const parsed = parseStateSafely(row?.state_json);
  const stateFromDb = row
    ? await buildLegacyStateFromRelational(query, parsed)
    : buildDefaultState();
  const scoped = scopedStateForUser(stateFromDb, req.user);
  return res.json({ state: scoped, updatedAt: serializeTimestamp(row?.updated_at) || new Date().toISOString() });
});

app.put(["/api/state", "/state"], authRequired, async (req, res) => {
  const { state, clientUpdatedAt } = req.body || {};
  if (!state || typeof state !== "object") {
    return sendError(res, 400, "Campo state invalido", "INVALID_STATE_PAYLOAD");
  }

  const now = new Date().toISOString();
  const currentResult = await query("SELECT state_json, updated_at FROM app_state WHERE id = 1");
  const currentRow = currentResult.rows[0];
  const currentUpdatedAt = serializeTimestamp(currentRow?.updated_at);

  if (clientUpdatedAt && currentUpdatedAt && clientUpdatedAt !== currentUpdatedAt) {
    const latestState = await buildLegacyStateFromRelational(query, parseStateSafely(currentRow?.state_json));
    const scoped = scopedStateForUser(latestState, req.user);
    return res.status(409).json({
      error: true,
      message: "Estado desatualizado. Sincronize e tente novamente.",
      code: "STATE_CONFLICT",
      state: scoped,
      updatedAt: currentUpdatedAt,
    });
  }

  const currentState = parseStateSafely(currentRow?.state_json);
  const mergedState = mergeStateForUser(currentState, state, req.user);
  const serialized = JSON.stringify(mergedState);

  await withTransaction(async (client) => {
    await client.query("SET client_encoding TO 'UTF8'");
    await client.query(
      `INSERT INTO app_state (id, state_json, updated_at, updated_by)
       VALUES (1, $1::jsonb, $2, $3)
       ON CONFLICT (id) DO UPDATE SET state_json = EXCLUDED.state_json, updated_at = EXCLUDED.updated_at, updated_by = EXCLUDED.updated_by`,
      [serialized, now, req.user.id]
    );

    if (isSystemAdmin(req.user)) {
      await syncFunnelsFromLegacyState(client, Array.isArray(mergedState.funnels) ? mergedState.funnels : []);
    }
    await syncLeadsFromLegacyState(client, Array.isArray(mergedState.leads) ? mergedState.leads : [], req.user.id, isSystemAdmin(req.user));

    await client.query(
      `INSERT INTO state_revisions (id, state_json, created_at, updated_by)
       VALUES ($1, $2::jsonb, $3, $4)`,
      [randomUUID(), serialized, now, req.user.id]
    );
  });

  await audit(req.user.id, "state_updated", null);
  return res.json({ ok: true, updatedAt: now });
});

app.get(["/api/audit-logs", "/audit-logs", "/api/auditlogs", "/auditlogs"], authRequired, adminRequired, async (_req, res) => {
  const result = await query(
    `SELECT a.id, a.action, a.details, a.created_at, u.name AS user_name, u.email AS user_email
     FROM audit_logs a
     LEFT JOIN users u ON u.id = a.user_id
     ORDER BY a.created_at DESC
     LIMIT 200`
  );
  res.json({ logs: result.rows });
});

app.post(["/api/backup/now", "/backup/now", "/api/backup-now", "/backup-now"], authRequired, adminRequired, async (req, res) => {
  await audit(req.user.id, "backup_guidance", "Backup deve ser feito pelo provedor PostgreSQL");
  return res.json({
    ok: true,
    mode: "provider-managed",
    message: "No ambiente online, utilize os backups gerenciados pelo provedor do PostgreSQL.",
  });
});

app.use((error, _req, res, _next) => {
  const message = error instanceof Error ? error.message : "Erro interno do servidor";
  sendError(res, 500, message, "INTERNAL_SERVER_ERROR");
});

export const startApiServer = async () => {
  if (isDatabaseConfigured()) {
    await ensureDatabaseReady();
  }

  const server = app.listen(port, () => {
    console.log(`API online em http://localhost:${port}`);
  });
  return server;
};

export default app;
