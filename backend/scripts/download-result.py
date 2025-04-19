#!/usr/bin/env python3

import requests
import os
import json
import time
import sys
import base64

API_KEY = 'sk-5eV9DDMJPgl1CMwjvz6MBpkMFrDDnCwbFHsgL8s4k7eILVMN'

def download_result(task_id):
    """尝试下载任务结果并保存为图片"""
    print(f"尝试下载任务ID {task_id} 的结果...")
    
    # 定义正确的结果端点 - 使用单数形式 "result" 而不是 "results"
    result_endpoint = f"https://api.stability.ai/v2beta/stable-image/edit/replace-background-and-relight/result/{task_id}"
    
    print(f"\n尝试从 {result_endpoint} 下载图片...")
    
    # 直接请求图片数据
    headers = {
        "authorization": f"Bearer {API_KEY}",
        "accept": "image/png,image/*,*/*",
        "stability-client-id": "photocalory-test-app",
        "stability-client-version": "1.0.0"
    }
    
    try:
        response = requests.get(result_endpoint, headers=headers)
        print(f"状态码: {response.status_code}")
        
        if response.status_code == 200:
            # 检测是否是图片
            content_type = response.headers.get('Content-Type', '')
            print(f"内容类型: {content_type}")
            
            if 'image/' in content_type:
                # 直接保存图片内容
                print("收到图片数据，正在保存...")
                filename = f"result_{task_id}.png"
                with open(filename, 'wb') as f:
                    f.write(response.content)
                print(f"✓ 成功! 图片已保存到: {os.path.abspath(filename)}")
                return True
            else:
                # 可能是JSON响应，包含base64编码的图片
                try:
                    result = response.json()
                    print("得到JSON响应:", json.dumps(result, indent=2))
                    
                    # 检查是否有图片数据
                    if 'artifacts' in result:
                        print(f"找到 {len(result['artifacts'])} 个生成结果")
                        for i, artifact in enumerate(result['artifacts']):
                            if 'base64' in artifact:
                                print(f"处理第 {i+1} 个结果...")
                                image_data = base64.b64decode(artifact['base64'])
                                filename = f"result_{task_id}_{i}.png"
                                with open(filename, 'wb') as f:
                                    f.write(image_data)
                                print(f"✓ 成功! 图片已保存到: {os.path.abspath(filename)}")
                                return True
                        
                        if len(result['artifacts']) > 0:
                            print("警告: 响应中有结果，但没有找到base64图片数据")
                    else:
                        print("警告: JSON响应中没有找到'artifacts'字段")
                
                except Exception as e:
                    print(f"解析JSON响应时出错: {str(e)}")
                    if len(response.content) > 100:
                        print(f"响应内容前100字节: {response.content[:100]}")
                    else:
                        print(f"响应内容: {response.content}")
        
        elif response.status_code == 202:
            # 202表示任务被接受但尚未完成处理
            print("任务仍在处理中... (202 Accepted)")
            try:
                result = response.json()
                print("状态信息:", json.dumps(result, indent=2))
            except:
                print("无法解析状态信息")
        
        elif response.status_code == 404:
            # 404可能表示任务仍在排队或处理中
            print("任务可能仍在排队或处理中... (404 Not Found)")
            try:
                print(f"响应内容: {response.text}")
            except:
                pass
        
        else:
            print(f"请求失败 ({response.status_code}): {response.text}")
    
    except Exception as e:
        print(f"尝试获取结果时出错: {str(e)}")
    
    print("\n无法获取结果，可能任务仍在处理中。")
    return False

def monitor_task(task_id, max_attempts=10, interval=10):
    """持续监控任务直到完成或达到最大尝试次数"""
    print(f"开始监控任务 {task_id}...")
    print(f"注意: 根据API文档，轮询间隔建议不小于10秒，以避免限流")
    
    for attempt in range(1, max_attempts + 1):
        print(f"\n尝试 {attempt}/{max_attempts}...")
        
        if download_result(task_id):
            print("✓ 任务已完成，并成功下载结果!")
            return True
        
        if attempt < max_attempts:
            print(f"等待 {interval} 秒后重试...")
            time.sleep(interval)
    
    print(f"\n达到最大尝试次数 ({max_attempts})，任务可能仍在处理中。")
    print("您可以稍后再次运行此脚本，或检查Stability AI仪表板。")
    return False

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("请提供要下载的任务ID")
        print("用法: python download-result.py <task_id> [max_attempts] [interval]")
        sys.exit(1)
    
    task_id = sys.argv[1]
    max_attempts = int(sys.argv[2]) if len(sys.argv) > 2 else 10
    interval = int(sys.argv[3]) if len(sys.argv) > 3 else 10
    
    monitor_task(task_id, max_attempts, interval) 