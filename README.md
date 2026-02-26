# API-Doc-Sync

[![npm version](https://badge.fury.io/js/api-doc-sync.svg)](https://www.npmjs.com/package/api-doc-sync)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

> OpenAPI/Swagger documentation automation tool - Generate Markdown documentation from OpenAPI specifications and sync to GitHub automatically.

## Features

- ✅ **OpenAPI 3.0 & Swagger 2.0** - Support for both specifications
- ✅ **Multiple Formats** - Markdown, HTML, PDF output
- ✅ **GitHub Integration** - Automatic sync with GitHub repositories
- ✅ **Version Management** - Track API changes with version tags
- ✅ **CLI Tool** - Easy-to-use command-line interface
- ✅ **Custom Templates** - Use Handlebars templates for customization
- ✅ **Multi-language** - English and Chinese documentation support

## Installation

### Global Install

```bash
npm install -g api-doc-sync
```

### Local Install

```bash
npm install --save-dev api-doc-sync
```

## Quick Start

### 1. Initialize Configuration

```bash
api-doc-sync init
```

This will guide you through setting up:
- OpenAPI spec path or URL
- Output directory
- Output format
- GitHub integration (optional)

### 2. Generate Documentation

```bash
api-doc-sync generate
```

### 3. Sync to GitHub (Coming Soon)

```bash
api-doc-sync sync
```

## Usage

### CLI Commands

#### `api-doc-sync init`

Initialize api-doc-sync in your project.

```bash
api-doc-sync init
```

#### `api-doc-sync generate`

Generate documentation from OpenAPI spec.

```bash
api-doc-sync generate
```

Options:
- `-i, --input <path>` - OpenAPI spec path or URL
- `-o, --output <dir>` - Output directory
- `-f, --format <format>` - Output format (markdown, html, pdf)
- `-c, --config <path>` - Path to config file

Example:
```bash
api-doc-sync generate -i ./openapi.yaml -o ./docs -f markdown
```

#### `api-doc-sync sync`

Sync documentation to GitHub. (Coming in Phase 3)

#### `api-doc-sync diff`

Show changes between API versions. (Coming in Phase 4)

### Configuration File

Create a `api-doc-sync.config.yml` file:

```yaml
input: ./openapi.yaml
output: ./docs
format: markdown
language: en

github:
  token: YOUR_GITHUB_TOKEN
  owner: your-username
  repo: your-repo
  branch: main
  path: docs
  createPR: true
```

## Output Structure

Generated documentation structure:

```
docs/
├── README.md           # Main documentation
├── API.md              # API reference
├── Schemas.md          # Data schemas
├── Users.md            # Tag-specific docs (if tags exist)
├── Posts.md            # Tag-specific docs (if tags exist)
└── .generation-summary.json
```

## GitHub Actions Integration

Create `.github/workflows/api-doc-sync.yml`:

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
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'

      - name: Install api-doc-sync
        run: npm install -g api-doc-sync

      - name: Generate Documentation
        run: api-doc-sync generate

      - name: Sync to GitHub
        run: api-doc-sync sync
        env:
          GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

## Roadmap

### Phase 1 ✅ (Current)
- [x] CLI framework
- [x] OpenAPI/Swagger parser
- [x] Markdown documentation generation
- [x] Init and generate commands

### Phase 2 🚧 (In Progress)
- [ ] Custom template support
- [ ] Multi-language docs (EN/CN)
- [ ] Better error handling

### Phase 3 📋 (Planned)
- [ ] GitHub API integration
- [ ] Auto-sync to GitHub
- [ ] Pull Request creation
- [ ] Webhook notifications

### Phase 4 📋 (Planned)
- [ ] Version management
- [ ] Change tracking
- [ ] Changelog generation
- [ ] Breaking change detection

### Phase 5 📋 (Planned)
- [ ] HTML generation
- [ ] PDF export
- [ ] Postman collection generation
- [ ] Test case generation

### Phase 6 📋 (Planned)
- [ ] GitHub Actions templates
- [ ] Enhanced CI/CD integration
- [ ] Performance optimization
- [ ] Unit tests (>80% coverage)

## Contributing

Contributions are welcome! Please read [CONTRIBUTING.md](CONTRIBUTING.md) for details.

## License

MIT © [斯克鲁奇](https://github.com/Agolid)

## Links

- [GitHub Repository](https://github.com/Agolid/api-doc-sync)
- [NPM Package](https://www.npmjs.com/package/api-doc-sync)
- [OpenAPI Specification](https://swagger.io/specification/)
- [Issues](https://github.com/Agolid/api-doc-sync/issues)

---

Made with ❤️ by [斯克鲁奇](https://github.com/Agolid)
