(function () {
  requireAdminAuth();

  const STATUS_LABELS = {
    pendente: 'Pendente',
    vence_hoje: 'Vence hoje',
    atrasado: 'Atrasado',
    pago: 'Pago',
    cancelado: 'Cancelado',
  };

  let clients = [];
  let charges = [];
  let currentFilter = 'todos';

  // ------------------------------------------------------------
  // Navegacao entre views (Cobrancas / Clientes)
  // ------------------------------------------------------------
  document.querySelectorAll('.nav-link[data-view]').forEach((btn) => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.nav-link[data-view]').forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');

      const view = btn.dataset.view;
      document.getElementById('view-charges').classList.toggle('hidden', view !== 'charges');
      document.getElementById('view-clients').classList.toggle('hidden', view !== 'clients');
    });
  });

  document.getElementById('logoutBtn').addEventListener('click', () => {
    Api.clearToken();
    window.location.href = 'login.html';
  });

  // ------------------------------------------------------------
  // Modais
  // ------------------------------------------------------------
  function openModal(id) {
    document.getElementById(id).classList.remove('hidden');
  }
  function closeModal(id) {
    document.getElementById(id).classList.add('hidden');
  }
  document.querySelectorAll('[data-close-modal]').forEach((el) => {
    el.addEventListener('click', () => closeModal(el.dataset.closeModal));
  });

  document.getElementById('openNewClientBtn').addEventListener('click', () => {
    document.getElementById('clientForm').reset();
    document.getElementById('clientFormError').classList.add('hidden');
    openModal('clientModal');
  });

  document.getElementById('openNewChargeBtn').addEventListener('click', () => {
    document.getElementById('chargeForm').reset();
    document.getElementById('chargeFormError').classList.add('hidden');
    populateClientSelect();
    openModal('chargeModal');
  });

  // ------------------------------------------------------------
  // Clientes
  // ------------------------------------------------------------
  async function loadClients() {
    clients = await Api.get('/clients');
    renderClientsTable();
    populateClientSelect();
  }

  function populateClientSelect() {
    const select = document.getElementById('chargeClient');
    select.innerHTML = clients
      .map((c) => `<option value="${c.id}">${escapeHtml(c.name)}</option>`)
      .join('');
  }

  function renderClientsTable() {
    const tbody = document.getElementById('clientsTableBody');
    const emptyState = document.getElementById('clientsEmptyState');

    if (clients.length === 0) {
      tbody.innerHTML = '';
      emptyState.classList.remove('hidden');
      return;
    }
    emptyState.classList.add('hidden');

    tbody.innerHTML = clients
      .map(
        (c) => `
        <tr>
          <td data-label="Nome">${escapeHtml(c.name)}</td>
          <td data-label="WhatsApp">${escapeHtml(c.whatsapp)}</td>
          <td data-label="Email">${escapeHtml(c.email || '-')}</td>
          <td data-label="Acoes">
            <div class="row-actions">
              <button class="btn btn-outline btn-sm" data-delete-client="${c.id}">Excluir</button>
            </div>
          </td>
        </tr>`
      )
      .join('');

    tbody.querySelectorAll('[data-delete-client]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        if (!confirm('Excluir este cliente? Cobrancas vinculadas tambem serao removidas.')) return;
        await Api.delete(`/clients/${btn.dataset.deleteClient}`);
        await loadClients();
        await loadCharges();
      });
    });
  }

  document.getElementById('clientForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const errorBox = document.getElementById('clientFormError');
    errorBox.classList.add('hidden');

    try {
      await Api.post('/clients', {
        name: document.getElementById('clientName').value.trim(),
        whatsapp: document.getElementById('clientWhatsapp').value.trim(),
        email: document.getElementById('clientEmail').value.trim(),
      });
      closeModal('clientModal');
      await loadClients();
    } catch (err) {
      errorBox.textContent = err.message;
      errorBox.classList.remove('hidden');
    }
  });

  // ------------------------------------------------------------
  // Cobrancas
  // ------------------------------------------------------------
  async function loadCharges() {
    charges = await Api.get('/charges');
    renderStats();
    renderChargesTable();
  }

  function renderStats() {
    const grid = document.getElementById('statsGrid');
    const counts = { pendente: 0, vence_hoje: 0, atrasado: 0, pago: 0 };
    let totalRecebido = 0;

    charges.forEach((c) => {
      if (counts[c.effective_status] !== undefined) counts[c.effective_status]++;
      if (c.effective_status === 'pago') totalRecebido += Number(c.amount);
    });

    const cards = [
      { label: 'Pendentes', value: counts.pendente },
      { label: 'Vencem hoje', value: counts.vence_hoje },
      { label: 'Atrasadas', value: counts.atrasado },
      { label: 'Total recebido', value: formatCurrencyBRL(totalRecebido) },
    ];

    grid.innerHTML = cards
      .map(
        (card) => `
        <div class="stat-card">
          <div class="stat-value">${card.value}</div>
          <div class="stat-label">${card.label}</div>
        </div>`
      )
      .join('');
  }

  document.querySelectorAll('.filter-chip').forEach((chip) => {
    chip.addEventListener('click', () => {
      document.querySelectorAll('.filter-chip').forEach((c) => c.classList.remove('active'));
      chip.classList.add('active');
      currentFilter = chip.dataset.filter;
      renderChargesTable();
    });
  });

  function renderChargesTable() {
    const tbody = document.getElementById('chargesTableBody');
    const emptyState = document.getElementById('chargesEmptyState');

    const filtered =
      currentFilter === 'todos'
        ? charges
        : charges.filter((c) => c.effective_status === currentFilter);

    if (filtered.length === 0) {
      tbody.innerHTML = '';
      emptyState.classList.remove('hidden');
      return;
    }
    emptyState.classList.add('hidden');

    tbody.innerHTML = filtered
      .map((c) => {
        const canCancel = c.status === 'pendente';
        const isPago = c.status === 'pago';

        return `
        <tr>
          <td data-label="Cliente">${escapeHtml(c.client?.name || '-')}</td>
          <td data-label="Servico">${escapeHtml(c.service_name)}</td>
          <td data-label="Valor">${formatCurrencyBRL(c.amount)}</td>
          <td data-label="Vencimento">${formatDateBR(c.due_date)}</td>
          <td data-label="Status"><span class="badge badge-${c.effective_status}">${STATUS_LABELS[c.effective_status]}</span></td>
          <td data-label="Acoes">
            <div class="row-actions">
              <button class="btn btn-outline btn-sm" data-copy-link="${c.id}">Copiar link</button>
              ${!isPago ? `<button class="btn btn-outline btn-sm" data-whatsapp="${c.id}">WhatsApp</button>` : ''}
              ${isPago ? `<button class="btn btn-success btn-sm" data-receipt="${c.id}">Recibo</button>` : ''}
              ${canCancel ? `<button class="btn btn-danger btn-sm" data-cancel="${c.id}">Cancelar</button>` : ''}
            </div>
          </td>
        </tr>`;
      })
      .join('');

    bindChargeRowActions();
  }

  function bindChargeRowActions() {
    document.querySelectorAll('[data-copy-link]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const charge = charges.find((c) => c.id === btn.dataset.copyLink);
        try {
          await navigator.clipboard.writeText(charge.payment_link);
          flashButton(btn, 'Copiado!');
        } catch {
          prompt('Copie o link abaixo:', charge.payment_link);
        }
      });
    });

    document.querySelectorAll('[data-whatsapp]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        try {
          const { wa_link } = await Api.post(`/charges/${btn.dataset.whatsapp}/whatsapp-message`);
          window.open(wa_link, '_blank');
        } catch (err) {
          alert(err.message);
        }
      });
    });

    document.querySelectorAll('[data-receipt]').forEach((btn) => {
      btn.addEventListener('click', () => {
        window.open(`../recibo/index.html?id=${btn.dataset.receipt}`, '_blank');
      });
    });

    document.querySelectorAll('[data-cancel]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        if (!confirm('Cancelar esta cobranca?')) return;
        await Api.post(`/charges/${btn.dataset.cancel}/cancel`);
        await loadCharges();
      });
    });
  }

  function flashButton(btn, text) {
    const original = btn.textContent;
    btn.textContent = text;
    setTimeout(() => (btn.textContent = original), 1500);
  }

  document.getElementById('chargeForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const errorBox = document.getElementById('chargeFormError');
    errorBox.classList.add('hidden');

    try {
      await Api.post('/charges', {
        client_id: document.getElementById('chargeClient').value,
        service_name: document.getElementById('chargeService').value.trim(),
        description: document.getElementById('chargeDescription').value.trim(),
        amount: parseFloat(document.getElementById('chargeAmount').value),
        due_date: document.getElementById('chargeDueDate').value,
      });
      closeModal('chargeModal');
      await loadCharges();
    } catch (err) {
      errorBox.textContent = err.message;
      errorBox.classList.remove('hidden');
    }
  });

  function escapeHtml(str) {
    return String(str || '').replace(/[&<>"']/g, (m) => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;',
    }[m]));
  }

  // ------------------------------------------------------------
  // Inicializacao
  // ------------------------------------------------------------
  (async function init() {
    try {
      await loadClients();
      await loadCharges();
    } catch (err) {
      console.error(err);
    }
  })();
})();
