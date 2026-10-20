import js from '@eslint/js';
import ts from 'typescript-eslint';
export default ts.config({ignores:['**/dist/**','node_modules/**','.npm-cache/**','.local/**','**/.env*','Laundrov2/**','test-results/**']},js.configs.recommended,...ts.configs.recommended,{files:['**/*.mjs','**/*.js'],languageOptions:{globals:{process:'readonly',Buffer:'readonly',URL:'readonly',console:'readonly',setTimeout:'readonly',clearTimeout:'readonly',fetch:'readonly',AbortSignal:'readonly'}}});
