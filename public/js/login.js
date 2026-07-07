(function () {
  if (Api.isAuthenticated()) {
    window.location.href = '/admin/dashboard.html';
    return;
  }

  const form = document.getElementById('loginForm');
  const errorBox = document.getElementById('loginError');
  const loginBtn = document.getElementById('loginBtn');

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    errorBox.classList.add('hidden');
    loginBtn.disabled = true;
    loginBtn.textContent = 'Entrando...';

    const email = document.getElementById('email').value.trim();
    const password = document.getElementById('password').value;

    try {
      const data = await Api.post('/admin-login', { email, password }, { auth: false });
      Api.setToken(data.token);
      window.location.href = '/admin/dashboard.html';
    } catch (err) {
      errorBox.textContent = err.message;
      errorBox.classList.remove('hidden');
    } finally {
      loginBtn.disabled = false;
      loginBtn.textContent = 'Entrar';
    }
  });
})();
