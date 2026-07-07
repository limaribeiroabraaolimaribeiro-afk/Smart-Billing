(function () {
  function chargeIdFromUrl() {
    const byQuery = new URLSearchParams(window.location.search).get('id');
    if (byQuery) return byQuery;

    const parts = window.location.pathname.split('/').filter(Boolean);
    const idx = parts.indexOf('recibo');
    return idx !== -1 ? parts[idx + 1] : undefined;
  }

  function functionsBaseUrl() {
    return window.SMART_BILLING_CONFIG.SUPABASE_FUNCTIONS_URL.replace(/\/$/, '');
  }

  function formatCurrencyBRL(value) {
    return Number(value || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  }

  function formatDateTimeBR(isoDate) {
    if (!isoDate) return '-';
    return new Date(isoDate).toLocaleString('pt-BR');
  }

  const PAYMENT_METHOD_LABELS = {
    credit_card: 'Cartao de credito',
    debit_card: 'Cartao de debito',
    ticket: 'Boleto',
    bank_transfer: 'Transferencia / Pix',
    account_money: 'Saldo Mercado Pago',
  };

  const chargeId = chargeIdFromUrl();
  const loadingState = document.getElementById('loadingState');
  const errorState = document.getElementById('errorState');
  const content = document.getElementById('content');

  async function loadReceipt() {
    if (!chargeId) {
      loadingState.classList.add('hidden');
      errorState.textContent = 'Link de recibo invalido: id da cobranca nao informado.';
      errorState.classList.remove('hidden');
      return;
    }

    try {
      const res = await fetch(`${functionsBaseUrl()}/receipt/${chargeId}`);
      const data = await res.json();

      if (!res.ok) throw new Error(data.error || 'Recibo indisponivel.');

      renderReceipt(data);
    } catch (err) {
      loadingState.classList.add('hidden');
      errorState.textContent = err.message;
      errorState.classList.remove('hidden');
    }
  }

  function renderReceipt(receipt) {
    document.getElementById('receiptNumber').textContent = receipt.receipt_number || '-';
    document.getElementById('clientName').textContent = receipt.client_name || '-';
    document.getElementById('serviceName').textContent = receipt.service_name || '-';
    document.getElementById('description').textContent = receipt.description || '-';
    document.getElementById('paidAt').textContent = formatDateTimeBR(receipt.paid_at);
    document.getElementById('paymentMethod').textContent =
      PAYMENT_METHOD_LABELS[receipt.payment_method] || receipt.payment_method || 'Nao informado';
    document.getElementById('amount').textContent = formatCurrencyBRL(receipt.amount);

    loadingState.classList.add('hidden');
    content.classList.remove('hidden');
  }

  // O PDF nao e mais gerado no servidor (Edge Functions nao rodam pdfkit de
  // forma confiavel). O recibo e uma pagina HTML imprimivel: o botao abaixo
  // aciona o dialogo de impressao do navegador, onde o cliente pode escolher
  // "Salvar como PDF".
  document.getElementById('downloadBtn').addEventListener('click', (e) => {
    e.preventDefault();
    window.print();
  });

  loadReceipt();
})();
