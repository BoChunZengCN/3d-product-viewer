import multer from 'multer';
import path from 'path';
import { env } from '../config/env.js';
import fs from 'fs';

// 确保上传目录存在
const uploadDir = path.resolve(env.UPLOAD_DIR);
fs.mkdirSync(uploadDir, { recursive: true });
fs.mkdirSync(path.join(uploadDir, 'models'), { recursive: true });
fs.mkdirSync(path.join(uploadDir, 'thumbnails'), { recursive: true });
fs.mkdirSync(path.join(uploadDir, 'converted'), { recursive: true });
fs.mkdirSync(path.join(uploadDir, 'temp'), { recursive: true });

const ALLOWED_EXTS = new Set([
  '.stl', '.obj', '.mtl', '.step', '.stp',
  '.iges', '.igs', '.gltf', '.glb', '.fbx',
  '.dxf', '.xyz', '.ifc',
]);

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(uploadDir, 'temp'));
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e6);
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, uniqueSuffix + ext);
  },
});

function fileFilter(req, file, cb) {
  const ext = path.extname(file.originalname).toLowerCase();
  if (ALLOWED_EXTS.has(ext)) {
    cb(null, true);
  } else {
    cb(new Error(`不支持的文件格式: ${ext}`), false);
  }
}

export const uploadModel = multer({
  storage,
  fileFilter,
  limits: { fileSize: env.MAX_FILE_SIZE },
}).single('file');

export const uploadImage = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (['.jpg', '.jpeg', '.png', '.webp'].includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error('仅支持 JPG/PNG/WebP 图片'), false);
    }
  },
}).single('image');

// multer 错误处理包装
export function handleUploadError(uploadFn) {
  return (req, res, next) => {
    uploadFn(req, res, (err) => {
      if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
          return res.status(413).json({ error: `文件大小超过限制 (${env.MAX_FILE_SIZE / 1024 / 1024}MB)` });
        }
        return res.status(400).json({ error: err.message });
      }
      if (err) return res.status(400).json({ error: err.message });
      next();
    });
  };
}
