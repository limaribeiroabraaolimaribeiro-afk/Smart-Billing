const supabase = require('../config/supabase');
const { getEffectiveStatus } = require('../utils/chargeHelpers');

const VALID_FILTERS = ['pendente', 'vence_hoje', 'atrasado', 'pago', 'cancelado'];

function withEffectiveStatus(charge) {
  return { ...charge, effective_status: getEffectiveStatus(charge) };
}

async function listCharges(req, res) {
  const { status, search } = req.query;

  let query = supabase
    .from('charges')
    .select('*, client:clients(id, name, whatsapp, email)')
    .order('due_date', { ascending: true });

  const { data, error } = await query;
  if (error) return res.status(500).json({ error: error.message });

  let charges = data.map(withEffectiveStatus);

  if (status && VALID_FILTERS.includes(status)) {
    charges = charges.filter((c) => c.effective_status === status);
  }

  if (search) {
    const term = search.toLowerCase();
    charges = charges.filter(
      (c) =>
        c.service_name?.toLowerCase().includes(term) ||
        c.client?.name?.toLowerCase().includes(term)
    );
  }

  return res.json(charges);
}

async function getCharge(req, res) {
  const { id } = req.params;
  const { data, error } = await supabase
    .from('charges')
    .select('*, client:clients(id, name, whatsapp, email)')
    .eq('id', id)
    .single();

  if (error) return res.status(404).json({ error: 'Cobranca nao encontrada.' });
  return res.json(withEffectiveStatus(data));
}

async function createCharge(req, res) {
  const { client_id, service_name, description, amount, due_date } = req.body;

  if (!client_id || !service_name || !amount || !due_date) {
    return res.status(400).json({
      error: 'client_id, service_name, amount e due_date sao obrigatorios.',
    });
  }

  const { data: inserted, error } = await supabase
    .from('charges')
    .insert([
      {
        client_id,
        service_name,
        description: description || null,
        amount,
        due_date,
        status: 'pendente',
      },
    ])
    .select('*, client:clients(id, name, whatsapp, email)')
    .single();

  if (error) return res.status(500).json({ error: error.message });

  // Gera o link publico de pagamento (pagina /pagar/:chargeId) e salva na cobranca.
  const paymentLink = `${process.env.BASE_URL}/pagar/${inserted.id}`;
  const { data: updated, error: updateError } = await supabase
    .from('charges')
    .update({ payment_link: paymentLink })
    .eq('id', inserted.id)
    .select('*, client:clients(id, name, whatsapp, email)')
    .single();

  if (updateError) return res.status(500).json({ error: updateError.message });

  return res.status(201).json(withEffectiveStatus(updated));
}

async function updateCharge(req, res) {
  const { id } = req.params;
  const { service_name, description, amount, due_date } = req.body;

  const { data: existing, error: fetchError } = await supabase
    .from('charges')
    .select('*')
    .eq('id', id)
    .single();

  if (fetchError) return res.status(404).json({ error: 'Cobranca nao encontrada.' });
  if (existing.status === 'pago') {
    return res.status(400).json({ error: 'Nao e possivel editar uma cobranca ja paga.' });
  }

  const { data, error } = await supabase
    .from('charges')
    .update({ service_name, description, amount, due_date })
    .eq('id', id)
    .select('*, client:clients(id, name, whatsapp, email)')
    .single();

  if (error) return res.status(500).json({ error: error.message });
  return res.json(withEffectiveStatus(data));
}

async function cancelCharge(req, res) {
  const { id } = req.params;

  const { data: existing, error: fetchError } = await supabase
    .from('charges')
    .select('*')
    .eq('id', id)
    .single();

  if (fetchError) return res.status(404).json({ error: 'Cobranca nao encontrada.' });
  if (existing.status === 'pago') {
    return res.status(400).json({ error: 'Nao e possivel cancelar uma cobranca ja paga.' });
  }

  const { data, error } = await supabase
    .from('charges')
    .update({ status: 'cancelado' })
    .eq('id', id)
    .select('*, client:clients(id, name, whatsapp, email)')
    .single();

  if (error) return res.status(500).json({ error: error.message });
  return res.json(withEffectiveStatus(data));
}

async function deleteCharge(req, res) {
  const { id } = req.params;
  const { error } = await supabase.from('charges').delete().eq('id', id);
  if (error) return res.status(500).json({ error: error.message });
  return res.status(204).send();
}

module.exports = {
  listCharges,
  getCharge,
  createCharge,
  updateCharge,
  cancelCharge,
  deleteCharge,
};
