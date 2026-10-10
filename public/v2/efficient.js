// Bounded feeds and image delivery. State is scoped to the active group/session.
let visitNext=null,archiveLimit=24,galleryIds=[],galleryNext=null,galleryLoaded=false,placeVisits={},galleryRequest=0,calendarRequest=0;
const imageCache=new Map(),imageRequests=new Map(),thumbnailQueues=new Map();
function lazyPhoto(id,alt){return `<img data-lazy-photo="${id}" alt="${esc(alt)}" loading="lazy" decoding="async">`;}
const photoObserver=new IntersectionObserver(entries=>{for(const entry of entries)if(entry.isIntersecting){photoObserver.unobserve(entry.target);loadThumbnail(entry.target);}}, {rootMargin:'120px'});
function observePhotos(){document.querySelectorAll('img[data-lazy-photo]').forEach(img=>{if(!img.getAttribute('src'))photoObserver.observe(img);});}
async function loadThumbnail(img){const id=img.dataset.lazyPhoto,scope=groupId,user=session?.user.id,key=user+':'+scope+':'+id;if(!scope||!user)return;try{let result=imageCache.get(key);if(!result||result.expiresAt<Date.now()+30000){let request=imageRequests.get(key);if(!request){request=queueThumbnail(scope,user,id);imageRequests.set(key,request);}try{result=await request;imageCache.set(key,result);}finally{imageRequests.delete(key);}}if(groupId!==scope||session?.user.id!==user||!img.isConnected)return;const url=safePhotoUrl(result.url);if(url){img.onload=()=>img.classList.toggle('landscape',img.naturalWidth>=img.naturalHeight);img.src=url;img.hidden=false;} }catch(_){img.alt='사진을 불러오지 못했습니다';}}
function queueThumbnail(scope,user,id){
 const key=user+':'+scope;let queue=thumbnailQueues.get(key);
 if(!queue){queue=[];thumbnailQueues.set(key,queue);setTimeout(async()=>{thumbnailQueues.delete(key);for(let offset=0;offset<queue.length;offset+=48){const batch=queue.slice(offset,offset+48);try{if(groupId!==scope||session?.user.id!==user)throw new Error('Changed session');const results=await api(`/groups/${scope}/photo-urls`,{method:'POST',body:JSON.stringify({ids:batch.map(x=>x.id)})});for(const item of batch){const result=results.find(r=>r.id===item.id);result?.url?item.resolve(result):item.reject(new Error('Unavailable photo'));}}catch(e){batch.forEach(x=>x.reject(e));}}},25);}
 return new Promise((resolve,reject)=>queue.push({id,resolve,reject}));
}
function mergeMedia(items){const map=new Map(workspace.media.map(p=>[p.id,p]));items.forEach(p=>map.set(p.id,{...map.get(p.id),...p}));workspace.media=[...map.values()];}
let galleryBusy=false,galleryFailed=false;
function updateGalleryPagination(){
 $('#galleryLoadStatus').textContent=galleryBusy?'사진을 불러오는 중…':galleryFailed?'사진을 불러오지 못했습니다.':'';
 $('#moreGallery').hidden=!galleryFailed;
 $('#galleryGrid').setAttribute('aria-busy',String(galleryBusy));
 galleryObserver.unobserve($('#gallerySentinel'));
 if(!galleryBusy&&!galleryFailed&&galleryLoaded&&galleryNext)galleryObserver.observe($('#gallerySentinel'));
}
async function loadGallery(more=false){
 if(!groupId||(more&&(galleryBusy||!galleryLoaded||!galleryNext)))return;
 const target=groupId,version=++galleryRequest;
 const query=new URLSearchParams({kind:$('#galleryKind').value,place:$('#galleryPlace').value});
 if(more)query.set('after',galleryNext);
 galleryBusy=true;galleryFailed=false;
 if(!more){galleryIds=[];galleryNext=null;galleryLoaded=false;renderGallery();}
 updateGalleryPagination();
 try{
  const result=await api(`/groups/${target}/media?${query}`);
  if(groupId!==target||version!==galleryRequest)return;
  mergeMedia(result.items);galleryIds=more?[...new Set([...galleryIds,...result.items.map(p=>p.id)])]:result.items.map(p=>p.id);
  galleryNext=result.next;galleryLoaded=true;renderGallery(more);observePhotos();
 }catch(error){if(groupId===target&&version===galleryRequest)galleryFailed=true;throw error;}
 finally{if(groupId===target&&version===galleryRequest){galleryBusy=false;updateGalleryPagination();}}
}
const galleryObserver=new IntersectionObserver(entries=>{
 if(currentView==='gallery'&&entries.some(e=>e.isIntersecting)&&!galleryFailed)loadGallery(true).catch(e=>status(e.message));
},{rootMargin:'0px 0px 400px 0px'});
$('#moreGallery').onclick=()=>busy($('#moreGallery'),()=>loadGallery(galleryLoaded&&!!galleryNext));
$('#moreVisits').onclick=()=>busy($('#moreVisits'),async()=>{journalLimit+=24;await ensureJournalPage();render();});
$('#moreArchive').onclick=()=>{archiveLimit+=24;renderArchive();};
async function refreshPlaces(){const target=groupId;const w=await api(`/groups/${target}/content`);if(target!==groupId)return;workspace.places=w.places;mergeMedia(w.media);renderWorkspace();render();renderArchive();observePhotos();}
async function refreshJournal(legacy=false){const target=groupId,author=filter,request=++journalRequest;const [v,a]=await Promise.all([api(`/groups/${target}/visits?author=${author}`),legacy?api(`/groups/${target}/archive`):Promise.resolve(archive)]);if(target!==groupId||request!==journalRequest)return;visits=v.items;visitNext=v.next;archive=a;placeVisits={};await ensureJournalPage(request);if(request!==journalRequest)return;await refreshPlaces();}
async function refreshPhotos(){imageCache.clear();const target=groupId;await refreshJournal();if(target!==groupId)return;await loadGallery();if(selectedPlace)await loadPlaceDetails(selectedPlace);}
async function loadCalendar(){const target=groupId,version=++calendarRequest;if(!target)return;const first=dateObject(calendarMonth+'-01'),start=new Date(first);start.setDate(1-first.getDay());const end=new Date(start);end.setDate(end.getDate()+41);const future=dateObject(today());future.setDate(future.getDate()+90);const ranges=[[dateString(start),dateString(end)],[today(),dateString(future)]];const results=await Promise.all(ranges.map(([from,to])=>api(`/groups/${target}/events?from=${from}&to=${to}`)));if(target!==groupId||version!==calendarRequest)return;workspace.events=[...new Map(results.flat().map(e=>[e.id,e])).values()].sort((a,b)=>a.event_date.localeCompare(b.event_date)||a.id.localeCompare(b.id));renderCalendar();}
async function loadPlaceDetails(id,more=false){const target=groupId;const cursor=more?placeVisits[id]?.next:null;const [v,m]=await Promise.all([api(`/groups/${target}/visits?place=${id}${cursor?'&after='+encodeURIComponent(cursor):''}`),api(`/groups/${target}/media?place=${id}`)]);if(target!==groupId||selectedPlace!==id)return;const list=more?[...placeVisits[id],...v.items]:v.items;list.next=v.next;placeVisits[id]=list;mergeMedia(m.items);renderPlaceDetail(id);const button=document.createElement('button');if(v.next){button.textContent='평가 더보기';button.onclick=()=>busy(button,()=>loadPlaceDetails(id,true));$('#placeDetailReviews').append(button);}if(m.next){const button=document.createElement('button');button.textContent='사진 모두 보기';button.onclick=()=>{$('#placeDialog').close();$('#galleryPlace').value=id;$('#galleryKind').value='all';setView('gallery');loadGallery().catch(e=>status(e.message));};$('#placeDetailPhotos').append(button);}observePhotos();}
// Renew only visible thumbnails near expiry, never all photos in the group.
setInterval(()=>{if(document.hidden||!session)return;for(const img of document.querySelectorAll('img[data-lazy-photo]')){const r=img.getBoundingClientRect();if(r.width&&r.height&&r.bottom>=0&&r.top<=innerHeight){const key=session.user.id+':'+groupId+':'+img.dataset.lazyPhoto;if((imageCache.get(key)?.expiresAt||0)<Date.now()+30000)loadThumbnail(img);}}},60000);
document.addEventListener('visibilitychange',()=>{if(!document.hidden)observePhotos();});
