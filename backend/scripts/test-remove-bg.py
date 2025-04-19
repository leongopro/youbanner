#!/usr/bin/env python3

import requests
import os
import json
import base64
import time
import sys

API_KEY = 'sk-5eV9DDMJPgl1CMwjvz6MBpkMFrDDnCwbFHsgL8s4k7eILVMN'
IMAGE_PATH = "uploads/123.png"  # 相对于项目根目录的路径

def test_remove_background():
    """测试 Stability AI 移除背景 API"""
    print("开始测试 Stability AI 移除背景 API...")
    
    # 检查图片是否存在
    if not os.path.exists(IMAGE_PATH):
        print(f"错误: 图片不存在: {IMAGE_PATH}")
        return
    
    print(f"使用图片: {os.path.abspath(IMAGE_PATH)}")
    print(f"图片大小: {os.path.getsize(IMAGE_PATH) / 1024:.2f} KB")
    
    # 提交任务
    try:
        print("\n提交移除背景任务...")
        print("请耐心等待，API处理可能需要一些时间...")
        
        # 准备请求参数
        files = {
            "image": open(IMAGE_PATH, "rb")
        }
        
        data = {
            "output_format": "png"  # 支持 png, jpg, webp
        }
        
        # 设置超时（连接超时和读取超时）
        timeout = (10, 60)  # 连接10秒超时，读取60秒超时
        
        response = requests.post(
            "https://api.stability.ai/v2beta/stable-image/edit/remove-background",
            headers={
                "authorization": f"Bearer {API_KEY}",
                "accept": "image/*",  # 修复accept头
                "stability-client-id": "photocalory-test-app"
            },
            files=files,
            data=data,
            timeout=timeout
        )
        
        print(f"响应状态码: {response.status_code}")
        print(f"响应内容类型: {response.headers.get('Content-Type', '未知')}")
        
        if response.status_code == 200:
            # 这个API同步返回结果，不需要轮询
            content_type = response.headers.get('Content-Type', '')
            
            if 'image/' in content_type:
                # 保存图片
                filename = "result_remove_bg.png"
                with open(filename, 'wb') as f:
                    f.write(response.content)
                print(f"\n✓ 成功! 图片已保存到: {os.path.abspath(filename)}")
                
                # 提取原始文件名（不含扩展名）并添加时间戳
                import datetime
                now = datetime.datetime.now().strftime('%Y%m%d%H%M%S')
                base_filename = os.path.splitext(os.path.basename(IMAGE_PATH))[0]
                final_filename = f"{base_filename}_nobg_{now}.png"
                
                # 复制一份到更有意义的文件名
                import shutil
                shutil.copy(filename, final_filename)
                print(f"✓ 图片已复制到: {os.path.abspath(final_filename)}")
            else:
                # 可能是错误消息
                try:
                    error_info = response.json()
                    print(f"错误: {json.dumps(error_info, indent=2)}")
                except:
                    print(f"未知响应: {response.text[:200]}...")
        else:
            print(f"任务失败: {response.text}")
    
    except requests.exceptions.Timeout:
        print("错误: 请求超时。API服务器响应时间过长。")
        print("您可以稍后再试，或者检查网络连接状况。")
        
    except requests.exceptions.ConnectionError:
        print("错误: 连接错误。无法连接到API服务器。")
        print("请检查网络连接是否正常，或者API服务器是否可用。")
            
    except Exception as e:
        print(f"发生错误: {str(e)}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    test_remove_background() 