const supabase = require('../config/supabase');
const { getEffectiveStatus } = require('../utils/chargeHelpers');
const { streamReceiptPDF } = require('../services/receiptService');

// Dados publicos da cobranca, exibidos na pagina /pagar/:chargeId.
// Nao expoe dados sensiveis (ids do Mercado Pago, whatsapp do cliente, etc.).
async function getPublicCharge(req, res) {
  const { chargeId } = req.params;

  const { data: charge, error } = await supabase
    .from('charges')
    .select('*, client:clients(name)')
    .eq('id', chargeId)
    .single();

  if (error || !charge) {
    return res.status(404).json({ error: 'Cobranca nao encontrada.' });
  }

  return res.json({
    id: charge.id,
    client_name: charge.client?.name,
    service_name: charge.service_name,
    description: charge.description,
    amount: charge.amount,
    due_date: charge.due_date,
    status: getEffectiveStatus(charge),
  });
}

// Busca os dados do recibo (somente se a cobranca estiver paga).
async function getPublicReceipt(req, res) {
  const { chargeId } = req.params;

  const { data: charge, error } = await supabase
    .from('charges')
    .select('*, client:clients(name)')
    .eq('id', chargeId)
    .single();

  if (error || !charge) {
    return res.status(404).json({ error: 'Cobranca nao encontrada.' });
  }

  if (charge.status !== 'pago') {
    return res.status(403).json({ error: 'O recibo so fica disponivel apos o pagamento ser confirmado.' });
  }

  return res.json({
    receipt_number: charge.receipt_number,
    client_name: charge.client?.name,
    service_name: charge.service_name,
    description: charge.description,
    amount: charge.amount,
    paid_at: charge.paid_at,
    payment_method: charge.payment_method,
  });
}

// Gera e retorna o PDF do recibo (somente se a cobranca estiver paga).
async function downloadReceiptPdf(req, res) {
  const { chargeId } = req.params;

  const { data: charge, error } = await supabase
    .from('charges')
    .select('*, client:clients(name)')
    .eq('id', chargeId)
    .single();

  if (error || !charge) {
    return res.status(404).json({ error: 'Cobranca nao encontrada.' });
  }

  if (charge.status !== 'pago') {
    return res.status(403).json({ error: 'O recibo so fica disponivel apos o pagamento ser confirmado.' });
  }

  return streamReceiptPDF(charge, res);
}

module.exports = { getPublicCharge, getPublicReceipt, downloadReceiptPdf };
