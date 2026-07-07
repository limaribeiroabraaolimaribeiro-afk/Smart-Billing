// Cabecalhos CORS compartilhados por todas as Edge Functions.
// Access-Control-Allow-Origin fica em "*" porque o frontend pode ser
// hospedado em dominios diferentes (Supabase Storage, Vercel, Netlify etc.).
export const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
};

// Chame no inicio de cada function; se retornar uma Response, devolva-a direto.
export function handleOptions(req: Request): Response | null {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  return null;
}
