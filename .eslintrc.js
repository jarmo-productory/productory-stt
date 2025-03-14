module.exports = {
  extends: [
    "next/core-web-vitals",
    "plugin:import/recommended",
    "plugin:import/typescript",
    "plugin:@typescript-eslint/recommended"
  ],
  plugins: [
    "import",
    "@typescript-eslint",
    "unused-imports"
  ],
  rules: {
    "react/no-unescaped-entities": "off",
    "@typescript-eslint/no-unused-vars": "off",
    "unused-imports/no-unused-imports": "warn",
    "unused-imports/no-unused-vars": [
      "warn",
      { 
        vars: "all", 
        varsIgnorePattern: "^_", 
        args: "after-used", 
        argsIgnorePattern: "^_" 
      }
    ],
    "@typescript-eslint/no-explicit-any": "warn",
    "react-hooks/rules-of-hooks": "warn",
    "react/jsx-no-comment-textnodes": "warn",
    
    // Strict null checking rules
    "@typescript-eslint/no-non-null-assertion": "warn",
    "@typescript-eslint/explicit-function-return-type": ["warn", {
      allowExpressions: true,
      allowTypedFunctionExpressions: true,
      allowHigherOrderFunctions: true
    }],
    "@typescript-eslint/strict-boolean-expressions": "off",
    "@typescript-eslint/no-unnecessary-condition": "off",
    
    // Import path rules
    "import/no-duplicates": "warn",
    "import/order": [
      "warn",
      {
        groups: ["builtin", "external", "internal", "parent", "sibling", "index"],
        pathGroups: [
          {
            pattern: "react",
            group: "builtin",
            position: "before"
          },
          {
            pattern: "next/**",
            group: "builtin",
            position: "before"
          },
          {
            pattern: "@/components/ui/**",
            group: "internal",
            position: "before"
          },
          {
            pattern: "@/app/components/**",
            group: "internal",
            position: "after"
          }
        ],
        pathGroupsExcludedImportTypes: ["react"],
        alphabetize: {
          order: "asc",
          caseInsensitive: true
        }
      }
    ],
    "import/no-cycle": "warn",
    "import/no-self-import": "warn"
  },
  settings: {
    "import/resolver": {
      typescript: {
        alwaysTryTypes: true
      }
    }
  },
  ignorePatterns: [
    "node_modules/",
    ".next/",
    "**/.next/**",
    "public/"
  ]
}; 