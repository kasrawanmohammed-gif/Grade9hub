import firebaseRulesPlugin from '@firebase/eslint-plugin-security-rules';

export default [
  {
    ignores: ['dist/**/*', 'node_modules/**/*', 'data/**/*', 'uploads/**/*'],
  },
  firebaseRulesPlugin.configs['flat/recommended'],
];
