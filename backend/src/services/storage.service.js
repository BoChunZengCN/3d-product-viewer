import fs from 'fs';
import path from 'path';
import { env } from '../config/env.js';

const UPLOAD_DIR = path.resolve(env.UPLOAD_DIR);

// ===== Local Storage =====

async function localSave(sourcePath, destKey) {
  const destPath = path.join(UPLOAD_DIR, destKey);
  fs.mkdirSync(path.dirname(destPath), { recursive: true });
  fs.copyFileSync(sourcePath, destPath);
  return destKey;
}

async function localGetStream(key) {
  const filePath = path.join(UPLOAD_DIR, key);
  if (!fs.existsSync(filePath)) return null;
  return fs.createReadStream(filePath);
}

async function localDelete(key) {
  const filePath = path.join(UPLOAD_DIR, key);
  if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
}

async function localExists(key) {
  return fs.existsSync(path.join(UPLOAD_DIR, key));
}

function localGetPath(key) {
  return path.join(UPLOAD_DIR, key);
}

// ===== S3 Storage (预留接口，需安装 @aws-sdk/client-s3) =====

async function s3Save(sourcePath, destKey) {
  // TODO: 实现 S3 上传
  throw new Error('S3 storage not implemented yet');
}

async function s3GetStream(key) {
  throw new Error('S3 storage not implemented yet');
}

async function s3Delete(key) {
  throw new Error('S3 storage not implemented yet');
}

// ===== 统一接口 =====

const isS3 = env.STORAGE_STRATEGY === 's3';

export const storage = {
  save: isS3 ? s3Save : localSave,
  getStream: isS3 ? s3GetStream : localGetStream,
  delete: isS3 ? s3Delete : localDelete,
  exists: localExists,
  getPath: localGetPath,
};

// 清理临时文件
export function cleanTemp(filePath) {
  try {
    if (filePath && fs.existsSync(filePath)) fs.unlinkSync(filePath);
  } catch { /* ignore */ }
}
