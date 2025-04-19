#!/usr/bin/env python3

import requests
import os
import json
import base64
import time

API_KEY = 'sk-5eV9DDMJPgl1CMwjvz6MBpkMFrDDnCwbFHsgL8s4k7eILVMN'
IMAGE_PATH = "uploads/123.png"  # 相对于项目根目录的路径

def test_api_direct():
    """直接测试API并等待结果，使用同步方式"""
    print("开始直接测试 Stability AI 背景替换 API...")
    
    # 检查图片是否存在
    if not os.path.exists(IMAGE_PATH):
        print(f"错误: 图片不存在: {IMAGE_PATH}")
        return
    
    print(f"使用图片: {os.path.abspath(IMAGE_PATH)}")
    print(f"图片大小: {os.path.getsize(IMAGE_PATH) / 1024:.2f} KB")
    
    # 提交任务
    try:
        print("\n提交背景替换任务...")
        
        # 准备请求参数 - 添加更多API支持的参数
        data = {
            # 必需参数
            "background_prompt": "pure white background, studio lighting, professional portrait photography",
            
            # 可选参数 - 使用数字而不是字符串
            "foreground_prompt": "person, portrait, face detail, high quality, detailed",
            "negative_prompt": "blurry, distorted, low quality, noise",
            "preserve_original_subject": 0.7,  # 0-1, 默认0.6
            "original_background_depth": 0.5,  # 0-1, 默认0.5
            "keep_original_background": "false",
            "light_source_direction": "above",   # above, below, left, right
            "light_source_strength": 0.4,      # 0-1, 默认0.3
            "seed": 0,                         # 0-4294967294, 默认0=随机
            "output_format": "png",              # jpeg, png, webp
        }
        
        response = requests.post(
            "https://api.stability.ai/v2beta/stable-image/edit/replace-background-and-relight",
            headers={
                "authorization": f"Bearer {API_KEY}",
                "accept": "application/json",
                # 可选的客户端标识
                "stability-client-id": "photocalory-test-app",
                "stability-client-version": "1.0.0"
            },
            files={
                "subject_image": open(IMAGE_PATH, "rb")
            },
            data=data
        )
        
        print(f"提交状态码: {response.status_code}")
        
        if response.status_code != 200:
            print(f"任务提交失败: {response.text}")
            return
        
        # 提取任务ID
        result = response.json()
        print("提交响应:", json.dumps(result, indent=2))
        
        if 'id' not in result:
            print("错误: 响应中没有任务ID")
            return
        
        task_id = result['id']
        print(f"任务ID: {task_id}")
        
        # 轮询检查任务状态
        max_attempts = 30
        interval_seconds = 10  # 根据API文档，不要超过每10秒一次
        
        print(f"\n开始轮询任务状态，最多 {max_attempts} 次，间隔 {interval_seconds} 秒")
        print("注意: API文档建议轮询间隔不小于10秒，以避免限流")
        
        # 修正端点名称: 使用正确的单数形式 "result" 而不是 "results"
        result_endpoint = f"https://api.stability.ai/v2beta/stable-image/edit/replace-background-and-relight/result/{task_id}"
        print(f"使用正确的结果端点: {result_endpoint}")
        
        for attempt in range(1, max_attempts + 1):
            print(f"\n轮询 {attempt}/{max_attempts}...")
            time.sleep(interval_seconds)
            
            print(f"检查端点: {result_endpoint}")
            
            try:
                # 尝试以图片格式获取结果
                headers = {
                    "authorization": f"Bearer {API_KEY}",
                    "accept": "image/png,image/*,*/*"  # 优先接收图片格式
                }
                
                result_response = requests.get(result_endpoint, headers=headers)
                status_code = result_response.status_code
                
                print(f"状态码: {status_code}")
                
                if status_code == 200:
                    # 检查内容类型
                    content_type = result_response.headers.get('Content-Type', '')
                    print(f"内容类型: {content_type}")
                    
                    if 'image/' in content_type:
                        # 保存图片
                        filename = f"result_direct_{task_id}.png"
                        with open(filename, 'wb') as f:
                            f.write(result_response.content)
                        print(f"\n✓ 成功! 图片已保存到: {os.path.abspath(filename)}")
                        return
                    
                    # 可能是JSON响应，包含base64编码的图片
                    try:
                        json_result = result_response.json()
                        print("JSON响应:", json.dumps(json_result, indent=2))
                        
                        # 检查是否有图片数据
                        if 'artifacts' in json_result:
                            for i, artifact in enumerate(json_result['artifacts']):
                                if 'base64' in artifact:
                                    # 解码并保存图片
                                    image_data = base64.b64decode(artifact['base64'])
                                    filename = f"result_direct_{task_id}_{i}.png"
                                    with open(filename, 'wb') as f:
                                        f.write(image_data)
                                    print(f"\n✓ 成功! 图片已保存到: {os.path.abspath(filename)}")
                                    return
                    except Exception as e:
                        print(f"解析JSON响应时出错: {str(e)}")
                
                elif status_code == 202:
                    # 202表示任务被接受但尚未完成处理
                    print("任务仍在处理中... (202 Accepted)")
                    try:
                        json_result = result_response.json()
                        print("状态响应:", json.dumps(json_result, indent=2))
                    except:
                        pass
                
                elif status_code == 404:
                    # 404可能表示任务仍在排队或处理中
                    print("任务可能仍在排队或处理中... (404 Not Found)")
                
                else:
                    print(f"请求失败 ({status_code}): {result_response.text}")
                    
            except Exception as e:
                print(f"检查任务状态时出错: {str(e)}")
            
            print(f"任务仍在处理中... ({attempt}/{max_attempts})")
        
        print("\n达到最大尝试次数，但任务仍未完成。")
        print("您可以稍后使用以下命令检查结果:")
        print(f"python backend/scripts/download-result.py {task_id}")
        
    except Exception as e:
        print(f"发生错误: {str(e)}")

if __name__ == "__main__":
    test_api_direct() 