// Gera o hash bcrypt de uma senha, para usar em ADMIN_PASSWORD_HASH no .env
// Uso: node scripts/gerar-hash-senha.js "minhasenha"
const bcrypt = require('bcryptjs');

const senha = process.argv[2];

if (!senha) {
  console.error('Uso: node scripts/gerar-hash-senha.js "suasenha"');
  process.exit(1);
}

const hash = bcrypt.hashSync(senha, 10);
console.log('\nHash gerado (copie para ADMIN_PASSWORD_HASH no .env):\n');
console.log(hash);
console.log('');
