import postgres from 'postgres';
import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

async function run() {
  const sql = postgres(process.env.DATABASE_URL);
  try {
    await sql`
      CREATE POLICY "Allow authenticated updates"
      ON storage.objects FOR UPDATE TO authenticated
      USING ( bucket_id = 'attachments' );
    `;
    console.log("Update policy created.");
  } catch (err) {
    console.error("Error creating update policy:", err.message);
  }

  process.exit(0);
}
run();
