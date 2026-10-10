module.exports = function registerRoutes(router, { route, send }) {
  router.get(
    '/profile',
    route(async (req, res) =>
      send(
        res,
        await req.db
          .from('h_profiles')
          .select('id,display_name')
          .eq('id', req.user.id)
          .maybeSingle(),
      ),
    ),
  );
  router.put(
    '/profile',
    route(async (req, res) => {
      const name = typeof req.body.displayName === 'string' ? req.body.displayName.trim() : '';
      if (!name || name.length > 40)
        return res.status(400).json({ error: '이름을 1~40자로 입력해주세요.' });
      send(
        res,
        await req.db
          .from('h_profiles')
          .upsert({ id: req.user.id, display_name: name })
          .select('id,display_name')
          .single(),
      );
    }),
  );
};
