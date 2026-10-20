// Native HTTPS PostgREST adapter; the bridge has no third-party runtime packages.
import {supabaseHeaders} from './headers.mjs';
import {URLSearchParams} from 'node:url';
export function createSupabaseAdapter(baseUrl,serviceKey,transport=fetch){
  const base=new URL(baseUrl);
  if(base.protocol!=='https:'&&!(base.protocol==='http:'&&['127.0.0.1','localhost'].includes(base.hostname)))throw Error('Supabase requires HTTPS except on localhost');
  const headers={...supabaseHeaders(serviceKey),'Content-Type':'application/json'};
  return{
    async ready(deviceId){
      const url=new URL('/rest/v1/iot_devices',base);
      url.search=new URLSearchParams({select:'id',id:`eq.${deviceId}`,active:'eq.true',limit:'1'}).toString();
      const response=await transport(url,{headers,redirect:'error',signal:AbortSignal.timeout(5000)});
      if(!response.ok)return false;
      const rows=await response.json();
      return Array.isArray(rows)&&rows.length===1&&rows[0].id===deviceId;
    },
    async ingest(e){
      const bay=e.kind==='bay.occupancy';
      const response=await transport(new URL(bay?'/rest/v1/rpc/ingest_parking_bay':'/rest/v1/rpc/ingest_parking',base),{
        method:'POST',headers,redirect:'error',signal:AbortSignal.timeout(8000),
        body:JSON.stringify({p_device:e.deviceId,p_event:e.eventId,p_sequence:e.sequence,...(bay?{p_status:e.status}:{p_occupied:e.occupied}),p_observed:e.observedAt})
      });
      if(response.ok)return true;
      if([400,409,422].includes(response.status)){
        const error=await response.json().catch(()=>null);
        if(['P0001','23505','23514','23503','22003','22007','22023','22P02'].includes(error?.code))return false;
      }
      throw Error('Supabase unavailable');
    }
  };
}
