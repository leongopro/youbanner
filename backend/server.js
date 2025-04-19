require('dotenv').config();
console.log('环境变量加载状态:', {
  NODE_ENV: process.env.NODE_ENV,
  PORT: process.env.PORT,
  CORS_ORIGIN: process.env.CORS_ORIGIN,
  UPLOAD_DIR: process.env.UPLOAD_DIR,
  SD_API_KEY_LENGTH: process.env.STABLE_DIFFUSION_API_KEY ? process.env.STABLE_DIFFUSION_API_KEY.length : 0,
  SD_API_URL: process.env.STABLE_DIFFUSION_API_URL
});

const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const helmet = require('helmet');
const compression = require('compression');
const path = require('path');
const fs = require('fs');

// 确保日志目录存在
const LOG_DIR = path.join(__dirname, 'logs');

// 创建日志目录
if (!fs.existsSync(LOG_DIR)) {
  console.log(`创建日志目录: ${LOG_DIR}`);
  fs.mkdirSync(LOG_DIR, { recursive: true });
}

// 创建日志流
const accessLogStream = fs.createWriteStream(path.join(LOG_DIR, 'access.log'), { flags: 'a' });
const errorLogStream = fs.createWriteStream(path.join(LOG_DIR, 'error.log'), { flags: 'a' });

// 添加日志格式化函数
const logError = (err, req) => {
  const logEntry = {
    timestamp: new Date().toISOString(),
    error: err.message,
    stack: err.stack,
    method: req.method,
    url: req.url,
    ip: req.ip,
    headers: req.headers
  };
  errorLogStream.write(JSON.stringify(logEntry) + '\n');
  console.error('错误:', err.message);
};

// 导入路由
const bannerRoutes = require('./routes/banner.routes');
const uploadRoutes = require('./routes/upload.routes');
const stableDiffusionRoutes = require('./routes/stablediffusion.routes');
const logsRoutes = require('./routes/logs.routes');
const monitorRoutes = require('./routes/monitor.routes');
const stabilityRoutes = require('./routes/stability.routes');

// 导入日志服务
const { logger, logApiRequest } = require('./services/logger.service');
const { healthCheckMiddleware, recordApiRequest } = require('./services/monitoring.service');

// 检查路由加载
console.log('路由检查:');
console.log('- bannerRoutes 已加载:', !!bannerRoutes);
console.log('- uploadRoutes 已加载:', !!uploadRoutes);
console.log('- stableDiffusionRoutes 已加载:', !!stableDiffusionRoutes);
console.log('- logsRoutes 已加载:', !!logsRoutes);
console.log('- monitorRoutes 已加载:', !!monitorRoutes);
console.log('- stabilityRoutes 已加载:', !!stabilityRoutes);

// 初始化Express应用
const app = express();
const PORT = process.env.PORT || 5000;

// 增加请求超时设置
app.use((req, res, next) => {
  // 设置10分钟的请求超时
  req.setTimeout(600000); // 10分钟
  res.setTimeout(600000); // 10分钟
  next();
});

// CORS配置
const corsOptions = {
  origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
  maxAge: 86400 // 24小时
};

// 中间件
app.use(cors(corsOptions));
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' }, // 允许跨域资源访问
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
      scriptSrcAttr: ["'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "blob:"],
      connectSrc: ["'self'"]
    }
  }
}));
app.use(compression());

// 使用健康检查中间件
app.use(healthCheckMiddleware());

// 使用自定义日志格式
app.use(morgan('dev'));
app.use(morgan('combined', { stream: accessLogStream }));

// API请求响应时间记录中间件
app.use((req, res, next) => {
  const startTime = Date.now();
  
  // 拦截res.end以记录响应时间
  const originalEnd = res.end;
  res.end = function(chunk, encoding) {
    const responseTime = Date.now() - startTime;
    res.responseTime = responseTime;
    
    // 记录API请求
    if (req.originalUrl && !req.originalUrl.includes('/health') && !req.originalUrl.includes('/uploads/')) {
      logApiRequest(req, res, chunk ? chunk.toString() : null);
      
      // 记录监控指标
      const isSuccess = res.statusCode >= 200 && res.statusCode < 400;
      recordApiRequest(isSuccess, responseTime);
    }
    
    // 调用原始的end方法
    originalEnd.call(this, chunk, encoding);
  };
  
  next();
});

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// 添加调试路由
app.use('/debug-request', (req, res) => {
  console.log('收到debug-request请求：');
  console.log('- URL:', req.url);
  console.log('- 方法:', req.method);
  console.log('- Content-Type:', req.headers['content-type']);
  res.send('Debug info logged');
});

// 创建上传目录
const uploadsDir = path.join(__dirname, 'uploads');
const publicDir = path.join(__dirname, 'public');
const generatedDir = path.join(__dirname, 'public', 'generated');

// 创建所有必要目录
const dirsToCreate = [uploadsDir, publicDir, generatedDir];

// 同步创建所有目录
dirsToCreate.forEach(dir => {
  try {
    if (!fs.existsSync(dir)) {
      console.log(`目录不存在，创建: ${dir}`);
      fs.mkdirSync(dir, { recursive: true });
      console.log(`目录创建成功: ${dir}`);
      
      // 设置目录权限
      fs.chmodSync(dir, 0o755);
      console.log(`目录权限设置为0755: ${dir}`);
    } else {
      console.log(`目录已存在: ${dir}`);
      // 检查目录是否可写
      try {
        fs.accessSync(dir, fs.constants.W_OK);
        console.log(`目录权限正常，可写入: ${dir}`);
      } catch (accessError) {
        console.error(`目录权限问题，不可写入: ${dir}`, accessError.message);
        console.error('尝试修复权限...');
        try {
          fs.chmodSync(dir, 0o755);
          console.log(`目录权限已修复: ${dir}`);
        } catch (chmodError) {
          console.error(`无法修复目录权限: ${dir}`, chmodError.message);
          console.error('请手动检查目录权限');
        }
      }
    }
  } catch (error) {
    console.error(`处理目录时出错 ${dir}:`, error);
    process.exit(1); // 如果不能创建关键目录，退出程序
  }
});

// 静态文件目录
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use('/uploads', express.static(path.join(process.cwd(), 'uploads')));
app.use('/generated', express.static(path.join(__dirname, 'public', 'generated'), {
  maxAge: '1h',
  setHeaders: (res, path) => {
    console.log(`提供静态文件: ${path}`);
    res.set('X-Content-Type-Options', 'nosniff');
    res.set('Cache-Control', 'public, max-age=3600');
  }
}));
app.use(express.static(path.join(__dirname, 'public'))); // 添加公共目录作为静态文件根目录

// API路由
app.use('/api/banner', bannerRoutes);
app.use('/api/upload', uploadRoutes);
app.use('/api/stable-diffusion', stableDiffusionRoutes);
app.use('/api/logs', logsRoutes);
app.use('/api/monitor', monitorRoutes);
app.use('/api/stability', stabilityRoutes);

// 添加文件存在检查端点
app.get('/api/check-file-exists', (req, res) => {
  const { filePath } = req.query;
  
  if (!filePath) {
    return res.status(400).json({ exists: false, error: '未提供文件路径' });
  }
  
  try {
    const normalizedPath = filePath.startsWith('/') ? filePath.substring(1) : filePath;
    const absolutePath = path.join(__dirname, normalizedPath);
    
    console.log(`[检查文件] 检查文件是否存在: ${absolutePath}`);
    const exists = fs.existsSync(absolutePath);
    
    if (exists) {
      const stats = fs.statSync(absolutePath);
      return res.json({ 
        exists,
        isDirectory: stats.isDirectory(),
        size: stats.size,
        created: stats.birthtime,
        modified: stats.mtime
      });
    }
    
    return res.json({ exists: false });
  } catch (error) {
    console.error(`检查文件存在性出错:`, error);
    return res.status(500).json({ 
      exists: false, 
      error: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

// 健康检查端点
app.get('/health', (req, res) => {
  // 由健康检查中间件处理，这里只是备用
  res.status(200).json({ status: 'ok', message: 'Server is running' });
});

// 根路径处理程序
app.get('/', (req, res) => {
  res.status(200).json({ 
    status: 'ok', 
    message: 'AutoYouBanner API服务正在运行',
    endpoints: {
      health: '/health',
      banner: '/api/banner',
      upload: '/api/upload',
      stableDiffusion: '/api/stable-diffusion'
    }
  });
});

// 错误处理中间件
app.use((err, req, res, next) => {
  // 记录错误到文件
  logError(err, req);
  
  res.status(err.status || 500).json({
    error: {
      message: err.message || 'Internal Server Error',
      ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
    }
  });
});

// 添加未捕获异常处理
process.on('uncaughtException', (err) => {
  const logEntry = {
    timestamp: new Date().toISOString(),
    type: 'uncaughtException',
    error: err.message,
    stack: err.stack
  };
  errorLogStream.write(JSON.stringify(logEntry) + '\n');
  console.error('未捕获的异常:', err);
});

process.on('unhandledRejection', (reason, promise) => {
  const logEntry = {
    timestamp: new Date().toISOString(),
    type: 'unhandledRejection',
    reason: reason ? (reason.message || reason.toString()) : 'unknown',
    stack: reason && reason.stack
  };
  errorLogStream.write(JSON.stringify(logEntry) + '\n');
  console.error('未处理的Promise拒绝:', reason);
});

// 启动服务器
app.listen(PORT, () => {
  logger.info(`服务器已启动`, {
    port: PORT,
    env: process.env.NODE_ENV,
    cors: corsOptions.origin
  });
  console.log(`Server running on port ${PORT}`);
  console.log(`Health check available at http://localhost:${PORT}/health`);
  console.log(`API available at http://localhost:${PORT}/api`);
  console.log(`CORS configured for: ${corsOptions.origin}`);
}); 