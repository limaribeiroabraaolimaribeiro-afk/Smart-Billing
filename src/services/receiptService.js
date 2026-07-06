const PDFDocument = require('pdfkit');
const { formatCurrencyBRL, formatDateBR } = require('../utils/chargeHelpers');

const PAYMENT_METHOD_LABELS = {
  credit_card: 'Cartao de credito',
  debit_card: 'Cartao de debito',
  ticket: 'Boleto',
  bank_transfer: 'Transferencia / Pix',
  account_money: 'Saldo Mercado Pago',
};

function paymentMethodLabel(method) {
  if (!method) return 'Nao informado';
  return PAYMENT_METHOD_LABELS[method] || method;
}

// Gera o PDF do recibo de uma cobranca ja paga e envia direto na response (stream).
// charge precisa vir com o client relacionado (charge.client.name).
function streamReceiptPDF(charge, res) {
  const doc = new PDFDocument({ size: 'A4', margin: 50 });

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader(
    'Content-Disposition',
    `attachment; filename="recibo-${charge.receipt_number || charge.id}.pdf"`
  );

  doc.pipe(res);

  // Cabecalho
  doc
    .fillColor('#5B21B6')
    .fontSize(24)
    .text('Smart Billing', { align: 'left' })
    .moveDown(0.2);

  doc
    .fillColor('#111827')
    .fontSize(12)
    .text('Recibo de pagamento', { align: 'left' })
    .moveDown(1);

  doc
    .strokeColor('#E5E7EB')
    .lineWidth(1)
    .moveTo(50, doc.y)
    .lineTo(545, doc.y)
    .stroke()
    .moveDown(1);

  // Numero do recibo
  doc
    .fontSize(11)
    .fillColor('#6B7280')
    .text('Numero do recibo')
    .fillColor('#111827')
    .fontSize(14)
    .text(charge.receipt_number || '-')
    .moveDown(1);

  const rows = [
    ['Cliente', charge.client?.name || '-'],
    ['Servico', charge.service_name || '-'],
    ['Descricao', charge.description || '-'],
    ['Valor pago', formatCurrencyBRL(charge.amount)],
    ['Data do pagamento', charge.paid_at ? formatDateBR(charge.paid_at) : '-'],
    ['Forma de pagamento', paymentMethodLabel(charge.payment_method)],
  ];

  rows.forEach(([label, value]) => {
    doc
      .fontSize(11)
      .fillColor('#6B7280')
      .text(label)
      .fillColor('#111827')
      .fontSize(13)
      .text(value)
      .moveDown(0.6);
  });

  doc.moveDown(1);
  doc
    .strokeColor('#E5E7EB')
    .lineWidth(1)
    .moveTo(50, doc.y)
    .lineTo(545, doc.y)
    .stroke()
    .moveDown(1);

  doc
    .fontSize(9)
    .fillColor('#9CA3AF')
    .text(
      'Este recibo comprova o pagamento recebido e nao substitui nota fiscal quando obrigatoria.',
      { align: 'left' }
    );

  doc.end();
}

module.exports = { streamReceiptPDF, paymentMethodLabel };
