module.exports = function registerRoutes(router, { wrap, member }) {
  router.get(
    '/search',
    wrap(async (req, res) => {
      const query = typeof req.query.query === 'string' ? req.query.query.trim() : '';
      if (!query || query.length > 100)
        return res.status(400).json({ error: '검색어를 1~100자로 입력해주세요.' });
      if (!(await member(req, res, req.query.group))) return;
      const response = await fetch(
        'https://openapi.naver.com/v1/search/local.json?display=5&query=' +
          encodeURIComponent(query),
        {
          headers: {
            'X-Naver-Client-Id': process.env.NAVER_SEARCH_CLIENT_ID,
            'X-Naver-Client-Secret': process.env.NAVER_SEARCH_CLIENT_SECRET,
          },
          signal: AbortSignal.timeout(8000),
        },
      );
      if (!response.ok) throw new Error('Search unavailable');
      const data = await response.json();
      const clean = (s) =>
        String(s || '')
          .replace(/<[^>]*>/g, '')
          .replace(/&amp;/g, '&')
          .replace(/&quot;/g, '"');
      res.json(
        (data.items || []).map((p) => ({
          name: clean(p.title),
          address: p.address || '',
          roadAddress: p.roadAddress || '',
          category: clean(p.category),
          lat: Number(p.mapy) / 1e7,
          lng: Number(p.mapx) / 1e7,
        })),
      );
    }),
  );
};
