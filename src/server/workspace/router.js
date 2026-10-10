const express = require('express');
const multer = require('multer');
const { randomUUID } = require('node:crypto');
const { createClient } = require('@supabase/supabase-js');
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const BUCKET = 'group-photos';
let admin;
function storageAdmin() {
  if (!admin)
    admin = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  return admin;
}
function fail(res, error) {
  if (error?.message === 'HAS_PLACE_REVIEWS')
    return res
      .status(409)
      .json({ error: '리뷰가 있는 장소는 가고 싶은 곳으로 변경할 수 없습니다.' });
  const c = error?.code;
  return res
    .status(
      c === '42501'
        ? 403
        : c === '40001'
          ? 409
          : ['22023', '22007', '22008', '23514', '23502', '23503'].includes(c)
            ? 400
            : 503,
    )
    .json({
      error:
        c === '42501'
          ? '접근 권한이 없습니다.'
          : c === '40001'
            ? '다른 화면에서 변경됐습니다. 새로 불러온 뒤 다시 시도해주세요.'
            : c?.startsWith('22') || c?.startsWith('23')
              ? '날짜·시간과 입력 내용을 확인해주세요.'
              : '불러오지 못했습니다. 잠시 후 다시 시도해주세요.',
    });
}
const { page } = require('../shared/paging');
const safeMedia = ({ path, thumb_path, ...p }) => p;
const { rows } = require('../shared/rows');
const { normalizePhoto, normalizeThumbnail } = require('../photos/images');
module.exports = function workspaceRouter() {
  const router = express.Router(),
    limits = new Map();
  router.use((req, res, next) => {
    if (
      !/^\/(groups\/[^/]+\/(content|media|photo-urls|photos|places|events)|places|events|photos|search)/.test(
        req.path,
      )
    )
      return next();
    const now = Date.now();
    let entry = limits.get(req.user.id);
    if (!entry || entry.until < now) {
      entry = { count: 0, until: now + 60000 };
      limits.set(req.user.id, entry);
    }
    if (++entry.count > 100)
      return res.status(429).json({ error: '요청이 많습니다. 잠시 후 다시 시도해주세요.' });
    if (limits.size > 1000)
      for (const [key, value] of limits) if (value.until < now) limits.delete(key);
    next();
  });
  const wrap = (fn) => async (req, res) => {
    try {
      await fn(req, res);
    } catch (e) {
      fail(res, e);
    }
  };
  async function member(req, res, id) {
    if (!UUID.test(id || '')) {
      res.status(400).json({ error: '모임을 확인해주세요.' });
      return false;
    }
    const r = await req.db.rpc('h_is_member', { target_group: id });
    if (r.error) throw r.error;
    if (!r.data) {
      res.status(403).json({ error: '이 모임에 접근할 수 없습니다.' });
      return false;
    }
    return true;
  }
  require('../places/content')(router, { wrap, member, rows, safeMedia });
  require('../photos/routes')(router, {
    wrap,
    member,
    UUID,
    page,
    safeMedia,
    storageAdmin,
    BUCKET,
    randomUUID,
    normalizePhoto,
    normalizeThumbnail,
    multer,
  });
  require('../calendar/routes')(router, { wrap, member, UUID, rows });
  require('../map/search')(router, { wrap, member });
  require('../places/routes')(router, { wrap, UUID });
  return router;
};
