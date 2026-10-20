// New Supabase API keys are opaque, not JWTs. Only JWTs belong in Bearer headers.
export function supabaseHeaders(apiKey,token){
 const opaque=typeof apiKey==='string'&&apiKey.startsWith('sb_');
 const bearer=token===apiKey&&opaque?null:(token??(opaque?null:apiKey));
 if(bearer?.startsWith('sb_'))throw Error('An opaque Supabase API key cannot be used as a user JWT');
 return{apikey:apiKey,...(bearer?{Authorization:`Bearer ${bearer}`}:{})};
}
