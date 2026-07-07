import { handleOptions } from "../_shared/cors.ts";
import { json, errorResponse } from "../_shared/response.ts";
import { getSupabaseAdmin } from "../_shared/supabaseAdmin.ts";

function getChargeId(pathname: string): string | undefined {
  const parts = pathname.split("/").filter(Boolean);
  const idx = parts.indexOf("receipt");
  return idx === -1 ? undefined : parts[idx + 1];
}

// Retorna os dados do recibo de uma cobranca - somente se ela estiver paga.
// A pagina /recibo/:chargeId consome este JSON e renderiza um HTML
// imprimivel (botao "Imprimir / Salvar PDF" usa window.print() no navegador,
// evitando depender de geracao de PDF binario dentro da Edge Function).
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

    if (charge.status !== "pago") {
      return errorResponse(
        "O recibo so fica disponivel apos o pagamento ser confirmado.",
        403,
      );
    }

    return json({
      receipt_number: charge.receipt_number,
      client_name: charge.client?.name,
      service_name: charge.service_name,
      description: charge.description,
      amount: charge.amount,
      paid_at: charge.paid_at,
      payment_method: charge.payment_method,
    });
  } catch (err) {
    console.error("Erro na function receipt:", err);
    return errorResponse((err as Error).message || "Erro inesperado.", 500);
  }
});
