(function () {
  const STATUS_BANNER = {
    pago: { text: 'Pagamento confirmado! Obrigado.', className: 'badge-pago' },
    cancelado: { text: 'Esta cobranca foi cancelada.', className: 'badge-cancelado' },
    atrasado: { text: 'Esta cobranca esta em atraso.', className: 'badge-atrasado' },
    vence_hoje: { text: 'Esta cobranca vence hoje.', className: 'badge-vence_hoje' },
  };

  function chargeIdFromUrl() {
    const parts = window.location.pathname.split('/').filter(Boolean);
    return parts[1]; // /pagar/:chargeId
  }

  function formatCurrencyBRL(value) {
    return Number(value || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  }

  function formatDateBR(isoDate) {
    if (!isoDate) return '-';
    const datePart = String(isoDate).substring(0, 10);
    const [year, month, day] = datePart.split('-');
    return `${day}/${month}/${year}`;
  }

  const chargeId = chargeIdFromUrl();
  const loadingState = document.getElementById('loadingState');
  const errorState = document.getElementById('errorState');
  const content = document.getElementById('content');
  const statusBanner = document.getElementById('statusBanner');
  const payBtn = document.getElementById('payBtn');
  const receiptLink = document.getElementById('receiptLink');
  const errorPay = document.getElementById('errorPay');

  async function loadCharge() {
    try {
      const res = await fetch(`/api/public/charges/${chargeId}`);
      const data = await res.json();

      if (!res.ok) throw new Error(data.error || 'Cobranca nao encontrada.');

      renderCharge(data);
    } catch (err) {
      loadingState.classList.add('hidden');
      errorState.textContent = err.message;
      errorState.classList.remove('hidden');
    }
  }

  function renderCharge(charge) {
    document.getElementById('clientName').textContent = charge.client_name || '-';
    document.getElementById('serviceName').textContent = charge.service_name || '-';
    document.getElementById('description').textContent = charge.description || '-';
    document.getElementById('dueDate').textContent = formatDateBR(charge.due_date);
    document.getElementById('amount').textContent = formatCurrencyBRL(charge.amount);

    const banner = STATUS_BANNER[charge.status];
    if (banner) {
      statusBanner.textContent = banner.text;
      statusBanner.classList.remove('hidden');
      statusBanner.classList.add(banner.className);
    }

    if (charge.status === 'pago') {
      payBtn.classList.add('hidden');
      receiptLink.href = `/recibo/${chargeId}`;
      receiptLink.classList.remove('hidden');
    } else if (charge.status === 'cancelado') {
      payBtn.classList.add('hidden');
    }

    loadingState.classList.add('hidden');
    content.classList.remove('hidden');
  }

  payBtn.addEventListener('click', async () => {
    errorPay.classList.add('hidden');
    payBtn.disabled = true;
    payBtn.textContent = 'Redirecionando...';

    try {
      const res = await fetch(`/api/payments/create-preference/${chargeId}`, { method: 'POST' });
      const data = await res.json();

      if (!res.ok) throw new Error(data.error || 'Nao foi possivel iniciar o pagamento.');

      window.location.href = data.init_point;
    } catch (err) {
      errorPay.textContent = err.message;
      errorPay.classList.remove('hidden');
      payBtn.disabled = false;
      payBtn.textContent = 'Pagar agora';
    }
  });

  loadCharge();
})();
