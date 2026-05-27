import { createClient } from '@supabase/supabase-js';
import postgres from 'postgres';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const dbUrl = process.env.DATABASE_URL;

if (!supabaseUrl || !serviceRoleKey || !dbUrl) {
  console.error("Missing environment variables. Please check .env.local");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false }
});
const sql = postgres(dbUrl);

async function createAccount(email, password, fullName, role, department) {
  console.log(`Creating/updating ${role} account (${email})...`);
  
  const { data: authData, error: authError } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });

  let userId;
  if (authError) {
    if (authError.message.includes('already been registered') || authError.code === 'email_exists') {
      console.log(`User ${email} already exists in auth.users, fetching ID...`);
      const [existingUser] = await sql`SELECT id FROM auth.users WHERE email = ${email} LIMIT 1`;
      userId = existingUser.id;
      // Update password
      await supabase.auth.admin.updateUserById(userId, { password });
    } else {
      console.error(`Failed to create auth user ${email}:`, authError);
      return;
    }
  } else {
    userId = authData.user.id;
  }

  console.log(`Inserting/updating profile for ${email} in public.users...`);
  await sql`
    INSERT INTO public.users (id, full_name, email, role, department, created_at)
    VALUES (${userId}, ${fullName}, ${email}, ${role}, ${department}, NOW())
    ON CONFLICT (id) DO UPDATE SET 
      full_name = EXCLUDED.full_name,
      role = EXCLUDED.role,
      department = EXCLUDED.department;
  `;
  console.log(`Successfully configured ${role} account.`);
}

async function seed() {
  try {
    console.log("Starting seed script...");
    
    // 1. Create Admin Account
    await createAccount(
      process.env.SEED_ADMIN_EMAIL || 'admin@company.com',
      process.env.SEED_ADMIN_PASSWORD || 'changeme_admin',
      'Admin Master', 'admin', 'IT'
    );
    
    // 2. Create User Account
    await createAccount(
      process.env.SEED_USER_EMAIL || 'karyawan@company.com',
      process.env.SEED_USER_PASSWORD || 'changeme_user',
      'Karyawan Biasa', 'karyawan', 'Operations'
    );

    console.log("Inserting default categories...");
    await sql`
      INSERT INTO public.categories (id, name, description)
      VALUES 
        (gen_random_uuid(), 'Hardware', 'Issues with physical devices'),
        (gen_random_uuid(), 'Software', 'Issues with applications and OS'),
        (gen_random_uuid(), 'Network', 'Internet and local network issues'),
        (gen_random_uuid(), 'Access', 'Account and permission requests'),
        (gen_random_uuid(), 'HR', 'Human Resources related requests')
      ON CONFLICT DO NOTHING;
    `;

    console.log("Seed complete! You can now log in.");
  } catch (err) {
    console.error("Failed to seed:", err);
  } finally {
    process.exit(0);
  }
}

seed();
