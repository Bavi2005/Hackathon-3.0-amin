import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createHmac,randomBytes} from 'node:crypto';
import {verifySignature} from '../apps/api/security.mjs';
import {freshness,available} from '../packages/contracts/freshness.ts';

test('signed ingestion authenticates exact body and credential',()=>{
 const secret=randomBytes(32).toString('hex'),timestamp=String(Date.now()),body='{"occupied":2}';
 const signature=createHmac('sha256',secret).update(`${timestamp}.${body}`).digest('hex');
 assert.equal(verifySignature(body,timestamp,signature,secret),true);
 assert.equal(verifySignature(body+' ',timestamp,signature,secret),false);
 assert.equal(verifySignature(body,timestamp,signature,randomBytes(32).toString('hex')),false);
});
test('signed ingestion refuses expired and malformed authentication',()=>{
 const secret=randomBytes(32).toString('hex'),now=Date.now(),timestamp=String(now-60001),body='{}';
 const signature=createHmac('sha256',secret).update(`${timestamp}.${body}`).digest('hex');
 assert.equal(verifySignature(body,timestamp,signature,secret,now),false);
 for(const malformed of [undefined,'','g'.repeat(64),'a'.repeat(63),'a'.repeat(66),[signature],123])assert.equal(verifySignature(body,String(now),malformed,secret,now),false);
 assert.equal(verifySignature(body,String(now),signature,'',now),false);
 assert.equal(verifySignature(body,'abc',signature,secret,now),false);
});
test('parking count inconsistencies are unknown rather than clamped into plausible availability',()=>{
 const now=Date.parse('2026-10-19T08:00:00Z'),at='2026-10-19T08:00:00Z';
 for(const [capacity,occupied]of [[40,null],[40,41],[40,-1],[40,NaN],[0,0],[Infinity,0]])assert.equal(available(capacity,occupied,at,now),null);
});
test('parking turns unknown after TTL rather than showing stale free count',()=>{
 const now=Date.parse('2026-10-19T08:00:00Z');
 assert.equal(available(40,12,'2026-10-19T08:00:00Z',now),28);
 assert.equal(available(40,12,'2026-10-19T07:57:59Z',now),null);
 assert.equal(available(40,12,null,now),null);
});
test('freshness distinguishes delayed observations and invalid future time',()=>{
 const now=Date.parse('2026-10-19T08:00:00Z');
 assert.equal(freshness('2026-10-19T07:59:29Z',now),'delayed');
 assert.equal(freshness('2026-10-19T08:02:00Z',now),'unknown');
 assert.equal(freshness('not-a-date',now),'unknown');
 assert.equal(freshness('2026-10-19T07:59:00Z',now,60000),'delayed');
 assert.equal(freshness('2026-10-19T07:58:59Z',now,60000),'unknown');
});
