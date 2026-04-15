import { Pool } from "pg";
import {
  migrateFromLegacyBlobState,
  parseLegacyState,
  runProperSchemaMigration,
} from "../relational-crm.mjs";

const databaseUrl =
  process.env.DATABASE_URL ||
  process.env.POSTGRES_URL ||
  process.env.POSTGRES_PRISMA_URL ||
  "";

if (!databaseUrl) {
  throw new Error("DATABASE_URL nao configurada.");
}

const useSsl = !/(localhost|127\.0\.0\.1)/i.test(databaseUrl);
const pool = new Pool({
  connectionString: databaseUrl,
  ssl: useSsl ? { rejectUnauthorized: false } : false,
});

pool.on("connect", (client) => {
  void client.query("SET client_encoding TO 'UTF8'");
});

const run = async () => {
  const client = await pool.connect();
  try {
    await client.query("SET client_encoding TO 'UTF8'");
    await client.query("BEGIN");
    await runProperSchemaMigration(client.query.bind(client));

    const stateResult = await client.query("SELECT state_json FROM app_state WHERE id = 1");
    const stateRow = stateResult.rows[0];
    if (!stateRow?.state_json) {
      console.log("Nenhum blob legado encontrado em app_state.");
      await client.query("COMMIT");
      return;
    }

    const parsed = parseLegacyState(stateRow.state_json, {});
    console.log("Migrando dados do blob legado...");
    console.log(`Funis encontrados: ${Array.isArray(parsed.funnels) ? parsed.funnels.length : 0}`);
    console.log(`Leads encontrados: ${Array.isArray(parsed.leads) ? parsed.leads.length : 0}`);

    await migrateFromLegacyBlobState(client, parsed);

    await client.query("COMMIT");
    console.log("Migracao concluida com sucesso.");
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Falha ao migrar blob legado:", error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
};

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
