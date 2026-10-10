const params = new URLSearchParams(location.search);

const fragment = new URLSearchParams(location.hash.slice(1));

function readInviteFragment() {
  if (fragment.has('invite')) params.set('invite', fragment.get('invite'));
}

function removeInviteFromAddress() {
  if (params.has('invite')) {
    const clean = new URL(location.href);
    clean.searchParams.delete('invite');
    clean.hash = '';
    history.replaceState({}, '', clean.pathname + clean.search);
  }
}

function rememberPendingInvite() {
  if (params.has('invite')) sessionStorage.setItem('hashulin.pendingInvite', params.get('invite'));
}

readInviteFragment();

removeInviteFromAddress();

rememberPendingInvite();

let inviteToken = sessionStorage.getItem('hashulin.pendingInvite');
