async function api(path, options = {}) {
  const { data, error } = await client.auth.getSession();
  if (error || !data.session) throw new Error('다시 로그인해주세요.');
  const res = await fetch('/api/v2' + path, {
    ...options,
    headers: {
      ...(options.body instanceof FormData ? {} : { 'Content-Type': 'application/json' }),
      Authorization: `Bearer ${data.session.access_token}`,
    },
  });
  const result = await res.json().catch(() => ({ error: '요청을 처리하지 못했습니다.' }));
  if (!res.ok) {
    const error = new Error(result.error || '요청을 처리하지 못했습니다.');
    error.status = res.status;
    throw error;
  }
  return result;
}
