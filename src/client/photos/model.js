function mergeMedia(items) {
  const map = new Map(workspace.media.map((p) => [p.id, p]));
  items.forEach((p) => map.set(p.id, { ...map.get(p.id), ...p }));
  workspace.media = [...map.values()];
}
