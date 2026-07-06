(function () {
  function chargeIdFromUrl() {
    const parts = window.location.pathname.split('/').filter(Boolean);
    return parts[1]; // /recibo/:chargeId
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
    try {
      const res = await fetch(`/api/public/receipts/${chargeId}`);
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
    document.getElementById('downloadBtn').href = `/api/public/receipts/${chargeId}/pdf`;

    loadingState.classList.add('hidden');
    content.classList.remove('hidden');
  }

  loadReceipt();
})();
