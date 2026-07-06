// Funcoes utilitarias compartilhadas para trabalhar com cobrancas (charges).

// Retorna a data de hoje no formato YYYY-MM-DD (sem horario), no fuso do servidor.
function todayISODate() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function daysBetween(dateA, dateB) {
  const msPerDay = 24 * 60 * 60 * 1000;
  const a = new Date(`${dateA}T00:00:00`);
  const b = new Date(`${dateB}T00:00:00`);
  return Math.round((b - a) / msPerDay);
}

// Calcula o status "efetivo" de uma cobranca para exibicao/filtros.
// O status salvo no banco e sempre: pendente | pago | cancelado.
// Quando pendente, calculamos dinamicamente: vence_hoje | atrasado | pendente.
function getEffectiveStatus(charge) {
  if (charge.status === 'pago') return 'pago';
  if (charge.status === 'cancelado') return 'cancelado';

  const today = todayISODate();
  const diff = daysBetween(today, charge.due_date); // due_date - today

  if (diff === 0) return 'vence_hoje';
  if (diff < 0) return 'atrasado';
  return 'pendente';
}

function formatCurrencyBRL(amount) {
  return Number(amount).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  });
}

function formatDateBR(isoDate) {
  if (!isoDate) return '';
  const d = new Date(`${String(isoDate).substring(0, 10)}T00:00:00`);
  return d.toLocaleDateString('pt-BR');
}

// Gera um numero de recibo legivel, ex: SB-2026-000123
function generateReceiptNumber(sequenceHint) {
  const year = new Date().getFullYear();
  const random = sequenceHint || Math.floor(100000 + Math.random() * 900000);
  return `SB-${year}-${random}`;
}

// Monta a mensagem padrao de cobranca enviada via WhatsApp.
// type: 'manual' | 'before_due' | 'due_today' | 'overdue'
function buildWhatsAppMessage({ clientName, serviceName, amount, dueDate, paymentLink, type = 'manual' }) {
  const valorFormatado = formatCurrencyBRL(amount);
  const vencimentoFormatado = formatDateBR(dueDate);

  const saudacao = `Ola, ${clientName}! Aqui e da Smart Billing.`;
  const detalhes = `Servico: ${serviceName}\nValor: ${valorFormatado}\nVencimento: ${vencimentoFormatado}`;
  const link = `Pague com seguranca pelo link:\n${paymentLink}`;

  let intro;
  switch (type) {
    case 'before_due':
      intro = 'Passando para lembrar que sua cobranca vence em breve.';
      break;
    case 'due_today':
      intro = 'Sua cobranca vence hoje.';
      break;
    case 'overdue':
      intro = 'Identificamos que sua cobranca esta em atraso.';
      break;
    default:
      intro = 'Segue sua cobranca.';
  }

  return `${saudacao}\n${intro}\n\n${detalhes}\n\n${link}`;
}

module.exports = {
  todayISODate,
  daysBetween,
  getEffectiveStatus,
  formatCurrencyBRL,
  formatDateBR,
  generateReceiptNumber,
  buildWhatsAppMessage,
};
