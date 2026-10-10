function uuid(value) {
  return (
    typeof value === 'string' &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)
  );
}
function isPublicKey(key) {
  if (!key) return false;
  if (key.startsWith('sb_publishable_')) return true;
  try {
    return JSON.parse(Buffer.from(key.split('.')[1], 'base64url').toString()).role === 'anon';
  } catch (_) {
    return false;
  }
}
function validReview(body) {
  return (
    typeof body.score === 'number' &&
    Number.isFinite(body.score) &&
    body.score >= 1 &&
    body.score <= 10 &&
    Math.abs(body.score * 10 - Math.round(body.score * 10)) < 1e-8 &&
    typeof body.comment === 'string' &&
    body.comment.trim().length > 0 &&
    body.comment.trim().length <= 1000
  );
}
module.exports = { uuid, isPublicKey, validReview };
