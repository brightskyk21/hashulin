module.exports = function registerRoutes(router, { wrap, UUID }) {
  router.post(
    '/groups/:id/places',
    wrap(async (req, res) => {
      const b = req.body;
      if (
        !UUID.test(req.params.id) ||
        typeof b.name !== 'string' ||
        typeof b.lat !== 'number' ||
        typeof b.lng !== 'number' ||
        !Number.isFinite(b.lat) ||
        !Number.isFinite(b.lng)
      )
        return res.status(400).json({ error: '검색 결과에서 장소를 선택해주세요.' });
      const r = await req.db.rpc('h_save_map_place', {
        target_group: req.params.id,
        place_name: b.name,
        place_address: b.address || '',
        road: b.roadAddress || '',
        category_name: b.category || '',
        latitude: b.lat,
        longitude: b.lng,
        place_status: b.status,
      });
      if (r.error) throw r.error;
      res.json({ id: r.data });
    }),
  );
  router.put(
    '/places/:id/status',
    wrap(async (req, res) => {
      if (!UUID.test(req.params.id)) return res.sendStatus(400);
      const r = await req.db.rpc('h_set_place_status', {
        target_place: req.params.id,
        place_status: req.body.status,
      });
      if (r.error) throw r.error;
      res.json({ ok: true });
    }),
  );
  router.post(
    '/places/:id/visits',
    wrap(async (req, res) => {
      if (
        !UUID.test(req.params.id) ||
        typeof req.body.score !== 'number' ||
        typeof req.body.comment !== 'string'
      )
        return res.sendStatus(400);
      const r = await req.db.rpc('h_record_at_place', {
        target_place: req.params.id,
        visit_date: req.body.date,
        rating: req.body.score,
        impression: req.body.comment,
      });
      if (r.error) throw r.error;
      res.json(r.data);
    }),
  );
};
