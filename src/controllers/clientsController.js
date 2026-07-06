const supabase = require('../config/supabase');

async function listClients(req, res) {
  const { search } = req.query;

  let query = supabase.from('clients').select('*').order('name', { ascending: true });

  if (search) {
    query = query.or(`name.ilike.%${search}%,whatsapp.ilike.%${search}%,email.ilike.%${search}%`);
  }

  const { data, error } = await query;
  if (error) return res.status(500).json({ error: error.message });
  return res.json(data);
}

async function getClient(req, res) {
  const { id } = req.params;
  const { data, error } = await supabase.from('clients').select('*').eq('id', id).single();
  if (error) return res.status(404).json({ error: 'Cliente nao encontrado.' });
  return res.json(data);
}

async function createClient(req, res) {
  const { name, whatsapp, email } = req.body;

  if (!name || !whatsapp) {
    return res.status(400).json({ error: 'Nome e WhatsApp sao obrigatorios.' });
  }

  const { data, error } = await supabase
    .from('clients')
    .insert([{ name, whatsapp, email: email || null }])
    .select()
    .single();

  if (error) return res.status(500).json({ error: error.message });
  return res.status(201).json(data);
}

async function updateClient(req, res) {
  const { id } = req.params;
  const { name, whatsapp, email } = req.body;

  const { data, error } = await supabase
    .from('clients')
    .update({ name, whatsapp, email: email || null })
    .eq('id', id)
    .select()
    .single();

  if (error) return res.status(500).json({ error: error.message });
  return res.json(data);
}

async function deleteClient(req, res) {
  const { id } = req.params;
  const { error } = await supabase.from('clients').delete().eq('id', id);
  if (error) return res.status(500).json({ error: error.message });
  return res.status(204).send();
}

module.exports = { listClients, getClient, createClient, updateClient, deleteClient };
