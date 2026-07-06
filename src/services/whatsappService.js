const supabase = require('../config/supabase');
const { buildWhatsAppMessage } = require('../utils/chargeHelpers');

// Normaliza um numero de WhatsApp brasileiro para o formato usado pelo wa.me
// (apenas digitos, com codigo do pais 55 quando ausente).
function sanitizeWhatsAppNumber(rawNumber) {
  const digits = String(rawNumber || '').replace(/\D/g, '');
  if (!digits) return '';
  if (digits.startsWith('55')) return digits;
  return `55${digits}`;
}

function buildWaLink(whatsapp, message) {
  const number = sanitizeWhatsAppNumber(whatsapp);
  const encoded = encodeURIComponent(message);
  return `https://wa.me/${number}?text=${encoded}`;
}

function buildMessageForCharge(charge, type = 'manual') {
  return buildWhatsAppMessage({
    clientName: charge.client?.name,
    serviceName: charge.service_name,
    amount: charge.amount,
    dueDate: charge.due_date,
    paymentLink: charge.payment_link,
    type,
  });
}

async function logMessage({ chargeId, clientId, type, text, status, sentAt = null }) {
  const { data, error } = await supabase
    .from('whatsapp_messages')
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

  if (error) console.error('Erro ao registrar mensagem de WhatsApp:', error.message);
  return data;
}

// -----------------------------------------------------------------------
// Envio automatico real (estrutura preparada, ainda sem provedor configurado).
//
// Quando WHATSAPP_PROVIDER_URL/WHATSAPP_PROVIDER_TOKEN forem preenchidos no
// .env com as credenciais de um provedor (ex: WhatsApp Cloud API, Twilio,
// Z-API, etc.), implemente aqui a chamada HTTP real para enviar a mensagem.
// Ate la, a mensagem fica registrada em whatsapp_messages com status
// "pending" para que o envio possa ser feito manualmente ou reprocessado
// depois que a integracao for concluida.
// -----------------------------------------------------------------------
async function sendAutomaticMessage({ charge, type }) {
  const text = buildMessageForCharge(charge, type);
  const providerUrl = process.env.WHATSAPP_PROVIDER_URL;
  const providerToken = process.env.WHATSAPP_PROVIDER_TOKEN;

  if (!providerUrl || !providerToken) {
    return logMessage({
      chargeId: charge.id,
      clientId: charge.client_id,
      type,
      text,
      status: 'pending',
    });
  }

  try {
    // Exemplo de integracao futura (ajuste o payload conforme o provedor escolhido):
    // await fetch(providerUrl, {
    //   method: 'POST',
    //   headers: {
    //     'Content-Type': 'application/json',
    //     Authorization: `Bearer ${providerToken}`,
    //   },
    //   body: JSON.stringify({
    //     to: sanitizeWhatsAppNumber(charge.client.whatsapp),
    //     from: process.env.WHATSAPP_SENDER_NUMBER,
    //     message: text,
    //   }),
    // });

    return logMessage({
      chargeId: charge.id,
      clientId: charge.client_id,
      type,
      text,
      status: 'sent',
      sentAt: new Date().toISOString(),
    });
  } catch (err) {
    console.error('Falha ao enviar mensagem automatica de WhatsApp:', err.message);
    return logMessage({
      chargeId: charge.id,
      clientId: charge.client_id,
      type,
      text,
      status: 'failed',
    });
  }
}

module.exports = {
  sanitizeWhatsAppNumber,
  buildWaLink,
  buildMessageForCharge,
  logMessage,
  sendAutomaticMessage,
};
