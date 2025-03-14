module.exports = {
  extends: [
    "next/core-web-vitals"
  ],
  rules: {
    // Disable TypeScript strict rules
    "@typescript-eslint/no-explicit-any": "off",
    "@typescript-eslint/no-unused-vars": "off",
    "@typescript-eslint/no-non-null-assertion": "off",
    "@typescript-eslint/explicit-function-return-type": "off",
    "@typescript-eslint/strict-boolean-expressions": "off",
    "@typescript-eslint/no-unnecessary-condition": "off",
    
    // Disable React strict rules
    "react-hooks/rules-of-hooks": "warn",
    "react-hooks/exhaustive-deps": "off",
    "react/no-unescaped-entities": "off",
    "react/jsx-no-comment-textnodes": "off",
    
    // Disable import rules
    "import/no-duplicates": "off",
    "import/order": "off",
    "import/no-cycle": "off",
    "import/no-self-import": "off"
  },
  ignorePatterns: [
    "node_modules/",
    ".next/",
    "out/",
    "build/",
    "public/",
    "**/*.test.ts",
    "**/*.test.tsx",
    "**/*.spec.ts",
    "**/*.spec.tsx",
    "**/__tests__/",
    "**/__mocks__/",
    "scripts/",
    "lib/utils/"
  ]
}; 