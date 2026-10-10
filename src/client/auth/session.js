function handleAuthChange(event, nextSession) {
  if (event === 'SIGNED_OUT') {
    clearAccount();
    return;
  }
  if (!nextSession) return;
  const changed = session?.user.id !== nextSession.user.id;
  session = nextSession;
  $('#login').hidden = true;
  $('#app').hidden = false;
  if (changed) setTimeout(() => loadAccount().catch((e) => status(e.message)), 0);
}

async function restoreSession() {
  if (!client) return;
  const { data, error } = await client.auth.getSession();
  if (error) {
    status('로그인 상태를 확인하지 못했습니다. 연결 후 다시 시도해주세요.');
    return;
  }
  if (data.session) handleAuthChange('RESTORED', data.session);
  else if (session) clearAccount();
}

function initAuthSessionControls() {
  $('#logout').onclick = () => logout($('#logout'));
}

function initAuthSessionActions() {
  $('#kakao').onclick = () =>
    busy($('#kakao'), async () => {
      const { error } = await client.auth.signInWithOAuth({
        provider: 'kakao',
        options: {
          redirectTo: location.origin + '/v2/',
          queryParams: { scope: 'profile_nickname' },
        },
      });
      if (error) throw error;
    });
}

function initAuthSessionNavigation() {
  document.addEventListener('DOMContentLoaded', async () => {
    try {
      const config = await fetch('/api/v2/config').then((r) => r.json());
      if (!config.ready) {
        $('#setup').textContent = '로그인 연결을 준비 중입니다.';
        return;
      }
      mapClientId = config.naverMapClientId;
      storageOrigin = new URL(config.supabaseUrl).origin;
      client = supabase.createClient(config.supabaseUrl, config.publicKey, {
        auth: {
          flowType: 'pkce',
          detectSessionInUrl: true,
          persistSession: true,
          autoRefreshToken: true,
        },
      });
      const { data, error } = await client.auth.getSession();
      if (error) throw error;
      session = data.session;
      $('#setup').textContent = '';
      $('#kakao').disabled = false;
      if (params.has('error')) status('카카오 로그인에 실패했습니다. 다시 시도해주세요.');
      if (params.has('code') || params.has('error'))
        history.replaceState({}, '', location.pathname);
      client.auth.onAuthStateChange(handleAuthChange);
      $('#login').hidden = !!session;
      $('#app').hidden = !session;
      if (session) await loadAccount();
    } catch (e) {
      status(e.message);
      $('#setup').textContent = '설정을 확인한 뒤 새로고침해주세요.';
    }
  });
}

function initAuthSessionLifecycle() {
  window.addEventListener('pageshow', () => restoreSession().catch((e) => status(e.message)));

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') restoreSession().catch((e) => status(e.message));
  });
}
