<div align="center">

# 📄 API-Doc-Sync

**OpenAPI / Swagger 文档自动化工具**

从 OpenAPI 规范生成 Markdown / HTML 文档，并自动同步到 GitHub 仓库。

[![CI](https://github.com/Agolid/API-Doc-Sync/actions/workflows/build.yml/badge.svg)](https://github.com/Agolid/API-Doc-Sync/actions)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

[功能特性](#-功能特性) · [快速开始](#-快速开始) · [命令参考](#-命令参考) · [配置文件](#-配置文件) · [GitHub 集成](#-github-集成) · [作为库使用](#-作为库使用)

</div>

---

## ✨ 功能特性

- **OpenAPI 3.0 & Swagger 2.0** — 完整支持两种规范
- **多格式输出** — Markdown 和 HTML 格式
- **GitHub 集成** — 自动同步文档到 GitHub 仓库，支持直接推送或创建 PR
- **版本对比** — 检测 API 规范变更，生成 diff 报告
- **规范校验** — 验证 OpenAPI / Swagger 规范的正确性
- **实时监听** — 监听 spec 文件变化，自动重新生成文档
- **多语言** — 支持英文和中文文档生成
- **自定义模板** — 使用 Handlebars 模板定制文档样式

## 📦 安装

> ⚠️ 尚未发布到 npm，敬请期待。

```bash
# TODO: npm publish 后可用
npm install -g api-doc-sync
```

## 🚀 快速开始

```bash
# 1. 初始化项目配置
api-doc-sync init

# 2. 生成文档（Markdown 格式）
api-doc-sync generate -i ./openapi.yaml -o ./docs

# 3. 生成 HTML 文档
api-doc-sync generate -i ./openapi.yaml -o ./docs-html -f html

# 4. 同步到 GitHub
api-doc-sync sync --create-pr
```

生成的文档结构：

```
docs/
├── README.md               # 主文档
├── API.md                  # API 参考
├── Schemas.md              # 数据模型
├── Users.md                # 按标签分组的文档
├── Posts.md
└── .generation-summary.json
```

## 📖 命令参考

### `init`

交互式初始化项目配置文件。

```bash
api-doc-sync init
```

### `generate`

从 OpenAPI 规范生成文档。

```bash
api-doc-sync generate [options]
```

| 选项 | 简写 | 默认值 | 说明 |
|------|------|--------|------|
| `--input <path>` | `-i` | — | OpenAPI 规范文件路径或 URL |
| `--output <dir>` | `-o` | — | 输出目录 |
| `--format <format>` | `-f` | `markdown` | 输出格式：`markdown`、`html`、`pdf` |
| `--config <path>` | `-c` | — | 配置文件路径 |
| `--language <lang>` | `-l` | `en` | 文档语言：`en`、`zh` |
| `--no-version` | — | — | 跳过版本保存 |

示例：

```bash
# 使用 URL 作为输入
api-doc-sync generate -i https://petstore.swagger.io/v2/swagger.yaml -o ./docs

# 生成中文 HTML 文档
api-doc-sync generate -i ./openapi.yaml -o ./docs -f html -l zh

# 使用配置文件
api-doc-sync generate -c ./api-doc-sync.config.yml
```

### `sync`

将生成的文档同步到 GitHub 仓库。

```bash
api-doc-sync sync [options]
```

| 选项 | 简写 | 说明 |
|------|------|------|
| `--config <path>` | `-c` | 配置文件路径 |
| `--message <text>` | `-m` | 提交信息 |
| `--branch <name>` | `-b` | 目标分支 |
| `--create-pr` | — | 创建 Pull Request（默认） |
| `--no-create-pr` | — | 直接推送到目标分支 |

### `diff`

比较两个版本的 OpenAPI 规范差异。

```bash
api-doc-sync diff [options]
```

| 选项 | 简写 | 说明 |
|------|------|------|
| `--config <path>` | `-c` | 配置文件路径 |
| `--version1 <version>` | `-v1` | 第一个版本 |
| `--version2 <version>` | `-v2` | 第二个版本 |
| `--output <dir>` | `-o` | 输出目录 |

### `validate`

验证 OpenAPI / Swagger 规范文件的正确性。

```bash
api-doc-sync validate [spec-path] [options]
```

| 选项 | 简写 | 说明 |
|------|------|------|
| `spec-path` | — | 规范文件路径（可选） |
| `--config <path>` | `-c` | 配置文件路径 |

### `watch`

监听输入文件变化，自动重新生成文档。

```bash
api-doc-sync watch [options]
```

| 选项 | 简写 | 说明 |
|------|------|------|
| `--input <path>` | `-i` | OpenAPI 规范文件路径或 URL |
| `--output <dir>` | `-o` | 输出目录 |
| `--config <path>` | `-c` | 配置文件路径 |
| `--language <lang>` | `-l` | 文档语言：`en`、`zh` |

## ⚙️ 配置文件

创建 `api-doc-sync.config.yml`：

```yaml
# OpenAPI 规范路径（本地文件或 URL）
input: ./openapi.yaml

# 输出目录
output: ./docs

# 输出格式：markdown | html | pdf
format: markdown

# 文档语言：en | zh
language: en

# GitHub 同步配置（可选）
github:
  token: ${GITHUB_TOKEN}     # 建议使用环境变量
  owner: your-username
  repo: your-repo
  branch: main
  path: docs                  # 仓库中的文档路径
  createPR: true              # 创建 PR 而非直接推送
```

## 🔗 GitHub 集成

### 直接推送模式

```bash
api-doc-sync sync --no-create-pr
```

文档将直接推送到配置的目标分支。

### Pull Request 模式

```bash
api-doc-sync sync --create-pr
```

将文档推送到一个新分支，并自动创建 Pull Request，便于审查。

### GitHub Actions 示例

```yaml
name: API Documentation Sync

on:
  push:
    paths:
      - 'api-spec/**'
    branches: [main]

jobs:
  sync-docs:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: '20'

      - run: npm install -g api-doc-sync
      - run: api-doc-sync generate
      - run: api-doc-sync sync --create-pr
        env:
          GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

## 📚 作为库使用

```typescript
import { OpenAPIParser, DocGenerator } from 'api-doc-sync';

// 解析 OpenAPI 规范
const parser = new OpenAPIParser('./openapi.yaml');
const spec = await parser.parse();

// 生成文档
const generator = new DocGenerator({
  output: './docs',
  format: 'markdown',
  language: 'en'
});

await generator.generate(spec);
```

## 🛠️ 开发

```bash
# 克隆仓库
git clone https://github.com/Agolid/API-Doc-Sync.git
cd API-Doc-Sync

# 安装依赖
npm install

# 构建
npm run build

# 测试
npm test

# 本地链接（开发调试）
npm link
```

## 📄 License

MIT © [Agolid](https://github.com/Agolid)
