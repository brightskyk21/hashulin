const {createClient}=require('@supabase/supabase-js');
const {isPublicKey}=require('./accounts');
function headers(req,res,next){res.set({'X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer','X-Frame-Options':'DENY','Permissions-Policy':'camera=(), microphone=(), geolocation=(self)'});if(req.path.startsWith('/api/'))res.set('Cache-Control','no-store');next();}
function legacyGate({url,publicKey,groupId,makeClient=createClient}){
 return async(req,res,next)=>{
  if(!url||!isPublicKey(publicKey)||!groupId)return res.status(503).json({error:'기존 기록의 로그인 연결을 준비 중입니다.'});
  const token=/^Bearer ([^\s]+)$/.exec(req.headers.authorization||'')?.[1];
  if(!token)return res.status(401).json({error:'로그인이 필요합니다.'});
  try{
   const db=makeClient(url,publicKey,{global:{headers:{Authorization:`Bearer ${token}`}},auth:{persistSession:false,autoRefreshToken:false}});
   const {data,error}=await db.auth.getUser(token);if(error||!data.user)return res.status(401).json({error:'다시 로그인해주세요.'});
   const access=await db.rpc('h_is_member',{target_group:groupId});if(access.error||access.data!==true)return res.status(403).json({error:'이 모임의 기록을 볼 권한이 없습니다.'});
   req.user=data.user;
   // Legacy author labels are not account identities. Until explicitly mapped,
   // preserve old rows and allow only reads through the authenticated bridge.
   if(!['GET','HEAD'].includes(req.method))return res.status(409).json({error:'기존 기록의 작성자 계정 연결 후 수정할 수 있습니다. 새 평가는 방문 기록에서 남겨주세요.'});
   next();
  }catch(_){res.status(503).json({error:'로그인 상태를 확인하지 못했습니다.'});}
 };
}
function frontendEntry(req,res,next){
 if(['GET','HEAD'].includes(req.method)&&['/','/index.html'].includes(req.path)){
  const query=req.originalUrl.includes('?')?req.originalUrl.slice(req.originalUrl.indexOf('?')):'';
  res.set('Cache-Control','no-store');
  return res.redirect(302,'/v2/'+query);
 }
 next();
}
module.exports={headers,legacyGate,frontendEntry};
