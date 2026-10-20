import {openDatabase} from './lib/postgres.mjs';
// Database and environment guards run before connecting. This tool is for a dedicated dev project only.
if (process.env.DEMO_MODE !== 'true') throw Error('Explicit DEMO_MODE=true is required to enable database simulators');
const db = await openDatabase();
try {
  await db.query('update private.runtime_settings set environment=$1, simulations_enabled=true where singleton=true', [process.env.APP_ENV]);
  console.log('Dedicated development database simulators enabled. No SMS or external devices connected.');
} finally { await db.end(); }
