function renderGroupSettings(){
 const group=groups.find(g=>g.id===groupId);
 $('#renameGroupForm').hidden=!group||group.owner_id!==session?.user.id;
 $('#renameGroupName').value=group?.name||'';
}
function accountDialog(id){
 for(const other of ['#profileDialog','#choiceDialog','#groupDialog'])if(other!==id&&$(other).open)$(other).close();
 if(!$(id).open)showDialog(id);
}
function openProfile(){
 $('#profileTitle').textContent=profile?'내 프로필':'이름을 설정해주세요';
 $('#profileGuide').textContent=profile?'':'함께 쓰는 사람들에게 표시할 이름이에요.';
 $('#profileForm .primary').textContent=profile?'이름 저장':'다음';
 $('#profileDialog [data-close]').hidden=!profile;
 accountDialog('#profileDialog');
}
function chooseAccountMode(mode){
 $('#accountChoices').hidden=!!inviteToken;
 $('#groupForm').hidden=mode!=='create'||!!inviteToken;
 $('#inviteCodeForm').hidden=mode!=='join'||!!inviteToken;
 $('#choiceDialog [data-close]').hidden=!groups.length;
 accountDialog('#choiceDialog');
}
let invitePreviewVersion=0;
async function previewPendingInvite(){
 const version=++invitePreviewVersion,token=inviteToken,actor=session?.user.id;
 $('#join').hidden=true;$('#join').disabled=true;$('#discardInvite').hidden=false;
 $('#invitePreview').textContent='초대한 모임을 확인하고 있어요…';
 chooseAccountMode('');
 try{
  const valid=parseInvite(token);if(!valid)throw new Error('초대 코드나 링크를 확인해주세요.');
  const rows=await api('/invites/preview',{method:'POST',body:JSON.stringify({token:valid})});
  if(version!==invitePreviewVersion||inviteToken!==token||session?.user.id!==actor)return;
  const invitation=rows[0];
  $('#invitePreview').textContent=invitation?(invitation.already_member?invitation.group_name+'에 이미 참여하고 있어요.':invitation.group_name+' 모임에 초대받았어요.'):'만료되었거나 취소된 초대예요. 새 초대를 요청해주세요.';
  $('#join').textContent=invitation?.already_member?'이 모임 열기':'이 모임에 참여';
  $('#join').hidden=!invitation;$('#join').disabled=!invitation;
 }catch(error){if(version===invitePreviewVersion&&inviteToken===token)$('#invitePreview').textContent=error.message;}
}
async function guideAccount(){
 const step=accountStep(profile,groups,inviteToken);
 if(step==='profile')openProfile();
 else if(step==='invite')await previewPendingInvite();
 else if(step==='group')chooseAccountMode('');
}
$('#myName').onclick=openProfile;
$('#editProfile').onclick=openProfile;
$('#addGroup').onclick=()=>{chooseAccountMode('');if(inviteToken)previewPendingInvite();};
$('#chooseCreate').onclick=()=>chooseAccountMode('create');
$('#chooseJoin').onclick=()=>chooseAccountMode('join');
$('#profileDialog').addEventListener('cancel',e=>{if(!profile)e.preventDefault();});
$('#choiceDialog').addEventListener('cancel',e=>{if(!groups.length)e.preventDefault();});
$('#inviteCodeForm').onsubmit=e=>{e.preventDefault();busy(e.submitter,async()=>{
 const token=parseInvite($('#inviteCodeInput').value);if(!token)throw new Error('받은 초대 코드나 링크를 그대로 붙여넣어주세요.');
 inviteToken=token;sessionStorage.setItem('hashulin.pendingInvite',token);await previewPendingInvite();
});};
$('#renameGroupForm').onsubmit=e=>{e.preventDefault();const target=groupId;busy(e.submitter,async()=>{
 await api(`/groups/${target}`,{method:'PATCH',body:JSON.stringify({name:$('#renameGroupName').value.trim()})});
 await loadAccount();status('모임 이름을 저장했습니다.');
});};
