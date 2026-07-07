// Gera o hash bcrypt de uma senha, para usar no secret ADMIN_PASSWORD_HASH
// das Supabase Edge Functions (supabase secrets set ADMIN_PASSWORD_HASH=...).
// Uso: node scripts/gerar-hash-senha.js "minhasenha"
const bcrypt = require('bcryptjs');

const senha = process.argv[2];

if (!senha) {
  console.error('Uso: node scripts/gerar-hash-senha.js "suasenha"');
  process.exit(1);
}

const hash = bcrypt.hashSync(senha, 10);
console.log('\nHash gerado (copie para o secret ADMIN_PASSWORD_HASH):\n');
console.log(hash);
console.log('');
