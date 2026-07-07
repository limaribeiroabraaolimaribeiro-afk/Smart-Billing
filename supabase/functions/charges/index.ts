import { handleOptions } from "../_shared/cors.ts";
import { json, errorResponse, noContent } from "../_shared/response.ts";
import { requireAdmin, AuthError } from "../_shared/auth.ts";
import { getSupabaseAdmin } from "../_shared/supabaseAdmin.ts";
import { getEffectiveStatus } from "../_shared/chargeHelpers.ts";
import { buildMessageForCharge, buildWaLink, logMessage } from "../_shared/whatsapp.ts";

const VALID_FILTERS = ["pendente", "vence_hoje", "atrasado", "pago", "cancelado"];
const CLIENT_SELECT = "*, client:clients(id, name, whatsapp, email)";

// deno-lint-ignore no-explicit-any
function withEffectiveStatus(charge: any) {
  return { ...charge, effective_status: getEffectiveStatus(charge) };
}

// Extrai [id, action] de "/charges/:id/:action" (ex.: /charges/abc/cancel).
function getSubPath(pathname: string): string[] {
  const parts = pathname.split("/").filter(Boolean);
  const idx = parts.indexOf("charges");
  return idx === -1 ? [] : parts.slice(idx + 1);
}

Deno.serve(async (req) => {
  const cors = handleOptions(req);
  if (cors) return cors;

  try {
    requireAdmin(req);

    const supabase = getSupabaseAdmin();
    const url = new URL(req.url);
    const [id, action] = getSubPath(url.pathname);

    // GET /charges -> lista com filtros
    if (req.method === "GET" && !id) {
      const status = url.searchParams.get("status");
      const search = url.searchParams.get("search");

      const { data, error } = await supabase
        .from("charges")
        .select(CLIENT_SELECT)
        .order("due_date", { ascending: true });

      if (error) return errorResponse(error.message, 500);

      let charges = (data || []).map(withEffectiveStatus);

      if (status && VALID_FILTERS.includes(status)) {
        charges = charges.filter((c: any) => c.effective_status === status);
      }

      if (search) {
        const term = search.toLowerCase();
        charges = charges.filter(
          (c: any) =>
            c.service_name?.toLowerCase().includes(term) ||
            c.client?.name?.toLowerCase().includes(term),
        );
      }

      return json(charges);
    }

    // GET /charges/:id
    if (req.method === "GET" && id && !action) {
      const { data, error } = await supabase
        .from("charges")
        .select(CLIENT_SELECT)
        .eq("id", id)
        .single();

      if (error) return errorResponse("Cobranca nao encontrada.", 404);
      return json(withEffectiveStatus(data));
    }

    // POST /charges -> cria cobranca
    if (req.method === "POST" && !id) {
      const body = await req.json();
      const { client_id, service_name, description, amount, due_date } = body;

      if (!client_id || !service_name || !amount || !due_date) {
        return errorResponse(
          "client_id, service_name, amount e due_date sao obrigatorios.",
          400,
        );
      }

      const { data: inserted, error } = await supabase
        .from("charges")
        .insert([
          {
            client_id,
            service_name,
            description: description || null,
            amount,
            due_date,
            status: "pendente",
          },
        ])
        .select(CLIENT_SELECT)
        .single();

      if (error) return errorResponse(error.message, 500);

      const appUrl = Deno.env.get("APP_URL");
      // Query string em vez de path param: o frontend agora e 100% estatico
      // (Supabase Storage, Edge Function "app" ou qualquer host estatico) e
      // nao ha servidor para reescrever "/pagar/:id" em "/pagar/index.html".
      const paymentLink = `${appUrl}/pagar/index.html?id=${inserted.id}`;

      const { data: updated, error: updateError } = await supabase
        .from("charges")
        .update({ payment_link: paymentLink })
        .eq("id", inserted.id)
        .select(CLIENT_SELECT)
        .single();

      if (updateError) return errorResponse(updateError.message, 500);
      return json(withEffectiveStatus(updated), { status: 201 });
    }

    // PUT /charges/:id -> edita cobranca (nao permitido se ja paga)
    if (req.method === "PUT" && id && !action) {
      const { data: existing, error: fetchError } = await supabase
        .from("charges")
        .select("*")
        .eq("id", id)
        .single();

      if (fetchError) return errorResponse("Cobranca nao encontrada.", 404);
      if (existing.status === "pago") {
        return errorResponse("Nao e possivel editar uma cobranca ja paga.", 400);
      }

      const body = await req.json();
      const { service_name, description, amount, due_date } = body;

      const { data, error } = await supabase
        .from("charges")
        .update({ service_name, description, amount, due_date })
        .eq("id", id)
        .select(CLIENT_SELECT)
        .single();

      if (error) return errorResponse(error.message, 500);
      return json(withEffectiveStatus(data));
    }

    // POST /charges/:id/cancel
    if (req.method === "POST" && id && action === "cancel") {
      const { data: existing, error: fetchError } = await supabase
        .from("charges")
        .select("*")
        .eq("id", id)
        .single();

      if (fetchError) return errorResponse("Cobranca nao encontrada.", 404);
      if (existing.status === "pago") {
        return errorResponse("Nao e possivel cancelar uma cobranca ja paga.", 400);
      }

      const { data, error } = await supabase
        .from("charges")
        .update({ status: "cancelado" })
        .eq("id", id)
        .select(CLIENT_SELECT)
        .single();

      if (error) return errorResponse(error.message, 500);
      return json(withEffectiveStatus(data));
    }

    // POST /charges/:id/whatsapp-message -> monta mensagem + link wa.me
    if (req.method === "POST" && id && action === "whatsapp-message") {
      const { data: charge, error } = await supabase
        .from("charges")
        .select(CLIENT_SELECT)
        .eq("id", id)
        .single();

      if (error || !charge) return errorResponse("Cobranca nao encontrada.", 404);
      if (charge.status === "pago") {
        return errorResponse("Esta cobranca ja esta paga, nao e necessario cobrar.", 400);
      }

      const text = buildMessageForCharge(charge, "manual");
      const waLink = buildWaLink(charge.client.whatsapp, text);

      await logMessage(supabase, {
        chargeId: charge.id,
        clientId: charge.client_id,
        type: "manual",
        text,
        status: "sent",
        sentAt: new Date().toISOString(),
      });

      return json({ message: text, wa_link: waLink });
    }

    // DELETE /charges/:id
    if (req.method === "DELETE" && id && !action) {
      const { error } = await supabase.from("charges").delete().eq("id", id);
      if (error) return errorResponse(error.message, 500);
      return noContent();
    }

    return errorResponse("Rota nao encontrada.", 404);
  } catch (err) {
    if (err instanceof AuthError) return errorResponse(err.message, 401);
    console.error("Erro na function charges:", err);
    return errorResponse((err as Error).message || "Erro inesperado.", 500);
  }
});
