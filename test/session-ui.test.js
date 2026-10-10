const {test}=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');
const source=fs.readFileSync(require('node:path').join(__dirname,'../public/v2/accounts.js'),'utf8');
function harness(){
 const elements={'#login':{hidden:false},'#app':{hidden:true}};
 const timers=[];let loads=0,clears=0;
 const context=vm.createContext({session:null,$:id=>elements[id],setTimeout:fn=>timers.push(fn),loadAccount:async()=>{loads++;},clearAccount:()=>{context.session=null;clears++;},status:()=>{},window:{addEventListener(){}},document:{addEventListener(){}},client:{auth:{getSession:async()=>({data:{session:null}})}}});
 vm.runInContext(source.slice(source.indexOf('function handleAuthChange(')),context);
 return {context,elements,timers,get loads(){return loads;},get clears(){return clears;}};
}
test('restored sign-in loads account outside auth callback; token refresh keeps current view',async()=>{
 const h=harness(),s={user:{id:'member'},access_token:'first'};
 h.context.handleAuthChange('SIGNED_IN',s);
 assert.equal(h.loads,0);assert.equal(h.elements['#login'].hidden,true);assert.equal(h.elements['#app'].hidden,false);
 await h.timers.shift()();assert.equal(h.loads,1);
 h.context.handleAuthChange('TOKEN_REFRESHED',{...s,access_token:'renewed'});
 assert.equal(h.context.session.access_token,'renewed');assert.equal(h.timers.length,0);
 h.context.handleAuthChange('SIGNED_OUT',null);assert.equal(h.clears,1);
});
test('resume preserves account on transient errors but clears a missing session',async()=>{
 const h=harness();h.context.session={user:{id:'member'}};
 h.context.client.auth.getSession=async()=>({data:{session:null},error:new Error('offline')});
 await h.context.restoreSession();assert.equal(h.clears,0);
 h.context.client.auth.getSession=async()=>({data:{session:null}});
 await h.context.restoreSession();assert.equal(h.clears,1);
});
