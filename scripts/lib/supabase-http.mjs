import {supabaseHeaders} from '../../apps/api/headers.mjs';
export function supabaseHttp(baseUrl,apiKey,token){
  const base=new URL(baseUrl);
  if(base.protocol!=='https:'&&!(base.protocol==='http:'&&['localhost','127.0.0.1'].includes(base.hostname)))throw Error('HTTPS required outside localhost');
  return async(path,{method='GET',body,headers={}}={})=>{
    const response=await fetch(new URL(path,base),{
      method,redirect:'error',headers:{...supabaseHeaders(apiKey,token),'Content-Type':'application/json',...headers},
      ...(body===undefined?{}:{body:JSON.stringify(body)}),signal:AbortSignal.timeout(15000)
    });
    const raw=await response.text();
    let data;
    try{data=raw?JSON.parse(raw):null;}catch{throw Error('Supabase returned a non-JSON response');}
    return{status:response.status,data};
  };
}
export async function required(request,path,options){
  const result=await request(path,options);
  if(result.status>=400)throw Error(`Supabase request failed (${result.status}, ${result.data?.code??'unknown'}); response contents suppressed`);
  return result.data;
}
