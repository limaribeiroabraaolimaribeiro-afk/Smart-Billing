const cron = require('node-cron');
const supabase = require('../config/supabase');
const { daysBetween, todayISODate } = require('../utils/chargeHelpers');
const { sendAutomaticMessage } = require('./whatsappService');

// Regras de cobranca automatica via WhatsApp:
// - 3 dias antes do vencimento -> 'before_due'
// - no dia do vencimento       -> 'due_today'
// - 2 dias apos o atraso       -> 'overdue'
// Cobrancas pagas ou canceladas nunca recebem mensagem.
function resolveMessageType(dueDate) {
  const diff = daysBetween(todayISODate(), dueDate); // due_date - hoje

  if (diff === 3) return 'before_due';
  if (diff === 0) return 'due_today';
  if (diff === -2) return 'overdue';
  return null;
}

// Evita reenviar a mesma mensagem para a mesma cobranca no mesmo dia.
async function alreadyNotifiedToday(chargeId, type) {
  const startOfDay = `${todayISODate()}T00:00:00.000Z`;

  const { data, error } = await supabase
    .from('whatsapp_messages')
    .select('id')
    .eq('charge_id', chargeId)
    .eq('message_type', type)
    .gte('created_at', startOfDay)
    .limit(1);

  if (error) {
    console.error('Erro ao verificar mensagens ja enviadas:', error.message);
    return true; // por seguranca, nao duplica envio se a checagem falhar
  }

  return data.length > 0;
}

async function runBillingReminders() {
  const { data: charges, error } = await supabase
    .from('charges')
    .select('*, client:clients(id, name, whatsapp, email)')
    .eq('status', 'pendente');

  if (error) {
    console.error('Erro ao buscar cobrancas pendentes para lembrete automatico:', error.message);
    return;
  }

  for (const charge of charges) {
    if (!charge.client) continue;

    const type = resolveMessageType(charge.due_date);
    if (!type) continue;

    const jaEnviada = await alreadyNotifiedToday(charge.id, type);
    if (jaEnviada) continue;

    await sendAutomaticMessage({ charge, type });
  }
}

function startBillingScheduler() {
  if (process.env.ENABLE_BILLING_SCHEDULER !== 'true') {
    console.log('[Smart Billing] Agendador de cobranca automatica desativado (ENABLE_BILLING_SCHEDULER != true).');
    return;
  }

  const cronExpression = process.env.BILLING_SCHEDULER_CRON || '0 9 * * *';

  cron.schedule(cronExpression, () => {
    console.log('[Smart Billing] Executando verificacao de cobrancas para lembrete automatico...');
    runBillingReminders().catch((err) =>
      console.error('Erro inesperado no agendador de cobranca:', err)
    );
  });

  console.log(`[Smart Billing] Agendador de cobranca automatica ativo (cron: ${cronExpression}).`);
}

module.exports = { startBillingScheduler, runBillingReminders };
