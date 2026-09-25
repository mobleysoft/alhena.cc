export function prepareStaticGeometry(node) {
  const geometry = node.geometry.clone().applyMatrix4(node.matrixWorld);
  const keep = new Set(['position', 'normal', 'uv']);
  if (node.material.vertexColors) keep.add('color');
  for (const name of Object.keys(geometry.attributes)) if (!keep.has(name)) geometry.deleteAttribute(name);
  if (!geometry.index) return geometry;
  const expanded = geometry.toNonIndexed();geometry.dispose();return expanded;
}
