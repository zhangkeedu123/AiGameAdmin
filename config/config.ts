import { defineConfig } from '@umijs/max';

process.env.PORT ||= '8001';
process.env.HOST ||= '127.0.0.1';

const target = process.env.AIGAME_API_TARGET || 'http://127.0.0.1:8000';
export default defineConfig({
  antd: {},
  title: '碎片复原师 · 运营管理',
  npmClient: 'npm',
  routes: [{ path: '/*', component: '@/pages/index' }],
  proxy: Object.fromEntries(['/admin', '/api', '/health'].map(path => [path, { target, changeOrigin: true }])),
});
