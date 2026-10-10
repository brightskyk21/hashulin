const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
function harness(){
 const elements=new Map();const get=id=>{if(!elements.has(id))elements.set(id,{value:'',textContent:'',innerHTML:'',hidden:false,disabled:false,style:{},dataset:{},setAttribute(){},setCustomValidity(value){this.validation=value;},addEventListener(){},close(){this.open=false;},replaceChildren(){}});return elements.get(id);};
 const form=get('#reviewForm');form.elements={score:{value:'8.8'},comment:{value:'기록 보존'},date:{value:'2026-10-01'},placeName:{value:'식당'},address:{value:'서울'}};form.dataset.placeId='place';form.querySelectorAll=()=>[...Object.values(form.elements),get('#saveReview')];
 let uploads=0,failOnce=true,creates=0,refreshes=0;const uploadKeys=[];
 const ctx=vm.createContext({$:get,archive:null,workspace:{places:[]},ownLegacyReview:()=>null,groupId:'group',editing:null,session:{user:{id:'me'}},band:()=>['⭐','매우 만족','#176540'],FormData,Blob,URL:{revokeObjectURL(){}},crypto:{randomUUID:()=> 'unused'},esc:String,status:()=>{},api:async(path,options)=>{
  if(path.endsWith('/visits')){creates++;return 'visit';}
  if(path.endsWith('/photos')){uploads++;uploadKeys.push(options.body.get('uploadId'));if(uploads===2&&failOnce){failOnce=false;throw new Error('offline');}return {id:'photo'};}
 },refreshJournal:async()=>refreshes++});
 vm.runInContext(fs.readFileSync(require('node:path').join(__dirname,'../public/v2/composer.js'),'utf8'),ctx);
 return {ctx,get,uploadKeys,get creates(){return creates;},get refreshes(){return refreshes;}};
}
test('photo retry retains saved review, skips completed photos and reuses the failed upload key',async()=>{
 const h=harness();vm.runInContext("scoreChosen=true;reviewPhotos=[{file:new Blob(['a']),key:'first',url:'blob:a',done:false},{file:new Blob(['b']),key:'second',url:'blob:b',done:false}];",h.ctx);
 await h.ctx.submitReview(h.get('#saveReview'));assert.equal(h.creates,1);assert.equal(vm.runInContext('savedReview.id',h.ctx),'visit');assert.equal(vm.runInContext('reviewPhotos.filter(p=>p.done).length',h.ctx),1);assert.match(h.get('#reviewProgress').textContent,/저장됐습니다/);
 await h.ctx.submitReview(h.get('#saveReview'));assert.equal(h.creates,1);assert.deepEqual(h.uploadKeys,['first','second','second']);assert.equal(h.refreshes,1);assert.equal(vm.runInContext('savedReview',h.ctx),null);
});
test('a new record cannot silently submit the untouched range value',async()=>{
 const h=harness();await h.ctx.submitReview(h.get('#saveReview'));assert.equal(h.creates,0);assert.equal(vm.runInContext('savedReview',h.ctx),null);
});

test('new composer prevents duplicating an accepted legacy review for the same day',async()=>{
 const h=harness();h.ctx.ownLegacyReview=()=>({id:'old-review'});vm.runInContext('scoreChosen=true',h.ctx);
 await h.ctx.submitReview(h.get('#saveReview'));assert.equal(h.creates,0);assert.equal(vm.runInContext('savedReview',h.ctx),null);
});
