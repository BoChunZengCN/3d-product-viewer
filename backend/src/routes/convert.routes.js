import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import { handleUploadError, uploadModel } from '../middleware/upload.js';
import { startConversion, getJobStatus } from '../services/convert.service.js';
import { cleanTemp } from '../services/storage.service.js';

const router = Router();

// 上传并转换（独立转换，不保存到模型库）
router.post('/', authenticate, handleUploadError(uploadModel), async (req, res, next) => {
  const tempPath = req.file?.path;
  try {
    if (!req.file) return res.status(400).json({ error: '未上传文件' });

    const jobId = await startConversion(tempPath, null, req.body.outputFormat || 'glb');
    res.status(202).json({ jobId, status: 'processing' });
  } catch (err) {
    cleanTemp(tempPath);
    next(err);
  }
});

// 查询转换状态
router.get('/:jobId/status', authenticate, async (req, res, next) => {
  try {
    const job = await getJobStatus(req.params.jobId);
    if (!job) return res.status(404).json({ error: '任务不存在' });
    res.json({
      jobId: job.id,
      status: job.status,
      progress: job.progress,
      error: job.error,
      outputPath: job.status === 'completed' ? job.outputPath : null,
    });
  } catch (err) { next(err); }
});

export default router;
