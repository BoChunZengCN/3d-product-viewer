# 轻量化三维预览 | 数据可视化平台 V2.0

一个基于 Web 的专业 3D 模型预览工具，面向工程师、产品设计人员、营销人员和创作者。支持多种 CAD 格式导入、材质编辑、截面分析、测量工具等高级功能。

## 在线体验

直接在浏览器中打开 `POC.html` 即可使用，或启动本地服务器：

```bash
# 使用 Node.js 启动本地服务器
node -e "const http=require('http'),fs=require('fs'),path=require('path');http.createServer((req,res)=>{const f=path.join(process.cwd(),req.url=='/'?'POC.html':req.url);try{const d=fs.readFileSync(f);const e=path.extname(f);const c={'.html':'text/html','.js':'text/javascript','.css':'text/css'}[e]||'application/octet-stream';res.writeHead(200,{'Content-Type':c});res.end(d);}catch(e){res.writeHead(404);res.end();}}).listen(8080);"

# 然后访问 http://localhost:8080/POC.html
```

## 功能特性

### 文件导入
- 支持 **STL**、**OBJ**、**STEP**、**IGES**、**GLTF/GLB**、**FBX** 格式
- 拖拽上传或点击选择文件
- 自动缩放至合适尺寸并居中显示
- 大模型分块加载，避免页面无响应

### 3D 渲染
- 基于 Three.js 0.160.0 的 WebGL 渲染
- 支持旋转、平移、缩放操作
- 双面渲染，模型背面不消失
- 网格线与坐标轴显示（可开关）
- 轮廓线显示（外轮廓，性能优化）

### 视图控制
- 7 种标准视图：前、后、左、右、顶、底、等轴测
- 自定义视图保存与快速切换
- 平滑的相机动画过渡
- 自动居中与最佳视角

### 材质系统
- 12 种预设材质（金属银、黄金、碳纤维、陶瓷白等）
- 自定义材质上传（颜色、金属度、粗糙度、贴图）
- 实时材质切换
- 材质库保存与管理

### 背景设置
- 纯色背景
- 渐变背景（默认）
- 自定义图片背景

### 测量工具
- 最短距离测量
- XYZ 轴距离测量
- 屏幕空间标签显示
- 测量点标记与清除

### 截面分析
- X/Y/Z 轴截面
- 截面位置调整
- 截面厚度控制
- 截面方向反转
- 显示/隐藏截面

### 模型库
- 本地 IndexedDB 持久化存储
- 目录分类管理（支持折叠/展开）
- 模型跨目录移动
- 新建/重命名/删除目录
- 模型搜索与过滤

### 显示设置
- 网格线显示/隐藏
- 坐标轴显示/隐藏
- 轮廓线显示/隐藏（仅外轮廓，性能优化）

### 帮助系统
- 操作指南气泡弹窗
- 快捷键提示
- 鼠标操作说明

## 操作指南

| 操作 | 功能 |
|------|------|
| 左键拖拽 | 旋转视图 |
| 右键拖拽 | 平移视图 |
| 滚轮 | 缩放视图 |
| 点击 | 测量模式下选取点 |
| Esc | 退出测量模式 |

## 技术栈

- **Three.js 0.160.0** - WebGL 3D 渲染引擎
- **OpenCASCADE WebAssembly** (occt-import-js) - STEP/IGES 格式解析
- **IndexedDB** - 本地模型持久化存储
- **GLTFLoader / FBXLoader** - GLTF/GLB/FBX 格式支持
- **纯前端实现** - 无需后端服务器

## 浏览器兼容性

- Chrome / Edge / Firefox / Safari 最新版
- 需要 WebGL 2.0 支持
- 推荐 Chrome 或 Edge 以获得最佳性能

## 项目结构

```
.
├── POC.html          # 主应用文件（完整功能）
├── index.html        # 入口页面
└── README.md         # 项目文档
```

## 最新更新

### v2.0 更新内容
- ✅ 新增 GLTF/GLB/FBX 格式支持
- ✅ 新增模型库目录折叠/展开功能
- ✅ 优化网格线与坐标轴显示（亮色可见）
- ✅ 边界线改为轮廓线（仅外轮廓，性能提升）
- ✅ 修复切换模型时轮廓线残留问题
- ✅ 大模型分块加载，避免页面无响应
- ✅ 模型库面板宽度优化，按钮不再遮挡
- ✅ 新增帮助图标与操作指南气泡

## GitHub 仓库

https://github.com/BoChunZengCN/3d-product-viewer

## 许可证

MIT License
