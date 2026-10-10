require('dotenv').config();
const app = require('./src/server/app');
const PORT = process.env.PORT || 3000;
if (require.main === module) {
  const server = app.listen(PORT, '0.0.0.0', () => console.log(`▶ http://localhost:${PORT}`));
  process.on('SIGTERM', () => {
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(1), 10000).unref();
  });
}
module.exports = app;
