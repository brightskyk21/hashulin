const {test}=require('node:test');const assert=require('node:assert/strict');const express=require('express');const {legacyGate,headers}=require('../lib/security');
const groupId='10000000-0000-0000-0000-000000000001';
async function run(options,check){const app=express();app.use(headers);app.use('/api',legacyGate({url:'https://example.supabase.co',publicKey:'sb_publishable_test',groupId,...options}));app.all('/api/reviews/:id',(q,r)=>r.json({ok:true}));const server=await new Promise(resolve=>{const s=app.listen(0,'127.0.0.1',()=>resolve(s));});try{await check('http://127.0.0.1:'+server.address().port);}finally{await new Promise(r=>server.close(r));}}
const makeClient=member=>()=>({auth:{getUser:async()=>({data:{user:{id:'owner'}}})},rpc:async()=>({data:member})});
test('legacy routes fail closed without config/auth and deny outsiders',async()=>{
 await run({groupId:''},async u=>assert.equal((await fetch(u+'/api/reviews/id')).status,503));
 await run({makeClient:makeClient(true)},async u=>assert.equal((await fetch(u+'/api/reviews/id')).status,401));
 await run({makeClient:makeClient(false)},async u=>assert.equal((await fetch(u+'/api/reviews/id',{headers:{Authorization:'Bearer test'}})).status,403));
});
test('legacy member can read, but cannot spoof author or delete unmapped reviews',async()=>{
 await run({makeClient:makeClient(true)},async u=>{const opts={headers:{Authorization:'Bearer test'}};const read=await fetch(u+'/api/reviews/id',opts);assert.equal(read.status,200);assert.equal(read.headers.get('cache-control'),'no-store');assert.equal(read.headers.get('referrer-policy'),'no-referrer');for(const method of ['POST','PUT','PATCH','DELETE'])assert.equal((await fetch(u+'/api/reviews/id',{...opts,method})).status,409);});
});
test('homepage enters V2 and preserves OAuth query without redirecting APIs',async()=>{
 const app=express();app.use(require('../lib/security').frontendEntry);app.get('/v2/',(q,r)=>r.send('new app'));app.get('/api/example',(q,r)=>r.send('api'));
 const server=await new Promise(resolve=>{const s=app.listen(0,'127.0.0.1',()=>resolve(s));});
 try{const base='http://127.0.0.1:'+server.address().port;
 for(const path of ['/','/index.html']){const r=await fetch(base+path+'?code=example',{redirect:'manual'});assert.equal(r.status,302);assert.equal(r.headers.get('location'),'/v2/?code=example');assert.equal(r.headers.get('cache-control'),'no-store');}
 assert.equal(await (await fetch(base+'/v2/')).text(),'new app');assert.equal(await (await fetch(base+'/api/example')).text(),'api');
 }finally{await new Promise(r=>server.close(r));}
});
