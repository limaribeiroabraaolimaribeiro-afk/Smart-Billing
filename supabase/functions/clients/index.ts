import { handleOptions } from "../_shared/cors.ts";
import { json, errorResponse, noContent } from "../_shared/response.ts";
import { requireAdmin, AuthError } from "../_shared/auth.ts";
import { getSupabaseAdmin } from "../_shared/supabaseAdmin.ts";

// Extrai o que vem depois de "/clients" na URL (ex.: o :id).
function getSubPath(pathname: string): string[] {
  const parts = pathname.split("/").filter(Boolean);
  const idx = parts.indexOf("clients");
  return idx === -1 ? [] : parts.slice(idx + 1);
}

Deno.serve(async (req) => {
  const cors = handleOptions(req);
  if (cors) return cors;

  try {
    requireAdmin(req);

    const supabase = getSupabaseAdmin();
    const url = new URL(req.url);
    const [id] = getSubPath(url.pathname);

    if (req.method === "GET" && !id) {
      const search = url.searchParams.get("search");
      let query = supabase.from("clients").select("*").order("name", { ascending: true });
      if (search) {
        query = query.or(
          `name.ilike.%${search}%,whatsapp.ilike.%${search}%,email.ilike.%${search}%`,
        );
      }
      const { data, error } = await query;
      if (error) return errorResponse(error.message, 500);
      return json(data);
    }

    if (req.method === "GET" && id) {
      const { data, error } = await supabase.from("clients").select("*").eq("id", id).single();
      if (error) return errorResponse("Cliente nao encontrado.", 404);
      return json(data);
    }

    if (req.method === "POST") {
      const body = await req.json();
      const { name, whatsapp, email } = body;

      if (!name || !whatsapp) {
        return errorResponse("Nome e WhatsApp sao obrigatorios.", 400);
      }

      const { data, error } = await supabase
        .from("clients")
        .insert([{ name, whatsapp, email: email || null }])
        .select()
        .single();

      if (error) return errorResponse(error.message, 500);
      return json(data, { status: 201 });
    }

    if (req.method === "PUT" && id) {
      const body = await req.json();
      const { name, whatsapp, email } = body;

      const { data, error } = await supabase
        .from("clients")
        .update({ name, whatsapp, email: email || null })
        .eq("id", id)
        .select()
        .single();

      if (error) return errorResponse(error.message, 500);
      return json(data);
    }

    if (req.method === "DELETE" && id) {
      const { error } = await supabase.from("clients").delete().eq("id", id);
      if (error) return errorResponse(error.message, 500);
      return noContent();
    }

    return errorResponse("Rota nao encontrada.", 404);
  } catch (err) {
    if (err instanceof AuthError) return errorResponse(err.message, 401);
    console.error("Erro na function clients:", err);
    return errorResponse((err as Error).message || "Erro inesperado.", 500);
  }
});
