/**
 * 系统监控路由
 * 提供系统状态、性能指标和运行数据
 */

const express = require('express');
const os = require('os');
const fs = require('fs');
const path = require('path');
const router = express.Router();
const { getMetrics } = require('../services/monitoring.service');
const { logger } = require('../services/logger.service');

/**
 * 获取系统状态
 * GET /api/monitor/status
 */
router.get('/status', (req, res) => {
  try {
    // 获取系统信息
    const systemInfo = {
      platform: os.platform(),
      arch: os.arch(),
      hostname: os.hostname(),
      cpus: os.cpus().length,
      totalMemory: Math.round(os.totalmem() / (1024 * 1024 * 1024) * 100) / 100 + ' GB',
      freeMemory: Math.round(os.freemem() / (1024 * 1024 * 1024) * 100) / 100 + ' GB',
      memoryUsage: Math.round((1 - os.freemem() / os.totalmem()) * 100) + '%',
      uptime: formatTime(os.uptime()),
      nodeVersion: process.version,
      processUptime: formatTime(process.uptime())
    };

    // 获取性能指标
    const metrics = getMetrics();

    logger.info('系统状态检查', { 
      clientIp: req.ip,
      memoryUsage: systemInfo.memoryUsage 
    });

    return res.status(200).json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      system: systemInfo,
      metrics: metrics
    });
  } catch (error) {
    logger.error('获取系统状态失败', {
      error: error.message,
      stack: error.stack
    });
    return res.status(500).json({ error: '获取系统状态失败', message: error.message });
  }
});

/**
 * 获取日志文件列表
 * GET /api/monitor/logs
 */
router.get('/logs', (req, res) => {
  try {
    const logsDir = path.join(__dirname, '..', 'logs');
    
    // 检查目录是否存在
    if (!fs.existsSync(logsDir)) {
      return res.status(200).json({ logs: [] });
    }

    // 读取日志文件列表
    const files = fs.readdirSync(logsDir)
      .filter(file => file.endsWith('.log'))
      .map(file => {
        const filePath = path.join(logsDir, file);
        const stats = fs.statSync(filePath);
        return {
          name: file,
          size: formatFileSize(stats.size),
          modified: stats.mtime,
          path: `/api/monitor/logs/${file}`
        };
      });

    logger.info('获取日志文件列表', { clientIp: req.ip });
    
    return res.status(200).json({ logs: files });
  } catch (error) {
    logger.error('获取日志文件列表失败', {
      error: error.message,
      stack: error.stack
    });
    return res.status(500).json({ error: '获取日志文件列表失败', message: error.message });
  }
});

/**
 * 获取具体日志文件内容
 * GET /api/monitor/logs/:filename
 */
router.get('/logs/:filename', (req, res) => {
  try {
    const { filename } = req.params;
    
    // 安全检查：确保没有路径注入
    if (filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
      return res.status(400).json({ error: '无效的文件名' });
    }
    
    // 构建日志文件路径
    const logFile = path.join(__dirname, '..', 'logs', filename);
    
    // 检查文件是否存在
    if (!fs.existsSync(logFile)) {
      return res.status(404).json({ error: '日志文件不存在' });
    }

    // 获取文件大小
    const stats = fs.statSync(logFile);
    
    // 对于大文件，只返回最后的部分内容
    const MAX_SIZE = 100 * 1024; // 100KB
    let content;
    
    if (stats.size > MAX_SIZE) {
      // 只读取最后100KB
      const buffer = Buffer.alloc(MAX_SIZE);
      const fd = fs.openSync(logFile, 'r');
      fs.readSync(fd, buffer, 0, MAX_SIZE, stats.size - MAX_SIZE);
      fs.closeSync(fd);
      content = buffer.toString('utf8');
      content = '...(文件内容被截断，只显示最后部分)...\n\n' + content;
    } else {
      // 读取整个文件
      content = fs.readFileSync(logFile, 'utf8');
    }

    logger.info('读取日志文件', { 
      clientIp: req.ip,
      filename,
      fileSize: stats.size
    });
    
    // 返回日志内容，根据请求格式决定返回纯文本或JSON
    const accept = req.headers.accept || '';
    if (accept.includes('application/json')) {
      // 将日志按行分割并转换为对象数组
      const lines = content.split('\n')
        .filter(line => line.trim())
        .map(line => {
          try {
            return JSON.parse(line);
          } catch (e) {
            return { raw: line };
          }
        });
      
      return res.status(200).json({ 
        filename, 
        size: formatFileSize(stats.size),
        modified: stats.mtime,
        lines 
      });
    } else {
      // 返回纯文本
      res.setHeader('Content-Type', 'text/plain');
      return res.status(200).send(content);
    }
  } catch (error) {
    logger.error('读取日志文件失败', {
      error: error.message,
      stack: error.stack,
      filename: req.params.filename
    });
    return res.status(500).json({ error: '读取日志文件失败', message: error.message });
  }
});

/**
 * 获取CPU和内存使用情况
 * GET /api/monitor/resources
 */
router.get('/resources', (req, res) => {
  try {
    // 获取CPU使用情况
    const cpus = os.cpus();
    let totalIdle = 0;
    let totalTick = 0;
    
    for (const cpu of cpus) {
      for (const type in cpu.times) {
        totalTick += cpu.times[type];
      }
      totalIdle += cpu.times.idle;
    }
    
    const cpuUsage = 100 - (totalIdle / totalTick * 100);
    
    // 获取内存使用情况
    const totalMemory = os.totalmem();
    const freeMemory = os.freemem();
    const usedMemory = totalMemory - freeMemory;
    
    // 获取进程内存使用情况
    const processMemory = process.memoryUsage();
    
    logger.debug('资源使用监控', {
      cpuUsage: Math.round(cpuUsage) + '%',
      memoryUsage: Math.round((usedMemory / totalMemory) * 100) + '%'
    });
    
    return res.status(200).json({
      timestamp: new Date().toISOString(),
      cpu: {
        usage: Math.round(cpuUsage * 100) / 100 + '%',
        cores: cpus.length
      },
      memory: {
        total: formatFileSize(totalMemory),
        used: formatFileSize(usedMemory),
        free: formatFileSize(freeMemory),
        usage: Math.round((usedMemory / totalMemory) * 100) + '%'
      },
      process: {
        rss: formatFileSize(processMemory.rss),
        heapTotal: formatFileSize(processMemory.heapTotal),
        heapUsed: formatFileSize(processMemory.heapUsed),
        external: formatFileSize(processMemory.external)
      }
    });
  } catch (error) {
    logger.error('获取资源使用情况失败', {
      error: error.message,
      stack: error.stack
    });
    return res.status(500).json({ error: '获取资源使用情况失败', message: error.message });
  }
});

/**
 * 格式化文件大小
 * @param {number} bytes - 字节数
 * @returns {string} 格式化后的大小
 */
function formatFileSize(bytes) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return Math.round(bytes / 1024 * 100) / 100 + ' KB';
  if (bytes < 1024 * 1024 * 1024) return Math.round(bytes / (1024 * 1024) * 100) / 100 + ' MB';
  return Math.round(bytes / (1024 * 1024 * 1024) * 100) / 100 + ' GB';
}

/**
 * 格式化时间
 * @param {number} seconds - 秒数
 * @returns {string} 格式化后的时间
 */
function formatTime(seconds) {
  const days = Math.floor(seconds / (24 * 60 * 60));
  seconds %= (24 * 60 * 60);
  const hours = Math.floor(seconds / (60 * 60));
  seconds %= (60 * 60);
  const minutes = Math.floor(seconds / 60);
  seconds = Math.floor(seconds % 60);
  
  return `${days}d ${hours}h ${minutes}m ${seconds}s`;
}

module.exports = router; 