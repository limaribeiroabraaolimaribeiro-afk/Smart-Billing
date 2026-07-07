import { createClient } from "npm:@supabase/supabase-js@2";

// SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY sao injetados automaticamente
// pelo runtime das Edge Functions (nao precisam ser criados manualmente
// com `supabase secrets set`). O client usa a service role, entao
// so deve ser importado dentro de Edge Functions (nunca no frontend).
export function getSupabaseAdmin() {
  const url = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!url || !serviceKey) {
    throw new Error(
      "SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY nao disponiveis no ambiente da function.",
    );
  }

  return createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
