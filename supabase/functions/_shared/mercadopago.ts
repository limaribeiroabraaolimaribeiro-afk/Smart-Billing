// Cliente minimo do Mercado Pago via fetch direto na API REST.
// Evita depender do SDK oficial (que nem sempre e 100% compativel com o
// runtime Deno das Edge Functions) - a API REST do Mercado Pago e estavel
// e simples o suficiente para nao precisar de um SDK aqui.
const MP_API_BASE = "https://api.mercadopago.com";

function getAccessToken(): string {
  const token = Deno.env.get("MERCADO_PAGO_ACCESS_TOKEN");
  if (!token) {
    throw new Error("MERCADO_PAGO_ACCESS_TOKEN nao configurado nos secrets do projeto.");
  }
  return token;
}

export async function createPreference(body: Record<string, unknown>): Promise<any> {
  const res = await fetch(`${MP_API_BASE}/checkout/preferences`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${getAccessToken()}`,
    },
    body: JSON.stringify(body),
  });

  const data = await res.json();

  if (!res.ok) {
    throw new Error(data?.message || "Falha ao criar preferencia no Mercado Pago.");
  }

  return data;
}

export async function getPayment(paymentId: string): Promise<any> {
  const res = await fetch(`${MP_API_BASE}/v1/payments/${paymentId}`, {
    headers: { Authorization: `Bearer ${getAccessToken()}` },
  });

  const data = await res.json();

  if (!res.ok) {
    throw new Error(data?.message || "Falha ao consultar pagamento no Mercado Pago.");
  }

  return data;
}
