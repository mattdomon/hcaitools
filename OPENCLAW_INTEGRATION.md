# OpenClaw 集成指南

## 概述

OpenClaw 是 hcaitools (Manus AI 平台) 的客户端执行库，允许 Manus 代理在本地机器上执行任务，包括浏览器自动化、代码执行和文件操作。

## 核心组件

### 1. OpenClaw Client (US-APPS-003)
**作用:** 与 Manus 云服务通信的主客户端库

**提供的功能:**
- REST API 客户端（使用 API 密钥认证）
- WebSocket 双向通信
- 任务队列管理
- 健康检查与自动恢复
- 本地资源监控

**支持的语言:**
- Python 3.7+
- JavaScript/Node.js 14+

**基本使用:**
```python
from openclaw import ManusClient

# 初始化客户端
client = ManusClient(api_key="your-api-key")

# 接收任务
while True:
    task = client.get_task()
    result = execute_task(task)
    client.upload_result(task.id, result)
```

### 2. Local Runtime (US-APPS-004)
**作用:** 在本地机器上执行代码任务

**支持的运行时:**
- Node.js (npm, yarn 支持)
- Python (pip, conda 支持)

**功能特性:**
- 虚拟环境隔离
- 资源限制 (CPU, 内存)
- 超时设置
- 输出流式处理
- 错误捕获与日志

**使用场景:**
- 数据处理和转换
- 本地 API 测试
- 脚本执行
- 报告生成

### 3. Local Browser Control (US-APPS-005)
**作用:** 控制本地浏览器实例进行自动化

**支持的浏览器:**
- Chrome/Chromium
- Microsoft Edge
- Brave Browser

**功能特性:**
- 浏览器配置持久化（保留 cookies、扩展）
- 多标签页导航
- DOM 操作与 JavaScript 注入
- 元素检查与截图
- 鼠标/键盘模拟
- 会话状态管理

**使用场景:**
- 网站自动化填表
- 数据爬取
- 用户界面测试
- 复杂工作流自动化

### 4. Local File Operations (US-APPS-006)
**作用:** 安全地访问和处理本地文件

**支持的操作:**
- 读写文件
- 目录操作
- 文件权限���理
- 批量操作
- 文件监控
- 压缩/解压

**安全特性:**
- 沙箱隔离
- 路径限制
- 权限检查
- 隔离文件处理

**使用场景:**
- 数据文件处理
- 报告生成
- 本地数据集成
- 文件格式转换

## 架构流程

```
┌─────────────────────────────────────────┐
│      Manus Cloud Platform               │
│  (Web App Builder, Brain, Agent)        │
└────────────────┬────────────────────────┘
                 │ API / WebSocket
                 │
        ┌────────▼─────────┐
        │  OpenClaw Client │
        └────────┬─────────┘
                 │
    ┌────────────┼────────────┐
    │            │            │
    ▼            ▼            ▼
┌────────┐  ┌────────────┐  ┌──────────┐
│ Local  │  │   Local    │  │  Local   │
│Runtime │  │  Browser   │  │  Files   │
└────────┘  └────────────┘  └──────────┘
   Node.js        Chrome         /home
   Python         Edge           /data
```

## 配置和安装

### Python 客户端安装
```bash
pip install openclaw-client
```

### Node.js 客户端安装
```bash
npm install @openclaw/client
```

### 配置 API 密钥
```bash
# 设置环境变量
export MANUS_API_KEY="your-api-key-here"

# 或创建配置文件 ~/.openclaw/config.json
{
  "api_key": "your-api-key",
  "api_url": "https://api.manus.im",
  "max_concurrent_tasks": 4,
  "resource_limits": {
    "max_cpu_percent": 80,
    "max_memory_mb": 2048,
    "task_timeout_seconds": 3600
  }
}
```

## 安全最佳实践

### 1. API 密钥管理
- ✅ 使用环境变量存储 API 密钥
- ✅ 定期轮换 API 密钥
- ❌ 不要在代码中硬编码密钥
- ❌ 不要提交密钥到版本控制

### 2. 文件操作安全
- ✅ 限制文件访问路径
- ✅ 检查文件权限
- ✅ 使用隔离沙箱
- ❌ 不要允许任意文件删除

### 3. 浏览器自动化安全
- ✅ 使用独立浏览器配置
- ✅ 清理敏感数据
- ✅ 验证脚本来源
- ❌ 不要在生产环境使用不受信任的脚本

## 常见用例

### 用例 1：数据处理管道
```python
from openclaw import ManusClient

client = ManusClient()

# 接收数据处理任务
task = client.get_task()

# 读取本地数据
with open(f"/data/{task.data_file}") as f:
    data = json.load(f)

# 本地处理
processed = process_data(data)

# 保存结果
with open(f"/output/{task.id}_result.json", "w") as f:
    json.dump(processed, f)

# 上传结果
client.upload_result(task.id, {"status": "complete"})
```

### 用例 2：网页自动化工作流
```javascript
const { BrowserClient } = require('@openclaw/client');

const browser = new BrowserClient({
  headless: false,
  useProfile: true
});

// 打开网页
await browser.navigate('https://example.com');

// 填表和提交
await browser.fill('input[name="email"]', 'user@example.com');
await browser.click('button[type="submit"]');

// 等待结果
await browser.waitForNavigation();

// 截图
const screenshot = await browser.screenshot();
```

### 用例 3：文件批处理
```python
from openclaw import FileClient

files = FileClient()

# 处理目录中的所有 CSV 文件
for file_path in files.list_directory('/data', pattern='*.csv'):
    data = files.read_file(file_path)
    processed = transform_csv(data)
    files.write_file(f'/output/{file_path}', processed)
```

## 故障排除

### 问题 1：无法连接到 Manus 云
**症状:** ConnectionError
**解决方案:**
1. 检查网络连接
2. 验证 API 密钥
3. 检查防火墙设置
4. 查看服务状态

### 问题 2：任务执行超时
**症状:** TaskTimeoutError
**解决方案:**
1. 增加超时时间
2. 优化任务逻辑
3. 分割大任务为小任务
4. 检查系统资源

### 问题 3：文件权限错误
**症状:** PermissionDenied
**解决方案:**
1. 检查文件权限
2. 验证路径配置
3. 确保沙箱策略允许
4. 运行必要的权限提升

## 监控和日志

### 启用详细日志
```python
import logging

logging.basicConfig(level=logging.DEBUG)
logger = logging.getLogger('openclaw')
```

### 健康检查
```python
from openclaw import ManusClient

client = ManusClient()

# 检查连接
if client.health_check():
    print("✓ 连接正常")
else:
    print("✗ 连接失败")
```

### 性能监控
```python
import psutil

# 监控 CPU 和内存
cpu_percent = psutil.cpu_percent(interval=1)
memory_info = psutil.virtual_memory()

print(f"CPU: {cpu_percent}%")
print(f"Memory: {memory_info.percent}%")
```

## 相关用户故事

- **US-APPS-003:** OpenClaw Client - 客户端库主实现
- **US-APPS-004:** Local Runtime - 代码执行运行时
- **US-APPS-005:** Local Browser - 浏览器控制
- **US-APPS-006:** Local Files - 文件操作

## 支持和文档

- 📖 完整文档：https://docs.openclaw.io
- 🐛 问题反馈：https://github.com/manusai/openclaw/issues
- 💬 社区讨论：https://github.com/manusai/openclaw/discussions
- 📧 技术支持：support@openclaw.io
