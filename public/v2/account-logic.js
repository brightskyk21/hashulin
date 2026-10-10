// Shared pure decisions for the journal and account entry flow.
function journalReviews(reviews,author='',authors=null,legacyName=''){
 return reviews.filter(r=>(!legacyName||r.reviewer===legacyName)&&(!author||(authors?authors.some(a=>a.reviewer===r.reviewer&&a.accepted_at&&a.user_id===author):r.author_id===author)));
}
function accountStep(profile,groups,invite){return !profile?'profile':invite?'invite':!groups.length?'group':'ready';}
function parseInvite(value){
 let token=String(value||'').trim();
 if(/^https?:\/\//i.test(token)){try{const url=new URL(token);token=new URLSearchParams(url.hash.slice(1)).get('invite')||url.searchParams.get('invite')||'';}catch(_){return null;}}
 const compact=token.replace(/-/g,'');
 if(!/^[0-9a-f]{32}$/i.test(compact))return null;
 return compact.replace(/^(.{8})(.{4})(.{4})(.{4})(.{12})$/,'$1-$2-$3-$4-$5').toLowerCase();
}
