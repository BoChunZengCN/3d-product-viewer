import { Worker } from 'worker_threads';
import path from 'path';
import { fileURLToPath } from 'url';
import prisma from '../config/database.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const WORKER_PATH = path.join(__dirname, '../workers/converter.worker.js');

const activeJobs = new Map();

export async function startConversion(inputPath, modelId = null, outputFormat = 'glb') {
  const job = await prisma.convertJob.create({
    data: {
      modelId,
      inputPath,
      status: 'processing',
      progress: 0,
    },
  });

  const worker = new Worker(WORKER_PATH, {
    workerData: { inputPath, outputFormat, jobId: job.id },
  });

  activeJobs.set(job.id, worker);

  worker.on('message', async (msg) => {
    if (msg.type === 'progress') {
      await prisma.convertJob.update({
        where: { id: job.id },
        data: { progress: msg.value },
      });
    }
    if (msg.type === 'done') {
      await prisma.convertJob.update({
        where: { id: job.id },
        data: { status: 'completed', progress: 100, outputPath: msg.outputPath },
      });
      // 更新模型的 convertedPath
      if (modelId) {
        await prisma.model.update({
          where: { id: modelId },
          data: { convertedPath: msg.outputPath },
        });
      }
      activeJobs.delete(job.id);
    }
  });

  worker.on('error', async (err) => {
    await prisma.convertJob.update({
      where: { id: job.id },
      data: { status: 'failed', error: err.message },
    });
    activeJobs.delete(job.id);
  });

  return job.id;
}

export async function getJobStatus(jobId) {
  return prisma.convertJob.findUnique({ where: { id: jobId } });
}
