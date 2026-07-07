// Funcoes utilitarias compartilhadas para trabalhar com cobrancas (charges).
// Port 1:1 da versao usada no antigo backend Express (src/utils/chargeHelpers.js).

export interface ChargeLike {
  status: string;
  due_date: string;
}

export function todayISODate(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function daysBetween(dateA: string, dateB: string): number {
  const msPerDay = 24 * 60 * 60 * 1000;
  const a = new Date(`${dateA}T00:00:00`);
  const b = new Date(`${dateB}T00:00:00`);
  return Math.round((b.getTime() - a.getTime()) / msPerDay);
}

// Status salvo no banco: pendente | pago | cancelado.
// Quando pendente, calculamos dinamicamente: vence_hoje | atrasado | pendente.
export function getEffectiveStatus(charge: ChargeLike): string {
  if (charge.status === "pago") return "pago";
  if (charge.status === "cancelado") return "cancelado";

  const today = todayISODate();
  const diff = daysBetween(today, charge.due_date); // due_date - today

  if (diff === 0) return "vence_hoje";
  if (diff < 0) return "atrasado";
  return "pendente";
}

export function formatCurrencyBRL(amount: number | string): string {
  return Number(amount).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

export function formatDateBR(isoDate?: string | null): string {
  if (!isoDate) return "";
  const d = new Date(`${String(isoDate).substring(0, 10)}T00:00:00`);
  return d.toLocaleDateString("pt-BR");
}

export function generateReceiptNumber(sequenceHint?: number): string {
  const year = new Date().getFullYear();
  const random = sequenceHint || Math.floor(100000 + Math.random() * 900000);
  return `SB-${year}-${random}`;
}

export type WhatsAppMessageType = "manual" | "before_due" | "due_today" | "overdue";

export function buildWhatsAppMessage(params: {
  clientName?: string;
  serviceName: string;
  amount: number | string;
  dueDate: string;
  paymentLink?: string | null;
  type?: WhatsAppMessageType;
}): string {
  const { clientName, serviceName, amount, dueDate, paymentLink, type = "manual" } = params;

  const valorFormatado = formatCurrencyBRL(amount);
  const vencimentoFormatado = formatDateBR(dueDate);

  const saudacao = `Ola, ${clientName}! Aqui e da Smart Billing.`;
  const detalhes = `Servico: ${serviceName}\nValor: ${valorFormatado}\nVencimento: ${vencimentoFormatado}`;
  const link = `Pague com seguranca pelo link:\n${paymentLink}`;

  let intro: string;
  switch (type) {
    case "before_due":
      intro = "Passando para lembrar que sua cobranca vence em breve.";
      break;
    case "due_today":
      intro = "Sua cobranca vence hoje.";
      break;
    case "overdue":
      intro = "Identificamos que sua cobranca esta em atraso.";
      break;
    default:
      intro = "Segue sua cobranca.";
  }

  return `${saudacao}\n${intro}\n\n${detalhes}\n\n${link}`;
}
