require('dotenv').config();
const app = require('./app');

if (!process.env.JWT_SECRET || !process.env.DATABASE_URL) {
  console.error('JWT_SECRET and DATABASE_URL must be set (see .env.example)');
  process.exit(1);
}

const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`CRM API listening on port ${port}`));
