const supabase = require('../config/supabase');
const { preferenceClient } = require('../config/mercadopago');

// Cria uma preferencia de pagamento no Mercado Pago Checkout Pro para uma cobranca.
// O Access Token e usado apenas aqui, no servidor. O frontend so recebe o init_point.
async function createPreference(req, res) {
  const { chargeId } = req.params;

  const { data: charge, error } = await supabase
    .from('charges')
    .select('*, client:clients(id, name, whatsapp, email)')
    .eq('id', chargeId)
    .single();

  if (error || !charge) {
    return res.status(404).json({ error: 'Cobranca nao encontrada.' });
  }

  if (charge.status === 'pago') {
    return res.status(400).json({ error: 'Esta cobranca ja foi paga.' });
  }

  if (charge.status === 'cancelado') {
    return res.status(400).json({ error: 'Esta cobranca foi cancelada.' });
  }

  const baseUrl = process.env.BASE_URL;

  try {
    const preferenceBody = {
      items: [
        {
          title: charge.service_name,
          quantity: 1,
          unit_price: Number(charge.amount),
          currency_id: 'BRL',
        },
      ],
      external_reference: charge.id,
      back_urls: {
        success: `${baseUrl}/pagar/${charge.id}?status=success`,
        failure: `${baseUrl}/pagar/${charge.id}?status=failure`,
        pending: `${baseUrl}/pagar/${charge.id}?status=pending`,
      },
      auto_return: 'approved',
      notification_url: `${baseUrl}/api/webhooks/mercadopago`,
    };

    const preference = await preferenceClient.create({ body: preferenceBody });

    await supabase
      .from('charges')
      .update({ mercado_pago_preference_id: preference.id })
      .eq('id', charge.id);

    return res.json({
      init_point: preference.init_point,
      preference_id: preference.id,
    });
  } catch (mpError) {
    console.error('Erro ao criar preferencia no Mercado Pago:', mpError);
    return res.status(502).json({ error: 'Falha ao criar preferencia de pagamento.' });
  }
}

module.exports = { createPreference };
