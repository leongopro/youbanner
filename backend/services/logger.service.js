/**
 * 日志服务
 * 提供服务器端日志记录功能
 */

const fs = require('fs');
const path = require('path');
const { createLogger, format, transports } = require('winston');
const { combine, timestamp, printf, colorize, splat } = format;

// 确保日志目录存在
const LOG_DIR = path.join(__dirname, '..', 'logs');
if (!fs.existsSync(LOG_DIR)) {
  fs.mkdirSync(LOG_DIR, { recursive: true });
}

// 日志文件路径
const LOG_FILES = {
  info: path.join(LOG_DIR, 'info.log'),
  error: path.join(LOG_DIR, 'error.log'),
  api: path.join(LOG_DIR, 'api.log'),
  stability: path.join(LOG_DIR, 'stability-api.log')
};

// 自定义日志格式
const logFormat = printf(({ level, message, label = '', timestamp, ...meta }) => {
  return `[${timestamp}] [${level}]${label ? ` [${label}]` : ''}: ${message} ${
    Object.keys(meta).length ? JSON.stringify(meta, null, 2) : ''
  }`;
});

// 控制台日志格式
const consoleFormat = format.printf(({ level, message, timestamp, ...metadata }) => {
  let metaStr = '';
  if (Object.keys(metadata).length > 0) {
    metaStr = JSON.stringify(metadata, null, 2);
  }
  return `${timestamp} [${level.toUpperCase()}]: ${message} ${metaStr}`;
});

// 创建日志记录器
const logger = createLogger({
  format: combine(
    timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    splat(),
    logFormat
  ),
  transports: [
    // 控制台输出
    new transports.Console({
      format: combine(
        colorize(),
        logFormat
      ),
      level: process.env.NODE_ENV === 'production' ? 'info' : 'debug'
    }),
    
    // 信息日志文件
    new transports.File({
      filename: LOG_FILES.info,
      level: 'info'
    }),
    
    // 错误日志文件
    new transports.File({
      filename: LOG_FILES.error,
      level: 'error'
    })
  ]
});

// API调用日志记录器
const apiLogger = createLogger({
  format: combine(
    timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    logFormat
  ),
  transports: [
    new transports.File({
      filename: LOG_FILES.api,
      level: 'info'
    })
  ]
});

// Stability AI API调用日志记录器
const stabilityApiLogger = createLogger({
  format: combine(
    timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    logFormat
  ),
  transports: [
    new transports.File({
      filename: LOG_FILES.stability,
      level: 'info'
    })
  ]
});

// Stability API错误日志记录器
const stabilityErrorLogger = createLogger({
  format: combine(
    timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    logFormat
  ),
  transports: [
    new transports.File({
      filename: path.join(LOG_DIR, 'stability-error.log'),
      level: 'error'
    }),
    new transports.Console({
      level: 'error',
      format: combine(
        timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
        consoleFormat
      )
    })
  ]
});

/**
 * 记录API请求
 * @param {object} req - Express请求对象
 * @param {object} res - Express响应对象
 * @param {string} responseBody - 响应内容
 */
function logApiRequest(req, res, responseBody = '') {
  const reqData = {
    method: req.method,
    url: req.originalUrl || req.url,
    params: req.params,
    query: req.query,
    body: req.body,
    headers: {
      'user-agent': req.headers['user-agent'],
      'content-type': req.headers['content-type'],
      'accept': req.headers['accept']
    },
    ip: req.ip
  };
  
  const resData = {
    statusCode: res.statusCode,
    statusMessage: res.statusMessage,
    responseTime: res.responseTime,
    responseBody: typeof responseBody === 'string' ? 
      (responseBody.length > 500 ? responseBody.substring(0, 500) + '...' : responseBody) : 
      'Non-string response'
  };
  
  apiLogger.info(`${req.method} ${req.originalUrl || req.url}`, {
    request: reqData,
    response: resData
  });
}

/**
 * 记录Stability API调用
 * @param {string} endpoint - API端点
 * @param {object} params - 请求参数
 * @param {object} response - 响应数据
 */
function logStabilityApiCall(endpoint, params, response = {}) {
  stabilityApiLogger.info(`调用Stability API: ${endpoint}`, {
    params: sanitizeParams(params),
    response: sanitizeResponse(response)
  });
}

/**
 * 记录Stability API错误
 * @param {string} endpoint - API端点
 * @param {Object} request - 请求信息
 * @param {Error} error - 错误对象
 */
function logStabilityApiError(endpoint, request, error) {
  const cleanRequest = { ...request };
  
  // 从请求中删除敏感信息和大型数据
  if (cleanRequest.headers) {
    if (cleanRequest.headers.Authorization) {
      cleanRequest.headers.Authorization = "Bearer [REDACTED]";
    }
  }
  
  // 如果有FormData，只记录键名而不是值
  if (cleanRequest.data && cleanRequest.data instanceof FormData) {
    const formDataKeys = [];
    // 由于FormData不容易直接检查，我们只记录'使用了FormData'
    cleanRequest.data = 'FormData包含多个字段，已省略具体内容';
  } else if (cleanRequest.data && typeof cleanRequest.data === 'object') {
    // 检查对象中的大型字段
    for (const key in cleanRequest.data) {
      if (typeof cleanRequest.data[key] === 'string' && cleanRequest.data[key].length > 200) {
        cleanRequest.data[key] = `${cleanRequest.data[key].substring(0, 100)}... [truncated, total ${cleanRequest.data[key].length} characters]`;
      }
    }
  }

  // 提取更多错误细节
  const errorDetails = {
    message: error.message,
    name: error.name,
    code: error.code || 'UNKNOWN',
    stack: error.stack ? error.stack.split('\n').slice(0, 3).join('\n') : undefined
  };

  // 如果有响应数据，添加到错误日志
  if (error.response) {
    errorDetails.status = error.response.status;
    errorDetails.statusText = error.response.statusText;
    
    if (error.response.data) {
      if (typeof error.response.data === 'string') {
        errorDetails.responseData = error.response.data.substring(0, 500);
      } else {
        try {
          errorDetails.responseData = JSON.stringify(error.response.data).substring(0, 500);
        } catch (e) {
          errorDetails.responseData = '[无法序列化响应数据]';
        }
      }
    }
  }

  // 记录详细的错误信息
  stabilityErrorLogger.error(`Stability API错误: ${endpoint}`, {
    endpoint,
    request: cleanRequest,
    error: errorDetails,
    timestamp: new Date().toISOString(),
    // 添加一些上下文数据，如服务器信息
    context: {
      nodeVersion: process.version,
      platform: process.platform,
      memory: process.memoryUsage()
    }
  });
}

/**
 * 清理参数中的敏感信息
 */
function sanitizeParams(params) {
  if (!params) return {};
  
  // 深拷贝以避免修改原始对象
  const sanitized = JSON.parse(JSON.stringify(params));
  
  // 清理API密钥
  if (sanitized.headers && sanitized.headers.Authorization) {
    sanitized.headers.Authorization = '[REDACTED]';
  }
  
  // 截断大型base64数据
  if (sanitized.init_image && typeof sanitized.init_image === 'string' && sanitized.init_image.length > 100) {
    sanitized.init_image = sanitized.init_image.substring(0, 100) + '... [TRUNCATED]';
  }
  
  return sanitized;
}

/**
 * 清理响应中的大型数据
 */
function sanitizeResponse(response) {
  if (!response) return {};
  
  // 深拷贝以避免修改原始对象
  const sanitized = JSON.parse(JSON.stringify(response));
  
  // 截断artifacts中的base64数据
  if (sanitized.data && sanitized.data.artifacts) {
    sanitized.data.artifacts = sanitized.data.artifacts.map(artifact => {
      if (artifact.base64 && typeof artifact.base64 === 'string') {
        return {
          ...artifact,
          base64: '[BASE64_DATA]'
        };
      }
      return artifact;
    });
  }
  
  return sanitized;
}

module.exports = {
  logger,
  apiLogger,
  stabilityApiLogger,
  logApiRequest,
  logStabilityApiCall,
  logStabilityApiError,
  stabilityErrorLogger
}; 