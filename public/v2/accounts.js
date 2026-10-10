const $=s=>document.querySelector(s);
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let client,session,profile,groups=[],members=[],visits=[],groupId='',filter='',editing=null,loadVersion=0,archive=null,archiveAuthor='',storageOrigin='',photoGallery=[],photoIndex=0;
const params=new URLSearchParams(location.search);
const fragment=new URLSearchParams(location.hash.slice(1));
if(fragment.has('invite'))params.set('invite',fragment.get('invite'));
if(params.has('invite')){const clean=new URL(location.href);clean.searchParams.delete('invite');clean.hash='';history.replaceState({},'',clean.pathname+clean.search);}
if(params.has('invite'))sessionStorage.setItem('hashulin.pendingInvite',params.get('invite'));
let inviteToken=sessionStorage.getItem('hashulin.pendingInvite');
function status(text){$('#status').textContent=text;document.querySelectorAll('.dialog-status').forEach(x=>x.remove());const dialog=document.querySelector('dialog[open]');if(dialog&&text){const p=document.createElement('p');p.className='dialog-status note';p.setAttribute('role','status');p.textContent=text;dialog.append(p);}clearTimeout(status.timer);status.timer=setTimeout(()=>$('#status').textContent='',8000);}
function today(){return new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());}
function band(s){return s<3?['🤢','매우 불만족','#9f302d']:s<5?['😣','불만족','#98470f']:s<6?['😐','보통','#756006']:s<8?['😋','대체로 만족','#4b6b22']:['⭐','매우 만족','#176540'];}
async function api(path,options={}){const {data,error}=await client.auth.getSession();if(error||!data.session)throw new Error('다시 로그인해주세요.');const res=await fetch('/api/v2'+path,{...options,headers:{...(options.body instanceof FormData?{}:{'Content-Type':'application/json'}),Authorization:`Bearer ${data.session.access_token}`}});const result=await res.json().catch(()=>({error:'요청을 처리하지 못했습니다.'}));if(!res.ok){const error=new Error(result.error||'요청을 처리하지 못했습니다.');error.status=res.status;throw error;}return result;}
async function busy(button,fn){if(button.disabled)return;button.disabled=true;try{await fn();}catch(e){status(e.message);}finally{button.disabled=false;}}
function showDialog(id){status('');const dialog=$(id);dialog.showModal();const title=dialog.querySelector('.dialog-head h2');if(title){title.tabIndex=-1;title.focus({preventScroll:true});}}
function renderGroups(){const name=profile?.display_name||'내 계정';$('#myName').textContent=name;$('#displayName').value=profile?.display_name||session?.user.user_metadata?.name||'';$('#groupSelect').innerHTML=groups.map(g=>`<option value="${g.id}">${esc(g.name)}</option>`).join('');$('#groupSelect').value=groupId;$('#groupTitle').textContent=groups.find(g=>g.id===groupId)?.name||'내 모임';$('#groupList').innerHTML=groups.length?groups.map(g=>`<div class="member-row"><button data-group="${g.id}"><strong>${esc(g.name)}</strong>${g.id===groupId?' · 선택됨':''}</button>${g.owner_id===session.user.id?`<span><button data-invite="${g.id}">새 초대 링크</button> · <button data-revoke="${g.id}">초대 취소</button></span>`:''}</div>`).join(''):'<p class="note">참여 중인 모임이 없습니다.</p>';$('#join').hidden=!inviteToken;$('#discardInvite').hidden=!inviteToken;$('#membership').hidden=!profile;$('#compose').disabled=!groupId||!profile;$('#localInviteNote').hidden=!['localhost','127.0.0.1'].includes(location.hostname);renderMemberControls();renderGroupSettings();}
function render(){
 renderGroups();$('#filters').innerHTML=members.length?[{user_id:'',h_profiles:{display_name:'모든 기록'}},...members].map(m=>`<button class="filter-tab ${filter===m.user_id?'active':''}" data-filter="${m.user_id}">${esc(m.h_profiles?.display_name||'멤버')}${m.user_id?'의 기록':''}</button>`).join(''):'';
 if(!groupId){$('#records').innerHTML='<div class="empty-state"><h2>참여 중인 모임이 없습니다</h2><button class="primary" data-manage>모임 선택</button></div>';return;}
 renderJournalFeed();
}
async function loadVisits(){const version=++loadVersion;journalLimit=24;const id=groupId;visits=[];members=[];archive=null;resetWorkspace();const request=++journalRequest;$('#archiveSection').hidden=true;if(!id){render();renderWorkspace();return;}$('#records').textContent='기록을 불러오는 중입니다.';try{const [m,v,a,w]=await Promise.all([api(`/groups/${id}/members`),api(`/groups/${id}/visits`),api(`/groups/${id}/archive`),api(`/groups/${id}/content`)]);if(version!==loadVersion||id!==groupId)return;members=m;visits=v.items;visitNext=v.next;archive=a;workspace=w;await ensureJournalPage(request);if(version!==loadVersion||id!==groupId)return;galleryIds=[];galleryNext=null;galleryLoaded=false;render();renderArchive();renderWorkspace();if(currentView==='gallery')await loadGallery();if(currentView==='calendar')await loadCalendar();}catch(e){if(version!==loadVersion)return;$('#records').innerHTML='<div class="empty-state"><p>기록을 불러오지 못했습니다.</p><button class="primary" data-retry>다시 시도</button></div>';throw e;}}
async function loadAccount(){profile=await api('/profile');groups=await api('/groups');const preferred=localStorage.getItem('hashulin.group.'+session.user.id);if(!groups.some(g=>g.id===groupId))groupId=groups.some(g=>g.id===preferred)?preferred:(groups[0]?.id||'');renderGroups();await loadVisits();await guideAccount();}
async function chooseGroup(id){groupId=id;filter='';archiveAuthor='';localStorage.setItem('hashulin.group.'+session.user.id,id);$('#inviteBox').hidden=true;renderGroups();await loadVisits();}




$('#scoreHelp').onclick=()=>{const guide=$('#scoreGuide');guide.hidden=!guide.hidden;$('#scoreHelp').setAttribute('aria-expanded',String(!guide.hidden));$('#scoreHelp').textContent=guide.hidden?'기준 보기':'기준 닫기';};

$('#profileForm').onsubmit=e=>{e.preventDefault();busy(e.submitter,async()=>{await api('/profile',{method:'PUT',body:JSON.stringify({displayName:$('#displayName').value.trim()})});$('#profileDialog').close();await loadAccount();status('이름을 저장했습니다.');});};
$('#groupForm').onsubmit=e=>{e.preventDefault();busy(e.submitter,async()=>{groupId=await api('/groups',{method:'POST',body:JSON.stringify({name:$('#groupName').value.trim()})});$('#groupName').value='';localStorage.setItem('hashulin.group.'+session.user.id,groupId);$('#choiceDialog').close();await loadAccount();status('모임을 만들었습니다.');});};
$('#join').onclick=()=>busy($('#join'),async()=>{groupId=await api('/groups/join',{method:'POST',body:JSON.stringify({token:inviteToken})});inviteToken=null;sessionStorage.removeItem('hashulin.pendingInvite');history.replaceState({},'',location.pathname);localStorage.setItem('hashulin.group.'+session.user.id,groupId);$('#choiceDialog').close();await loadAccount();status('모임에 참여했습니다.');});
$('#discardInvite').onclick=()=>{sessionStorage.removeItem('hashulin.pendingInvite');inviteToken=null;$('#invitePreview').textContent='';$('#join').hidden=true;$('#discardInvite').hidden=true;$('#inviteCodeInput').value='';chooseAccountMode('');};
async function copyInviteLink(){
 const field=$('#inviteLink');if(!field.value)return;
 try{await navigator.clipboard.writeText(field.value);$('#inviteMessage').textContent='초대 링크를 복사했습니다.';$('#copyInvite').textContent='복사 완료';}
 catch(_){field.focus();field.select();field.setSelectionRange(0,field.value.length);$('#inviteMessage').textContent='자동 복사가 지원되지 않습니다. 선택된 주소를 길게 눌러 복사해주세요.';}
}
$('#copyInvite').onclick=()=>busy($('#copyInvite'),copyInviteLink);
async function createInvite(button){
 const target=button.dataset.invite,actor=session?.user.id;
 const box=$('#inviteBox'),copy=$('#copyInvite');
 box.hidden=false;$('#inviteLink').value='';copy.disabled=true;copy.textContent='링크 복사';
 $('#inviteHeading').textContent=(groups.find(g=>g.id===target)?.name||'모임')+' 초대';
 $('#inviteMessage').textContent='초대 링크 생성 중…';box.scrollIntoView({block:'center',behavior:'smooth'});
 try{
  const token=await api(`/groups/${target}/invites`,{method:'POST'});
  if(session?.user.id!==actor||!groups.some(g=>g.id===target))return;
  $('#inviteLink').value=location.origin+'/v2/#invite='+encodeURIComponent(token);
  $('#inviteCode').value=token;
  $('#inviteMessage').textContent='초대 링크를 생성했습니다.';
  copy.disabled=false;copy.focus({preventScroll:true});box.scrollIntoView({block:'center',behavior:'smooth'});
 }catch(error){$('#inviteMessage').textContent=error.message||'초대 링크를 만들지 못했습니다. 다시 시도해주세요.';box.scrollIntoView({block:'center',behavior:'smooth'});}
}
$('#groupSelect').onchange=()=>chooseGroup($('#groupSelect').value).catch(e=>status(e.message));
for(const id of ['groupNav','mobileGroups'])$('#'+id).onclick=()=>showDialog('#groupDialog');
for(const id of ['journalNav','mobileJournal'])$('#'+id).onclick=()=>loadVisits().catch(e=>status(e.message));
$('#compose').onclick=()=>compose();
function clearAccount(){++loadVersion;session=null;profile=null;groups=[];members=[];visits=[];archive=null;resetWorkspace();$('#archiveRecords').replaceChildren();$('#legacyAuthors').replaceChildren();photoGallery=[];$('#photoLarge').removeAttribute('src');$('#archiveSection').hidden=true;groupId='';sessionStorage.removeItem('hashulin.pendingInvite');inviteToken=null;document.querySelectorAll('dialog[open]').forEach(d=>d.close());$('#records').replaceChildren();$('#groupList').replaceChildren();$('#currentMembers').replaceChildren();$('#inviteLink').value='';$('#app').hidden=true;$('#login').hidden=false;}
async function logout(button){await busy(button,async()=>{const {error}=await client.auth.signOut({scope:'local'});if(error)throw error;clearAccount();status('로그아웃했습니다.');});}
$('#logout').onclick=()=>logout($('#logout'));$('#mobileLogout').onclick=()=>logout($('#mobileLogout'));
$('#kakao').onclick=()=>busy($('#kakao'),async()=>{const {error}=await client.auth.signInWithOAuth({provider:'kakao',options:{redirectTo:location.origin+'/v2/',queryParams:{scope:'profile_nickname'}}});if(error)throw error;});
document.addEventListener('click',e=>{const b=e.target.closest('button');if(!b)return;if(b.hasAttribute('data-close')){const dialog=b.closest('dialog');if(dialog.id==='reviewDialog'&&reviewSaving)return status('저장이 끝날 때까지 기다려주세요.');if(dialog.id==='reviewDialog'&&reviewDirty()&&!confirm('작성 중인 내용을 닫을까요? 저장하지 않은 내용은 사라집니다.'))return;dialog.close();}if(b.hasAttribute('data-manage'))showDialog('#groupDialog');if(b.hasAttribute('data-compose'))compose();if(b.hasAttribute('data-filter')){filter=b.dataset.filter;archiveAuthor='';archiveLimit=24;journalLimit=24;refreshJournal().catch(e=>status(e.message));}if(b.dataset.review)compose(visits.find(v=>v.id===b.dataset.review));if(b.hasAttribute('data-retry'))busy(b,loadVisits);if(b.dataset.group)busy(b,async()=>{await chooseGroup(b.dataset.group);$('#groupDialog').close();});if(b.dataset.invite)busy(b,()=>createInvite(b));if(b.dataset.revoke)busy(b,async()=>{await api(`/groups/${b.dataset.revoke}/invites`,{method:'DELETE'});$('#inviteBox').hidden=true;$('#inviteLink').value='';status('아직 사용하지 않은 초대 링크를 취소했습니다.');});});
document.addEventListener('DOMContentLoaded',async()=>{try{const config=await fetch('/api/v2/config').then(r=>r.json());if(!config.ready){$('#setup').textContent='로그인 연결을 준비 중입니다.';return;}mapClientId=config.naverMapClientId;storageOrigin=new URL(config.supabaseUrl).origin;client=supabase.createClient(config.supabaseUrl,config.publicKey,{auth:{flowType:'pkce',detectSessionInUrl:true,persistSession:true,autoRefreshToken:true}});const {data,error}=await client.auth.getSession();if(error)throw error;session=data.session;$('#setup').textContent='';$('#kakao').disabled=false;if(params.has('error'))status('카카오 로그인에 실패했습니다. 다시 시도해주세요.');if(params.has('code')||params.has('error'))history.replaceState({},'',location.pathname);client.auth.onAuthStateChange(handleAuthChange);$('#login').hidden=!!session;$('#app').hidden=!session;if(session)await loadAccount();}catch(e){status(e.message);$('#setup').textContent='설정을 확인한 뒤 새로고침해주세요.';}});


$('#reviewDialog').addEventListener('cancel',e=>{if(reviewSaving){e.preventDefault();return;}if(reviewDirty()&&!confirm('작성 중인 내용을 닫을까요? 저장하지 않은 내용은 사라집니다.'))e.preventDefault();});
window.addEventListener('beforeunload',e=>{if($('#reviewDialog').open&&reviewDirty()){e.preventDefault();e.returnValue='';}});

function safePhotoUrl(value){
 try{const u=new URL(value);return u.protocol==='https:'&&u.origin===storageOrigin&&u.pathname.startsWith('/storage/v1/object/sign/group-photos/')?u.href:'';}catch(_){return '';}
}
function placePhotos(id){return (archive?.place_photos||[]).filter(p=>p.place_id===id).sort((a,b)=>String(a.created_at).localeCompare(String(b.created_at)));}
function photoStrip(place){
 const photos=placePhotos(place?.id);if(!photos.length)return '';
 return `<aside class="place-photos" aria-label="${esc(place.name)} 사진"><div class="photo-label">사진 <span>${photos.length}장</span></div><div class="photo-thumbnails">${photos.slice(0,1).map((p,i)=>`<button class="photo-thumb" data-photo-place="${place.id}" data-photo-index="${i}" aria-label="${esc(place.name)} 사진 ${i+1} 크게 보기">${lazyPhoto(p.id,place.name+' 사진 '+(i+1))}<span class="photo-fallback" hidden>불러오지 못했습니다</span>${photos.length>1?`<span class="photo-more">1 / ${photos.length}</span>`:''}</button>`).join('')}</div></aside>`;
}
function renderLegacyAuthors(){
 const own=groups.find(g=>g.id===groupId)?.owner_id===session.user.id;
 const pending=(archive.authors||[]).filter(a=>!a.accepted_at&&(own||a.user_id===session.user.id));$('#legacyAuthors').hidden=!pending.length;
 $('#legacyAuthors').innerHTML=`<details><summary>이전 리뷰의 계정 연결</summary><p class="note">모임장이 계정을 지정하고, 당사자가 본인의 기록인지 확인하면 수정할 수 있습니다. 연결이 끝난 작성자는 여기서 바꿀 수 없습니다.</p>${pending.map(a=>`<div class="author-link-row"><div><strong>${esc(a.reviewer)}</strong><span class="note"> · 리뷰 ${a.review_count}개</span><p class="note">${a.accepted_at?esc(a.display_name)+' 계정에 연결됨':a.user_id?esc(a.display_name)+' 님의 확인 대기':'연결할 계정을 선택해주세요.'}</p></div>${!a.accepted_at&&own?`<form class="author-link-form" data-author-form="${esc(a.reviewer)}"><label>연결할 계정<select name="userId" required aria-label="${esc(a.reviewer)} 리뷰에 연결할 계정"><option value="">계정 선택</option>${members.map(m=>`<option value="${m.user_id}" ${m.user_id===a.user_id?'selected':''}>${esc(m.h_profiles?.display_name||'멤버')}${m.user_id===session.user.id?' · 나':''}</option>`).join('')}</select></label><button class="primary small">${a.user_id?'지정 변경':'계정 지정'}</button></form>`:''}${!a.accepted_at&&a.user_id===session.user.id?`<div class="author-confirm"><p>이전 ‘${esc(a.reviewer)}’ 리뷰 ${a.review_count}개가 본인이 작성한 기록인가요?</p><button class="primary small" data-accept-author="${esc(a.reviewer)}">내 기록으로 연결</button></div>`:''}</div>`).join('')}</details>`;
}
function renderArchive(){$('#archiveSection').hidden=true;if(archive)renderLegacyAuthors();else $('#legacyAuthors').replaceChildren();renderJournalFeed();}
function showPhoto(){
 const p=photoGallery[photoIndex];if(!p)return;const src=safePhotoUrl(p.url);
 $('#photoError').textContent='사진을 불러오는 중입니다.';$('#photoError').hidden=!!src;$('#photoLarge').hidden=!src;$('#photoLarge').alt=$('#photoTitle').textContent+' '+(photoIndex+1);
 if(src)$('#photoLarge').src=src;else $('#photoLarge').removeAttribute('src');
 $('#photoPosition').textContent=`${photoIndex+1} / ${photoGallery.length}`;
 updatePhotoTools(p);refreshViewerPhoto(p);$('#photoPrevious').disabled=photoIndex===0;$('#photoNext').disabled=photoIndex===photoGallery.length-1;
}
function movePhoto(direction){const next=photoIndex+direction;if(next<0||next>=photoGallery.length)return;photoIndex=next;showPhoto();}
$('#photoPrevious').onclick=()=>movePhoto(-1);$('#photoNext').onclick=()=>movePhoto(1);
$('#photoDialog').addEventListener('keydown',e=>{if(!e.target.matches('input,textarea,select')&&(e.key==='ArrowLeft'||e.key==='ArrowRight')){e.preventDefault();movePhoto(e.key==='ArrowLeft'?-1:1);}});
$('#photoDialog').addEventListener('close',()=>{photoGallery=[];$('#photoLarge').removeAttribute('src');});
$('#photoLarge').onerror=()=>{$('#photoError').textContent='사진을 불러오지 못했습니다.';$('#photoError').hidden=false;$('#photoLarge').hidden=true;};
$('#archiveRecords').addEventListener('error',e=>{if(e.target.matches('.photo-thumb img')){e.target.hidden=true;e.target.nextElementSibling.hidden=false;}},true);
$('#legacyAuthors').addEventListener('submit',e=>{const f=e.target.closest('[data-author-form]');if(!f)return;e.preventDefault();busy(e.submitter,async()=>{await api(`/groups/${groupId}/legacy-authors`,{method:'POST',body:JSON.stringify({reviewer:f.dataset.authorForm,userId:new FormData(f).get('userId')})});await loadVisits();$('#legacyAuthors details').open=true;status('계정을 지정했습니다. 당사자가 확인하면 연결됩니다.');});});
document.addEventListener('click',e=>{
 const b=e.target.closest('button');if(!b)return;
 if(b.dataset.acceptAuthor)busy(b,async()=>{await api(`/groups/${groupId}/legacy-authors/accept`,{method:'POST',body:JSON.stringify({reviewer:b.dataset.acceptAuthor})});await loadVisits();$('#legacyAuthors details').open=true;status('이전 리뷰를 연결했습니다. 이제 내 평가를 수정할 수 있어요.');});
 if(b.dataset.legacyReview){const r=archive.reviews.find(r=>r.id===b.dataset.legacyReview);if(r)compose({id:r.id,legacy:r,h_places:archive.places.find(p=>p.id===r.place_id)||{name:'이전 기록'},visited_on:r.visited_on,h_reviews:[{...r,author_id:session.user.id}]});}
 if(b.dataset.photoPlace){photoGallery=placePhotos(b.dataset.photoPlace);photoIndex=Number(b.dataset.photoIndex);$('#photoTitle').textContent=(archive.places.find(p=>p.id===b.dataset.photoPlace)?.name||'장소')+' · 사진';showPhoto();showDialog('#photoDialog');}
});
$('#archiveAuthor').onchange=e=>{archiveAuthor=e.target.value;archiveLimit=24;renderArchive();};

// Measure rendered lines so short comments never get an unnecessary disclosure.
function reviewCopy(review,source){
 const id=`review-copy-${source}-${review.id}`;
 return `<div class="review-copy"><p id="${esc(id)}" class="review-comment">${esc(review.comment||'')}</p><button class="review-toggle" data-expand-review="${esc(id)}" aria-controls="${esc(id)}" aria-expanded="false" hidden>더보기</button></div>`;
}
let reviewClampFrame;
function scheduleReviewClamps(){
 observePhotos();
 cancelAnimationFrame(reviewClampFrame);
 reviewClampFrame=requestAnimationFrame(()=>{
  document.querySelectorAll('.review-copy').forEach(copy=>{
   const paragraph=copy.querySelector('.review-comment'),button=copy.querySelector('.review-toggle');
   if(!paragraph.getClientRects().length)return;
   const expanded=button.getAttribute('aria-expanded')==='true';
   paragraph.classList.remove('is-expanded');
   const overflow=paragraph.scrollHeight>paragraph.clientHeight+1;
   button.hidden=!overflow;
   const keepExpanded=expanded&&overflow;
   paragraph.classList.toggle('is-expanded',keepExpanded);
   button.setAttribute('aria-expanded',String(keepExpanded));
   button.textContent=keepExpanded?'접기':'더보기';
  });
 });
}
document.addEventListener('click',e=>{
 const button=e.target.closest('[data-expand-review]');if(!button)return;
 const paragraph=document.getElementById(button.dataset.expandReview);if(!paragraph)return;
 const expanded=button.getAttribute('aria-expanded')!=='true';
 paragraph.classList.toggle('is-expanded',expanded);
 button.setAttribute('aria-expanded',String(expanded));button.textContent=expanded?'접기':'더보기';
});
let reviewLayoutWidth=0;
new ResizeObserver(entries=>{const width=entries[0].contentRect.width;if(width!==reviewLayoutWidth){reviewLayoutWidth=width;scheduleReviewClamps();}}).observe($('#main'));
if(document.fonts)document.fonts.ready.then(scheduleReviewClamps);

let membershipAction=null,membershipChecking=false;
function renderMemberControls(){
 const group=groups.find(g=>g.id===groupId),owner=group?.owner_id===session?.user.id;
 $('#currentMembers').innerHTML=members.length?members.map(m=>`<div class="member-row"><span>${esc(m.h_profiles?.display_name||'멤버')}${m.user_id===session?.user.id?' · 나':''}${m.user_id===group?.owner_id?' · 모임장':''}</span>${m.user_id!==group?.owner_id&&(owner||m.user_id===session?.user.id)?`<button class="member-action" data-remove-member="${m.user_id}">${m.user_id===session.user.id?'모임 나가기':'내보내기'}</button>`:''}</div>`).join(''):'<p class="note">현재 모임의 멤버가 없습니다.</p>';
 $('#membershipNote').textContent=owner?'모임장은 현재 탈퇴할 수 없습니다. 멤버를 내보내도 기존 기록은 유지됩니다.':'모임을 나가도 남긴 기록은 보관됩니다. 다시 참여하려면 새 초대가 필요합니다.';
}
document.addEventListener('click',e=>{const b=e.target.closest('[data-remove-member]');if(!b)return;const m=members.find(m=>m.user_id===b.dataset.removeMember);if(!m)return;const self=m.user_id===session.user.id;membershipAction={group:groupId,user:m.user_id,self};$('#membershipTitle').textContent=self?'모임 나가기':'멤버 내보내기';$('#membershipMessage').textContent=self?'이 모임에서 나갈까요? 이후에는 이 모임의 기록을 보거나 수정할 수 없습니다.':(m.h_profiles?.display_name||'이 멤버')+' 님을 내보낼까요? 이후에는 이 모임의 기록을 보거나 수정할 수 없습니다.';$('#confirmMembership').textContent=self?'모임 나가기':'내보내기';showDialog('#membershipDialog');});
$('#confirmMembership').onclick=()=>busy($('#confirmMembership'),async()=>{const action=membershipAction;if(!action)return;await api(`/groups/${action.group}/members/${action.user}`,{method:'DELETE'});$('#membershipDialog').close();$('#inviteBox').hidden=true;$('#inviteLink').value='';if(action.self){$('#groupDialog').close();groupId='';}await loadAccount();status(action.self?'모임에서 나왔습니다.':'멤버를 내보냈습니다. 미사용 초대 링크도 취소했습니다.');});
$('#reloadReview').onclick=()=>busy($('#reloadReview'),async()=>{
 if(!confirm('작성 중인 내용을 최신 저장 내용으로 바꿀까요? 필요한 내용은 먼저 복사해주세요.'))return;
 const previous=editing,f=$('#reviewForm'),name=f.elements.placeName.value.trim(),address=f.elements.address.value.trim(),date=f.elements.date.value,place=f.dataset.placeId;
 await loadVisits();let fresh;
 if(previous?.legacy){const r=archive?.reviews.find(r=>r.id===previous.id);if(r)fresh={id:r.id,legacy:r,h_places:archive.places.find(p=>p.id===r.place_id)||{name:'이전 기록'},visited_on:r.visited_on,h_reviews:[{...r,author_id:session.user.id}]};}
 else if(previous)fresh=await api('/visits/'+previous.id);
 else {const query=new URLSearchParams({day:date,...(place?{place}:{name,address})});const result=await api(`/groups/${groupId}/visits?${query}`);fresh=result.items[0];}
 if(!fresh)throw new Error('최신 평가를 찾지 못했습니다. 작성 내용은 유지됩니다.');
 $('#reviewDialog').close();compose(fresh);status('최신 평가를 불러왔습니다.');
});
// Remove stale private content from an already-open tab after membership is revoked.
async function refreshMembership(){
 if(!client||!session||document.hidden||membershipChecking)return;
 membershipChecking=true;const user=session.user.id,target=groupId;
 try{const available=await api('/groups');if(session?.user.id!==user||groupId!==target)return;
  if(target&&!available.some(g=>g.id===target)){
   ++loadVersion;groupId='';groups=available;members=[];visits=[];archive=null;photoGallery=[];$('#photoLarge').removeAttribute('src');
   document.querySelectorAll('dialog[open]').forEach(d=>d.close());resetWorkspace();$('#records').replaceChildren();$('#archiveRecords').replaceChildren();$('#archiveSection').hidden=true;$('#inviteLink').value='';$('#inviteBox').hidden=true;render();
   await loadAccount();status('모임 접근 권한이 변경되어 기록을 닫았습니다.');
  }
 }catch(_){/* Offline does not imply revocation. Every API write still checks membership. */}
 finally{membershipChecking=false;}
}
setInterval(refreshMembership,30000);document.addEventListener('visibilitychange',()=>{if(!document.hidden)refreshMembership();});

// Keep the in-memory account in sync with persisted sessions and token refreshes.
// Defer API reads outside Supabase's auth callback lock.
function handleAuthChange(event,nextSession){
 if(event==='SIGNED_OUT'){clearAccount();return;}
 if(!nextSession)return;
 const changed=session?.user.id!==nextSession.user.id;
 session=nextSession;
 $('#login').hidden=true;$('#app').hidden=false;
 if(changed)setTimeout(()=>loadAccount().catch(e=>status(e.message)),0);
}
async function restoreSession(){
 if(!client)return;
 const {data,error}=await client.auth.getSession();
 if(error){status('로그인 상태를 확인하지 못했습니다. 연결 후 다시 시도해주세요.');return;}
 if(data.session)handleAuthChange('RESTORED',data.session);
 else if(session)clearAccount();
}
window.addEventListener('pageshow',()=>restoreSession().catch(e=>status(e.message)));
document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')restoreSession().catch(e=>status(e.message));});
