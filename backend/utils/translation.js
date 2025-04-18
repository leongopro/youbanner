/**
 * 翻译工具库
 * 处理中文到英文的翻译功能
 */

/**
 * 检测字符串是否包含中文字符
 * @param {string} text - 要检测的文本
 * @returns {boolean} - 如果包含中文字符返回true，否则返回false
 */
function containsChinese(text) {
  if (!text) return false;
  return /[\u4e00-\u9fa5]/.test(text);
}

/**
 * 中英文提示词对照表
 * 用于将中文提示词转换为英文
 */
const promptTranslations = {
  // 自然和风景类
  '山': 'mountain',
  '水': 'water',
  '湖': 'lake',
  '海': 'sea',
  '河': 'river',
  '森林': 'forest',
  '草地': 'grassland',
  '沙漠': 'desert',
  '冰川': 'glacier',
  '岛屿': 'island',
  '海滩': 'beach',
  '峡谷': 'canyon',
  '瀑布': 'waterfall',
  '雪山': 'snowy mountain',
  
  // 天空和气象类
  '天空': 'sky',
  '云': 'cloud',
  '雾': 'fog',
  '雨': 'rain',
  '雪': 'snow',
  '彩虹': 'rainbow',
  '闪电': 'lightning',
  '暴风雨': 'storm',
  '晴天': 'sunny day',
  '日落': 'sunset',
  '日出': 'sunrise',
  '黄昏': 'dusk',
  '黎明': 'dawn',
  '星空': 'starry sky',
  '银河': 'milky way',
  '极光': 'aurora',
  
  // 植物和动物类
  '树': 'tree',
  '花': 'flower',
  '草': 'grass',
  '叶子': 'leaves',
  '仙人掌': 'cactus',
  '动物': 'animal',
  '鸟': 'bird',
  '鱼': 'fish',
  '蝴蝶': 'butterfly',
  '昆虫': 'insect',
  
  // 建筑和城市类
  '建筑': 'building',
  '城市': 'city',
  '街道': 'street',
  '桥': 'bridge',
  '房子': 'house',
  '摩天大楼': 'skyscraper',
  '古代建筑': 'ancient architecture',
  '寺庙': 'temple',
  '城堡': 'castle',
  '宫殿': 'palace',
  '乡村': 'countryside',
  '村庄': 'village',
  
  // 科技和未来类
  '科技': 'technology',
  '未来': 'future',
  '机器人': 'robot',
  '太空': 'space',
  '宇宙': 'universe',
  '行星': 'planet',
  '太空船': 'spaceship',
  '人工智能': 'artificial intelligence',
  '全息图': 'hologram',
  '虚拟现实': 'virtual reality',
  '赛博朋克': 'cyberpunk',
  
  // 艺术和抽象类
  '抽象': 'abstract',
  '艺术': 'art',
  '油画': 'oil painting',
  '水彩': 'watercolor',
  '素描': 'sketch',
  '雕塑': 'sculpture',
  '纹理': 'texture',
  '几何': 'geometric',
  '波普艺术': 'pop art',
  '超现实主义': 'surrealism',
  '印象派': 'impressionism',
  
  // 游戏和媒体类
  '游戏': 'game',
  '动漫': 'anime',
  '电影': 'movie',
  '漫画': 'comic',
  '电视': 'TV',
  '音乐': 'music',
  '舞蹈': 'dance',
  '戏剧': 'drama',
  
  // 人类相关
  '人物': 'person',
  '人群': 'crowd',
  '家庭': 'family',
  '儿童': 'children',
  '婴儿': 'baby',
  '老人': 'elderly',
  '男人': 'man',
  '女人': 'woman',
  '肖像': 'portrait',
  
  // 风格描述类
  '写实': 'realistic',
  '卡通': 'cartoon',
  '丰富多彩': 'colorful',
  '色彩鲜艳': 'vibrant colors',
  '黑白': 'black and white',
  '单色': 'monochrome',
  '复古': 'vintage',
  '现代': 'modern',
  '最小化': 'minimalist',
  '华丽': 'ornate',
  '简单': 'simple',
  '复杂': 'complex',
  '对称': 'symmetrical',
  '不对称': 'asymmetrical',
  
  // 质量和技术描述
  '高清': 'high definition',
  '4K': '4K',
  '8K': '8K',
  '超高清': 'ultra HD',
  '低分辨率': 'low resolution',
  '模糊': 'blurry',
  '清晰': 'sharp',
  '高质量': 'high quality',
  '低质量': 'low quality',
  '专业': 'professional',
  '业余': 'amateur',
  '噪点': 'noise',
  '锐利': 'crisp',
  '平滑': 'smooth'
};

/**
 * 将中文文本翻译成英文
 * @param {string} text - 要翻译的中文文本
 * @returns {string} - 翻译后的英文文本
 */
function translateToEnglish(text) {
  if (!text) return '';
  if (!containsChinese(text)) return text;
  
  let result = text;
  
  // 遍历词典中的中文词汇，替换为对应的英文
  Object.keys(promptTranslations).forEach(key => {
    result = result.replace(new RegExp(key, 'g'), promptTranslations[key]);
  });
  
  // 如果还存在中文字符，用空格替换
  result = result.replace(/[\u4e00-\u9fa5]/g, ' ');
  
  // 清理多余的空格
  result = result.replace(/\s+/g, ' ').trim();
  
  // 如果翻译后文本为空，提供默认值
  if (!result || result.trim() === '') {
    result = 'beautiful landscape, high quality, detailed';
  }
  
  return result;
}

module.exports = {
  containsChinese,
  translateToEnglish
}; 