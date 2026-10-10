const express = require('express');
const { createClient } = require('@supabase/supabase-js');

// V2 requests use the signed-in user's JWT; never the service-role client.
module.exports = function accountsRouter({makeClient=createClient}={}) {
  const router = express.Router();
  router.use((req,res,next)=>{res.set('Cache-Control','no-store');next();});
  const url = process.env.SUPABASE_URL;
  const publicKey = process.env.SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_ANON_KEY;
  const validPublicKey = isPublicKey(publicKey);
  router.get('/config', (req, res) => {
    res.set('Cache-Control', 'no-store');
    res.json({ ready: !!url && validPublicKey, supabaseUrl: url || null,
      naverMapClientId:process.env.NAVER_MAP_CLIENT_ID||null,publicKey: validPublicKey ? publicKey : null });
  });
  router.use(async (req, res, next) => {
    if (!url || !validPublicKey) return res.status(503).json({ error: '로그인 연결을 준비 중입니다.' });
    const token = /^Bearer ([^\s]+)$/.exec(req.headers.authorization || '')?.[1];
    if (!token) return res.status(401).json({ error: '로그인이 필요합니다.' });
    try {
      req.db = makeClient(url, publicKey, {
        global: { headers: { Authorization: `Bearer ${token}` } },
        auth: { persistSession: false, autoRefreshToken: false },
      });
      const { data, error } = await req.db.auth.getUser(token);
      if (error || !data.user) return res.status(401).json({ error: '다시 로그인해주세요.' });
      req.user = data.user;
      next();
    } catch (_) { res.status(503).json({ error: '로그인 상태를 확인하지 못했습니다.' }); }
  });
  router.use(require('./workspace')());
  const route = fn => async (req, res) => {
    try { await fn(req, res); } catch (_) { res.status(503).json({ error: '요청을 처리하지 못했습니다.' }); }
  };
  function send(res, result) {
    if (result.error) {
      const code = result.error.code;
      return res.status(code === '40001' ? 409 : code === '42501' ? 403 : code === '22023' || code === '23505' || code === '23514' ? 400 : 503)
        .json({ error: code === '40001' ? '이미 저장되었거나 다른 화면에서 수정된 평가입니다. 작성 내용을 복사하고 최신 평가를 불러온 뒤 다시 수정해주세요.' : code === '42501' ? '접근 권한이 없습니다.' : code === '23505' ? '이미 다른 작성자에 연결된 계정입니다.' : code === '22023' ? '입력 내용이나 초대 링크를 확인해주세요.' : '요청을 처리하지 못했습니다. 설정을 확인해주세요.' });
    }
    res.json(result.data);
  }
  router.get('/profile', route(async (req,res) => send(res, await req.db.from('h_profiles').select('id,display_name').eq('id',req.user.id).maybeSingle())));
  router.put('/profile', route(async (req,res) => {
    const name = typeof req.body.displayName === 'string' ? req.body.displayName.trim() : '';
    if (!name || name.length > 40) return res.status(400).json({error:'이름을 1~40자로 입력해주세요.'});
    send(res, await req.db.from('h_profiles').upsert({id:req.user.id,display_name:name}).select('id,display_name').single());
  }));
  router.get('/groups', route(async (req,res) => send(res, await req.db.from('h_groups').select('id,name,owner_id,created_at').order('created_at'))));
  router.post('/groups', route(async (req,res) => {
    const name = typeof req.body.name === 'string' ? req.body.name.trim() : '';
    if (!name || name.length > 60) return res.status(400).json({error:'모임 이름을 1~60자로 입력해주세요.'});
    send(res, await req.db.rpc('h_create_group',{group_name:name}));
  }));
  router.patch('/groups/:id', route(async(req,res)=>{
    const name=typeof req.body.name==='string'?req.body.name.trim():'';
    if(!uuid(req.params.id)||!name||name.length>60)return res.status(400).json({error:'모임 이름을 1~60자로 입력해주세요.'});
    send(res,await req.db.rpc('h_rename_group',{target_group:req.params.id,group_name:name}));
  }));
  router.post('/invites/preview', route(async(req,res)=>{
    if(!uuid(req.body.token))return res.status(400).json({error:'초대 링크를 확인해주세요.'});
    send(res,await req.db.rpc('h_preview_invite',{invite_token:req.body.token}));
  }));
  router.delete('/groups/:id/invites', route(async(req,res)=>{
    if(!uuid(req.params.id))return res.status(400).json({error:'모임을 확인해주세요.'});
    send(res,await req.db.rpc('h_revoke_invites',{target_group:req.params.id}));
  }));
  router.post('/groups/join', route(async (req,res) => {
    if (!uuid(req.body.token)) return res.status(400).json({error:'초대 링크를 확인해주세요.'});
    send(res, await req.db.rpc('h_join_group',{invite_token:req.body.token}));
  }));
  router.post('/groups/:id/invites', route(async (req,res) => {
    if (!uuid(req.params.id)) return res.status(400).json({error:'모임을 확인해주세요.'});
    send(res, await req.db.rpc('h_create_invite',{target_group:req.params.id}));
  }));
  router.post('/groups/:id/legacy-authors', route(async(req,res)=>{
    if(!uuid(req.params.id)||!uuid(req.body.userId)||typeof req.body.reviewer!=='string'||!req.body.reviewer||req.body.reviewer.length>100)return res.status(400).json({error:'작성자와 계정을 확인해주세요.'});
    send(res,await req.db.rpc('h_propose_legacy_author',{target_group:req.params.id,legacy_reviewer:req.body.reviewer,target_user:req.body.userId}));
  }));
  router.post('/groups/:id/legacy-authors/accept', route(async(req,res)=>{
    if(!uuid(req.params.id)||typeof req.body.reviewer!=='string'||!req.body.reviewer||req.body.reviewer.length>100)return res.status(400).json({error:'작성자를 확인해주세요.'});
    send(res,await req.db.rpc('h_accept_legacy_author',{target_group:req.params.id,legacy_reviewer:req.body.reviewer}));
  }));
  router.put('/legacy/reviews/:id', route(async(req,res)=>{
    if(!uuid(req.params.id)||!validReview(req.body)||typeof req.body.expectedScore!=='number'||!Number.isFinite(req.body.expectedScore)||(req.body.expectedComment!==null&&typeof req.body.expectedComment!=='string'))return res.status(400).json({error:'점수와 감상을 확인해주세요.'});
    const result=await req.db.rpc('h_edit_legacy_review',{target_review:req.params.id,rating:req.body.score,impression:req.body.comment,expected_score:req.body.expectedScore,expected_comment:req.body.expectedComment});
    if(result.error?.code==='40001')return res.status(409).json({error:'다른 화면에서 수정된 기록입니다. 작성 내용을 복사한 뒤 닫고 기록을 새로 불러와주세요.'});
    send(res,result);
  }));
  router.get('/groups/:id/archive', route(async(req,res)=>{
    if(!uuid(req.params.id))return res.status(400).json({error:'모임을 확인해주세요.'});
    const result=await req.db.rpc('h_legacy_archive',{target_group:req.params.id});
    if(result.error||!result.data)return send(res,result);
    result.data.event_count=result.data.events?.length||0;delete result.data.events;
    // Archive carries metadata only. Images are authorized and signed on demand.
    const active=await require('./workspace').rows(req.db.from('h_media').select('id').eq('group_id',req.params.id).is('deleted_at',null).order('id'));
    const activeIds=new Set(active.map(p=>p.id));
    for(const key of ['place_photos','couple_photos'])result.data[key]=result.data[key].filter(p=>activeIds.has(p.id)).map(({url,...p})=>p);
    send(res,result);
  }));
  router.delete('/groups/:id/members/:userId', route(async(req,res)=>{
    if(!uuid(req.params.id)||!uuid(req.params.userId))return res.status(400).json({error:'모임과 멤버를 확인해주세요.'});
    send(res,await req.db.rpc('h_remove_group_member',{target_group:req.params.id,target_user:req.params.userId}));
  }));
  router.get('/groups/:id/members', route(async (req,res) => {
    if (!uuid(req.params.id)) return res.status(400).json({error:'모임을 확인해주세요.'});
    send(res, await req.db.from('h_group_members').select('user_id,h_profiles(id,display_name)').eq('group_id',req.params.id));
  }));
  router.get('/visits/:id',route(async(req,res)=>{
    if(!uuid(req.params.id))return res.sendStatus(400);
    send(res,await req.db.from('h_visits').select('id,visited_on,h_places(id,name,address),h_reviews(id,author_id,score,comment,updated_at,version)').eq('id',req.params.id).maybeSingle());
  }));
  router.get('/groups/:id/visits', route(async (req,res) => {
    if (!uuid(req.params.id)) return res.status(400).json({error:'모임을 확인해주세요.'});
    if(req.query.author&&!uuid(req.query.author))return res.sendStatus(400);
    const relation='h_reviews';
    let query=req.db.from('h_visits').select(`id,visited_on,${req.query.name?'h_places!inner':'h_places'}(id,name,address),${relation}(id,author_id,score,comment,updated_at,version)${req.query.author?',matching:h_reviews!inner(author_id)':''}`).eq('group_id',req.params.id);
    if(req.query.author)query=query.eq('matching.author_id',req.query.author);
    if(req.query.place){if(!uuid(req.query.place))return res.sendStatus(400);query=query.eq('place_id',req.query.place);}
    if(req.query.day){if(!/^\d{4}-\d{2}-\d{2}$/.test(req.query.day))return res.sendStatus(400);query=query.eq('visited_on',req.query.day);}
    if(req.query.name){if(typeof req.query.name!=='string'||req.query.name.length>100||typeof req.query.address!=='string'||req.query.address.length>300)return res.sendStatus(400);query=query.eq('h_places.name',req.query.name).eq('h_places.address',req.query.address);}
    send(res,{data:await require('./paging').page(query,req.query.after,'visited_on')});
  }));
  router.post('/groups/:id/visits', route(async (req,res) => {
    if (!uuid(req.params.id) || !validReview(req.body) || typeof req.body.placeName !== 'string' || !req.body.placeName.trim() || req.body.placeName.trim().length>100 || typeof req.body.date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(req.body.date) || (req.body.address != null && (typeof req.body.address !== 'string' || req.body.address.length>300))) return res.status(400).json({error:'장소·날짜·점수·감상을 확인해주세요.'});
    send(res, await req.db.rpc('h_record_visit',{target_group:req.params.id,place_name:req.body.placeName,place_address:req.body.address||'',visit_date:req.body.date,rating:req.body.score,impression:req.body.comment}));
  }));
  router.put('/visits/:id/review', route(async (req,res) => {
    if (!uuid(req.params.id) || !validReview(req.body) || (req.body.version!==null && (!Number.isInteger(req.body.version)||req.body.version<1))) return res.status(400).json({error:'1~10점(0.1점 단위)과 감상을 입력해주세요.'});
    send(res, await req.db.rpc('h_review_visit',{target_visit:req.params.id,rating:req.body.score,impression:req.body.comment,expected_version:req.body.version}));
  }));
  return router;
};
function uuid(value) { return typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value); }
function isPublicKey(key) {
  if (!key) return false;
  if (key.startsWith('sb_publishable_')) return true;
  try { return JSON.parse(Buffer.from(key.split('.')[1], 'base64url').toString()).role === 'anon'; }
  catch (_) { return false; }
}
module.exports.isPublicKey = isPublicKey;

function validReview(body) { return typeof body.score === "number" && Number.isFinite(body.score) && body.score >= 1 && body.score <= 10 && Math.abs(body.score*10-Math.round(body.score*10))<1e-8 && typeof body.comment === "string" && body.comment.trim().length>0 && body.comment.trim().length<=1000; }
