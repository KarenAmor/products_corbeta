const bcrypt = require('bcrypt');

async function generateHash() {
  const password = 'estoesunaprueba';
  const salt = await bcrypt.genSalt(10);
  const hash = await bcrypt.hash(password, salt);
  console.log('Hash generado:', hash);
}

generateHash();
