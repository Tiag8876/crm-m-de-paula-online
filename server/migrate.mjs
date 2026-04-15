import { fileURLToPath } from "node:url";
import { Pool } from "pg";

const databaseUrl =
  process.env.DATABASE_URL ||
  process.env.POSTGRES_URL ||
  process.env.POSTGRES_PRISMA_URL ||
  "";

const withUtf8ConnectionString = (rawUrl) => {
  try {
    const parsed = new URL(rawUrl);
    parsed.searchParams.set("client_encoding", "UTF8");
    return parsed.toString();
  } catch {
    return rawUrl;
  }
};

const createPool = () => {
  if (!databaseUrl) {
    throw new Error("DATABASE_URL not configured.");
  }

  const useSsl = !/(localhost|127\.0\.0\.1)/i.test(databaseUrl);
  return new Pool({
    connectionString: withUtf8ConnectionString(databaseUrl),
    ssl: useSsl ? { rejectUnauthorized: false } : false,
    max: 1,
  });
};

export const runRelationalTablesMigration = async (executor) => {
  await executor(`CREATE EXTENSION IF NOT EXISTS pgcrypto;`);

  await executor(`
    CREATE TABLE IF NOT EXISTS funnels (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      name TEXT NOT NULL,
      position INTEGER NOT NULL DEFAULT 0,
      color TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS funnel_stages (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      funnel_id UUID REFERENCES funnels(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      position INTEGER NOT NULL DEFAULT 0,
      color TEXT
    );

    CREATE TABLE IF NOT EXISTS leads (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      name TEXT NOT NULL,
      email TEXT,
      phone TEXT,
      company TEXT,
      funnel_id UUID REFERENCES funnels(id) ON DELETE SET NULL,
      stage_id UUID REFERENCES funnel_stages(id) ON DELETE SET NULL,
      contract_value NUMERIC(15,2),
      notes TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS financial_records (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      lead_id UUID REFERENCES leads(id) ON DELETE CASCADE,
      description TEXT,
      amount NUMERIC(15,2),
      due_date DATE,
      paid_date DATE,
      status VARCHAR(50) NOT NULL DEFAULT 'pending',
      type VARCHAR(50) NOT NULL DEFAULT 'receivable',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS activities (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      lead_id UUID REFERENCES leads(id) ON DELETE CASCADE,
      type TEXT,
      description TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE INDEX IF NOT EXISTS idx_funnel_stages_funnel_id
      ON funnel_stages(funnel_id);

    CREATE INDEX IF NOT EXISTS idx_leads_funnel_id
      ON leads(funnel_id);

    CREATE INDEX IF NOT EXISTS idx_leads_stage_id
      ON leads(stage_id);

    CREATE INDEX IF NOT EXISTS idx_financial_records_lead_id
      ON financial_records(lead_id);

    CREATE INDEX IF NOT EXISTS idx_activities_lead_id
      ON activities(lead_id);
  `);
};

export const runMigration = async () => {
  const pool = createPool();
  pool.on("connect", (client) => {
    void client.query("SET client_encoding TO 'UTF8'");
  });

  try {
    await runRelationalTablesMigration((text, params = []) => pool.query(text, params));
    console.log("Relational migration completed.");
  } finally {
    await pool.end();
  }
};

const isDirectRun = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];

if (isDirectRun) {
  runMigration().catch((error) => {
    console.error("Relational migration failed:", error);
    process.exitCode = 1;
  });
}
