const {test}=require('node:test');const assert=require('node:assert/strict');const {page,cursor}=require('../lib/paging');
test('cursor pagination bounds reads and rejects filter injection',async()=>{
 const input=Array.from({length:25},(_,i)=>({id:`10000000-0000-0000-0000-${String(i).padStart(12,'0')}`,created_at:'2026-10-10T00:00:00+00:00'}));const calls=[];
 const query={order(...a){calls.push(a);return this;},limit(n){assert.equal(n,25);return {data:input};}};
 const result=await page(query,null,'created_at');assert.equal(result.items.length,24);assert.ok(result.next);assert.match(cursor(result.next,'created_at'),/id.lt.10000000/);assert.equal(calls.length,2);
 assert.throws(()=>cursor(Buffer.from(JSON.stringify({id:input[0].id,at:'2026-01-01),id.neq.x'})).toString('base64url'),'created_at'));
 assert.throws(()=>cursor('garbage','created_at'));
});
