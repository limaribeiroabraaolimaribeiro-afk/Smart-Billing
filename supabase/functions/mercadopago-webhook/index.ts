import { corsHeaders, handleOptions } from "../_shared/cors.ts";
import { getSupabaseAdmin } from "../_shared/supabaseAdmin.ts";
import { getPayment } from "../_shared/mercadopago.ts";
import { generateReceiptNumber } from "../_shared/chargeHelpers.ts";

// Extrai o id do pagamento e o tipo de notificacao, tanto do formato antigo
// (query params: ?type=payment&data.id=123) quanto do formato novo (body JSON).
async function extractNotification(req: Request) {
  const url = new URL(req.url);
  let body: any = {};

  if (req.method === "POST") {
    body = await req.json().catch(() => ({}));
  }

  const type = url.searchParams.get("type") || body?.type || body?.action?.split(".")[0];
  const paymentId =
    url.searchParams.get("data.id") || body?.data?.id || url.searchParams.get("id") || body?.id;

  return { type, paymentId };
}

function ok(payload: Record<string, unknown>) {
  return new Response(JSON.stringify(payload), {
    status: 200,
    headers: { "Content-Type": "application/json", ...corsHeaders },
  });
}

// Recebe as notificacoes (webhooks) do Mercado Pago.
// Sempre responde 200 rapidamente para evitar reenvios desnecessarios,
// mas so processa o pagamento quando consegue confirmar os dados junto a
// API do Mercado Pago (nunca confia apenas no payload recebido).
Deno.serve(async (req) => {
  const cors = handleOptions(req);
  if (cors) return cors;

  try {
    const { type, paymentId } = await extractNotification(req);

    if (type !== "payment" || !paymentId) {
      return ok({ received: true, ignored: true });
    }

    const payment = await getPayment(String(paymentId));
    const chargeId = payment.external_reference;

    if (!chargeId) {
      return ok({ received: true, ignored: true, reason: "sem external_reference" });
    }

    const supabase = getSupabaseAdmin();

    await supabase.from("payment_logs").insert([
      {
        charge_id: chargeId,
        mercado_pago_payment_id: String(payment.id),
        status: payment.status,
        raw_response: payment,
      },
    ]);

    if (payment.status === "approved") {
      const { data: charge } = await supabase
        .from("charges")
        .select("*")
        .eq("id", chargeId)
        .single();

      // Idempotencia: se ja estiver paga, nao processa de novo.
      if (charge && charge.status !== "pago") {
        const receiptNumber = generateReceiptNumber();

        await supabase
          .from("charges")
          .update({
            status: "pago",
            mercado_pago_payment_id: String(payment.id),
            payment_method: payment.payment_type_id || payment.payment_method_id || null,
            paid_at: new Date().toISOString(),
            receipt_number: receiptNumber,
          })
          .eq("id", chargeId);

        await supabase
          .from("receipt_logs")
          .insert([{ charge_id: chargeId, receipt_number: receiptNumber }]);
      }
    }

    return ok({ received: true });
  } catch (err) {
    console.error("Erro ao processar webhook do Mercado Pago:", err);
    // Retornamos 200 mesmo em erro interno para evitar loop de reenvio do MP;
    // o erro fica registrado no log da function para investigacao.
    return ok({ received: true, error: true });
  }
});
