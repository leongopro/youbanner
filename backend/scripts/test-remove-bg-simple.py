#!/usr/bin/env python3

import requests
import os
import json

API_KEY = 'sk-5eV9DDMJPgl1CMwjvz6MBpkMFrDDnCwbFHsgL8s4k7eILVMN'
IMAGE_PATH = "uploads/123.png"  # 相对于项目根目录的路径

def test_remove_background_simple():
    """测试 Stability AI 移除背景 API - 简化版"""
    print("开始简化测试 Stability AI 移除背景 API...")
    
    # 检查图片是否存在
    if not os.path.exists(IMAGE_PATH):
        print(f"错误: 图片不存在: {IMAGE_PATH}")
        return
    
    print(f"使用图片: {os.path.abspath(IMAGE_PATH)}")
    
    try:
        print("\n提交移除背景任务...")
        
        # API请求
        url = "https://api.stability.ai/v2beta/stable-image/edit/remove-background"
        headers = {
            "Authorization": f"Bearer {API_KEY}",
            "Accept": "image/*"
            # 不要手动设置Content-Type，requests会自动设置
        }
        
        # 直接使用文件对象
        files = {
            "image": open(IMAGE_PATH, "rb")
        }
        
        data = {
            "output_format": "png"
        }
        
        print("发送请求...")
        print("这可能需要一些时间，请耐心等待...")
        response = requests.post(
            url,
            headers=headers,
            files=files,
            data=data,
            timeout=90  # 90秒超时
        )
        
        print(f"状态码: {response.status_code}")
        
        # 检查响应
        if response.status_code == 200:
            # 保存返回的图片
            output_file = "result_simple.png"
            with open(output_file, 'wb') as f:
                f.write(response.content)
            print(f"成功! 已将结果保存到 {os.path.abspath(output_file)}")
        else:
            print(f"请求失败: {response.status_code}")
            print(f"响应: {response.text}")
            
    except Exception as e:
        print(f"错误: {str(e)}")

if __name__ == "__main__":
    test_remove_background_simple() 