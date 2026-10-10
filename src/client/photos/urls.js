function safePhotoUrl(value) {
  try {
    const u = new URL(value);
    return u.protocol === 'https:' &&
      u.origin === storageOrigin &&
      u.pathname.startsWith('/storage/v1/object/sign/group-photos/')
      ? u.href
      : '';
  } catch (_) {
    return '';
  }
}
