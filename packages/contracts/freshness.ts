export function freshness(at:string|null,now=Date.now(),ttl=120000){if(!at)return 'unknown';const age=now-Date.parse(at);return !Number.isFinite(age)||age< -30000||age>ttl?'unknown':age>30000?'delayed':'live';}
export function available(capacity:number,occupied:number|null,at:string|null,now=Date.now()){
 if(!Number.isInteger(capacity)||capacity<=0||occupied===null||!Number.isInteger(occupied)||occupied<0||occupied>capacity||freshness(at,now)==='unknown')return null;
 return capacity-occupied;
}
