module.exports = function registerRoutes(router, { wrap, member, UUID, rows }) {
  router.get(
    '/groups/:id/events',
    wrap(async (req, res) => {
      if (!(await member(req, res, req.params.id))) return;
      const { from, to } = req.query;
      if (
        !/^\d{4}-\d{2}-\d{2}$/.test(from || '') ||
        !/^\d{4}-\d{2}-\d{2}$/.test(to || '') ||
        !Number.isFinite(Date.parse(from)) ||
        !Number.isFinite(Date.parse(to)) ||
        Date.parse(to) < Date.parse(from) ||
        Date.parse(to) - Date.parse(from) > 100 * 86400000
      )
        return res.sendStatus(400);
      const events = await rows(
        req.db
          .from('h_events')
          .select('*')
          .eq('group_id', req.params.id)
          .lte('event_date', to)
          .or(`end_date.gte.${from},and(end_date.is.null,event_date.gte.${from})`)
          .order('event_date')
          .order('id'),
      );
      res.json(events);
    }),
  );
  router.post(
    '/groups/:id/events',
    wrap(async (req, res) => {
      const b = req.body;
      if (
        !UUID.test(req.params.id) ||
        (b.id && !UUID.test(b.id)) ||
        typeof b.title !== 'string' ||
        typeof b.date !== 'string' ||
        typeof b.memo !== 'string' ||
        typeof b.owner !== 'string'
      )
        return res.status(400).json({ error: '일정 내용을 확인해주세요.' });
      const r = await req.db.rpc('h_save_event', {
        target_group: req.params.id,
        target_event: b.id || null,
        event_title: b.title,
        start_date: b.date,
        finish_date: b.endDate || null,
        starts: b.startTime || null,
        ends: b.endTime || null,
        label: b.owner,
        description: b.memo,
        expected_version: b.version ?? null,
      });
      if (r.error) throw r.error;
      res.json({ id: r.data });
    }),
  );
  router.put(
    '/events/:id/deleted',
    wrap(async (req, res) => {
      if (!UUID.test(req.params.id) || typeof req.body.deleted !== 'boolean')
        return res.sendStatus(400);
      const r = await req.db.rpc('h_set_event_deleted', {
        target_event: req.params.id,
        deleted: req.body.deleted,
        expected_version: req.body.version,
      });
      if (r.error) throw r.error;
      res.json({ ok: true });
    }),
  );
};
