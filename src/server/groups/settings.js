module.exports = function registerRoutes(router, { route, send, uuid }) {
  router.get(
    '/groups',
    route(async (req, res) =>
      send(
        res,
        await req.db.from('h_groups').select('id,name,owner_id,created_at').order('created_at'),
      ),
    ),
  );
  router.post(
    '/groups',
    route(async (req, res) => {
      const name = typeof req.body.name === 'string' ? req.body.name.trim() : '';
      if (!name || name.length > 60)
        return res.status(400).json({ error: '모임 이름을 1~60자로 입력해주세요.' });
      send(res, await req.db.rpc('h_create_group', { group_name: name }));
    }),
  );
  router.patch(
    '/groups/:id',
    route(async (req, res) => {
      const name = typeof req.body.name === 'string' ? req.body.name.trim() : '';
      if (!uuid(req.params.id) || !name || name.length > 60)
        return res.status(400).json({ error: '모임 이름을 1~60자로 입력해주세요.' });
      send(
        res,
        await req.db.rpc('h_rename_group', { target_group: req.params.id, group_name: name }),
      );
    }),
  );
};
