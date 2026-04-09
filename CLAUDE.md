# hcaitools - Development Guide for AI Agents

## Project Overview

This is the Manus AI Platform implementation with OpenClaw local execution system.

### Project Structure

```
src/
├── core/          # Core features (Web App Builder, Browser Operator, etc.)
├── integrations/  # Integrations (Stripe, Database, Slack, etc.)
├── tools/         # Tools (AI Design, Slides, Data Analysis, etc.)
└── common/        # Common utilities and types
tests/             # Test files
dist/              # Compiled output
docs/              # Documentation
```

### Technology Stack

- **Language**: TypeScript
- **Runtime**: Node.js
- **Framework**: Express.js
- **Testing**: Jest
- **Linting**: ESLint

### Key Commands

```bash
npm run build      # Compile TypeScript
npm run test       # Run tests
npm run lint       # Run ESLint
npm run typecheck  # Type checking
npm run dev        # Development mode
```

### Development Guidelines

1. All code must be in TypeScript
2. Follow the existing folder structure
3. Add tests for all new functionality
4. Ensure `npm run typecheck` and `npm run lint` pass
5. Write descriptive commit messages

### Important Patterns

- All source files go in `src/`
- Test files go in `tests/` with `.test.ts` suffix
- Export types and interfaces for public APIs
- Use async/await for promises
- Add JSDoc comments to functions

## Getting Started

1. Install dependencies: `npm install`
2. Build project: `npm run build`
3. Run tests: `npm run test`
4. Check types: `npm run typecheck`

## Running Quality Checks

Before committing, always run:
```bash
npm run typecheck && npm run lint && npm run test
```

This must pass for all commits.
