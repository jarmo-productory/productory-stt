# Contributing to Productory STT

Thank you for considering contributing to this project! This guide will help you understand the codebase organization and follow consistent patterns.

## Code Organization

### Component Structure

We follow a strict organization pattern for components to maintain consistency and avoid duplication:

1. **ShadCN UI Components**
   - Location: `/components/ui/`
   - Naming: lowercase, kebab-case (e.g., `button.tsx`, `card.tsx`)
   - Import: `import { Button } from "@/components/ui/button";`
   - Creation: Always use `npx shadcn@latest add <component>` when adding new ShadCN components

2. **App-wide Components**
   - Location: `/app/components/`
   - Naming: PascalCase (e.g., `AppLayout.tsx`, `Breadcrumbs.tsx`)
   - Import: `import { AppLayout } from "@/app/components/layout/AppLayout";`
   
3. **Feature-specific Components**
   - Location: `/app/[feature]/components/`
   - Naming: PascalCase (e.g., `FileManager.tsx`)
   - Import: `import { FileManager } from "@/app/dashboard/components/FileManager";`

### Creating New Components

1. Use our helper script to create components with the correct structure:
   ```bash
   npm run create-component
   ```
   
2. Follow the naming conventions strictly:
   - ShadCN UI components: lowercase, kebab-case
   - All other components: PascalCase

3. Place components in the correct location based on their usage scope

### Importing Components

Always use the correct import paths:

```typescript
// ✅ Correct imports
import { Button } from "@/components/ui/button";
import { AppLayout } from "@/app/components/layout/AppLayout";
import { FileManager } from "@/app/dashboard/components/FileManager";

// ❌ Incorrect imports
import { Button } from "@/app/components/ui/Button"; // Wrong location for ShadCN
import { appLayout } from "@/app/components/layout/appLayout"; // Wrong casing
```

## Code Style

1. Use TypeScript for all new components
2. Format code using Prettier
3. Follow ESLint rules
4. Write descriptive component props interfaces
5. Use meaningful component and variable names

## Pull Request Process

1. Create feature branches from `main`
2. Follow the conventional commit format
3. Ensure your code passes all linting checks
4. Update documentation where necessary
5. Request reviews from maintainers

## Running the Component Check

Before submitting your PR, run the component organization check:

```bash
npm run lint
```

This will identify any component import/organization issues.

By following these guidelines, you'll help maintain a consistent and maintainable codebase. Thank you for your contributions! 