import {createServer} from 'node:http';
import {createBridgeHandler} from './handler.mjs';
import {createSupabaseAdapter} from './supabase.mjs';

const env=process.env;
const configured=Boolean(env.SUPABASE_URL&&env.SUPABASE_SERVICE_ROLE_KEY&&env.DEVICE_ID&&env.DEVICE_HMAC_SECRET?.length>=32);
const adapter=configured?createSupabaseAdapter(env.SUPABASE_URL,env.SUPABASE_SERVICE_ROLE_KEY):null;
const server=createServer(createBridgeHandler({adapter,deviceId:env.DEVICE_ID,secret:env.DEVICE_HMAC_SECRET,production:env.NODE_ENV==='production'}));
server.requestTimeout=10000;
server.headersTimeout=10000;
server.listen(env.PORT===undefined?3001:Number(env.PORT),'0.0.0.0',()=>console.log(JSON.stringify({event:'listening',port:server.address().port})));
for(const signal of ['SIGTERM','SIGINT'])process.once(signal,()=>server.close());
