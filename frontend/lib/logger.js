/**
 * 前端日志工具
 * 用于记录前端操作、请求和错误日志
 */

// 日志级别定义
const LOG_LEVELS = {
  DEBUG: 'debug',
  INFO: 'info',
  WARN: 'warn',
  ERROR: 'error'
};

// 日志存储
let logs = [];
const MAX_LOGS = 1000; // 最多保存1000条日志

/**
 * 添加日志
 * @param {string} level - 日志级别
 * @param {string} category - 日志类别
 * @param {string} message - 日志消息
 * @param {any} data - 附加数据
 */
function addLog(level, category, message, data = null) {
  const timestamp = new Date().toISOString();
  const log = {
    timestamp,
    level,
    category,
    message,
    data
  };
  
  // 添加到内存中
  logs.push(log);
  
  // 如果超过最大日志数，删除最早的日志
  if (logs.length > MAX_LOGS) {
    logs = logs.slice(-MAX_LOGS);
  }
  
  // 控制台输出
  const consoleMethod = level === LOG_LEVELS.ERROR ? 'error' : 
                      level === LOG_LEVELS.WARN ? 'warn' : 
                      level === LOG_LEVELS.INFO ? 'info' : 'log';
                      
  console[consoleMethod](`[${timestamp}] [${level.toUpperCase()}] [${category}] ${message}`, data || '');
  
  // 如果是错误日志，发送到服务器
  if (level === LOG_LEVELS.ERROR) {
    sendErrorToServer(log).catch(err => {
      console.error('发送错误日志到服务器失败:', err);
    });
  }
}

/**
 * 发送错误日志到服务器
 * @param {Object} log - 日志对象
 */
async function sendErrorToServer(log) {
  try {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';
    
    // 只在生产环境发送
    if (process.env.NODE_ENV === 'production') {
      await fetch(`${apiUrl}/api/logs`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          ...log,
          client: {
            userAgent: navigator.userAgent,
            url: window.location.href,
            referrer: document.referrer
          }
        })
      });
    }
  } catch (error) {
    console.error('发送日志失败:', error);
  }
}

/**
 * 获取所有日志
 * @returns {Array} 日志数组
 */
function getLogs() {
  return [...logs];
}

/**
 * 清空日志
 */
function clearLogs() {
  logs = [];
}

/**
 * 导出日志为JSON文件
 */
function exportLogs() {
  const dataStr = JSON.stringify(logs, null, 2);
  const dataUri = `data:application/json;charset=utf-8,${encodeURIComponent(dataStr)}`;
  
  const exportFileDefaultName = `frontend-logs-${new Date().toISOString()}.json`;
  
  const linkElement = document.createElement('a');
  linkElement.setAttribute('href', dataUri);
  linkElement.setAttribute('download', exportFileDefaultName);
  linkElement.click();
}

// 公开的日志方法
const logger = {
  debug: (category, message, data) => addLog(LOG_LEVELS.DEBUG, category, message, data),
  info: (category, message, data) => addLog(LOG_LEVELS.INFO, category, message, data),
  warn: (category, message, data) => addLog(LOG_LEVELS.WARN, category, message, data),
  error: (category, message, data) => addLog(LOG_LEVELS.ERROR, category, message, data),
  getLogs,
  clearLogs,
  exportLogs
};

export default logger; 