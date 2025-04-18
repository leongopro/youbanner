/**
 * 日志API路由
 * 处理前端日志的收集和存储
 */

const express = require('express');
const fs = require('fs');
const path = require('path');
const router = express.Router();

// 日志文件路径
const LOG_DIR = path.join(__dirname, '..', 'logs');
const CLIENT_LOG_FILE = path.join(LOG_DIR, 'client-errors.log');

// 确保日志目录存在
if (!fs.existsSync(LOG_DIR)) {
  fs.mkdirSync(LOG_DIR, { recursive: true });
}

/**
 * 接收前端日志
 * POST /api/logs
 */
router.post('/', async (req, res) => {
  try {
    const logData = req.body;
    
    // 验证日志数据
    if (!logData || !logData.timestamp || !logData.level || !logData.message) {
      return res.status(400).json({ error: '无效的日志数据' });
    }
    
    // 只存储错误日志
    if (logData.level === 'error') {
      // 增加来源标识
      const logEntry = {
        ...logData,
        source: 'client',
        ip: req.ip,
        receivedAt: new Date().toISOString()
      };
      
      // 写入日志文件
      fs.appendFileSync(
        CLIENT_LOG_FILE,
        JSON.stringify(logEntry) + '\n'
      );
      
      console.log(`接收到客户端错误日志: ${logData.message}`);
    }
    
    return res.status(200).json({ success: true });
  } catch (error) {
    console.error('处理前端日志出错:', error);
    return res.status(500).json({ error: '处理日志出错' });
  }
});

/**
 * 获取前端错误日志
 * 仅在开发环境可用
 * GET /api/logs
 */
router.get('/', (req, res) => {
  if (process.env.NODE_ENV !== 'development') {
    return res.status(403).json({ error: '仅开发环境可用' });
  }
  
  try {
    // 检查日志文件是否存在
    if (!fs.existsSync(CLIENT_LOG_FILE)) {
      return res.status(200).json({ logs: [] });
    }
    
    // 读取日志文件
    const logContent = fs.readFileSync(CLIENT_LOG_FILE, 'utf8');
    const logs = logContent
      .split('\n')
      .filter(line => line.trim() !== '')
      .map(line => {
        try {
          return JSON.parse(line);
        } catch (e) {
          return { raw: line, parseError: true };
        }
      });
    
    return res.status(200).json({ logs });
  } catch (error) {
    console.error('获取前端日志出错:', error);
    return res.status(500).json({ error: '获取日志出错' });
  }
});

/**
 * 清空前端错误日志
 * 仅在开发环境可用
 * DELETE /api/logs
 */
router.delete('/', (req, res) => {
  if (process.env.NODE_ENV !== 'development') {
    return res.status(403).json({ error: '仅开发环境可用' });
  }
  
  try {
    // 检查日志文件是否存在
    if (fs.existsSync(CLIENT_LOG_FILE)) {
      // 清空日志文件
      fs.writeFileSync(CLIENT_LOG_FILE, '');
    }
    
    return res.status(200).json({ success: true });
  } catch (error) {
    console.error('清空前端日志出错:', error);
    return res.status(500).json({ error: '清空日志出错' });
  }
});

module.exports = router; 