const path = require('path');
const express = require('express');

const app = express();
app.disable('x-powered-by');
const security = require('./middleware/security');
app.use(security.headers);
app.use(security.frontendEntry);
app.get('/healthz', (req, res) => res.json({ ok: true }));
app.use(express.json({ limit: '32kb' }));
app.use('/api/v2', require('./auth/router')());
app.get('/vendor/supabase.js', (req, res) => {
  res.sendFile(
    path.join(__dirname, '../../node_modules/@supabase/supabase-js/dist/umd/supabase.js'),
  );
});
app.use(express.static(path.join(__dirname, '../../public')));
app.use(express.static(path.join(__dirname, '../../public/legacy')));
app.use(
  '/api',
  security.legacyGate({
    url: process.env.SUPABASE_URL,
    publicKey: process.env.SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_ANON_KEY,
    groupId: process.env.LEGACY_GROUP_ID,
  }),
);

app.use(require('./legacy/router')());
app.use((error, req, res, next) => {
  if (res.headersSent) return next(error);
  res.status(error.type === 'entity.too.large' ? 413 : 500).json({
    error:
      error.type === 'entity.too.large'
        ? '입력 내용이 너무 큽니다.'
        : '요청을 처리하지 못했습니다.',
  });
});

module.exports = app;
