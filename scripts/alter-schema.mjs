import postgres from 'postgres';
import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

async function run() {
  const sql = postgres(process.env.DATABASE_URL);
  try {
    await sql`ALTER TABLE tickets ADD COLUMN IF NOT EXISTS attachment_url text;`;
    console.log("Column attachment_url added to tickets.");
  } catch (err) {
    console.error("Error:", err);
  } finally {
    process.exit(0);
  }
}
run();
