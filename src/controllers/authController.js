const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

// Login simples de administrador, baseado em credenciais fixas no .env.
// Nao ha cadastro de multiplos admins - e um sistema simples de cobranca.
async function login(req, res) {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Informe email e senha.' });
  }

  const adminEmail = process.env.ADMIN_EMAIL;
  const adminPasswordHash = process.env.ADMIN_PASSWORD_HASH;

  if (!adminEmail || !adminPasswordHash) {
    return res.status(500).json({
      error: 'Login do admin nao configurado no servidor (ADMIN_EMAIL/ADMIN_PASSWORD_HASH).',
    });
  }

  if (email.trim().toLowerCase() !== adminEmail.trim().toLowerCase()) {
    return res.status(401).json({ error: 'Credenciais invalidas.' });
  }

  const senhaValida = await bcrypt.compare(password, adminPasswordHash);
  if (!senhaValida) {
    return res.status(401).json({ error: 'Credenciais invalidas.' });
  }

  const token = jwt.sign(
    { email: adminEmail, role: 'admin' },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '8h' }
  );

  return res.json({ token, admin: { email: adminEmail } });
}

async function me(req, res) {
  return res.json({ admin: req.admin });
}

module.exports = { login, me };
