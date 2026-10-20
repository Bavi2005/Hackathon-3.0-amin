import {defineConfig} from 'vitest/config';
export default defineConfig({test:{maxWorkers:2,include:['tests/contracts.test.ts','tests/visitor-records.test.ts','tests/visitor-forms.test.ts','tests/parking-overview.test.ts','tests/dispatch-simulation.test.ts','tests/signature.test.mjs']}});
