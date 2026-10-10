const journalEmojiImages = new Map();

function journalEmojiImage(emoji) {
  if (journalEmojiImages.has(emoji)) return journalEmojiImages.get(emoji);
  const source = document.createElement('canvas');
  source.width = source.height = 128;
  const ctx = source.getContext('2d', { willReadFrequently: true });
  if (!ctx) return '';
  ctx.font = '80px "Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  ctx.fillText(emoji, 64, 96);
  const pixels = ctx.getImageData(0, 0, 128, 128).data;
  let left = 128,
    top = 128,
    right = -1,
    bottom = -1;
  for (let y = 0; y < 128; y++)
    for (let x = 0; x < 128; x++)
      if (pixels[(y * 128 + x) * 4 + 3]) {
        left = Math.min(left, x);
        right = Math.max(right, x);
        top = Math.min(top, y);
        bottom = Math.max(bottom, y);
      }
  if (right < left) return '';
  const icon = document.createElement('canvas');
  icon.width = icon.height = 72;
  const output = icon.getContext('2d');
  if (!output) return '';
  const width = right - left + 1,
    height = bottom - top + 1,
    scale = 72 / Math.max(width, height);
  output.drawImage(
    source,
    left,
    top,
    width,
    height,
    (72 - width * scale) / 2,
    (72 - height * scale) / 2,
    width * scale,
    height * scale,
  );
  const url = icon.toDataURL('image/png');
  journalEmojiImages.set(emoji, url);
  return url;
}
