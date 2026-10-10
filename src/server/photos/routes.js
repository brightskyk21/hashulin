module.exports = function registerRoutes(
  router,
  {
    wrap,
    member,
    UUID,
    page,
    safeMedia,
    storageAdmin,
    BUCKET,
    randomUUID,
    normalizePhoto,
    normalizeThumbnail,
    multer,
  },
) {
  const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 8 * 1024 * 1024, files: 1, fields: 4 },
  }).single('photo');
  router.get(
    '/groups/:id/media',
    wrap(async (req, res) => {
      if (!(await member(req, res, req.params.id))) return;
      let q = req.db.from('h_media').select('*').eq('group_id', req.params.id);
      const kind = req.query.kind || 'all';
      if (!['all', 'place', 'couple', 'trash'].includes(kind)) return res.sendStatus(400);
      q = kind === 'trash' ? q.not('deleted_at', 'is', null) : q.is('deleted_at', null);
      if (kind === 'place') q = q.not('place_id', 'is', null);
      if (kind === 'couple') q = q.is('place_id', null);
      if (req.query.place) {
        if (!UUID.test(req.query.place)) return res.sendStatus(400);
        q = q.eq('place_id', req.query.place);
      }
      if (req.query.visit) {
        if (!UUID.test(req.query.visit)) return res.sendStatus(400);
        q = q.eq('visit_id', req.query.visit);
      }
      const result = await page(q, req.query.after, 'created_at');
      res.json({ ...result, items: result.items.map(safeMedia) });
    }),
  );
  router.post(
    '/groups/:id/photo-urls',
    wrap(async (req, res) => {
      if (!(await member(req, res, req.params.id))) return;
      const ids = req.body.ids;
      if (
        !Array.isArray(ids) ||
        !ids.length ||
        ids.length > 48 ||
        ids.some((id) => typeof id !== 'string' || !UUID.test(id))
      )
        return res.sendStatus(400);
      const r = await req.db
        .from('h_media')
        .select('id,path,thumb_path')
        .eq('group_id', req.params.id)
        .in('id', [...new Set(ids)]);
      if (r.error) throw r.error;
      if (!r.data.length) return res.json([]);
      const signed = await storageAdmin()
        .storage.from(BUCKET)
        .createSignedUrls(
          r.data.map((m) => m.thumb_path || m.path),
          300,
        );
      if (signed.error) throw signed.error;
      res.json(
        r.data.map((m, i) => ({
          id: m.id,
          url: signed.data[i]?.signedUrl || null,
          expiresAt: Date.now() + 290000,
        })),
      );
    }),
  );
  router.get(
    '/photos/:id/url',
    wrap(async (req, res) => {
      if (!UUID.test(req.params.id)) return res.sendStatus(400);
      const r = await req.db.from('h_media').select('*').eq('id', req.params.id).maybeSingle();
      if (r.error) throw r.error;
      if (!r.data) return res.status(404).json({ error: '사진을 찾을 수 없습니다.' });
      const imagePath = req.query.size === 'thumb' ? r.data.thumb_path || r.data.path : r.data.path;
      const signed = await storageAdmin().storage.from(BUCKET).createSignedUrl(imagePath, 300);
      if (signed.error) throw signed.error;
      res.json({
        url: signed.data.signedUrl,
        expiresAt: Date.now() + 290000,
        media: safeMedia(r.data),
      });
    }),
  );
  router.put(
    '/photos/:id',
    wrap(async (req, res) => {
      if (
        !UUID.test(req.params.id) ||
        typeof req.body.caption !== 'string' ||
        typeof req.body.deleted !== 'boolean'
      )
        return res.sendStatus(400);
      const r = await req.db.rpc('h_edit_photo', {
        target_photo: req.params.id,
        description: req.body.caption,
        deleted: req.body.deleted,
        expected_version: req.body.version,
      });
      if (r.error) throw r.error;
      res.json({ ok: true });
    }),
  );
  router.post(
    '/groups/:id/photos',
    wrap(async (req, res) => {
      if (!(await member(req, res, req.params.id))) return;
      await new Promise((resolve, reject) =>
        upload(req, res, (e) => (e ? reject(Object.assign(e, { code: '22023' })) : resolve())),
      );
      if (!req.file) return res.status(400).json({ error: '사진을 선택해주세요.' });
      let place = req.body.placeId || null;
      const visit = req.body.visitId || null,
        uploadKey = req.body.uploadId || randomUUID();
      if (!UUID.test(uploadKey) || (visit && !UUID.test(visit))) return res.sendStatus(400);
      if (visit) {
        const v = await req.db
          .from('h_visits')
          .select('id,place_id')
          .eq('group_id', req.params.id)
          .eq('id', visit)
          .maybeSingle();
        if (v.error) throw v.error;
        if (!v.data || (place && place !== v.data.place_id))
          return res.status(403).json({ error: '이 모임의 방문 기록을 선택해주세요.' });
        place = v.data.place_id;
      }
      if (place) {
        if (!UUID.test(place)) return res.sendStatus(400);
        const p = await req.db
          .from('h_places')
          .select('id')
          .eq('group_id', req.params.id)
          .eq('id', place)
          .maybeSingle();
        if (p.error) throw p.error;
        if (!p.data) return res.status(403).json({ error: '이 모임의 장소를 선택해주세요.' });
      }
      const caption = typeof req.body.caption === 'string' ? req.body.caption.trim() : '';
      if (caption.length > 500) return res.sendStatus(400);
      const retry = await req.db
        .from('h_media')
        .select('id,visit_id,place_id,caption,deleted_at')
        .eq('group_id', req.params.id)
        .eq('uploaded_by', req.user.id)
        .eq('upload_key', uploadKey)
        .maybeSingle();
      if (retry.error) throw retry.error;
      if (retry.data) {
        const r = retry.data;
        if (r.visit_id !== visit || r.place_id !== place || r.caption !== caption || r.deleted_at)
          return res
            .status(409)
            .json({ error: '사진 내용이 변경됐습니다. 사진을 다시 선택해주세요.' });
        return res.status(200).json({ id: r.id });
      }
      let buffer;
      try {
        buffer = await normalizePhoto(req.file.buffer);
      } catch (_) {
        return res.status(400).json({
          error: '8MB 이하의 JPG·PNG·WebP 사진을 선택해주세요. HEIC 사진은 JPG로 변환해주세요.',
        });
      }
      const id = randomUUID(),
        path = req.params.id + '/' + id + '.webp';
      const a = storageAdmin();
      const saved = await a.storage
        .from(BUCKET)
        .upload(path, buffer, { contentType: 'image/webp', upsert: false });
      if (saved.error) throw saved.error;
      const record = await a.rpc('h_finalize_visit_photo', {
        target_photo: id,
        target_group: req.params.id,
        target_place: place,
        target_user: req.user.id,
        description: caption,
        target_visit: visit,
        request_key: uploadKey,
      });
      if (record.error) {
        await a.storage.from(BUCKET).remove([path]);
        throw record.error;
      }
      if (record.data !== id) {
        await a.storage.from(BUCKET).remove([path]);
        return res.status(200).json({ id: record.data });
      }
      // A failed thumbnail is safe: readers fall back to the full image.
      try {
        const thumbPath = path.replace('.webp', '.thumb.webp');
        const thumb = await normalizeThumbnail(buffer);
        const uploaded = await a.storage
          .from(BUCKET)
          .upload(thumbPath, thumb, { contentType: 'image/webp', upsert: false });
        if (!uploaded.error) {
          const updated = await a.from('h_media').update({ thumb_path: thumbPath }).eq('id', id);
          if (updated.error) await a.storage.from(BUCKET).remove([thumbPath]);
        }
      } catch (_) {}
      res.status(201).json({ id });
    }),
  );
};
