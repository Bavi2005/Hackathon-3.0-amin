import {readFile,readdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {openDatabase} from './lib/postgres.mjs';
const db=await openDatabase();
try{
 await db.query('select pg_advisory_lock(174260319)');
 await db.query("create schema if not exists private; create table if not exists private.schema_migrations(version text primary key,sha256 text not null,applied_at timestamptz not null default now()); alter table private.schema_migrations enable row level security; revoke all on private.schema_migrations from public,anon,authenticated");
 const files=(await readdir('supabase/migrations')).filter(name=>/^\d+_.*\.sql$/.test(name)).sort();
 for(const file of files){
  const sql=await readFile(`supabase/migrations/${file}`,'utf8'),hash=createHash('sha256').update(sql).digest('hex');
  const previous=await db.query('select sha256 from private.schema_migrations where version=$1',[file]);
  if(previous.rowCount){if(previous.rows[0].sha256!==hash)throw Error(`Previously applied migration changed: ${file}. Use an additive correction.`);console.log(`Already applied ${file}`);continue;}
  await db.query('begin');
  try{await db.query(sql);await db.query('insert into private.schema_migrations(version,sha256) values($1,$2)',[file,hash]);await db.query('commit');console.log(`Applied ${file}`);}
  catch(error){await db.query('rollback');throw Error(`Migration failed: ${file} (${error.code??'unknown'}). Transaction rolled back; no automatic reset performed.`);}
 }
 console.log('Hosted development migrations complete. Run database and real-account tests before use.');
}finally{await db.end();}
