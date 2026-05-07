import { parentPort, workerData } from 'worker_threads';
import fs from 'fs';
import path from 'path';

const { inputPath, outputFormat, jobId } = workerData;

async function run() {
  try {
    parentPort.postMessage({ type: 'progress', value: 5 });

    // 动态加载 occt-import-js
    const occtImportJs = (await import('occt-import-js')).default;
    const occt = await occtImportJs();

    parentPort.postMessage({ type: 'progress', value: 20 });

    const fileBuffer = fs.readFileSync(inputPath);
    const ext = path.extname(inputPath).toLowerCase();

    parentPort.postMessage({ type: 'progress', value: 30 });

    let result;
    if (ext === '.step' || ext === '.stp') {
      result = occt.ReadStepFile(new Uint8Array(fileBuffer), null);
    } else if (ext === '.iges' || ext === '.igs') {
      result = occt.ReadIgesFile(new Uint8Array(fileBuffer), null);
    } else {
      throw new Error(`不支持的转换格式: ${ext}`);
    }

    parentPort.postMessage({ type: 'progress', value: 60 });

    if (!result || !result.success) {
      throw new Error('OCCT 解析失败: ' + (result?.error || '未知错误'));
    }

    if (!result.meshes || result.meshes.length === 0) {
      throw new Error('模型无有效网格数据');
    }

    // 将 OCCT 结果序列化为 JSON（含顶点/索引/法线）
    // 前端可直接用 Three.js BufferGeometry 加载
    const meshData = result.meshes.map((mesh, i) => {
      const out = { index: i };
      if (mesh.attributes?.position?.array) {
        out.positions = Array.from(mesh.attributes.position.array);
      }
      if (mesh.index?.array) {
        out.indices = Array.from(mesh.index.array);
      }
      if (mesh.attributes?.normal?.array) {
        out.normals = Array.from(mesh.attributes.normal.array);
      }
      if (mesh.color) {
        out.color = mesh.color;
      }
      return out;
    });

    parentPort.postMessage({ type: 'progress', value: 85 });

    // 写出转换结果到 converted 目录
    const uploadsDir = path.resolve(process.env.UPLOAD_DIR || './uploads');
    const outputDir = path.join(uploadsDir, 'converted');
    fs.mkdirSync(outputDir, { recursive: true });
    const outputPath = path.join(outputDir, path.basename(inputPath).replace(/\.[^.]+$/, '.json'));

    fs.writeFileSync(outputPath, JSON.stringify({
      format: 'occt-mesh-json',
      version: 1,
      meshCount: meshData.length,
      meshes: meshData,
    }));

    parentPort.postMessage({ type: 'progress', value: 100 });
    parentPort.postMessage({ type: 'done', outputPath });
  } catch (err) {
    parentPort.postMessage({ type: 'error', error: err.message });
    throw err;
  }
}

run();
