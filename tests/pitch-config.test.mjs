import test from 'node:test';
import assert from 'node:assert/strict';
import {pitchConfig,assertPitchTarget} from '../scripts/lib/pitch-config.mjs';
const env={APP_ENV:'test',DEMO_SEED_ACK:'fictional-data-only',DEMO_MODE:'true',SUPABASE_URL:'https://pitch.example.test',SUPABASE_PUBLISHABLE_KEY:'nonfunctional-public-fixture',SUPABASE_SERVICE_ROLE_KEY:'nonfunctional-secret-fixture',DEMO_PASSWORD:'nonfunctional-fixture-password'};
test('pitch guard refuses production even with demo flags',()=>assert.throws(()=>pitchConfig({...env,APP_ENV:'production'}),/requires/));
test('pitch guard requires explicit acknowledgment and simulator switch',()=>{for(const key of ['DEMO_SEED_ACK','DEMO_MODE'])assert.throws(()=>pitchConfig({...env,[key]:''}),/requires/);});
test('pitch guard refuses missing credentials and short passwords without echoing values',()=>{assert.throws(()=>pitchConfig({...env,SUPABASE_SERVICE_ROLE_KEY:''}),/Configure/);assert.throws(()=>pitchConfig({...env,DEMO_PASSWORD:'short'}),/Configure/);});
test('pitch guard accepts bare HTTPS origins only',()=>{assert.equal(pitchConfig(env).url,env.SUPABASE_URL);for(const url of ['http://pitch.example.test','https://user:password@pitch.example.test','https://pitch.example.test/path','https://pitch.example.test/?secret=x'])assert.throws(()=>pitchConfig({...env,SUPABASE_URL:url}),/bare HTTPS/);});
test('pitch target refuses project/tenant mismatch, non-demo tenant and disabled database simulation',()=>{
 const fixture={projectUrl:env.SUPABASE_URL,tenants:[{tenantId:'fictional-a'}]},config=pitchConfig(env),tenant={id:'fictional-a',demo:true},overview={simulation_enabled:true};
 assert.doesNotThrow(()=>assertPitchTarget(fixture,config,tenant,overview));
 for(const args of [[{...fixture,projectUrl:'https://other.example.test'},config,tenant,overview],[fixture,config,{...tenant,id:'foreign'},overview],[fixture,config,{...tenant,demo:false},overview],[fixture,config,tenant,{simulation_enabled:false}]])assert.throws(()=>assertPitchTarget(...args),/mismatch|disabled/);
});
