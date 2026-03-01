# Contributing to API-Doc-Sync

Thank you for your interest in contributing to API-Doc-Sync! This document provides guidelines and instructions for contributing.

## Code of Conduct

By participating in this project, you agree to maintain a respectful and inclusive environment for all contributors.

## How to Contribute

### Reporting Bugs

Before creating bug reports, please check the existing issues to avoid duplicates. When creating a bug report:

- Use a clear and descriptive title
- Describe the exact steps to reproduce the problem
- Provide specific examples to demonstrate the steps
- Describe the behavior you observed and what you expected
- Include environment details (OS, Node.js version, etc.)

### Suggesting Enhancements

Enhancement suggestions are tracked as GitHub issues. When suggesting an enhancement:

- Use a clear and descriptive title
- Provide a detailed description of the proposed enhancement
- Explain why this enhancement would be useful
- Provide examples of how the enhancement would be used

### Pull Requests

1. **Fork the repository** and create your branch from `master`
2. **Make your changes** with clear, descriptive commit messages
3. **Run tests** to ensure your changes don't break existing functionality
4. **Run linting** to ensure code quality
5. **Update documentation** if your changes affect usage
6. **Submit a pull request** with a clear description of your changes

## Development Setup

```bash
# Clone your fork
git clone https://github.com/YOUR-USERNAME/API-Doc-Sync.git
cd API-Doc-Sync

# Install dependencies
npm install

# Run tests
npm test

# Run linter
npm run lint

# Build the project
npm run build
```

## Coding Standards

- Follow existing code style and conventions
- Write clear, self-documenting code
- Add comments for complex logic
- Keep functions focused and single-purpose
- Write tests for new features

## Commit Messages

Follow conventional commit format:

```
type(scope): description

[optional body]

[optional footer]
```

Types: `feat`, `fix`, `docs`, `style`, `refactor`, `test`, `chore`

Example:
```
feat(parser): add support for JSON schema validation

- Implement schema validation
- Add error handling for invalid schemas
- Update unit tests
```

## Testing

- Write unit tests for new features
- Ensure all tests pass before submitting PR
- Aim for good test coverage
- Test on Node.js 18.x and 20.x

## Release Process

Releases are created via GitHub Actions when a new tag is pushed:

```bash
# Create and push a new tag
git tag -a v1.0.0 -m "Release v1.0.0"
git push origin v1.0.0
```

This will:
- Run all tests
- Build the project
- Publish to npm
- Create a GitHub Release

## Questions?

Feel free to open an issue with the "question" label for any questions or clarifications.
