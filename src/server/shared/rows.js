async function rows(query) {
  const out = [];
  for (let n = 0; n < 10000; n += 500) {
    const r = await query.range(n, n + 499);
    if (r.error) throw r.error;
    out.push(...r.data);
    if (r.data.length < 500) return out;
  }
  throw new Error('Too many rows');
}
module.exports = { rows };
