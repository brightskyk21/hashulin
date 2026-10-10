// One timeline for both generations of records, without rewriting old reviews.
let journalLimit=24,journalRequest=0,visibleJournal=[],selectedJournal='';
function journalRows(){return buildJournalRows(visits,archive,workspace.places,filter,visitNext);}
async function ensureJournalPage(request=journalRequest){
 const target=groupId,author=filter;
 while(visitNext&&journalRows().length<journalLimit){
  const cursor=visitNext,result=await api(`/groups/${target}/visits?author=${author}&after=${encodeURIComponent(cursor)}`);
  if(request!==journalRequest||groupId!==target||filter!==author)return;
  visits=[...new Map([...visits,...result.items].map(v=>[v.id,v])).values()];visitNext=result.next;
  if(visitNext===cursor)throw new Error('리뷰을 더 불러오지 못했습니다. 다시 시도해주세요.');
 }
}
function journalPhoto(row){
 const cover=row.visit?.cover;
 if(cover&&!workspace.media.find(m=>m.id===cover.id)?.deleted_at)return {id:cover.id,visit:row.visit.id};
 // Photos without a visit remain attached to the place, including all legacy photos.
 const old=row.legacyPlace?placePhotos(row.legacyPlace.id):[];
 return old.length?{id:old[0].id,legacyPlace:row.legacyPlace.id,count:old.length}:null;
}
function journalAuthor(r){return r.legacy?r.reviewer:(members.find(m=>m.user_id===r.author_id)?.h_profiles?.display_name||'멤버');}
function journalPhotoButton(row){
 const photo=journalPhoto(row);if(!photo)return '';
 return `<aside class="place-photos"><button class="photo-thumb" ${photo.legacyPlace?`data-photo-place="${photo.legacyPlace}" data-photo-index="0"`:`data-visit-media="${photo.id}" data-visit-id="${photo.visit}"`} aria-label="${esc(row.place.name)} 사진 보기">${lazyPhoto(photo.id,row.place.name+' 사진')}</button></aside>`;
}
function journalScoreBadge(row){
 const scores=row.reviews.map(r=>Number(r.score)).filter(s=>Number.isFinite(s)&&s>=1&&s<=10);
 if(!scores.length)return '';
 const average=scores.reduce((sum,s)=>sum+s,0)/scores.length;
 const [emoji,mood,ink]=band(average);
 const label=`${filter?'내 점수':'평균'} ${Number(average.toFixed(2))} · 리뷰 ${scores.length}개`;
 return `<div class="journal-score-footer"><details class="journal-score"><summary aria-label="${label} · ${mood}" style="--badge-ink:${ink}"><span class="journal-score-disc" aria-hidden="true"><span class="journal-score-emoji">${emoji}</span></span></summary><span class="journal-score-info">${label}</span></details></div>`;
}
function renderJournalFeed(){
 const rows=journalRows();visibleJournal=rows.slice(0,journalLimit);
 $('#records').innerHTML=visibleJournal.length?visibleJournal.map(row=>{
  const photo=journalPhotoButton(row);
  return `<article class="live-card archive-card journal-entry ${photo?'with-photos':''}"><div class="archive-content"><div class="date">${esc(row.date||'날짜 없음')}</div><button class="journal-open" data-journal="${esc(row.key)}"><h2>${esc(row.place.name)}</h2></button>${row.place.category?`<p class="place-category">${esc(row.place.category.split('>').pop().trim())}</p>`:''}${row.reviews.map(r=>`<div class="live-review"><header><strong>${esc(journalAuthor(r))}${r.author_id===session?.user.id?' · 나':''}</strong><span class="score-pill" style="color:${band(Number(r.score))[2]}">${Number(r.score).toFixed(1)}</span></header>${reviewCopy(r,'feed')}</div>`).join('')}</div>${photo}${journalScoreBadge(row)}</article>`;
 }).join(''):`<div class="empty-state"><h2>${filter?'작성한 리뷰가 없습니다':'리뷰가 없습니다'}</h2><button class="primary" data-compose>리뷰 추가</button></div>`;
 $('#moreVisits').hidden=rows.length<=journalLimit&&!visitNext;
 $('#archiveSection').hidden=true;scheduleReviewClamps();
 if(selectedJournal&&$('#journalDialog').open)renderJournalDetail(selectedJournal);
}
function renderJournalDetail(key){
 const row=journalRows().find(r=>r.key===key);if(!row){$('#journalDialog').close();return;}
 selectedJournal=key;$('#journalDetailTitle').textContent=row.place.name;
 $('#journalDetailDate').textContent=[row.date,row.place.road_address||row.place.address].filter(Boolean).join(' · ');
 const old=ownLegacyReview(archive,workspace.places,session?.user.id,row.place.id,row.date);
 const mine=row.reviews.find(r=>r.author_id===session?.user.id)||row.visit?.h_reviews.find(r=>r.author_id===session?.user.id)||(old?{...old,legacy:true}:null);
 $('#journalDetailReviews').innerHTML=row.reviews.map(r=>`<div class="live-review"><header><strong>${esc(journalAuthor(r))}${r.author_id===session?.user.id?' · 나':''}</strong><span class="score-pill" style="color:${band(Number(r.score))[2]}">${Number(r.score).toFixed(1)}</span></header><p>${esc(r.comment||'')}</p></div>`).join('');
 $('#journalDetailPhotos').innerHTML=journalPhotoButton(row);observePhotos();
 $('#journalDetailActions').innerHTML=`${mine?`<button class="primary" ${mine.legacy?`data-legacy-review="${mine.id}"`:`data-review="${row.visit.id}"`}>내 리뷰 수정</button>`:row.date?`<button class="primary" data-journal-review="${esc(key)}">내 리뷰 추가</button>`:''}<button class="secondary-action" data-place="${row.place.id}">장소 보기</button>`;
}
function openJournal(key){renderJournalDetail(key);showDialog('#journalDialog');}
$('#journalDialog').addEventListener('close',()=>{selectedJournal='';});
document.addEventListener('click',e=>{
 const b=e.target.closest('button');if(!b)return;
 if(b.dataset.journal)openJournal(b.dataset.journal);
 if(b.dataset.journalReview){const row=journalRows().find(r=>r.key===b.dataset.journalReview);if(!row)return;$('#journalDialog').close();if(row.visit)compose(row.visit);else{composePlace(row.place.id);$('#reviewForm').elements.date.value=row.date;}}
 if(b.dataset.visitMedia)openVisitPhoto(b.dataset.visitMedia,b.dataset.visitId);
});
async function openVisitPhoto(id,visitId){
 try{
  const target=groupId,items=[],seen=new Set();let cursor=null;
  do{
   const result=await api(`/groups/${target}/media?visit=${visitId}${cursor?'&after='+encodeURIComponent(cursor):''}`);
   if(target!==groupId)return;items.push(...result.items);cursor=result.next;
   if(cursor&&seen.has(cursor))throw new Error('사진을 더 불러오지 못했습니다. 다시 시도해주세요.');seen.add(cursor);
  }while(cursor);
  mergeMedia(items);photoGallery=[...new Map(items.map(p=>[p.id,p])).values()].reverse();photoIndex=Math.max(0,photoGallery.findIndex(p=>p.id===id));if(!photoGallery.length)return;
  $('#photoTitle').textContent=workspace.places.find(p=>p.id===photoGallery[photoIndex].place_id)?.name||'방문 사진';showPhoto();showDialog('#photoDialog');
 }catch(e){status(e.message);}
}
