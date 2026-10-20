import assert from 'node:assert/strict';
export function expectSqlRejection(result,code='42501',message){
 const expectedStatus=code==='42501'?403:code==='23505'?409:400;
 assert.equal(result.status,expectedStatus,'expected an explicit SQL rejection, not an unavailable endpoint or server error');
 assert.equal(result.data?.code,code,'SQLSTATE must identify the expected rejection');
 if(message)assert.equal(result.data?.message,message);
}
