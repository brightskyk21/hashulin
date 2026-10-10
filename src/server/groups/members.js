module.exports = function registerRoutes(router, { route, send, uuid }) {
  router.delete(
    '/groups/:id/members/:userId',
    route(async (req, res) => {
      if (!uuid(req.params.id) || !uuid(req.params.userId))
        return res.status(400).json({ error: '모임과 멤버를 확인해주세요.' });
      send(
        res,
        await req.db.rpc('h_remove_group_member', {
          target_group: req.params.id,
          target_user: req.params.userId,
        }),
      );
    }),
  );
  router.get(
    '/groups/:id/members',
    route(async (req, res) => {
      if (!uuid(req.params.id)) return res.status(400).json({ error: '모임을 확인해주세요.' });
      send(
        res,
        await req.db
          .from('h_group_members')
          .select('user_id,h_profiles(id,display_name)')
          .eq('group_id', req.params.id),
      );
    }),
  );
};
