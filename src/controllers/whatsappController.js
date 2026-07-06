const supabase = require('../config/supabase');
const { buildMessageForCharge, buildWaLink, logMessage } = require('../services/whatsappService');

// Usado pelo painel admin: monta a mensagem de cobranca e o link do WhatsApp
// para o botao "Enviar cobranca pelo WhatsApp" (o envio de fato acontece
// quando o admin clica no link wa.me, abrindo o WhatsApp Web/App dele).
async function buildManualMessage(req, res) {
  const { id } = req.params;

  const { data: charge, error } = await supabase
    .from('charges')
    .select('*, client:clients(id, name, whatsapp, email)')
    .eq('id', id)
    .single();

  if (error || !charge) {
    return res.status(404).json({ error: 'Cobranca nao encontrada.' });
  }

  if (charge.status === 'pago') {
    return res.status(400).json({ error: 'Esta cobranca ja esta paga, nao e necessario cobrar.' });
  }

  const text = buildMessageForCharge(charge, 'manual');
  const waLink = buildWaLink(charge.client.whatsapp, text);

  await logMessage({
    chargeId: charge.id,
    clientId: charge.client_id,
    type: 'manual',
    text,
    status: 'sent',
    sentAt: new Date().toISOString(),
  });

  return res.json({ message: text, wa_link: waLink });
}

module.exports = { buildManualMessage };
