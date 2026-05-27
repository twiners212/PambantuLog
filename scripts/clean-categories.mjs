import postgres from 'postgres';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '.env.local') });

const dbUrl = process.env.DATABASE_URL;

if (!dbUrl) {
  console.error("Missing DATABASE_URL");
  process.exit(1);
}

const sql = postgres(dbUrl);

async function clean() {
  try {
    console.log("Cleaning duplicate categories...");
    
    await sql`
      DELETE FROM public.categories
      WHERE ctid NOT IN (
        SELECT MIN(ctid)
        FROM public.categories
        GROUP BY name
      )
    `;

    console.log("Duplicates removed.");
    
    // Add unique constraint manually if it doesn't exist
    try {
      await sql`ALTER TABLE public.categories ADD CONSTRAINT categories_name_unique UNIQUE (name);`;
      console.log("Added unique constraint on name.");
    } catch(e) {
      console.log("Unique constraint might already exist:", e.message);
    }
    
  } catch (err) {
    console.error("Failed:", err);
  } finally {
    process.exit(0);
  }
}

clean();
