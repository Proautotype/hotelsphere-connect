import fs from "node:fs";

const env = {};
for (const line of fs.readFileSync(".env.local", "utf8").split("\n")) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m) env[m[1]] = m[2].trim().replace(/^['"]|['"]$/g, "");
}

// Check auth.users on mcqwnkkk via the Admin API
try {
  const res = await fetch(`${env.SUPABASE_URL}/auth/v1/admin/users?per_page=200`, {
    headers: { apikey: env.SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}` },
    signal: AbortSignal.timeout(12000),
  });
  const body = await res.json();
  console.log("mcqwnkkk admin/users status:", res.status);
  console.log("users:", JSON.stringify(body).slice(0, 300));
} catch (e) {
  console.log("ERR", String(e).slice(0, 200));
}