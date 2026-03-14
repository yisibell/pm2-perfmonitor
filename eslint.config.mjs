// eslint.config.mjs
import globals from 'globals'
import pluginJs from '@eslint/js'
import pluginNode from 'eslint-plugin-n'
import pluginImport from 'eslint-plugin-import'
import pluginPrettier from 'eslint-plugin-prettier'
import configPrettier from 'eslint-config-prettier'

export default [
  // 基础规则集（ESLint 推荐规则）
  pluginJs.configs.recommended,

  // Prettier 冲突规则关闭（必须放在其他规则集之后）
  configPrettier,

  // 通用配置：定义全局变量、注册插件
  {
    files: ['**/*.js', '**/*.cjs', '**/*.mjs'],
    languageOptions: {
      ecmaVersion: 'latest',
      globals: {
        ...globals.node,
      },
    },
    plugins: {
      n: pluginNode,
      import: pluginImport,
      prettier: pluginPrettier, // 注册 Prettier 插件
    },
    rules: {
      // 通用的质量规则
      'no-console': 'off',
      'no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],

      // 将 Prettier 格式问题以 ESLint 错误形式报告
      'prettier/prettier': 'error',
    },
  },

  // CommonJS 特定配置（针对 .js 和 .cjs）
  {
    files: ['**/*.js', '**/*.cjs'],
    languageOptions: {
      sourceType: 'commonjs',
    },
    rules: {
      // CommonJS 专用规则
      'n/no-missing-require': 'error',
      'n/no-deprecated-api': 'error',
      'n/process-exit-as-throw': 'error',

      // 导入规则（适用于 require）
      'import/first': 'error',
      'import/no-duplicates': 'error',
      'import/order': [
        'error',
        {
          groups: [
            'builtin',
            'external',
            'internal',
            'parent',
            'sibling',
            'index',
          ],
          'newlines-between': 'always',
        },
      ],
    },
  },

  // ESM 特定配置（针对 .mjs）
  {
    files: ['**/*.mjs'],
    languageOptions: {
      sourceType: 'module',
    },
    rules: {
      // ESM 专用规则
      'n/no-missing-import': 'error',
      'n/no-deprecated-api': 'error',
      'n/process-exit-as-throw': 'error',

      // ESM 导入规则
      'import/first': 'error',
      'import/no-duplicates': 'error',
      'import/order': [
        'error',
        {
          groups: [
            'builtin',
            'external',
            'internal',
            'parent',
            'sibling',
            'index',
            'object',
            'type',
          ],
          'newlines-between': 'always',
        },
      ],
    },
  },
]
