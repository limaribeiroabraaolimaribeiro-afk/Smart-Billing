import { handleOptions } from "../_shared/cors.ts";
import { json, errorResponse } from "../_shared/response.ts";
import { getSupabaseAdmin } from "../_shared/supabaseAdmin.ts";
import { daysBetween, todayISODate, WhatsAppMessageType } from "../_shared/chargeHelpers.ts";
import { sendAutomaticMessage } from "../_shared/whatsapp.ts";

// Regras de cobranca automatica via WhatsApp:
// - 3 dias antes do vencimento -> "before_due"
// - no dia do vencimento       -> "due_today"
// - 2 dias apos o atraso       -> "overdue"
// Cobrancas pagas ou canceladas nunca recebem mensagem.
function resolveMessageType(dueDate: string): WhatsAppMessageType | null {
  const diff = daysBetween(todayISODate(), dueDate); // due_date - hoje

  if (diff === 3) return "before_due";
  if (diff === 0) return "due_today";
  if (diff === -2) return "overdue";
  return null;
}

// deno-lint-ignore no-explicit-any
async function alreadyNotifiedToday(supabase: any, chargeId: string, type: string) {
  const startOfDay = `${todayISODate()}T00:00:00.000Z`;

  const { data, error } = await supabase
    .from("whatsapp_messages")
    .select("id")
    .eq("charge_id", chargeId)
    .eq("message_type", type)
    .gte("created_at", startOfDay)
    .limit(1);

  if (error) {
    console.error("Erro ao verificar mensagens ja enviadas:", error.message);
    return true; // por seguranca, nao duplica envio se a checagem falhar
  }

  return (data || []).length > 0;
}

// Esta function e chamada pelo Supabase Cron (pg_cron + pg_net), uma vez
// por dia (ver database/cron.sql). Protegida por um segredo compartilhado
// (CRON_SECRET) enviado no header "x-cron-secret", ja que verify_jwt esta
// desligado para todas as functions deste projeto.
Deno.serve(async (req) => {
  const cors = handleOptions(req);
  if (cors) return cors;

  const cronSecret = Deno.env.get("CRON_SECRET");
  const providedSecret = req.headers.get("x-cron-secret");

  if (cronSecret && providedSecret !== cronSecret) {
    return errorResponse("Nao autorizado.", 401);
  }

  try {
    const supabase = getSupabaseAdmin();

    const { data: charges, error } = await supabase
      .from("charges")
      .select("*, client:clients(id, name, whatsapp, email)")
      .eq("status", "pendente");

    if (error) return errorResponse(error.message, 500);

    let processed = 0;

    for (const charge of charges || []) {
      if (!charge.client) continue;

      const type = resolveMessageType(charge.due_date);
      if (!type) continue;

      const jaEnviada = await alreadyNotifiedToday(supabase, charge.id, type);
      if (jaEnviada) continue;

      await sendAutomaticMessage(supabase, charge, type);
      processed++;
    }

    return json({ ok: true, processed });
  } catch (err) {
    console.error("Erro no whatsapp-cron:", err);
    return errorResponse((err as Error).message || "Erro inesperado.", 500);
  }
});
