import {readFile} from 'node:fs/promises';
export async function databaseOptions(env=process.env){
 if(!['test','development'].includes(env.APP_ENV)||env.DEMO_SEED_ACK!=='fictional-data-only')throw Error('Require APP_ENV=test/development and DEMO_SEED_ACK=fictional-data-only for the dedicated development database');
 if(!env.SUPABASE_DB_URL)throw Error('Set SUPABASE_DB_URL to the hosted development PostgreSQL/session-pooler connection string');
 let url;
 try{url=new URL(env.SUPABASE_DB_URL);}catch{throw Error('SUPABASE_DB_URL is malformed; connection string suppressed');}
 if(!['postgres:','postgresql:'].includes(url.protocol))throw Error('PostgreSQL connection string required');
 if(url.hostname.endsWith('.pooler.supabase.com')&&url.port==='6543')throw Error('Use the session pooler on port 5432, not the transaction pooler, for migrations and SQL tests');
 // Do not allow connection-string SSL options to replace explicit certificate verification.
 if(['disable','no-verify','prefer','allow'].includes(url.searchParams.get('sslmode')))throw Error('Insecure PostgreSQL sslmode is not supported');
 for(const key of ['sslmode','sslrootcert','sslcert','sslkey','ssl'])url.searchParams.delete(key);
 let ca=env.SUPABASE_DB_CA_PEM;
 if(env.SUPABASE_DB_CA_FILE){
  if(!/\.(crt|pem|cer)$/i.test(env.SUPABASE_DB_CA_FILE))throw Error('SUPABASE_DB_CA_FILE must be a .crt, .cer or .pem certificate');
  ca=await readFile(env.SUPABASE_DB_CA_FILE,'utf8');
 }
 return{connectionString:url.toString(),ssl:{rejectUnauthorized:true,...(ca?{ca}:{})},connectionTimeoutMillis:10000,statement_timeout:60000,application_name:'smarttownship-development-checks'};
}
export async function openDatabase(){
 const options=await databaseOptions();
 let pg;
 try{pg=await import('pg');}catch{throw Error('Install dependencies in normal PowerShell: npm.cmd install --cache .npm-cache (pg is required)');}
 const client=new pg.Client(options);
 try{await client.connect();return client;}catch(error){await client.end().catch(()=>{});throw Error(`Hosted database connection failed (${error.code??'unknown'}); certificate verification remains enabled`);}
}
