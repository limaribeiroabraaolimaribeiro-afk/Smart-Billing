import { buildWhatsAppMessage, WhatsAppMessageType } from "./chargeHelpers.ts";

// Normaliza um numero de WhatsApp brasileiro para o formato usado pelo wa.me
// (apenas digitos, com codigo do pais 55 quando ausente).
export function sanitizeWhatsAppNumber(rawNumber: string): string {
  const digits = String(rawNumber || "").replace(/\D/g, "");
  if (!digits) return "";
  if (digits.startsWith("55")) return digits;
  return `55${digits}`;
}

export function buildWaLink(whatsapp: string, message: string): string {
  const number = sanitizeWhatsAppNumber(whatsapp);
  const encoded = encodeURIComponent(message);
  return `https://wa.me/${number}?text=${encoded}`;
}

export function buildMessageForCharge(
  charge: {
    client?: { name?: string };
    service_name: string;
    amount: number | string;
    due_date: string;
    payment_link?: string | null;
  },
  type: WhatsAppMessageType = "manual",
): string {
  return buildWhatsAppMessage({
    clientName: charge.client?.name,
    serviceName: charge.service_name,
    amount: charge.amount,
    dueDate: charge.due_date,
    paymentLink: charge.payment_link,
    type,
  });
}

// deno-lint-ignore no-explicit-any
export async function logMessage(
  supabase: any,
  params: {
    chargeId: string;
    clientId: string;
    type: WhatsAppMessageType;
    text: string;
    status: "pending" | "sent" | "failed";
    sentAt?: string | null;
  },
) {
  const { chargeId, clientId, type, text, status, sentAt = null } = params;

  const { data, error } = await supabase
    .from("whatsapp_messages")
    .insert([
      {
        charge_id: chargeId,
        client_id: clientId,
        message_type: type,
        message_text: text,
        status,
        sent_at: sentAt,
      },
    ])
    .select()
    .single();

  if (error) console.error("Erro ao registrar mensagem de WhatsApp:", error.message);
  return data;
}

// -----------------------------------------------------------------------
// Envio automatico real (estrutura preparada, ainda sem provedor configurado).
//
// Quando WHATSAPP_PROVIDER_URL/WHATSAPP_PROVIDER_TOKEN forem preenchidos
// nos secrets do projeto com as credenciais de um provedor (ex: WhatsApp
// Cloud API, Twilio, Z-API etc.), implemente aqui a chamada HTTP real para
// enviar a mensagem. Ate la, a mensagem fica registrada em
// whatsapp_messages com status "pending" para envio manual ou reprocessamento
// futuro.
// -----------------------------------------------------------------------
// deno-lint-ignore no-explicit-any
export async function sendAutomaticMessage(
  supabase: any,
  charge: {
    id: string;
    client_id: string;
    client?: { name?: string; whatsapp?: string };
    service_name: string;
    amount: number | string;
    due_date: string;
    payment_link?: string | null;
  },
  type: WhatsAppMessageType,
) {
  const text = buildMessageForCharge(charge, type);
  const providerUrl = Deno.env.get("WHATSAPP_PROVIDER_URL");
  const providerToken = Deno.env.get("WHATSAPP_PROVIDER_TOKEN");

  if (!providerUrl || !providerToken) {
    return logMessage(supabase, {
      chargeId: charge.id,
      clientId: charge.client_id,
      type,
      text,
      status: "pending",
    });
  }

  try {
    // Exemplo de integracao futura (ajuste o payload conforme o provedor escolhido):
    // await fetch(providerUrl, {
    //   method: "POST",
    //   headers: {
    //     "Content-Type": "application/json",
    //     Authorization: `Bearer ${providerToken}`,
    //   },
    //   body: JSON.stringify({
    //     to: sanitizeWhatsAppNumber(charge.client?.whatsapp || ""),
    //     message: text,
    //   }),
    // });

    return logMessage(supabase, {
      chargeId: charge.id,
      clientId: charge.client_id,
      type,
      text,
      status: "sent",
      sentAt: new Date().toISOString(),
    });
  } catch (err) {
    console.error("Falha ao enviar mensagem automatica de WhatsApp:", (err as Error).message);
    return logMessage(supabase, {
      chargeId: charge.id,
      clientId: charge.client_id,
      type,
      text,
      status: "failed",
    });
  }
}
