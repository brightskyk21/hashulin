const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function cursor(value,field){
 if(!value)return null;
 try{const p=JSON.parse(Buffer.from(value,'base64url').toString());if(!UUID.test(p.id)||typeof p.at!=='string'||!/^\d{4}-\d{2}-\d{2}(?:T[\d:.]+(?:Z|[+-]\d{2}:\d{2}))?$/.test(p.at)||!Number.isFinite(Date.parse(p.at)))throw 0;return `${field}.lt.${p.at},and(${field}.eq.${p.at},id.lt.${p.id})`;}
 catch(_){throw Object.assign(new Error('Invalid cursor'),{code:'22023'});}
}
async function page(query,after,field,size=24){const condition=cursor(after,field);if(condition)query=query.or(condition);const r=await query.order(field,{ascending:false}).order('id',{ascending:false}).limit(size+1);if(r.error)throw r.error;const items=r.data.slice(0,size),last=items.at(-1);return {items,next:r.data.length>size?Buffer.from(JSON.stringify({at:last[field],id:last.id})).toString('base64url'):null};}
module.exports={page,cursor};
