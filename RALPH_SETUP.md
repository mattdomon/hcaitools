# Ralph Setup for OpenCode

Ralph 已成功安装到当前项目目录。

## 安装内容

✅ **已完成的步骤:**
- `scripts/ralph/` 目录已创建
- `ralph.sh` 脚本已复制并设置为可执行
- `prompt.md` (Amp 提示模板) 已复制
- `CLAUDE.md` (Claude Code 提示模板) 已复制
- `prd.json.example` (PRD 格式示例) 已复制到项目根目录
- 已初始化 git 仓库
- `jq` 工具已确认安装

## 目录结构

```
manus-clone/
├── scripts/
│   └── ralph/
│       ├── ralph.sh          # 主要循环脚本
│       ├── prompt.md         # Amp 提示模板
│       └── CLAUDE.md         # Claude Code 提示模板
├── tasks/                     # PRD 文档保存位置
├── prd.json.example          # PRD 格式参考
└── .git/                      # Git 仓库
```

## 使用方法

### 1. 创建 PRD (Product Requirements Document)

在当前项目中创建 `prd.json` 文件。参考 `prd.json.example` 的格式。

基本结构:
```json
{
  "title": "功能名称",
  "branchName": "feature-name",
  "userStories": [
    {
      "id": "1",
      "title": "故事标题",
      "description": "详细描述",
      "acceptanceCriteria": "验收标准",
      "passes": false
    }
  ]
}
```

### 2. 运行 Ralph

#### 使用 Amp (默认)
```bash
./scripts/ralph/ralph.sh [max_iterations]
```

#### 使用 Claude Code
```bash
./scripts/ralph/ralph.sh --tool claude [max_iterations]
```

#### 指定迭代次数
```bash
./scripts/ralph/ralph.sh 20  # 最多 20 次迭代
```

### 3. 工作流

Ralph 会:
1. 从 PRD 创建特性分支
2. 选择最高优先级且未完成的用户故事
3. 实现该故事
4. 运行质量检查 (类型检查、测试)
5. 如果检查通过则提交
6. 更新 `prd.json` 标记为 `passes: true`
7. 将学习内容追加到 `progress.txt`
8. 重复直到所有故事完成或达到最大迭代次数

## 关键文件

| 文件 | 目的 |
|------|------|
| `scripts/ralph/ralph.sh` | 生成新 AI 实例的 bash 循环 |
| `scripts/ralph/prompt.md` | 提供给每个 Amp 实例的提示 |
| `scripts/ralph/CLAUDE.md` | 提供给每个 Claude Code 实例的提示 |
| `prd.json` | 包含用户故事和 `passes` 状态的任务列表 |
| `progress.txt` | 前几次迭代的学习内容 (追加式) |
| `.git/` | 用于跟踪每次迭代的更改 |

## 自定义提示

编辑 `scripts/ralph/prompt.md` (Amp) 或 `scripts/ralph/CLAUDE.md` (Claude Code) 以针对您的项目进行定制:

- 添加项目特定的质量检查命令
- 包含代码库约定
- 添加您堆栈的常见注意事项

## 重要概念

### 每次迭代 = 新的清洁上下文

每次迭代都会生成一个**新的 AI 实例**,具有清洁的上下文。迭代之间唯一的记忆是:
- Git 历史 (前一次迭代的提交)
- `progress.txt` (学习和上下文)
- `prd.json` (哪些故事已完成)

### 小任务很关键

每个 PRD 项应该足够小,以在一个上下文窗口内完成。如果任务过大,LLM 在完成前会耗尽上下文,导致代码质量下降。

合适的故事规模:
- 添加数据库列和迁移
- 向现有页面添加 UI 组件
- 使用新逻辑更新服务器操作
- 向列表添加过滤下拉菜单

过大 (需要拆分):
- "构建整个仪表板"
- "添加身份验证"
- "重构 API"

## 调试

```bash
# 查看哪些故事已完成
cat prd.json | jq '.userStories[] | {id, title, passes}'

# 查看前一次迭代的学习
cat progress.txt

# 检查 git 历史
git log --oneline -10
```

## 更多信息

- [Ralph 项目](https://github.com/snarktank/ralph)
- [Geoffrey Huntley 的 Ralph 文章](https://ghuntley.com/ralph/)
- [Amp 文档](https://ampcode.com/manual)
- [Claude Code 文档](https://docs.anthropic.com/en/docs/claude-code)
