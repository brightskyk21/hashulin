module.exports = function registerRoutes(router, { wrap, member, rows, safeMedia }) {
  router.get(
    '/groups/:id/content',
    wrap(async (req, res) => {
      if (!(await member(req, res, req.params.id))) return;
      const [places, totals, covers] = await Promise.all([
        rows(
          req.db
            .from('h_places')
            .select('*')
            .eq('group_id', req.params.id)
            .order('created_at', { ascending: false })
            .order('id'),
        ),
        req.db.rpc('h_place_review_totals', { target_group: req.params.id }),
        req.db.rpc('h_photo_covers', { target_group: req.params.id }),
      ]);
      if (totals.error) throw totals.error;
      if (covers.error) throw covers.error;
      res.json({
        places: places.map((p) => ({
          ...p,
          review_count: totals.data.find((r) => r.place_id === p.id)?.review_count || 0,
          score_sum: totals.data.find((r) => r.place_id === p.id)?.score_sum || 0,
        })),
        events: [],
        media: covers.data.map(safeMedia),
      });
    }),
  );
};
