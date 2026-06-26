require('dotenv').config();
const path = require('path');
const express = require('express');
const multer = require('multer');
const { createClient } = require('@supabase/supabase-js');

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// 사진 업로드(메모리) — 최대 8MB
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 8 * 1024 * 1024 } });

// 스토리지 업로드 헬퍼: 버퍼 → photos 버킷 → 공개 URL
async function uploadToStorage(folder, id, file) {
  const ext = (file.mimetype.split('/')[1] || 'jpg').replace('jpeg', 'jpg');
  const sp = `${folder}/${id ? id + '/' : ''}${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const { error } = await supabase.storage.from('photos').upload(sp, file.buffer, { contentType: file.mimetype });
  if (error) throw error;
  const url = supabase.storage.from('photos').getPublicUrl(sp).data.publicUrl;
  return { url, path: sp };
}

// ── Supabase (서버 전용 키 사용) ───────────────────────────────
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

// ── 프론트에 필요한 설정 전달 (지도 Client ID 등) ──────────────
app.get('/api/config', (req, res) => {
  res.json({ naverMapClientId: process.env.NAVER_MAP_CLIENT_ID });
});

// ── 가게 검색 (네이버 지역검색 API 프록시) ─────────────────────
//    Secret이 필요해 브라우저에서 직접 못 부르므로 서버가 대신 호출
app.get('/api/search', async (req, res) => {
  const query = (req.query.query || '').trim();
  if (!query) return res.status(400).json({ error: 'query 필요' });

  try {
    const url = `https://openapi.naver.com/v1/search/local.json?query=${encodeURIComponent(query)}&display=5&sort=random`;
    const r = await fetch(url, {
      headers: {
        'X-Naver-Client-Id': process.env.NAVER_SEARCH_CLIENT_ID,
        'X-Naver-Client-Secret': process.env.NAVER_SEARCH_CLIENT_SECRET,
      },
    });
    if (!r.ok) {
      const body = await r.text();
      return res.status(r.status).json({ error: '네이버 검색 실패', body });
    }
    const data = await r.json();
    const items = (data.items || []).map((it) => ({
      name: stripTags(it.title),
      category: it.category,
      address: it.address,
      roadAddress: it.roadAddress,
      link: it.link,
      // 지역검색 API의 mapx/mapy는 WGS84 좌표 × 1e7 (경도, 위도)
      lng: Number(it.mapx) / 1e7,
      lat: Number(it.mapy) / 1e7,
    }));
    res.json(items);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── 저장된(북마크된) 가게 목록 + 평균점수 ──────────────────────
app.get('/api/places', async (req, res) => {
  const { data, error } = await supabase
    .from('place_with_stats')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

// ── 가게 저장(북마크) ──────────────────────────────────────────
app.post('/api/places', async (req, res) => {
  const { name, category, address, roadAddress, link, lat, lng } = req.body;
  if (!name || lat == null || lng == null)
    return res.status(400).json({ error: 'name, lat, lng 필요' });
  const status = req.body.status === 'wish' ? 'wish' : 'visited';

  // 같은 이름+주소면 중복 저장 방지. 단, 상태(방문/위시)가 다르면 그 상태로 갱신
  const { data: existing } = await supabase
    .from('places')
    .select('*')
    .eq('name', name)
    .eq('address', address || '')
    .maybeSingle();
  if (existing) {
    if (existing.status !== status) {
      const { data: updated } = await supabase
        .from('places').update({ status }).eq('id', existing.id).select().single();
      return res.json(updated || existing);
    }
    return res.json(existing);
  }

  const { data, error } = await supabase
    .from('places')
    .insert({ name, category, address, road_address: roadAddress, link, lat, lng, status })
    .select()
    .single();
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

// ── 전체 리뷰 모아보기 (가게명 포함) ──────────────────────────
app.get('/api/reviews', async (req, res) => {
  const { data, error } = await supabase
    .from('reviews')
    .select('*, places(name, status)')
    .order('visited_on', { ascending: false })
    .order('created_at', { ascending: false });
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

// ── 가게 상태 변경 (가고싶음 ↔ 방문) ──────────────────────────
app.patch('/api/places/:id', async (req, res) => {
  const { status } = req.body;
  if (!['visited', 'wish'].includes(status))
    return res.status(400).json({ error: 'status는 visited/wish' });
  const { data, error } = await supabase.from('places').update({ status }).eq('id', req.params.id).select().single();
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

// ── 가게 삭제 ──────────────────────────────────────────────────
app.delete('/api/places/:id', async (req, res) => {
  const { error } = await supabase.from('places').delete().eq('id', req.params.id);
  if (error) return res.status(500).json({ error: error.message });
  res.json({ ok: true });
});

// ── 가게별 평가 목록 ──────────────────────────────────────────
app.get('/api/places/:id/reviews', async (req, res) => {
  const { data, error } = await supabase
    .from('reviews')
    .select('*')
    .eq('place_id', req.params.id)
    .order('visited_on', { ascending: false })
    .order('created_at', { ascending: false });
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

// ── 평가 추가 (방문 날짜 포함) ─────────────────────────────────
app.post('/api/places/:id/reviews', async (req, res) => {
  const { reviewer, score, comment, visitedOn } = req.body;
  const s = Number(score);
  if (!reviewer || !(s >= 1 && s <= 10))
    return res.status(400).json({ error: 'reviewer 필요, score는 1~10' });

  const row = {
    place_id: req.params.id,
    reviewer,
    score: Math.round(s * 10) / 10, // 소수 첫째자리
    comment: comment || '',
  };
  if (visitedOn) row.visited_on = visitedOn; // 없으면 DB가 오늘 날짜로

  const { data, error } = await supabase.from('reviews').insert(row).select().single();
  if (error) return res.status(500).json({ error: error.message });
  // 평가가 생기면 '가고싶음' → '방문함' 자동 전환
  await supabase.from('places').update({ status: 'visited' }).eq('id', req.params.id);
  res.json(data);
});

// ── 평가 수정 ─────────────────────────────────────────────────
app.put('/api/reviews/:id', async (req, res) => {
  const { score, comment, visitedOn } = req.body;
  const s = Number(score);
  if (!(s >= 1 && s <= 10)) return res.status(400).json({ error: 'score는 1~10' });
  const row = { score: Math.round(s * 10) / 10, comment: comment || '' };
  if (visitedOn) row.visited_on = visitedOn;
  const { data, error } = await supabase.from('reviews').update(row).eq('id', req.params.id).select().single();
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

// ── 평가 삭제 ─────────────────────────────────────────────────
app.delete('/api/reviews/:id', async (req, res) => {
  const { error } = await supabase.from('reviews').delete().eq('id', req.params.id);
  if (error) return res.status(500).json({ error: error.message });
  res.json({ ok: true });
});

// ── 소원권: 목록 + 잔액(받은 것 − 쓴 것) ───────────────────────
app.get('/api/wishes', async (req, res) => {
  const [{ data: tickets, error: e1 }, { data: uses, error: e2 }] = await Promise.all([
    supabase.from('wish_tickets').select('*').order('created_at', { ascending: false }),
    supabase.from('wish_uses').select('*').order('used_on', { ascending: false }),
  ]);
  if (e1) return res.status(500).json({ error: e1.message });
  if (e2) return res.status(500).json({ error: e2.message });

  const earned = { 하진: 0, 민혁: 0 };
  for (const t of tickets) if (t.status === 'approved') earned[t.owner]++;
  const used = { 하진: 0, 민혁: 0 };
  for (const u of uses) used[u.user_name]++;
  const balances = { 하진: earned.하진 - used.하진, 민혁: earned.민혁 - used.민혁 };

  res.json({ balances, earned, used, tickets, uses });
});

// ── 소원권 사용 (잔액 차감) ────────────────────────────────────
app.post('/api/wish-uses', async (req, res) => {
  const { userName, usedOn, description } = req.body;
  if (!['하진', '민혁'].includes(userName) || !description)
    return res.status(400).json({ error: 'userName(하진/민혁), description 필요' });

  // 잔액 확인
  const [{ data: tickets }, { data: uses }] = await Promise.all([
    supabase.from('wish_tickets').select('owner,status').eq('owner', userName).eq('status', 'approved'),
    supabase.from('wish_uses').select('id').eq('user_name', userName),
  ]);
  if ((tickets?.length || 0) - (uses?.length || 0) <= 0)
    return res.status(400).json({ error: '사용할 수 있는 소원권이 없어요' });

  const row = { user_name: userName, description };
  if (usedOn) row.used_on = usedOn;
  const { data, error } = await supabase.from('wish_uses').insert(row).select().single();
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

// ── 소원권 사용 기록 삭제(되돌리기) ────────────────────────────
app.delete('/api/wish-uses/:id', async (req, res) => {
  const { error } = await supabase.from('wish_uses').delete().eq('id', req.params.id);
  if (error) return res.status(500).json({ error: error.message });
  res.json({ ok: true });
});

// ── 소원권 신청 (pending 생성) ─────────────────────────────────
app.post('/api/wishes', async (req, res) => {
  const { owner, reason } = req.body;
  if (!['하진', '민혁'].includes(owner) || !reason)
    return res.status(400).json({ error: 'owner(하진/민혁), reason 필요' });

  const { data, error } = await supabase
    .from('wish_tickets')
    .insert({ owner, reason, status: 'pending' })
    .select()
    .single();
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

// ── 소원권 컨펌 / 거절 (상대방만 가능) ──────────────────────────
app.post('/api/wishes/:id/:action', async (req, res) => {
  const { id, action } = req.params;
  const { by } = req.body;
  if (!['approve', 'reject'].includes(action))
    return res.status(400).json({ error: 'action은 approve/reject' });

  const { data: ticket, error: e1 } = await supabase
    .from('wish_tickets')
    .select('*')
    .eq('id', id)
    .single();
  if (e1 || !ticket) return res.status(404).json({ error: '요청을 찾을 수 없음' });
  if (ticket.status !== 'pending') return res.status(400).json({ error: '이미 처리된 요청' });
  if (by === ticket.owner) return res.status(403).json({ error: '본인 신청은 본인이 컨펌할 수 없어요' });
  if (by !== '하진' && by !== '민혁') return res.status(400).json({ error: '컨펌하는 사람을 선택하세요' });

  const { data, error } = await supabase
    .from('wish_tickets')
    .update({ status: action === 'approve' ? 'approved' : 'rejected', decided_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single();
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

// ── 소원권 삭제(취소) ──────────────────────────────────────────
app.delete('/api/wishes/:id', async (req, res) => {
  const { error } = await supabase.from('wish_tickets').delete().eq('id', req.params.id);
  if (error) return res.status(500).json({ error: error.message });
  res.json({ ok: true });
});

// ── 일정(캘린더): 목록 ─────────────────────────────────────────
app.get('/api/events', async (req, res) => {
  const { data, error } = await supabase
    .from('events')
    .select('*')
    .order('event_date', { ascending: true })
    .order('start_time', { ascending: true, nullsFirst: true });
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

// ── 일정 추가 ─────────────────────────────────────────────────
app.post('/api/events', async (req, res) => {
  const { owner, title, eventDate, endDate, startTime, endTime, memo } = req.body;
  if (!['민혁', '하진', '데이트'].includes(owner) || !title || !eventDate)
    return res.status(400).json({ error: 'owner(민혁/하진/데이트), title, eventDate 필요' });

  const row = { owner, title, event_date: eventDate, memo: memo || '' };
  if (startTime) row.start_time = startTime;
  if (endTime) row.end_time = endTime;
  if (endDate && endDate >= eventDate) row.end_date = endDate; // 기간 일정
  const { data, error } = await supabase.from('events').insert(row).select().single();
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

// ── 일정 수정 ─────────────────────────────────────────────────
app.put('/api/events/:id', async (req, res) => {
  const { owner, title, eventDate, endDate, startTime, endTime, memo } = req.body;
  if (!['민혁', '하진', '데이트'].includes(owner) || !title || !eventDate)
    return res.status(400).json({ error: 'owner(민혁/하진/데이트), title, eventDate 필요' });

  const row = {
    owner, title, event_date: eventDate, memo: memo || '',
    start_time: startTime || null,
    end_time: endTime || null,
    end_date: endDate && endDate >= eventDate ? endDate : null,
  };
  const { data, error } = await supabase.from('events').update(row).eq('id', req.params.id).select().single();
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

// ── 일정 삭제 ─────────────────────────────────────────────────
app.delete('/api/events/:id', async (req, res) => {
  const { error } = await supabase.from('events').delete().eq('id', req.params.id);
  if (error) return res.status(500).json({ error: error.message });
  res.json({ ok: true });
});

// ── 가게(식당) 사진 ───────────────────────────────────────────
app.get('/api/places/:id/photos', async (req, res) => {
  const { data, error } = await supabase
    .from('place_photos').select('*').eq('place_id', req.params.id)
    .order('created_at', { ascending: false });
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

app.post('/api/places/:id/photos', upload.single('photo'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: '사진 파일이 필요해요' });
  try {
    const { url, path: sp } = await uploadToStorage('places', req.params.id, req.file);
    const { data, error } = await supabase
      .from('place_photos').insert({ place_id: req.params.id, url, path: sp }).select().single();
    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.delete('/api/photos/:id', async (req, res) => {
  const { data: ph } = await supabase.from('place_photos').select('path').eq('id', req.params.id).maybeSingle();
  if (ph?.path) await supabase.storage.from('photos').remove([ph.path]);
  const { error } = await supabase.from('place_photos').delete().eq('id', req.params.id);
  if (error) return res.status(500).json({ error: error.message });
  res.json({ ok: true });
});

// ── 커플 사진 (홈) ────────────────────────────────────────────
app.get('/api/couple-photos', async (req, res) => {
  const { data, error } = await supabase
    .from('couple_photos').select('*').order('created_at', { ascending: false });
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

app.post('/api/couple-photos', upload.single('photo'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: '사진 파일이 필요해요' });
  try {
    const { url, path: sp } = await uploadToStorage('couple', null, req.file);
    const { data, error } = await supabase
      .from('couple_photos').insert({ url, path: sp, caption: req.body.caption || '' }).select().single();
    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.delete('/api/couple-photos/:id', async (req, res) => {
  const { data: ph } = await supabase.from('couple_photos').select('path').eq('id', req.params.id).maybeSingle();
  if (ph?.path) await supabase.storage.from('photos').remove([ph.path]);
  const { error } = await supabase.from('couple_photos').delete().eq('id', req.params.id);
  if (error) return res.status(500).json({ error: error.message });
  res.json({ ok: true });
});

function stripTags(s = '') {
  return s.replace(/<[^>]+>/g, '');
}

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`▶ http://localhost:${PORT}`));
