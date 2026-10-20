import {readFile,readdir} from 'node:fs/promises';
import {openDatabase} from './lib/postgres.mjs';
import {readTap} from './lib/tap.mjs';
const db=await openDatabase();
let assertions=0;
try{
 for(const file of(await readdir('supabase/tests')).filter(name=>name.endsWith('.test.sql')).sort()){
  let results;
  try{results=await db.query(await readFile(`supabase/tests/${file}`,'utf8'));}
  catch(error){await db.query('rollback');throw Error(`SQL tests failed to execute: ${file} (${error.code??'unknown'}). No pass claimed.`);}
  const tap=readTap(results);
  if(!tap.passed){for(const line of tap.failures)console.error(line);throw Error(`pgTAP failed: ${file}; expected ${tap.expected}, emitted ${tap.actual}, failing/skipped ${tap.failures.length}`);}
  assertions+=tap.actual;console.log(`PASS ${file}: ${tap.actual} actual pgTAP assertions`);
 }
 console.log(`Hosted PostgreSQL PASS: ${assertions} assertions. Fixtures were transactionally rolled back. Browser/Realtime checks remain separate.`);
}finally{await db.end();}
