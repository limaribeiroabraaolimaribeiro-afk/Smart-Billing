import { handleOptions } from "../_shared/cors.ts";
import { json, errorResponse } from "../_shared/response.ts";
import { getSupabaseAdmin } from "../_shared/supabaseAdmin.ts";
import { getEffectiveStatus } from "../_shared/chargeHelpers.ts";

function getChargeId(pathname: string): string | undefined {
  const parts = pathname.split("/").filter(Boolean);
  const idx = parts.indexOf("public-charge");
  return idx === -1 ? undefined : parts[idx + 1];
}

// Dados publicos da cobranca, exibidos na pagina /pagar/:chargeId.
// Nao expoe dados sensiveis (ids do Mercado Pago, whatsapp do cliente etc.).
Deno.serve(async (req) => {
  const cors = handleOptions(req);
  if (cors) return cors;

  if (req.method !== "GET") return errorResponse("Metodo nao permitido.", 405);

  try {
    const url = new URL(req.url);
    const chargeId = getChargeId(url.pathname);
    if (!chargeId) return errorResponse("Informe o id da cobranca.", 400);

    const supabase = getSupabaseAdmin();
    const { data: charge, error } = await supabase
      .from("charges")
      .select("*, client:clients(name)")
      .eq("id", chargeId)
      .single();

    if (error || !charge) return errorResponse("Cobranca nao encontrada.", 404);

    return json({
      id: charge.id,
      client_name: charge.client?.name,
      service_name: charge.service_name,
      description: charge.description,
      amount: charge.amount,
      due_date: charge.due_date,
      status: getEffectiveStatus(charge),
    });
  } catch (err) {
    console.error("Erro na function public-charge:", err);
    return errorResponse((err as Error).message || "Erro inesperado.", 500);
  }
});
