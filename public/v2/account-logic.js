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

function buildJournalRows(visits,archive,places,author='',next=null){
 const rows=new Map(),canonical=new Map(places.map(p=>[p.legacy_id||p.id,p]));
 const rowFor=(place,date)=>{const key=place.id+':'+(date||'');if(!rows.has(key))rows.set(key,{key,place,date,reviews:[],visit:null,legacyPlace:null});return rows.get(key);};
 for(const visit of visits){const rs=journalReviews(visit.h_reviews,author);if(!rs.length)continue;const row=rowFor(places.find(p=>p.id===visit.h_places.id)||visit.h_places,visit.visited_on);row.visit=visit;row.reviews.push(...rs);}
 for(const review of archive?.reviews||[]){
  const link=archive.authors?.find(a=>a.reviewer===review.reviewer&&a.accepted_at),user=link?.user_id;
  if(author&&author!==user)continue;
  const place=archive.places.find(p=>p.id===review.place_id);if(!place)continue;
  const row=rowFor(canonical.get(place.id)||place,review.visited_on);row.legacyPlace=place;
  row.reviews.push({...review,legacy:true,author_id:user||null});
 }
 // A later page can contain more visits on the boundary day. Do not show an incomplete day.
 const boundary=next&&visits.length?visits.at(-1).visited_on:null;
 return [...rows.values()].filter(row=>!boundary||(row.date&&row.date>boundary)).sort((a,b)=>String(b.date||'').localeCompare(String(a.date||''))||a.key.localeCompare(b.key));
}
function clusterPlaces(points,radius){
 const clusters=[];
 for(const p of [...points].sort((a,b)=>a.place.id.localeCompare(b.place.id))){
  const found=clusters.find(c=>Math.hypot(c.x-p.x,c.y-p.y)<radius);
  if(found){const n=found.items.length;found.x=(found.x*n+p.x)/(n+1);found.y=(found.y*n+p.y)/(n+1);found.items.push(p.place);}
  else clusters.push({x:p.x,y:p.y,items:[p.place]});
 }
 return clusters;
}

function ownLegacyReview(archive,places,user,placeId,date,name='',address=''){
 const place=places.find(p=>p.id===placeId)||places.find(p=>p.name===name.trim()&&p.address===address.trim());
 if(!place?.legacy_id)return null;
 const author=archive?.authors?.find(a=>a.user_id===user&&a.accepted_at);
 return author?(archive.reviews||[]).find(r=>r.place_id===place.legacy_id&&r.visited_on===date&&r.reviewer===author.reviewer)||null:null;
}

function placeHasReviews(place,archive){
 return Number(place?.review_count||0)>0||!!(place?.legacy_id&&(archive?.reviews||[]).some(r=>r.place_id===place.legacy_id));
}
