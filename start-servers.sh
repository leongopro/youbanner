#!/bin/bash

# 打印彩色输出
print_message() {
  echo -e "\e[1;36m$1\e[0m"
}

# 启动后端服务器
start_backend() {
  print_message "正在启动后端服务器..."
  cd backend
  npm start &
  backend_pid=$!
  cd ..
  print_message "后端服务器已启动，PID: $backend_pid"
}

# 启动前端服务器
start_frontend() {
  print_message "正在启动前端服务器..."
  cd frontend
  npm run dev &
  frontend_pid=$!
  cd ..
  print_message "前端服务器已启动，PID: $frontend_pid"
}

# 主函数
main() {
  print_message "===== 启动 PhotoCalory 应用服务器 ====="
  
  # 检查是否存在后端和前端目录
  if [ ! -d "backend" ]; then
    print_message "错误：找不到 backend 目录"
    exit 1
  fi
  
  if [ ! -d "frontend" ]; then
    print_message "错误：找不到 frontend 目录"
    exit 1
  fi
  
  start_backend
  sleep 2  # 等待后端服务器启动
  start_frontend
  
  print_message "所有服务器已启动，请访问 http://localhost:3000"
  print_message "按 Ctrl+C 停止所有服务器"
  
  # 等待用户按下 Ctrl+C
  trap "kill $backend_pid $frontend_pid 2>/dev/null" EXIT
  wait
}

main 