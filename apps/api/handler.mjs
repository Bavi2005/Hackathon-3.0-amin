import {randomUUID} from 'node:crypto';
import {parkingEvent} from '../../packages/contracts/parking-event.ts';
import {verifySignature} from './security.mjs';

export function createBridgeHandler({adapter,deviceId,secret,production=false,now=Date.now,limit=120}) {
  let windowStart=0,count=0;
  return async(req,res)=>{
    const correlationId=randomUUID();
    res.setHeader('Content-Type','application/json');
    res.setHeader('Cache-Control','no-store');
    res.setHeader('X-Content-Type-Options','nosniff');
    res.setHeader('Strict-Transport-Security','max-age=31536000');
    const send=(status,code)=>{res.writeHead(status);res.end(JSON.stringify({code,correlationId}));};
    if(req.url==='/healthz'&&req.method==='GET')return send(200,'ALIVE');
    if(req.url==='/readyz'&&req.method==='GET'){
      if(!adapter)return send(503,'NOT_CONFIGURED');
      try{return(await adapter.ready(deviceId))?send(200,'READY'):send(503,'DEPENDENCY_UNAVAILABLE');}
      catch{return send(503,'DEPENDENCY_UNAVAILABLE');}
    }
    if(req.url!=='/v1/iot/events'||req.method!=='POST')return send(404,'NOT_FOUND');
    if(production&&req.headers['x-forwarded-proto']!=='https')return send(400,'HTTPS_REQUIRED');
    if(!adapter)return send(503,'NOT_CONFIGURED');
    if(now()-windowStart>=60000){windowStart=now();count=0;}
    if(++count>limit){res.setHeader('Retry-After','60');return send(429,'RATE_LIMITED');}
    if(!/^application\/json(?:\s*;|$)/i.test(req.headers['content-type']??''))return send(415,'JSON_REQUIRED');
    const chunks=[];let size=0;
    try{
      for await(const chunk of req.iterator({destroyOnReturn:false})){
        size+=chunk.length;
        if(size>4096){req.resume();return send(413,'BODY_TOO_LARGE');}
        chunks.push(chunk);
      }
    }catch{return send(400,'INVALID_REQUEST');}
    const raw=Buffer.concat(chunks).toString('utf8');
    if(!verifySignature(raw,req.headers['x-timestamp'],req.headers['x-signature'],secret,now()))return send(401,'INVALID_SIGNATURE');
    let parsed;
    try{parsed=parkingEvent.safeParse(JSON.parse(raw));}catch{return send(400,'INVALID_EVENT');}
    if(!parsed.success)return send(400,'INVALID_EVENT');
    if(parsed.data.deviceId!==deviceId)return send(403,'DEVICE_SCOPE');
    try{return(await adapter.ingest(parsed.data))?send(202,'ACCEPTED'):send(409,'EVENT_REJECTED');}
    catch{return send(503,'DEPENDENCY_UNAVAILABLE');}
  };
}
