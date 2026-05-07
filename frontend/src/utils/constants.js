export const MATERIAL_LIBRARY = [
  { name: '默认蓝', color: 0x58a6ff, metalness: 0.3, roughness: 0.4 },
  { name: '金属银', color: 0xc0c0c0, metalness: 0.9, roughness: 0.2 },
  { name: '黄金', color: 0xffd700, metalness: 1.0, roughness: 0.15 },
  { name: '玫瑰金', color: 0xb76e79, metalness: 0.8, roughness: 0.2 },
  { name: '铜', color: 0xb87333, metalness: 0.9, roughness: 0.25 },
  { name: '钛合金', color: 0x8c9ba5, metalness: 0.7, roughness: 0.3 },
  { name: '碳纤维', color: 0x1a1a1a, metalness: 0.1, roughness: 0.8 },
  { name: '陶瓷白', color: 0xf5f5f5, metalness: 0.0, roughness: 0.1 },
  { name: '翡翠绿', color: 0x00a86b, metalness: 0.2, roughness: 0.15 },
  { name: '宝石红', color: 0xe0115f, metalness: 0.3, roughness: 0.2 },
  { name: '深空灰', color: 0x4a4a4a, metalness: 0.6, roughness: 0.35 },
  { name: '珍珠白', color: 0xfaf0e6, metalness: 0.1, roughness: 0.25 },
];

export const VIEW_PRESETS = {
  front:  { label: '前视图', pos: [0, 0, 6] },
  back:   { label: '后视图', pos: [0, 0, -6] },
  left:   { label: '左视图', pos: [-6, 0, 0] },
  right:  { label: '右视图', pos: [6, 0, 0] },
  top:    { label: '顶视图', pos: [0, 6, 0.001] },
  bottom: { label: '底视图', pos: [0, -6, 0.001] },
  iso:    { label: '等轴测', pos: [5, 5, 5] },
};

export const SUPPORTED_FORMATS = ['.stl', '.obj', '.step', '.stp', '.iges', '.igs', '.gltf', '.glb', '.fbx', '.dxf', '.xyz', '.ifc'];

export const NEEDS_SERVER_CONVERT = new Set(['STEP', 'STP', 'IGES', 'IGS']);
