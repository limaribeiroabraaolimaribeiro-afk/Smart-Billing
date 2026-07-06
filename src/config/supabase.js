const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.warn(
    '[Smart Billing] Atencao: SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY nao configurados no .env'
  );
}

// Cliente Supabase usado apenas no backend, com a service role key.
// NUNCA importe este arquivo em codigo que roda no navegador.
const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

module.exports = supabase;
