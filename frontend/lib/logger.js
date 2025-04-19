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
const LOCAL_STORAGE_KEY = 'app_logs';

// 尝试从本地存储加载日志
try {
  if (typeof window !== 'undefined') {
    const storedLogs = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (storedLogs) {
      const parsedLogs = JSON.parse(storedLogs);
      if (Array.isArray(parsedLogs)) {
        logs = parsedLogs.slice(-MAX_LOGS);
        console.info(`已从本地存储加载 ${logs.length} 条日志`);
      }
    }
  }
} catch (e) {
  console.warn('加载本地日志失败:', e);
}

/**
 * 将日志保存到本地存储
 */
function saveLogsToLocalStorage() {
  try {
    if (typeof window !== 'undefined') {
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(logs.slice(-MAX_LOGS)));
    }
  } catch (e) {
    console.warn('保存日志到本地存储失败:', e);
  }
}

/**
 * 添加日志
 * @param {string} level - 日志级别
 * @param {string} category - 日志类别
 * @param {string} message - 日志消息
 * @param {any} data - 附加数据
 */
function addLog(level, category, message, data = null) {
  const timestamp = new Date().toISOString();
  
  // 处理对象类型的data，去除循环引用和过大的数据
  let processedData = null;
  if (data) {
    try {
      // 尝试删除循环引用，限制数据大小
      const getCircularReplacer = () => {
        const seen = new WeakSet();
        return (key, value) => {
          // 如果是对象且已经处理过，返回 '[Circular]'
          if (typeof value === 'object' && value !== null) {
            if (seen.has(value)) {
              return '[Circular]';
            }
            seen.add(value);
          }
          // 对于过大的字符串，截断
          if (typeof value === 'string' && value.length > 1000) {
            return value.substring(0, 1000) + '... [截断]';
          }
          return value;
        };
      };
      
      // 使用自定义替换函数处理数据
      processedData = JSON.parse(JSON.stringify(data, getCircularReplacer()));
    } catch (e) {
      // 如果无法序列化，使用基本描述
      processedData = {
        error: '无法序列化数据',
        dataType: typeof data,
        dataKeys: Object.keys(data || {}).join(', ')
      };
    }
  }
  
  const log = {
    timestamp,
    level,
    category,
    message,
    data: processedData,
    userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : null,
    url: typeof window !== 'undefined' ? window.location.href : null
  };
  
  // 添加到内存中
  logs.push(log);
  
  // 如果超过最大日志数，删除最早的日志
  if (logs.length > MAX_LOGS) {
    logs = logs.slice(-MAX_LOGS);
  }
  
  // 定期将日志保存到localStorage
  if (level === LOG_LEVELS.ERROR || logs.length % 10 === 0) {
    saveLogsToLocalStorage();
  }
  
  // 控制台输出
  const consoleMethod = level === LOG_LEVELS.ERROR ? 'error' : 
                      level === LOG_LEVELS.WARN ? 'warn' : 
                      level === LOG_LEVELS.INFO ? 'info' : 'log';
                      
  console[consoleMethod](`[${timestamp}] [${level.toUpperCase()}] [${category}] ${message}`, processedData || '');
  
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
    // 确保有API URL
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';
    
    // 检查网络连接
    if (!navigator.onLine) {
      console.warn('网络离线，无法发送日志到服务器');
      return;
    }
    
    // 添加设备信息
    const enhancedLog = {
      ...log,
      client: {
        userAgent: navigator.userAgent,
        url: window.location.href,
        referrer: document.referrer,
        viewport: {
          width: window.innerWidth,
          height: window.innerHeight
        },
        platform: navigator.platform,
        language: navigator.language,
        timestamp: new Date().toISOString()
      }
    };
    
    // 发送日志
    await fetch(`${apiUrl}/api/logs`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(enhancedLog)
    });
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
 * 获取特定级别的日志
 * @param {string} level - 日志级别
 * @returns {Array} 日志数组
 */
function getLogsByLevel(level) {
  return logs.filter(log => log.level === level);
}

/**
 * 清空日志
 */
function clearLogs() {
  logs = [];
  try {
    if (typeof window !== 'undefined') {
      localStorage.removeItem(LOCAL_STORAGE_KEY);
    }
  } catch (e) {
    console.warn('清除本地存储日志失败:', e);
  }
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

/**
 * 将日志显示在控制台
 */
function printLogsToConsole() {
  console.group('应用日志');
  console.table(logs.map(log => ({
    时间: new Date(log.timestamp).toLocaleString(),
    级别: log.level.toUpperCase(),
    类别: log.category,
    消息: log.message
  })));
  console.groupEnd();
}

// 公开的日志方法
const logger = {
  debug: (category, message, data) => addLog(LOG_LEVELS.DEBUG, category, message, data),
  info: (category, message, data) => addLog(LOG_LEVELS.INFO, category, message, data),
  warn: (category, message, data) => addLog(LOG_LEVELS.WARN, category, message, data),
  error: (category, message, data) => addLog(LOG_LEVELS.ERROR, category, message, data),
  getLogs,
  getLogsByLevel,
  clearLogs,
  exportLogs,
  printLogsToConsole
};

// 在开发环境下将logger对象添加到window对象，方便调试
if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
  window.appLogger = logger;
}

export default logger; 