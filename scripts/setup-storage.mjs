import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function setup() {
  const { data: buckets, error: listError } = await supabase.storage.listBuckets();
  if (listError) {
    console.error("Error listing buckets:", listError);
    return;
  }
  
  if (!buckets.some(b => b.name === "attachments")) {
    const { data, error } = await supabase.storage.createBucket("attachments", {
      public: true,
      fileSizeLimit: 5242880, // 5MB
      allowedMimeTypes: ["image/png", "image/jpeg", "application/pdf"],
    });
    if (error) {
      console.error("Error creating bucket:", error);
    } else {
      console.log("Created public 'attachments' bucket.");
    }
  } else {
    console.log("Bucket 'attachments' already exists.");
  }
}
setup();
