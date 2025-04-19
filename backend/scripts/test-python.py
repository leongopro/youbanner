#!/usr/bin/env python3

import requests
import os
import json
import sys

API_KEY = 'sk-5eV9DDMJPgl1CMwjvz6MBpkMFrDDnCwbFHsgL8s4k7eILVMN'
IMAGE_PATH = "../../uploads/123.png"  # 原路径
# 尝试多种可能的路径
PATHS_TO_TRY = [
    "../../uploads/123.png",  # 原路径
    "../uploads/123.png",     # 相对于backend目录
    "uploads/123.png",        # 相对于项目根目录
]

def test_api():
    print("开始测试 Stability AI 背景替换 API...")
    
    # 尝试多个路径找到图片
    image_path = None
    for path in PATHS_TO_TRY:
        if os.path.exists(path):
            image_path = path
            break
    
    if image_path is None:
        print("错误: 无法找到图片 123.png，尝试了以下路径:")
        for path in PATHS_TO_TRY:
            print(f" - {path} ({os.path.abspath(path)})")
        return
    
    print(f"使用图片: {os.path.abspath(image_path)}")
    print(f"图片大小: {os.path.getsize(image_path) / 1024:.2f} KB")
    
    # 发送API请求
    try:
        response = requests.post(
            "https://api.stability.ai/v2beta/stable-image/edit/replace-background-and-relight",
            headers={
                "authorization": f"Bearer {API_KEY}",
                "accept": "application/json"  # 首先使用json格式接收响应
            },
            files={
                "subject_image": open(image_path, "rb")
            },
            data={
                "background_prompt": "modern studio lighting, professional portrait",
                "output_format": "png",
            },
        )
        
        # 检查响应
        print(f"响应状态码: {response.status_code}")
        
        if response.status_code == 200:
            result = response.json()
            print("响应数据:", json.dumps(result, indent=2))
            
            if 'id' in result:
                print(f"生成任务ID: {result['id']}")
                
                # 尝试立即检查状态
                check_status(result['id'])
            else:
                print("警告: 响应中没有任务ID")
        else:
            print(f"API请求失败: {response.text}")
    
    except Exception as e:
        print(f"发生错误: {str(e)}")

def check_status(task_id):
    """检查任务状态"""
    print(f"\n检查任务状态: {task_id}")
    
    # 定义要测试的端点
    endpoints = [
        f"https://api.stability.ai/v2beta/stable-image/edit/replace-background-and-relight/result/{task_id}",
        f"https://api.stability.ai/v2beta/stable-image/result/{task_id}",
        f"https://api.stability.ai/v2beta/generation/status/{task_id}",
        f"https://api.stability.ai/v2beta/generation/image-to-image/result/{task_id}"
    ]
    
    # 尝试所有端点
    for endpoint in endpoints:
        try:
            print(f"\n尝试端点: {endpoint}")
            
            # 首先尝试获取JSON响应
            headers = {
                "authorization": f"Bearer {API_KEY}",
                "accept": "application/json"
            }
            
            response = requests.get(endpoint, headers=headers)
            print(f"状态码: {response.status_code}")
            
            if response.status_code == 200:
                print("✓ 任务已完成!")
                
                # 检测内容类型
                content_type = response.headers.get('Content-Type', '')
                print(f"内容类型: {content_type}")
                
                if 'application/json' in content_type:
                    try:
                        result = response.json()
                        print("响应数据:", json.dumps(result, indent=2))
                    except:
                        print("无法解析JSON响应")
                elif 'image/' in content_type:
                    # 直接保存图片
                    save_image(response.content, task_id)
                else:
                    # 尝试作为图片保存
                    if response.content and len(response.content) > 1000:  # 可能是二进制图片数据
                        save_image(response.content, task_id)
                        print("已尝试将响应作为图片保存")
                    else:
                        # 显示内容
                        if len(response.content) > 100:
                            print(f"响应内容: {response.content[:100]}... (截断)")
                        else:
                            print(f"响应内容: {response.content}")
                
                # 如果是JSON响应但没有获取到图片，尝试以图片格式再次请求
                if 'application/json' in content_type and 'image/' not in content_type:
                    print("\n尝试以图片格式请求...")
                    img_headers = {
                        "authorization": f"Bearer {API_KEY}",
                        "accept": "image/png,image/*"
                    }
                    try:
                        img_response = requests.get(endpoint, headers=img_headers)
                        if img_response.status_code == 200 and 'image/' in img_response.headers.get('Content-Type', ''):
                            save_image(img_response.content, f"{task_id}_direct")
                    except Exception as e:
                        print(f"以图片格式请求出错: {str(e)}")
                
                break
            elif response.status_code == 202:
                print("任务仍在处理中...")
                try:
                    result = response.json()
                    print("响应数据:", json.dumps(result, indent=2))
                except:
                    print("响应不是JSON格式")
                break
            else:
                print(f"响应内容: {response.text}")
                
        except Exception as e:
            print(f"尝试端点 {endpoint} 失败: {str(e)}")
    
    print("\n状态检查完成。如果任务仍在处理中，请稍后再次检查。")

def save_image(image_data, task_id):
    """保存图片数据到文件"""
    filename = f"result_{task_id}.png"
    with open(filename, 'wb') as f:
        f.write(image_data)
    print(f"✓ 图片已保存到: {os.path.abspath(filename)}")

def check_specific_task():
    """检查特定任务ID的状态（从命令行参数获取）"""
    if len(sys.argv) < 2:
        print("请提供要检查的任务ID作为命令行参数")
        print("用法: python test-python.py [task_id]")
        return
    
    task_id = sys.argv[1]
    print(f"正在检查指定任务ID: {task_id}")
    check_status(task_id)

if __name__ == "__main__":
    if len(sys.argv) > 1:
        check_specific_task()
    else:
        test_api() 