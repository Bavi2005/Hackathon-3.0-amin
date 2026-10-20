import {defineConfig} from '@playwright/test';
const setupOnly=process.env.SMARTTOWNSHIP_E2E_MODE==='setup';
const contractOnly=process.env.SMARTTOWNSHIP_E2E_MODE==='contract';
if(!setupOnly&&!contractOnly&&(!process.env.SUPABASE_URL||!process.env.SUPABASE_PUBLISHABLE_KEY||!process.env.DEMO_PASSWORD||!['test','development'].includes(process.env.APP_ENV??'')||process.env.DEMO_SEED_ACK!=='fictional-data-only'))throw Error('Hosted E2E requires the dedicated demo environment and seeded fixture; use test:e2e:setup for unconfigured UI tests');
export default defineConfig({
 testDir:'tests/e2e',testMatch:setupOnly?'setup.spec.ts':contractOnly?['contract.spec.ts','administration.spec.ts','parking.spec.ts','mobility.spec.ts','privacy-analytics.spec.ts','platform-public.spec.ts']:'hosted.spec.ts',workers:1,timeout:120000,expect:{timeout:20000},
 outputDir:setupOnly?'test-results/setup':contractOnly?'test-results/contract':'test-results/hosted',
 use:{baseURL:'http://127.0.0.1:5174',...(process.env.PLAYWRIGHT_CHANNEL?{channel:process.env.PLAYWRIGHT_CHANNEL}:{}),trace:'off',screenshot:'off',video:'off'},
 webServer:process.env.SMARTTOWNSHIP_E2E_EXTERNAL_SERVER==='1'?undefined:{command:'npm run build:web && npm run preview',url:'http://127.0.0.1:5174',reuseExistingServer:false,env:{VITE_SUPABASE_URL:setupOnly?'':process.env.SUPABASE_URL!,VITE_SUPABASE_PUBLISHABLE_KEY:setupOnly?'':process.env.SUPABASE_PUBLISHABLE_KEY!}},
 reporter:'list'
});
