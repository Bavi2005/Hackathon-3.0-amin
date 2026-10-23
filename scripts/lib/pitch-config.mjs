export function pitchConfig(env){
 if(!['test','development'].includes(env.APP_ENV)||env.DEMO_SEED_ACK!=='fictional-data-only'||env.DEMO_MODE!=='true')throw Error('Pitch data requires APP_ENV=test/development, DEMO_SEED_ACK=fictional-data-only and DEMO_MODE=true');
 const {SUPABASE_URL:url,SUPABASE_PUBLISHABLE_KEY:key,SUPABASE_SERVICE_ROLE_KEY:serviceKey,DEMO_PASSWORD:password}=env;
 if(!url||!key||!serviceKey||!password||password.length<16)throw Error('Configure dedicated development Supabase credentials and a demo password of at least 16 characters; do not paste secrets into chat');
 let parsed;try{parsed=new URL(url);}catch{throw Error('Invalid Supabase project URL; value suppressed');}
 if(parsed.protocol!=='https:'||parsed.username||parsed.password||parsed.search||parsed.hash||parsed.pathname!=='/')throw Error('Use a bare HTTPS Supabase project origin');
 return{url:parsed.origin,key,serviceKey,password};
}
export function assertPitchTarget(fixture,config,tenant,overview){
 if(fixture.projectUrl!==config.url||fixture.tenants?.[0]?.tenantId!==tenant?.id||tenant?.demo!==true||overview?.simulation_enabled!==true)throw Error('Pitch target mismatch or database demonstration mode disabled; no scenario data written');
}
