const jwt = require('jsonwebtoken');

// Protege as rotas do painel admin. Espera um Bearer token
// gerado em /api/auth/login e valida com o JWT_SECRET.
function adminAuth(req, res, next) {
  const authHeader = req.headers.authorization || '';
  const [scheme, token] = authHeader.split(' ');

  if (scheme !== 'Bearer' || !token) {
    return res.status(401).json({ error: 'Token de autenticacao ausente.' });
  }

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    req.admin = payload;
    return next();
  } catch (err) {
    return res.status(401).json({ error: 'Token invalido ou expirado.' });
  }
}

module.exports = adminAuth;
