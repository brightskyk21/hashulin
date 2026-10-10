function parseInvite(value) {
  let token = String(value || '').trim();
  if (/^https?:\/\//i.test(token)) {
    try {
      const url = new URL(token);
      token =
        new URLSearchParams(url.hash.slice(1)).get('invite') ||
        url.searchParams.get('invite') ||
        '';
    } catch (_) {
      return null;
    }
  }
  const compact = token.replace(/-/g, '');
  if (!/^[0-9a-f]{32}$/i.test(compact)) return null;
  return compact.replace(/^(.{8})(.{4})(.{4})(.{4})(.{12})$/, '$1-$2-$3-$4-$5').toLowerCase();
}
