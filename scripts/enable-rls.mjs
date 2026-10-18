import postgres from 'postgres';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '..', '.env.local') });

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

    console.log("Applying baseline RLS policies...");

    // 1. Categories: read-only for all users (anon & authenticated)
    await sql`
      DO $$ BEGIN
        CREATE POLICY "Allow read categories for all"
        ON public.categories FOR SELECT
        TO public USING (true);
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$;
    `;
    console.log("- Policy: Allow read categories for all");

    // 2. Users: read profile for authenticated users
    await sql`
      DO $$ BEGIN
        CREATE POLICY "Allow read users for authenticated"
        ON public.users FOR SELECT
        TO authenticated USING (true);
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$;
    `;
    console.log("- Policy: Allow read users for authenticated");

    // 3. Tickets: read tickets for authenticated
    await sql`
      DO $$ BEGIN
        CREATE POLICY "Allow read tickets for authenticated"
        ON public.tickets FOR SELECT
        TO authenticated USING (true);
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$;
    `;
    console.log("- Policy: Allow read tickets for authenticated");

    // 4. Ticket comments: read comments for authenticated
    await sql`
      DO $$ BEGIN
        CREATE POLICY "Allow read comments for authenticated"
        ON public.ticket_comments FOR SELECT
        TO authenticated USING (true);
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$;
    `;
    console.log("- Policy: Allow read comments for authenticated");

    console.log("Done.");
  } catch (err) {
    console.error("Failed:", err);
  } finally {
    process.exit(0);
  }
}

enableRLS();
