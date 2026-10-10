module.exports = function registerRoutes(router, { route, send, uuid, validReview }) {
  router.post(
    '/groups/:id/legacy-authors',
    route(async (req, res) => {
      if (
        !uuid(req.params.id) ||
        !uuid(req.body.userId) ||
        typeof req.body.reviewer !== 'string' ||
        !req.body.reviewer ||
        req.body.reviewer.length > 100
      )
        return res.status(400).json({ error: '작성자와 계정을 확인해주세요.' });
      send(
        res,
        await req.db.rpc('h_propose_legacy_author', {
          target_group: req.params.id,
          legacy_reviewer: req.body.reviewer,
          target_user: req.body.userId,
        }),
      );
    }),
  );
  router.post(
    '/groups/:id/legacy-authors/accept',
    route(async (req, res) => {
      if (
        !uuid(req.params.id) ||
        typeof req.body.reviewer !== 'string' ||
        !req.body.reviewer ||
        req.body.reviewer.length > 100
      )
        return res.status(400).json({ error: '작성자를 확인해주세요.' });
      send(
        res,
        await req.db.rpc('h_accept_legacy_author', {
          target_group: req.params.id,
          legacy_reviewer: req.body.reviewer,
        }),
      );
    }),
  );
  router.put(
    '/legacy/reviews/:id',
    route(async (req, res) => {
      if (
        !uuid(req.params.id) ||
        !validReview(req.body) ||
        typeof req.body.expectedScore !== 'number' ||
        !Number.isFinite(req.body.expectedScore) ||
        (req.body.expectedComment !== null && typeof req.body.expectedComment !== 'string')
      )
        return res.status(400).json({ error: '점수와 감상을 확인해주세요.' });
      const result = await req.db.rpc('h_edit_legacy_review', {
        target_review: req.params.id,
        rating: req.body.score,
        impression: req.body.comment,
        expected_score: req.body.expectedScore,
        expected_comment: req.body.expectedComment,
      });
      if (result.error?.code === '40001')
        return res.status(409).json({
          error:
            '다른 화면에서 수정된 기록입니다. 작성 내용을 복사한 뒤 닫고 기록을 새로 불러와주세요.',
        });
      send(res, result);
    }),
  );
  router.get(
    '/groups/:id/archive',
    route(async (req, res) => {
      if (!uuid(req.params.id)) return res.status(400).json({ error: '모임을 확인해주세요.' });
      const result = await req.db.rpc('h_legacy_archive', { target_group: req.params.id });
      if (result.error || !result.data) return send(res, result);
      result.data.event_count = result.data.events?.length || 0;
      delete result.data.events;
      // Archive carries metadata only. Images are authorized and signed on demand.
      const active = await require('../shared/rows').rows(
        req.db
          .from('h_media')
          .select('id')
          .eq('group_id', req.params.id)
          .is('deleted_at', null)
          .order('id'),
      );
      const activeIds = new Set(active.map((p) => p.id));
      for (const key of ['place_photos', 'couple_photos'])
        result.data[key] = result.data[key]
          .filter((p) => activeIds.has(p.id))
          .map(({ url, ...p }) => p);
      send(res, result);
    }),
  );
};
