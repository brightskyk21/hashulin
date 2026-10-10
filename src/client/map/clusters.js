function clusterPlaces(points, radius) {
  const clusters = [];
  for (const p of [...points].sort((a, b) => a.place.id.localeCompare(b.place.id))) {
    const found = clusters.find((c) => Math.hypot(c.x - p.x, c.y - p.y) < radius);
    if (found) {
      const n = found.items.length;
      found.x = (found.x * n + p.x) / (n + 1);
      found.y = (found.y * n + p.y) / (n + 1);
      found.items.push(p.place);
    } else clusters.push({ x: p.x, y: p.y, items: [p.place] });
  }
  return clusters;
}
