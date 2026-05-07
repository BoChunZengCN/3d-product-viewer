export function formatFileSize(bytes) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

export function formatDate(dateStr) {
  return new Date(dateStr).toLocaleDateString('zh-CN');
}

export function getFileExt(filename) {
  return filename.split('.').pop().toLowerCase();
}

export function getFormatFromExt(ext) {
  const map = { stl: 'STL', obj: 'OBJ', step: 'STEP', stp: 'STEP', iges: 'IGES', igs: 'IGES', gltf: 'GLTF', glb: 'GLB', fbx: 'FBX', dxf: 'DXF', xyz: 'XYZ', ifc: 'IFC' };
  return map[ext] || ext.toUpperCase();
}

export function debounce(fn, ms = 300) {
  let timer;
  return (...args) => { clearTimeout(timer); timer = setTimeout(() => fn(...args), ms); };
}
