module.exports = function registerRoutes(router, { route, send, uuid }) {
  router.post(
    '/invites/preview',
    route(async (req, res) => {
      if (!uuid(req.body.token))
        return res.status(400).json({ error: '초대 링크를 확인해주세요.' });
      send(res, await req.db.rpc('h_preview_invite', { invite_token: req.body.token }));
    }),
  );
  router.delete(
    '/groups/:id/invites',
    route(async (req, res) => {
      if (!uuid(req.params.id)) return res.status(400).json({ error: '모임을 확인해주세요.' });
      send(res, await req.db.rpc('h_revoke_invites', { target_group: req.params.id }));
    }),
  );
  router.post(
    '/groups/join',
    route(async (req, res) => {
      if (!uuid(req.body.token))
        return res.status(400).json({ error: '초대 링크를 확인해주세요.' });
      send(res, await req.db.rpc('h_join_group', { invite_token: req.body.token }));
    }),
  );
  router.post(
    '/groups/:id/invites',
    route(async (req, res) => {
      if (!uuid(req.params.id)) return res.status(400).json({ error: '모임을 확인해주세요.' });
      send(res, await req.db.rpc('h_create_invite', { target_group: req.params.id }));
    }),
  );
};
