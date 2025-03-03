#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

// Component types
const TYPES = {
  UI: 'ui',
  APP: 'app',
  FEATURE: 'feature'
};

// Template path
const TEMPLATE_PATH = path.join(__dirname, '..', 'templates', 'component-template.tsx');

// Function to create the component
async function createComponent() {
  try {
    // Check if template exists
    if (!fs.existsSync(TEMPLATE_PATH)) {
      console.error('Error: Component template not found at:', TEMPLATE_PATH);
      process.exit(1);
    }

    // Get component type
    const componentType = await new Promise(resolve => {
      rl.question(`Select component type:
1. UI component (/components/ui/) - for ShadCN components
2. App component (/app/components/) - for app-wide components
3. Feature component (/app/[feature]/components/) - for feature-specific components
Enter number (1-3): `, answer => {
        switch (answer.trim()) {
          case '1': return resolve(TYPES.UI);
          case '2': return resolve(TYPES.APP);
          case '3': return resolve(TYPES.FEATURE);
          default: 
            console.error('Invalid selection. Please enter 1, 2, or 3.');
            process.exit(1);
        }
      });
    });

    // If UI component, recommend using ShadCN CLI
    if (componentType === TYPES.UI) {
      const useCliResponse = await new Promise(resolve => {
        rl.question('It\'s recommended to use ShadCN CLI for UI components. Continue with manual creation? (y/n): ', answer => {
          return resolve(answer.trim().toLowerCase());
        });
      });

      if (useCliResponse === 'n') {
        console.log('Please use "npx shadcn@latest add <component-name>" instead.');
        process.exit(0);
      }
    }

    // Get component name
    const componentName = await new Promise(resolve => {
      rl.question('Enter component name (PascalCase for app/feature, lowercase for UI): ', answer => {
        if (!answer.trim()) {
          console.error('Component name cannot be empty');
          process.exit(1);
        }
        return resolve(answer.trim());
      });
    });

    // For feature components, get the feature name
    let featureName = '';
    if (componentType === TYPES.FEATURE) {
      featureName = await new Promise(resolve => {
        rl.question('Enter feature name (e.g., dashboard, folders): ', answer => {
          if (!answer.trim()) {
            console.error('Feature name cannot be empty');
            process.exit(1);
          }
          return resolve(answer.trim());
        });
      });
    }

    // Determine the target directory and filename
    let targetDir, filename;
    switch (componentType) {
      case TYPES.UI:
        targetDir = path.join(process.cwd(), 'components', 'ui');
        filename = `${componentName.toLowerCase()}.tsx`;
        break;
      case TYPES.APP:
        targetDir = path.join(process.cwd(), 'app', 'components');
        filename = `${componentName}.tsx`;
        break;
      case TYPES.FEATURE:
        targetDir = path.join(process.cwd(), 'app', featureName, 'components');
        filename = `${componentName}.tsx`;
        break;
    }

    // Create directory if it doesn't exist
    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true });
    }

    // Read template
    const templateContent = fs.readFileSync(TEMPLATE_PATH, 'utf8');

    // Replace template placeholders
    let componentContent = templateContent.replace(/ComponentName/g, componentName);

    // Write the component file
    const componentPath = path.join(targetDir, filename);
    fs.writeFileSync(componentPath, componentContent);

    console.log(`✅ Component ${componentName} created successfully at ${componentPath}`);
  } catch (error) {
    console.error('Error creating component:', error);
  } finally {
    rl.close();
  }
}

// Run the function
createComponent(); 