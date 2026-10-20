import {test} from 'node:test';
import assert from 'node:assert/strict';
import {supabaseHeaders} from '../apps/api/headers.mjs';
import {databaseOptions} from '../scripts/lib/postgres.mjs';
import {readTap} from '../scripts/lib/tap.mjs';
import {expectSqlRejection} from '../scripts/lib/expect-rejection.mjs';
const env={APP_ENV:'test',DEMO_SEED_ACK:'fictional-data-only',SUPABASE_DB_URL:'postgresql://postgres:fixture-only@database.example.test:5432/postgres?sslmode=require'};
test('hosted migration/test configuration enforces certificate validation',async()=>{
 const config=await databaseOptions(env);
 assert.equal(config.ssl.rejectUnauthorized,true);
 assert.equal(new URL(config.connectionString).searchParams.has('sslmode'),false);
 assert.equal(config.connectionTimeoutMillis,10000);
});
test('hosted database helpers reject insecure transport and production targets',async()=>{
 await assert.rejects(()=>databaseOptions({...env,APP_ENV:'production'}),/dedicated development/);
 await assert.rejects(()=>databaseOptions({...env,SUPABASE_DB_URL:undefined}),/SUPABASE_DB_URL/);
 await assert.rejects(()=>databaseOptions({...env,SUPABASE_DB_URL:env.SUPABASE_DB_URL.replace('require','disable')}),/Insecure/);
 await assert.rejects(()=>databaseOptions({...env,SUPABASE_DB_URL:'https://example.test'}),/PostgreSQL/);
 await assert.rejects(()=>databaseOptions({...env,SUPABASE_DB_URL:'postgresql://postgres:fixture-only@aws-0-example.pooler.supabase.com:6543/postgres'}),/session pooler/);
});
test('pgTAP result parser never counts missing, failed, skipped or partial tests as passing',()=>{
 const result=(...lines)=>({rows:lines.map(line=>({test:line}))});
 assert.equal(readTap([result('1..2'),result('ok 1 - scope'),result('ok 2 - replay')]).passed,true);
 for(const rows of [result(),result('1..2','ok 1'),result('1..1','not ok 1 - isolation'),result('1..1','ok 1 # SKIP missing service'),result('1..1','ok 1 # TODO fix'),result('1..1','1..1','ok 1')])assert.equal(readTap(rows).passed,false);
});
test('malformed database connection strings are suppressed rather than printed with passwords',async()=>{
 await assert.rejects(()=>databaseOptions({...env,SUPABASE_DB_URL:'not a valid connection string fixture-password'}),error=>!error.message.includes('fixture-password')&&error.message.includes('malformed'));
});
test('opaque publishable/secret keys use apikey header and user JWT remains separate',()=>{
 assert.deepEqual(supabaseHeaders('sb_publishable_fixture'),{apikey:'sb_publishable_fixture'});
 assert.deepEqual(supabaseHeaders('sb_secret_fixture','sb_secret_fixture'),{apikey:'sb_secret_fixture'});
 assert.deepEqual(supabaseHeaders('sb_publishable_fixture','user-jwt-fixture'),{apikey:'sb_publishable_fixture',Authorization:'Bearer user-jwt-fixture'});
 assert.deepEqual(supabaseHeaders('legacy-jwt-fixture'),{apikey:'legacy-jwt-fixture',Authorization:'Bearer legacy-jwt-fixture'});
 assert.throws(()=>supabaseHeaders('sb_publishable_fixture','sb_secret_other'),/cannot be used/);
});
test('authorization tests cannot pass on server outages, missing endpoints or expired authentication',()=>{
 expectSqlRejection({status:403,data:{code:'42501'}});
 expectSqlRejection({status:400,data:{code:'P0001',message:'Vehicle full'}},'P0001','Vehicle full');
 for(const result of [{status:500,data:{code:'42501'}},{status:404,data:{code:'PGRST202'}},{status:401,data:{code:'PGRST301'}},{status:403,data:{code:'PGRST301'}}])assert.throws(()=>expectSqlRejection(result));
});
