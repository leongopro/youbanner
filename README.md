# AutoYouBanner

响应式YouTube横幅生成器 - 一键创建符合所有设备标准的频道Banner

## 项目简介

AutoYouBanner是一个帮助YouTube创作者快速设计频道横幅的Web应用。用户只需输入频道名称、选择风格并上传logo，即可自动生成专业美观的横幅图片。

## 开发环境设置

### 1. 克隆项目

```bash
git clone https://github.com/leongopro/youbanner.git
cd youbanner
```

### 2. 安装依赖

```bash
# 前端依赖
cd frontend
npm install

# 后端依赖
cd ../backend
npm install
```

### 3. 环境变量

复制`.env.example`文件为`.env`并编辑相关配置。

### 4. 解决编码问题

为避免在多平台开发中遇到编码和换行符问题，本项目采取了以下措施：

#### 编辑器设置（Cursor / VS Code）

1. **确保文件编码为 UTF-8**
   - 打开 Cursor/VS Code 的任意文件
   - 检查右下角文件编码 → 应为 UTF-8
   - 如果不是：点击它 → 选择 Reopen with Encoding → 选 UTF-8

2. **统一换行符设置**
   - 检查右下角的 CRLF/LF 设置
   - 确保设置为 LF (Unix风格换行符)
   - 如果显示CRLF：点击它 → 选择 LF

3. **配置工作区设置**
   - 按 Ctrl+Shift+P (Windows/Linux) 或 Cmd+Shift+P (Mac)
   - 输入 "Preferences: Open Settings (JSON)"
   - 添加以下设置:
   ```json
   "files.encoding": "utf8",
   "files.eol": "\n",
   ```

#### Git配置

- `.gitattributes`文件已配置确保跨平台代码提交的一致性
- 所有代码文件使用UTF-8编码保存

#### 终端编码设置

**Windows PowerShell:**
```powershell
# 使用提供的启动脚本
./start-dev.ps1

# 或手动设置
$env:LANG="en_US.UTF-8"
$OutputEncoding = [System.Text.Encoding]::UTF8
```

**Git Bash/Linux/macOS:**
```bash
# 使用提供的启动脚本
./start-dev.sh

# 或手动设置
export LANG=en_US.UTF-8
export LC_ALL=en_US.UTF-8
```

**推荐:**
- Windows用户建议使用Git Bash或WSL开发
- 所有编辑器配置为使用UTF-8编码和LF换行符

### 5. 启动开发服务器

```bash
# 前端
cd frontend
npm run dev

# 后端
cd backend
npm run dev
```

## 项目规范

- 代码风格: ESLint + Prettier
- 提交规范: Conventional Commits
- 分支管理: Git Flow (main/develop/feature)

## 许可证

MIT 