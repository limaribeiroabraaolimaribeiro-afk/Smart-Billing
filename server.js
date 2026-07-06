require('dotenv').config();

const app = require('./src/app');
const { startBillingScheduler } = require('./src/services/billingScheduler');

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Smart Billing rodando em http://localhost:${PORT}`);
  startBillingScheduler();
});
