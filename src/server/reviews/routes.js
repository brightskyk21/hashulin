module.exports = function registerRoutes(router, { route, send, uuid, validReview }) {
  router.get(
    '/visits/:id',
    route(async (req, res) => {
      if (!uuid(req.params.id)) return res.sendStatus(400);
      send(
        res,
        await req.db
          .from('h_visits')
          .select(
            'id,visited_on,h_places(id,name,address),h_reviews(id,author_id,score,comment,updated_at,version)',
          )
          .eq('id', req.params.id)
          .maybeSingle(),
      );
    }),
  );
  router.get(
    '/groups/:id/visits',
    route(async (req, res) => {
      if (!uuid(req.params.id)) return res.status(400).json({ error: '모임을 확인해주세요.' });
      if (req.query.author && !uuid(req.query.author)) return res.sendStatus(400);
      const relation = 'h_reviews';
      let query = req.db
        .from('h_visits')
        .select(
          `id,visited_on,${req.query.name ? 'h_places!inner' : 'h_places'}(id,name,address),${relation}(id,author_id,score,comment,updated_at,version)${req.query.author ? ',matching:h_reviews!inner(author_id)' : ''}`,
        )
        .eq('group_id', req.params.id);
      if (req.query.author) query = query.eq('matching.author_id', req.query.author);
      if (req.query.place) {
        if (!uuid(req.query.place)) return res.sendStatus(400);
        query = query.eq('place_id', req.query.place);
      }
      if (req.query.day) {
        if (!/^\d{4}-\d{2}-\d{2}$/.test(req.query.day)) return res.sendStatus(400);
        query = query.eq('visited_on', req.query.day);
      }
      if (req.query.name) {
        if (
          typeof req.query.name !== 'string' ||
          req.query.name.length > 100 ||
          typeof req.query.address !== 'string' ||
          req.query.address.length > 300
        )
          return res.sendStatus(400);
        query = query.eq('h_places.name', req.query.name).eq('h_places.address', req.query.address);
      }
      const result = await require('../shared/paging').page(query, req.query.after, 'visited_on');
      if (result.items.length) {
        const covers = await req.db.rpc('h_visit_photo_covers', {
          target_visits: result.items.map((v) => v.id),
        });
        if (covers.error) return send(res, covers);
        const safe = (covers.data || []).map(({ path, thumb_path, ...p }) => p);
        result.items = result.items.map((v) => ({
          ...v,
          cover: safe.find((m) => m.visit_id === v.id) || null,
        }));
      }
      send(res, { data: result });
    }),
  );
  router.post(
    '/groups/:id/visits',
    route(async (req, res) => {
      if (
        !uuid(req.params.id) ||
        !validReview(req.body) ||
        typeof req.body.placeName !== 'string' ||
        !req.body.placeName.trim() ||
        req.body.placeName.trim().length > 100 ||
        typeof req.body.date !== 'string' ||
        !/^\d{4}-\d{2}-\d{2}$/.test(req.body.date) ||
        (req.body.address != null &&
          (typeof req.body.address !== 'string' || req.body.address.length > 300))
      )
        return res.status(400).json({ error: '장소·날짜·점수·감상을 확인해주세요.' });
      send(
        res,
        await req.db.rpc('h_record_visit', {
          target_group: req.params.id,
          place_name: req.body.placeName,
          place_address: req.body.address || '',
          visit_date: req.body.date,
          rating: req.body.score,
          impression: req.body.comment,
        }),
      );
    }),
  );
  router.put(
    '/visits/:id/review',
    route(async (req, res) => {
      if (
        !uuid(req.params.id) ||
        !validReview(req.body) ||
        (req.body.version !== null && (!Number.isInteger(req.body.version) || req.body.version < 1))
      )
        return res.status(400).json({ error: '1~10점(0.1점 단위)과 감상을 입력해주세요.' });
      send(
        res,
        await req.db.rpc('h_review_visit', {
          target_visit: req.params.id,
          rating: req.body.score,
          impression: req.body.comment,
          expected_version: req.body.version,
        }),
      );
    }),
  );
};
