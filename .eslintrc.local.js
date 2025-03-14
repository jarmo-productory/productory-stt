// Local development ESLint configuration
// This extends the main configuration but disables stricter rules for local development
// To use: npx eslint --config .eslintrc.local.js <files>

module.exports = {
  // Extend the main ESLint configuration
  extends: ['./.eslintrc.js'],
  
  // Override rules to be more lenient for local development
  rules: {
    // Disable TypeScript strict rules
    '@typescript-eslint/no-explicit-any': 'off',
    '@typescript-eslint/no-non-null-assertion': 'off',
    '@typescript-eslint/explicit-function-return-type': 'off',
    '@typescript-eslint/strict-boolean-expressions': 'off',
    '@typescript-eslint/no-unnecessary-condition': 'off',
    
    // Disable import rules
    'import/no-duplicates': 'off',
    'import/order': 'off',
    'import/no-cycle': 'off',
    'import/no-self-import': 'off',
    
    // Disable unused imports/vars rules
    'unused-imports/no-unused-imports': 'off',
    'unused-imports/no-unused-vars': 'off',
  }
}; 