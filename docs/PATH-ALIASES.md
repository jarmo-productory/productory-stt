# Path Aliases in Next.js

This document explains how path aliases are configured in this Next.js application.

## Configuration Files

Path aliases are configured in multiple files to ensure they work correctly in different environments:

1. **tsconfig.json** - For TypeScript compilation
2. **jsconfig.json** - For JavaScript/IDE support
3. **next.config.js** - For Next.js build process

## Current Configuration

All files use the `@/*` pattern to map to the root directory of the project. This means:

```javascript
// Instead of this:
import { Button } from '../../components/ui/button';

// You can write this:
import { Button } from '@/components/ui/button';
```

## Common Import Patterns

Here are some common import patterns used in the project:

- UI Components: `@/components/ui/[component-name]`
- App Components: `@/app/components/[component-name]`
- Contexts: `@/contexts/[context-name]`
- Utilities: `@/utils/[utility-name]`
- Types: `@/types/[type-name]`

## Troubleshooting

If you encounter issues with path aliases:

1. Ensure both `tsconfig.json` and `jsconfig.json` have the correct path configuration
2. Restart your development server
3. Clear the `.next` cache folder
4. Run the path alias check script: `node scripts/check-path-aliases.js`

## Deployment Considerations

When deploying to Render or other platforms:

1. Make sure the build process includes both configuration files
2. The `jsconfig.json` file is particularly important for some build environments
3. If you encounter "Cannot find module" errors, check that path aliases are being resolved correctly 