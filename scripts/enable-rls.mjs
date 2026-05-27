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

async function enableRLS() {
  try {
    console.log("Enabling RLS on public tables...");
    
    await sql`ALTER TABLE public.tickets ENABLE ROW LEVEL SECURITY;`;
    console.log("- RLS enabled for public.tickets");
    
    await sql`ALTER TABLE public.ticket_comments ENABLE ROW LEVEL SECURITY;`;
    console.log("- RLS enabled for public.ticket_comments");
    
    await sql`ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;`;
    console.log("- RLS enabled for public.users");
    
    await sql`ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;`;
    console.log("- RLS enabled for public.categories");
    
    console.log("Done.");
  } catch (err) {
    console.error("Failed:", err);
  } finally {
    process.exit(0);
  }
}

enableRLS();
