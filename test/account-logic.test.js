const {test}=require('node:test');const assert=require('node:assert/strict');const vm=require('node:vm');const fs=require('node:fs');
const ctx=vm.createContext({URL,URLSearchParams});vm.runInContext(fs.readFileSync(require('node:path').join(__dirname,'../public/v2/account-logic.js'),'utf8'),ctx);
test('author tabs filter reviews within a shared visit, with accepted legacy ownership only',()=>{
 const rows=[{author_id:'min'},{author_id:'ha'}];assert.equal(ctx.journalReviews(rows,'min')[0],rows[0]);assert.equal(ctx.journalReviews(rows,'ha').length,1);assert.equal(ctx.journalReviews(rows).length,2);
 const old=[{reviewer:'민혁'},{reviewer:'하진'}],authors=[{reviewer:'민혁',user_id:'min',accepted_at:'date'},{reviewer:'하진',user_id:'ha',accepted_at:'date'}];
 assert.equal(ctx.journalReviews(old,'min',authors).length,1);assert.equal(ctx.journalReviews(old,'min',authors)[0],old[0]);assert.equal(ctx.journalReviews(old,'ha',authors)[0],old[1]);assert.equal(ctx.journalReviews(old,'',authors).length,2);
 assert.equal(ctx.journalReviews(old,'min',authors,'하진').length,0);assert.equal(ctx.journalReviews(old,'',authors,'하진')[0],old[1]);authors[1].accepted_at=null;assert.equal(ctx.journalReviews(old,'ha',authors).length,0);
});
test('profile comes before invite acceptance, group choice is only needed for first-time members',()=>{
 assert.equal(ctx.accountStep(null,[],'invite'),'profile');assert.equal(ctx.accountStep({},[],'invite'),'invite');assert.equal(ctx.accountStep({},[],null),'group');assert.equal(ctx.accountStep({},[{}],null),'ready');assert.equal(ctx.accountStep({},[{}],'invite'),'invite');
});
test('code and link resolve to the same full-strength invite without guessing malformed input',()=>{
 const token='10000000-1234-4567-89ab-123456789abc';for(const input of [token,token.toUpperCase(),token.replace(/-/g,''),'https://example.test/v2/#invite='+token,'https://example.test/v2/?invite='+token])assert.equal(ctx.parseInvite(input),token);
 for(const input of ['123456','https://example.test/v2/','javascript:alert(1)','',null])assert.equal(ctx.parseInvite(input),null);
});
