import { handleOptions } from "../_shared/cors.ts";
import { json, errorResponse } from "../_shared/response.ts";
import { getSupabaseAdmin } from "../_shared/supabaseAdmin.ts";
import { createPreference as createMpPreference } from "../_shared/mercadopago.ts";

function getChargeId(pathname: string): string | undefined {
  const parts = pathname.split("/").filter(Boolean);
  const idx = parts.indexOf("create-preference");
  return idx === -1 ? undefined : parts[idx + 1];
}

// Cria uma preferencia de pagamento no Mercado Pago Checkout Pro para uma
// cobranca. O Access Token so existe aqui (secret da function), nunca no
// frontend. Rota publica: o proprio cliente final aciona ao clicar em
// "Pagar agora" na pagina /pagar/:chargeId.
Deno.serve(async (req) => {
  const cors = handleOptions(req);
  if (cors) return cors;

  if (req.method !== "POST") return errorResponse("Metodo nao permitido.", 405);

  try {
    const url = new URL(req.url);
    let chargeId = getChargeId(url.pathname);

    if (!chargeId) {
      const body = await req.json().catch(() => ({}));
      chargeId = body.chargeId;
    }

    if (!chargeId) return errorResponse("Informe o id da cobranca.", 400);

    const supabase = getSupabaseAdmin();
    const { data: charge, error } = await supabase
      .from("charges")
      .select("*, client:clients(id, name, whatsapp, email)")
      .eq("id", chargeId)
      .single();

    if (error || !charge) return errorResponse("Cobranca nao encontrada.", 404);
    if (charge.status === "pago") return errorResponse("Esta cobranca ja foi paga.", 400);
    if (charge.status === "cancelado") return errorResponse("Esta cobranca foi cancelada.", 400);

    const appUrl = Deno.env.get("APP_URL");
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const notificationUrl = `${supabaseUrl}/functions/v1/mercadopago-webhook`;

    const preferenceBody = {
      items: [
        {
          title: charge.service_name,
          quantity: 1,
          unit_price: Number(charge.amount),
          currency_id: "BRL",
        },
      ],
      external_reference: charge.id,
      back_urls: {
        success: `${appUrl}/pagar/index.html?id=${charge.id}&status=success`,
        failure: `${appUrl}/pagar/index.html?id=${charge.id}&status=failure`,
        pending: `${appUrl}/pagar/index.html?id=${charge.id}&status=pending`,
      },
      auto_return: "approved",
      notification_url: notificationUrl,
    };

    const preference = await createMpPreference(preferenceBody);

    await supabase
      .from("charges")
      .update({ mercado_pago_preference_id: preference.id })
      .eq("id", charge.id);

    return json({
      init_point: preference.init_point || preference.sandbox_init_point,
      preference_id: preference.id,
    });
  } catch (err) {
    console.error("Erro ao criar preferencia no Mercado Pago:", err);
    return errorResponse(
      (err as Error).message || "Falha ao criar preferencia de pagamento.",
      502,
    );
  }
});
