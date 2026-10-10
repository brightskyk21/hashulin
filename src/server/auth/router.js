const { uuid, isPublicKey, validReview } = require('../shared/validation');
const express = require('express');
const { createClient } = require('@supabase/supabase-js');

// V2 requests use the signed-in user's JWT; never the service-role client.
module.exports = function accountsRouter({ makeClient = createClient } = {}) {
  const router = express.Router();
  router.use((req, res, next) => {
    res.set('Cache-Control', 'no-store');
    next();
  });
  const url = process.env.SUPABASE_URL;
  const publicKey = process.env.SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_ANON_KEY;
  const validPublicKey = isPublicKey(publicKey);
  router.get('/config', (req, res) => {
    res.set('Cache-Control', 'no-store');
    res.json({
      ready: !!url && validPublicKey,
      supabaseUrl: url || null,
      naverMapClientId: process.env.NAVER_MAP_CLIENT_ID || null,
      publicKey: validPublicKey ? publicKey : null,
    });
  });
  router.use(async (req, res, next) => {
    if (!url || !validPublicKey)
      return res.status(503).json({ error: '로그인 연결을 준비 중입니다.' });
    const token = /^Bearer ([^\s]+)$/.exec(req.headers.authorization || '')?.[1];
    if (!token) return res.status(401).json({ error: '로그인이 필요합니다.' });
    try {
      req.db = makeClient(url, publicKey, {
        global: { headers: { Authorization: `Bearer ${token}` } },
        auth: { persistSession: false, autoRefreshToken: false },
      });
      const { data, error } = await req.db.auth.getUser(token);
      if (error || !data.user) return res.status(401).json({ error: '다시 로그인해주세요.' });
      req.user = data.user;
      next();
    } catch (_) {
      res.status(503).json({ error: '로그인 상태를 확인하지 못했습니다.' });
    }
  });
  router.use(require('../workspace/router')());
  const route = (fn) => async (req, res) => {
    try {
      await fn(req, res);
    } catch (_) {
      res.status(503).json({ error: '요청을 처리하지 못했습니다.' });
    }
  };
  function send(res, result) {
    if (result.error) {
      const code = result.error.code;
      return res
        .status(
          code === '40001'
            ? 409
            : code === '42501'
              ? 403
              : code === '22023' || code === '23505' || code === '23514'
                ? 400
                : 503,
        )
        .json({
          error:
            code === '40001'
              ? '이미 저장되었거나 다른 화면에서 수정된 평가입니다. 작성 내용을 복사하고 최신 평가를 불러온 뒤 다시 수정해주세요.'
              : code === '42501'
                ? '접근 권한이 없습니다.'
                : code === '23505'
                  ? '이미 다른 작성자에 연결된 계정입니다.'
                  : code === '22023'
                    ? '입력 내용이나 초대 링크를 확인해주세요.'
                    : '요청을 처리하지 못했습니다. 설정을 확인해주세요.',
        });
    }
    res.json(result.data);
  }
  require('../auth/profile')(router, { route, send });
  require('../groups/settings')(router, { route, send, uuid });
  require('../groups/invites')(router, { route, send, uuid });
  require('../legacy/archive')(router, { route, send, uuid, validReview });
  require('../groups/members')(router, { route, send, uuid });
  require('../reviews/routes')(router, { route, send, uuid, validReview });
  return router;
};
module.exports.isPublicKey = isPublicKey;
