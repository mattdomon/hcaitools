# Ralph 快速入门指南

## 第一步：创建您的第一个 PRD

创建文件 `prd.json`：

```json
{
  "title": "My First Feature",
  "branchName": "feature/my-first-feature",
  "userStories": [
    {
      "id": "1",
      "title": "Create a Hello World component",
      "description": "Create a simple React component that displays 'Hello, World!'",
      "acceptanceCriteria": "Component renders correctly and displays the text",
      "priority": "high",
      "passes": false
    },
    {
      "id": "2", 
      "title": "Add styling to component",
      "description": "Add basic CSS styling to make the component visually appealing",
      "acceptanceCriteria": "Component has centered text with nice colors",
      "priority": "medium",
      "passes": false
    }
  ]
}
```

## 第二步：初始化 git

```bash
cd /Users/hc/Desktop/manus-clone
git add prd.json
git commit -m "Initial PRD for my first feature"
```

## 第三步：运行 Ralph

使用默认的 Amp 工具（10 次迭代）：
```bash
./scripts/ralph/ralph.sh
```

或指定迭代次数：
```bash
./scripts/ralph/ralph.sh 5
```

或使用 Claude Code：
```bash
./scripts/ralph/ralph.sh --tool claude 10
```

## 预期的工作流

1. Ralph 会创建一个特性分支
2. 选择第一个未完成的故事
3. 生成新的 AI 实例来实现它
4. 运行质量检查
5. 如果成功，提交更改
6. 标记故事为 `passes: true`
7. 重复下一个故事

## 查看进度

```bash
# 查看哪些故事已完成
cat prd.json | jq '.userStories[] | {id, title, passes}'

# 查看学习笔记
cat progress.txt

# 查看 git 历史
git log --oneline
```

## 提示

- 保持每个故事简单（1-2 小时的工作）
- 确保您有有效的质量检查命令（测试、类型检查等）
- 检查 `scripts/ralph/prompt.md` 并根据您的项目进行自定义
- 查看 `ralph/` 子文件夹中的完整 README 了解更多详情

## 故障排除

如果 Ralph 没有运行任何东西：
- 确认 `prd.json` 存在且格式正确
- 确认已安装 Amp CLI (`which amp`) 或 Claude Code
- 检查 git 已初始化和配置
- 查看是否有错误消息或检查 `progress.txt`
