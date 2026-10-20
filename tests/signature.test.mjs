import {it,expect} from 'vitest';
import {createHmac} from 'node:crypto';
import {verifySignature} from '../apps/api/security.mjs';
it('accepts exact signed body and rejects forgery, expiry, malformed signatures and absent configuration',()=>{
 const secret='unit-test-only-not-a-device-credential',body='{"occupied":2}',timestamp='1792396800000';
 const signature=createHmac('sha256',secret).update(`${timestamp}.${body}`).digest('hex');
 expect(verifySignature(body,timestamp,signature,secret,Number(timestamp))).toBe(true);
 expect(verifySignature(body+' ',timestamp,signature,secret,Number(timestamp))).toBe(false);
 expect(verifySignature(body,timestamp,signature,secret,Number(timestamp)+60001)).toBe(false);
 expect(verifySignature(body,timestamp,'zz',secret,Number(timestamp))).toBe(false);
 expect(verifySignature(body,timestamp,signature,'',Number(timestamp))).toBe(false);
});
