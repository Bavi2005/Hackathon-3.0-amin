import {createHmac,timingSafeEqual} from 'node:crypto';
export function verifySignature(body,timestamp,signature,secret,now=Date.now()){
 if(typeof body!=='string'||typeof secret!=='string'||!secret||typeof timestamp!=='string'||typeof signature!=='string'||!/^\d{13}$/.test(timestamp)||Math.abs(now-Number(timestamp))>60000||! /^[a-f0-9]{64}$/.test(signature))return false;
 const expected=createHmac('sha256',secret).update(`${timestamp}.${body}`).digest();
 return timingSafeEqual(expected,Buffer.from(signature,'hex'));
}
