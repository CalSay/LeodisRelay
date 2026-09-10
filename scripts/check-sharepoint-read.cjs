// Read-only server diagnostic. No credentials, tokens or record contents printed.
(async () => {
 const site='leodisdevelopments.sharepoint.com,7fc89dbf-9b60-4018-bb49-1bcdb28a5fd6,5213073c-845c-4e0f-aac1-a3e7e1bcfa9e';
 const drive='b!v53If2CbGEC7SRvNsopf1jwHE1JchA9OqsGj5-G8-p7bHad39Sa1RbMMg2COJDmO';
 const env=process.env;
 for(const key of ['ENTRA_TENANT_ID','ENTRA_CLIENT_ID','ENTRA_CLIENT_SECRET'])if(!env[key])throw new Error('Missing '+key);
 if(env.ENTRA_CLIENT_ID!=='495fc6e5-eae8-4fab-9b37-abd5f7e96601')throw new Error('Server client ID differs from the app granted access.');
 if(env.ENTRA_TENANT_ID!=='1431dac1-21c1-4c06-959a-9a437f51401c')throw new Error('Server tenant differs from the expected Leodis tenant.');
 const auth=await fetch(`https://login.microsoftonline.com/${env.ENTRA_TENANT_ID}/oauth2/v2.0/token`,{method:'POST',redirect:'error',signal:AbortSignal.timeout(30000),body:new URLSearchParams({client_id:env.ENTRA_CLIENT_ID,client_secret:env.ENTRA_CLIENT_SECRET,grant_type:'client_credentials',scope:'https://graph.microsoft.com/.default'})});
 if(!auth.ok)throw new Error('App authentication failed: HTTP '+auth.status);
 const token=(await auth.json()).access_token;if(!token)throw new Error('No app token returned.');
 console.log('PASS: RELAY app authentication');
 let failed=0;
 for(const [label,path] of [
 ['Operations site',`/sites/${site}?$select=id`],
 ['Project Tracker records',`/sites/${site}/lists/3e2035e6-3d28-4fe4-9e24-888ffd8e9ef4/items?$top=1&$select=id`],
 ['Client Database records',`/sites/${site}/lists/9174b22f-a49a-4a0f-9be0-ce9d70be5287/items?$top=1&$select=id`],
 ['Documents library',`/drives/${drive}?$select=id`],
 ['Tetley Hall Reports folder',`/drives/${drive}/items/01UMGXW5IIWI2AUN3LCJHZE7SZLD36PEKL?$select=id,folder`]
 ]){try{const r=await fetch('https://graph.microsoft.com/v1.0'+path,{headers:{Authorization:'Bearer '+token},redirect:'error',signal:AbortSignal.timeout(30000)});if(!r.ok){failed++;console.log('FAIL: '+label+' (HTTP '+r.status+')');continue;}const data=await r.json();if(label.endsWith('folder')&&!data.folder){failed++;console.log('FAIL: Expected a folder');continue;}console.log('PASS: '+label);}catch{failed++;console.log('FAIL: '+label+' (network error or invalid response)');}}
 console.log(failed?'Read access checks incomplete.':'All read access checks passed. No SharePoint content changed.');process.exitCode=failed?1:0;
})().catch(e=>{console.error(e instanceof TypeError||e?.name==='TimeoutError'?'FAIL: Network request failed.':'FAIL: '+e.message);process.exitCode=1;});
