# Linting and Code Quality Setup

This document explains the linting and code quality tools set up in this project and how to use them effectively.

## Overview

We use several tools to ensure code quality:

- **ESLint**: For static code analysis
- **TypeScript**: For type checking
- **Prettier**: For code formatting
- **Husky**: For Git hooks
- **lint-staged**: For running linters on staged files
- **GitHub Actions**: For CI/CD checks

## Local Development

### IDE Setup

For the best development experience, we recommend using VS Code with the following extensions:

- ESLint
- Prettier
- TypeScript
- Tailwind CSS IntelliSense

The project includes VS Code settings that will:

- Format code on save using Prettier
- Run ESLint fixes on save
- Use the workspace TypeScript version

### Pre-commit Checks

When you commit code, Husky will automatically run:

1. **lint-staged**: Runs ESLint and Prettier on staged files
2. **TypeScript**: Checks for type errors

If any of these checks fail, the commit will be aborted.

### Running Checks Manually

You can run these checks manually with the following commands:

```bash
# Standard linting
npm run lint

# Strict linting (no warnings allowed)
npm run lint:strict

# Fix linting issues automatically
npm run lint:fix

# Type checking
npm run typecheck

# Run tests
npm run test
```

## Common Issues and Solutions

### Unused Variables and Imports

TypeScript is configured to report errors for unused variables and imports. To fix these:

- Remove unused variables and imports
- If you need to declare a variable but not use it, prefix it with an underscore: `_unusedVar`

### Any Type

The `any` type is disallowed in this project. Instead:

- Use proper type definitions
- Use `unknown` for values of uncertain type, then narrow the type
- Use type assertions when necessary

### Unescaped Entities

React requires certain characters to be escaped in JSX. Use the following:

- `&quot;` or `&ldquo;` for `"`
- `&apos;` or `&lsquo;` for `'`
- `&amp;` for `&`
- `&lt;` for `<`
- `&gt;` for `>`

## CI/CD Pipeline

Our GitHub Actions workflow runs the following checks on pull requests:

1. Linting with strict rules
2. Format checking with Prettier
3. Type checking
4. Tests
5. Dependency checking

All these checks must pass before a pull request can be merged.

## Best Practices

1. **Run linting locally** before pushing changes
2. **Fix warnings**, not just errors
3. **Use proper types** instead of `any`
4. **Keep dependencies updated**
5. **Write tests** for new features 