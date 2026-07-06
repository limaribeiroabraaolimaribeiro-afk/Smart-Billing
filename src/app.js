const path = require('path');
const express = require('express');
const cors = require('cors');
const morgan = require('morgan');

const authRoutes = require('./routes/auth.routes');
const clientsRoutes = require('./routes/clients.routes');
const chargesRoutes = require('./routes/charges.routes');
const paymentsRoutes = require('./routes/payments.routes');
const webhooksRoutes = require('./routes/webhooks.routes');
const publicRoutes = require('./routes/public.routes');

const PUBLIC_DIR = path.join(__dirname, '..', 'public');

const app = express();

app.use(cors());
app.use(morgan('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Arquivos estaticos do frontend (admin, css, js, paginas publicas)
// index:false porque as rotas "/", "/admin", "/pagar/:id" e "/recibo/:id"
// abaixo controlam explicitamente qual HTML e servido em cada caso.
app.use(express.static(PUBLIC_DIR, { index: false }));

// ------------------------------
// API
// ------------------------------
app.use('/api/auth', authRoutes);
app.use('/api/clients', clientsRoutes);
app.use('/api/charges', chargesRoutes);
app.use('/api/payments', paymentsRoutes);
app.use('/api/webhooks', webhooksRoutes);
app.use('/api/public', publicRoutes);

// ------------------------------
// Paginas do frontend (SPA simples por pagina)
// ------------------------------

// Pagina inicial: landing do Smart Billing (nao o README).
app.get('/', (req, res) => {
  res.sendFile(path.join(PUBLIC_DIR, 'index.html'));
});

// Login do painel administrativo: /admin
app.get('/admin', (req, res) => {
  res.sendFile(path.join(PUBLIC_DIR, 'admin', 'login.html'));
});

// Pagina publica do cliente: /pagar/:chargeId
app.get('/pagar/:chargeId', (req, res) => {
  res.sendFile(path.join(PUBLIC_DIR, 'pagar', 'index.html'));
});

// Pagina publica do recibo: /recibo/:chargeId
app.get('/recibo/:chargeId', (req, res) => {
  res.sendFile(path.join(PUBLIC_DIR, 'recibo', 'index.html'));
});

// 404 para rotas de API nao encontradas
app.use('/api', (req, res) => {
  res.status(404).json({ error: 'Rota nao encontrada.' });
});

module.exports = app;
