import express from "express";
import cors from "cors";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { randomUUID } from "node:crypto";
import { Pool } from "pg";

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

const createPool = () => {
  if (!databaseUrl) {
    throw new Error("DATABASE_URL nao configurada.");
  }

  const useSsl = !/(localhost|127\.0\.0\.1)/i.test(databaseUrl);
  return new Pool({
    connectionString: databaseUrl,
    ssl: useSsl ? { rejectUnauthorized: false } : false,
    max: 10,
  });
};

const getPool = () => {
  if (!pool) {
    pool = createPool();
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

app.get(["/api/health", "/health"], async (_req, res) => {
  if (!isDatabaseConfigured()) {
    return res.status(503).json({ ok: false, message: "DATABASE_URL nao configurada" });
  }

  try {
    await ensureDatabaseReady();
    return res.json({ ok: true, database: "connected", mode: "online" });
  } catch (error) {
    return res.status(503).json({
      ok: false,
      message: error instanceof Error ? error.message : "Banco indisponivel",
    });
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
    return res.status(401).json({ message: "Nao autenticado" });
  }

  const token = authHeader.slice(7);
  try {
    const payload = jwt.verify(token, jwtSecret);
    const { rows } = await query("SELECT * FROM users WHERE id = $1", [payload.sub]);
    const user = rows[0];
    if (!user || !user.active) {
      return res.status(401).json({ message: "Sessao invalida" });
    }
    req.user = toPublicUser(user);
    return next();
  } catch {
    return res.status(401).json({ message: "Token invalido" });
  }
};

const adminRequired = (req, res, next) => {
  if (!isSystemAdmin(req.user)) {
    return res.status(403).json({ message: "Acesso restrito ao administrador" });
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
    return res.status(403).json({
      message: "Provisionamento publico desabilitado nesta instancia.",
    });
  }

  const status = await query("SELECT COUNT(*)::int AS count FROM users");
  if (Number(status.rows[0]?.count || 0) > 0) {
    return res.status(409).json({ message: "Setup inicial ja foi concluido" });
  }

  const { name, email, password } = req.body || {};
  if (!name || !email || !password) {
    return res.status(400).json({ message: "name, email e password sao obrigatorios" });
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
    return res.status(500).json({
      message: error instanceof Error ? error.message : "Falha ao concluir setup inicial",
    });
  }

  return res.status(201).json({ ok: true });
});

app.post(["/api/auth/login", "/auth/login", "/api/auth-login", "/auth-login"], async (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) {
    return res.status(400).json({ message: "Email e senha sao obrigatorios" });
  }

  const normalizedEmail = String(email).toLowerCase();
  const result = await query("SELECT * FROM users WHERE email = $1", [normalizedEmail]);
  const user = result.rows[0];

  if (!user || !user.active) {
    await audit(null, "login_failed", `email=${normalizedEmail}`);
    return res.status(401).json({ message: "Credenciais invalidas" });
  }

  const valid = bcrypt.compareSync(String(password), user.password_hash);
  if (!valid) {
    await audit(user.id, "login_failed", "senha incorreta");
    return res.status(401).json({ message: "Credenciais invalidas" });
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
    return res.status(400).json({ message: "name, email, password, role e sector sao obrigatorios" });
  }
  if (!["admin", "user"].includes(role)) {
    return res.status(400).json({ message: "role invalido" });
  }

  const normalizedEmail = String(email).toLowerCase();
  const exists = await query("SELECT id FROM users WHERE email = $1", [normalizedEmail]);
  if (exists.rows[0]) {
    return res.status(409).json({ message: "Email ja cadastrado" });
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
    return res.status(404).json({ message: "Usuario nao encontrado" });
  }

  const { name, email, avatarUrl, role, sector, active, password } = req.body || {};
  const nextName = name ?? current.name;
  const nextEmail = email ? String(email).toLowerCase() : current.email;
  const nextAvatarUrl = typeof avatarUrl === "string" ? avatarUrl.trim() || null : current.avatar_url;
  const nextRole = role ?? current.role;
  const nextSector = sector ?? current.sector;
  const nextActive = typeof active === "boolean" ? active : current.active;

  if (!["admin", "user"].includes(nextRole)) {
    return res.status(400).json({ message: "role invalido" });
  }

  const emailOwner = await query("SELECT id FROM users WHERE email = $1 AND id <> $2", [nextEmail, id]);
  if (emailOwner.rows[0]) {
    return res.status(409).json({ message: "Email ja utilizado por outro usuario" });
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
    return res.status(404).json({ message: "Usuario nao encontrado" });
  }

  const { name, email, avatarUrl, currentPassword, newPassword } = req.body || {};
  const wantsSensitiveChange = typeof email === "string" || typeof newPassword === "string";

  if (wantsSensitiveChange) {
    if (!currentPassword || !bcrypt.compareSync(String(currentPassword), current.password_hash)) {
      return res.status(400).json({ message: "Senha atual invalida para alterar email ou senha" });
    }
  }

  const nextName = typeof name === "string" && name.trim() ? name.trim() : current.name;
  const nextEmail = typeof email === "string" && email.trim() ? email.trim().toLowerCase() : current.email;
  const nextAvatarUrl = typeof avatarUrl === "string" ? avatarUrl.trim() || null : current.avatar_url;

  const emailOwner = await query("SELECT id FROM users WHERE email = $1 AND id <> $2", [nextEmail, req.user.id]);
  if (emailOwner.rows[0]) {
    return res.status(409).json({ message: "Email ja utilizado por outro usuario" });
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
    return res.status(404).json({ message: "Usuario nao encontrado" });
  }

  if (id === req.user.id) {
    return res.status(400).json({ message: "Nao e permitido excluir o proprio usuario logado" });
  }

  if (current.role === "admin" && current.active) {
    const admins = await query("SELECT COUNT(*)::int AS count FROM users WHERE role = 'admin' AND active = TRUE");
    if (Number(admins.rows[0]?.count || 0) <= 1) {
      return res.status(400).json({ message: "Nao e permitido excluir o ultimo administrador ativo" });
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

app.get(["/api/state", "/state"], authRequired, async (req, res) => {
  const result = await query("SELECT state_json, updated_at FROM app_state WHERE id = 1");
  const row = result.rows[0];
  if (!row) {
    return res.json({ state: scopedStateForUser(buildDefaultState(), req.user), updatedAt: new Date().toISOString() });
  }

  const parsed = parseStateSafely(row.state_json);
  const scoped = scopedStateForUser(parsed, req.user);
  return res.json({ state: scoped, updatedAt: serializeTimestamp(row.updated_at) });
});

app.put(["/api/state", "/state"], authRequired, async (req, res) => {
  const { state, clientUpdatedAt } = req.body || {};
  if (!state || typeof state !== "object") {
    return res.status(400).json({ message: "Campo state invalido" });
  }

  const now = new Date().toISOString();
  const currentResult = await query("SELECT state_json, updated_at FROM app_state WHERE id = 1");
  const currentRow = currentResult.rows[0];

  const currentUpdatedAt = serializeTimestamp(currentRow?.updated_at);

  if (clientUpdatedAt && currentUpdatedAt && clientUpdatedAt !== currentUpdatedAt) {
    const latestState = parseStateSafely(currentRow?.state_json);
    const scoped = scopedStateForUser(latestState, req.user);
    return res.status(409).json({
      message: "Estado desatualizado. Sincronize e tente novamente.",
      state: scoped,
      updatedAt: currentUpdatedAt,
    });
  }

  const currentState = parseStateSafely(currentRow?.state_json);
  const mergedState = mergeStateForUser(currentState, state, req.user);
  const serialized = JSON.stringify(mergedState);

  await withTransaction(async (client) => {
    await client.query(
      `INSERT INTO app_state (id, state_json, updated_at, updated_by)
       VALUES (1, $1::jsonb, $2, $3)
       ON CONFLICT (id) DO UPDATE SET state_json = EXCLUDED.state_json, updated_at = EXCLUDED.updated_at, updated_by = EXCLUDED.updated_by`,
      [serialized, now, req.user.id]
    );

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
  res.status(500).json({ message });
});

export const startApiServer = () => {
  const server = app.listen(port, () => {
    console.log(`API online em http://localhost:${port}`);
  });
  return server;
};

export default app;
