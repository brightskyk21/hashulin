async function normalizePhoto(buffer) {
  const sharp = require('sharp');
  const meta = await sharp(buffer, { limitInputPixels: 40000000 }).metadata();
  if (!['jpeg', 'png', 'webp'].includes(meta.format) || meta.pages > 1)
    throw new Error('Unsupported image');
  return sharp(buffer, { limitInputPixels: 40000000 })
    .rotate()
    .resize({ width: 2400, height: 2400, fit: 'inside', withoutEnlargement: true })
    .webp({ quality: 88 })
    .toBuffer();
}
async function normalizeThumbnail(buffer) {
  return require('sharp')(buffer, { limitInputPixels: 40000000 })
    .rotate()
    .resize({ width: 640, height: 640, fit: 'inside', withoutEnlargement: true })
    .webp({ quality: 78 })
    .toBuffer();
}
module.exports = { normalizePhoto, normalizeThumbnail };
