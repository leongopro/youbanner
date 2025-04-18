/**
 * 服务监控工具
 * 用于监控API性能和健康状态
 */

const fs = require('fs');
const path = require('path');
const os = require('os');
const { logger } = require('./logger.service');

// 性能指标
const metrics = {
  totalRequests: 0,
  successfulRequests: 0,
  failedRequests: 0,
  stabilityApiCalls: 0,
  stabilityApiErrors: 0,
  responseTimeMs: {
    sum: 0,
    count: 0,
    max: 0,
    min: Number.MAX_SAFE_INTEGER
  },
  lastUpdated: new Date()
};

// 系统资源利用率
let systemResources = {
  cpu: 0,
  memory: {
    free: 0,
    total: 0,
    percentFree: 0
  },
  uptime: 0
};

// 初始化：获取系统资源信息
function updateSystemResources() {
  try {
    const cpus = os.cpus();
    let totalIdle = 0;
    let totalTick = 0;
    
    for (const cpu of cpus) {
      for (const type in cpu.times) {
        totalTick += cpu.times[type];
      }
      totalIdle += cpu.times.idle;
    }
    
    systemResources.cpu = 100 - (totalIdle / totalTick * 100);
    systemResources.memory.free = os.freemem();
    systemResources.memory.total = os.totalmem();
    systemResources.memory.percentFree = (systemResources.memory.free / systemResources.memory.total * 100).toFixed(2);
    systemResources.uptime = os.uptime();
    
    return systemResources;
  } catch (error) {
    logger.error('获取系统资源信息失败:', error);
    return systemResources;
  }
}

// 首次更新系统资源信息
updateSystemResources();

// 定期更新系统资源信息（每分钟一次）
setInterval(updateSystemResources, 60000);

/**
 * 记录API请求
 * @param {boolean} isSuccess - 请求是否成功
 * @param {number} responseTimeMs - 响应时间(毫秒)
 */
function recordApiRequest(isSuccess, responseTimeMs) {
  metrics.totalRequests++;
  
  if (isSuccess) {
    metrics.successfulRequests++;
  } else {
    metrics.failedRequests++;
  }
  
  if (responseTimeMs) {
    metrics.responseTimeMs.sum += responseTimeMs;
    metrics.responseTimeMs.count++;
    metrics.responseTimeMs.max = Math.max(metrics.responseTimeMs.max, responseTimeMs);
    metrics.responseTimeMs.min = Math.min(metrics.responseTimeMs.min, responseTimeMs);
  }
  
  metrics.lastUpdated = new Date();
}

/**
 * 记录Stability API调用
 * @param {boolean} isSuccess - 调用是否成功
 */
function recordStabilityApiCall(isSuccess) {
  metrics.stabilityApiCalls++;
  
  if (!isSuccess) {
    metrics.stabilityApiErrors++;
  }
  
  metrics.lastUpdated = new Date();
}

/**
 * 获取性能指标
 * @returns {object} 性能指标对象
 */
function getMetrics() {
  const avgResponseTime = metrics.responseTimeMs.count > 0
    ? metrics.responseTimeMs.sum / metrics.responseTimeMs.count
    : 0;
  
  return {
    ...metrics,
    avgResponseTimeMs: avgResponseTime.toFixed(2),
    successRate: metrics.totalRequests > 0
      ? ((metrics.successfulRequests / metrics.totalRequests) * 100).toFixed(2)
      : 0,
    stabilityApiSuccessRate: metrics.stabilityApiCalls > 0
      ? (((metrics.stabilityApiCalls - metrics.stabilityApiErrors) / metrics.stabilityApiCalls) * 100).toFixed(2)
      : 0,
    systemResources: updateSystemResources()
  };
}

/**
 * 创建API健康检查中间件
 * @returns {Function} Express中间件
 */
function healthCheckMiddleware() {
  return (req, res, next) => {
    if (req.path === '/health') {
      const healthStatus = {
        status: 'ok',
        uptime: process.uptime(),
        timestamp: new Date().toISOString(),
        metrics: {
          totalRequests: metrics.totalRequests,
          successRate: metrics.totalRequests > 0
            ? ((metrics.successfulRequests / metrics.totalRequests) * 100).toFixed(2)
            : 0
        },
        system: {
          memory: {
            free: (systemResources.memory.free / 1024 / 1024).toFixed(2) + ' MB',
            total: (systemResources.memory.total / 1024 / 1024).toFixed(2) + ' MB',
            percentFree: systemResources.memory.percentFree + '%'
          },
          cpu: systemResources.cpu.toFixed(2) + '%',
          uptime: formatUptime(systemResources.uptime)
        }
      };
      
      return res.json(healthStatus);
    }
    
    next();
  };
}

/**
 * 格式化正常运行时间
 * @param {number} seconds - 秒数
 * @returns {string} 格式化的正常运行时间
 */
function formatUptime(seconds) {
  const days = Math.floor(seconds / (3600 * 24));
  const hours = Math.floor((seconds % (3600 * 24)) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remainingSeconds = Math.floor(seconds % 60);
  
  return `${days}d ${hours}h ${minutes}m ${remainingSeconds}s`;
}

module.exports = {
  recordApiRequest,
  recordStabilityApiCall,
  getMetrics,
  healthCheckMiddleware
}; 