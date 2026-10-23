export type IconName='home'|'ride'|'visitor'|'parking'|'user'|'shield'|'forms'|'settings'|'chart'|'globe'|'audit'|'arrow'|'refresh'|'pin'|'clock'|'logout'|'more'|'check'|'spark'|'ticket'|'chevron';
const paths:Record<IconName,string>={
 home:'m3 10 9-7 9 7v10a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1Z',
 ride:'M5 16h14V6a3 3 0 0 0-3-3H8a3 3 0 0 0-3 3Zm0-7h14M8 16v3m8-3v3M8 12h.01M16 12h.01M8 21h8',
 visitor:'M15 21H3v-2a6 6 0 0 1 12 0M13 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0m4 3 2 2 3-4',
 parking:'M9 18V6h4a4 4 0 0 1 0 8H9M5 2h14a3 3 0 0 1 3 3v14a3 3 0 0 1-3 3H5a3 3 0 0 1-3-3V5a3 3 0 0 1 3-3',
 user:'M20 21a8 8 0 0 0-16 0M16 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0',
 shield:'m12 3 8 3v6c0 5-8 9-8 9s-8-4-8-9V6Zm-4 9 3 3 5-6',
 forms:'M8 3H5v18h14V3h-3M8 2h8v4H8Zm0 9h8m-8 4h5',
 settings:'M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8M12 2v3m0 14v3M2 12h3m14 0h3M5 5l2 2m10 10 2 2M5 19l2-2M17 7l2-2',
 chart:'M4 3v18h17M9 16v-4m5 4V7m5 9V4',
 globe:'M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0M3 12h18M12 3c-5 5-5 13 0 18 5-5 5-13 0-18',
 audit:'M8 3H4v18h16V3h-4M8 2h8v4H8Zm0 9h8m-8 4h8',
 arrow:'M4 12h16m-6-6 6 6-6 6',refresh:'M20 7v5h-5M4 17v-5h5M5 8a8 8 0 0 1 14-3l1 2M4 17l1 2a8 8 0 0 0 14-3',
 pin:'M19 10c0 5-7 11-7 11S5 15 5 10a7 7 0 0 1 14 0m-5 0a2 2 0 1 1-4 0 2 2 0 0 1 4 0',
 clock:'M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0M12 7v5l3 2',logout:'M9 4H4v16h5m5-13 5 5-5 5m-6-5h11',
 more:'M5 12h.01M12 12h.01M19 12h.01',check:'m5 12 4 4L19 6',spark:'m12 2 3 7 7 3-7 3-3 7-3-7-7-3 7-3Z',
 ticket:'M3 5h18v5a2 2 0 0 0 0 4v5H3v-5a2 2 0 0 0 0-4Zm12 1v2m0 3v2m0 3v2',chevron:'m9 5 7 7-7 7'
};
export function Icon({name,className=''}:{name:IconName;className?:string}){return <svg className={`icon ${className}`} width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={paths[name]}/></svg>;}
