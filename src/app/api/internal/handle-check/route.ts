import {createServerClient} from '@supabase/ssr';
import {handleEmail} from '@/lib/handle-auth';
export const maxDuration=60;
export async function GET(req:Request){
 if(process.env.VERCEL_ENV!=="preview")return new Response(null,{status:404});
 const checks:Record<string,boolean>={},fixtures:{handle:string;id:string}[]=[];let stage="start";
 const url=process.env.NEXT_PUBLIC_SUPABASE_URL!,key=process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!;
 const origin=new URL(req.url).origin;
 async function api(path:string,body?:unknown,jar=new Map<string,string>()){
  const headers:Record<string,string>={"Content-Type":"application/json",Origin:origin,Cookie:[req.headers.get('cookie')??'',...Array.from(jar,([n,v])=>n+'='+v)].filter(Boolean).join('; ')};
  const bypass=req.headers.get('x-vercel-protection-bypass')??new URL(req.url).searchParams.get('x-vercel-protection-bypass');if(bypass)headers['x-vercel-protection-bypass']=bypass;
  const r=await fetch(new URL(path,origin),{method:body?'POST':'GET',headers,body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(15000)});return {status:r.status,body:await r.json().catch(()=>({}))};
 }
 function actor(){const jar=new Map<string,string>();return {jar,client:createServerClient(url,key,{cookies:{getAll:()=>Array.from(jar,([name,value])=>({name,value})),setAll:items=>items.forEach(i=>{if(i.value)jar.set(i.name,i.value);else jar.delete(i.name)})}})}}
 try{
  const h='qat_'+crypto.randomUUID().replaceAll('-','').slice(0,16),password=crypto.randomUUID()+'Aa1',newPassword=crypto.randomUUID()+'Aa2';
  stage='register_a';const a=await api('/api/handle-account',{action:'register',handle:h,password});checks.register_without_email=a.status===201&&a.body.recoveryCode?.length===68;if(!checks.register_without_email)throw Error(String(a.status)+':'+String(a.body.error));
  stage='login_a';const aa=actor();const login=await aa.client.auth.signInWithPassword({email:handleEmail(h),password});if(login.data.user)fixtures.push({handle:h,id:login.data.user.id});checks.real_login=!login.error&&!!login.data.user;checks.no_email_provided=login.data.user?.email===handleEmail(h);if(!checks.real_login)throw Error('Login failed');
  stage='register_b';const b=await api('/api/handle-account',{action:'register',handle:h+'b',password});const bb=actor();const lb=await bb.client.auth.signInWithPassword({email:handleEmail(h+'b'),password});if(lb.data.user)fixtures.push({handle:h+'b',id:lb.data.user.id});checks.second_account=b.status===201&&!lb.error;
  stage='workspace';const workspace={version:1,name:'Temporary handle QA',currency:'USD',source:'Synthetic isolated QA',priceBasis:'unknown',bars:[],positions:[],financials:[]};const saved=await api('/api/workspace',{workspace,revision:0},aa.jar);checks.cookie_to_api_to_database=saved.status===200&&saved.body.item?.revision===1;const other=await api('/api/workspace',undefined,bb.jar);checks.other_user_cannot_read=other.status===200&&other.body.item===null;
  stage='recovery';const recovered=await api('/api/handle-account',{action:'recover',handle:h,password:newPassword,recoveryCode:a.body.recoveryCode});checks.recovery_without_email=recovered.status===200&&recovered.body.recoveryCode!==a.body.recoveryCode;
  const after=actor();checks.new_password_works=!(await after.client.auth.signInWithPassword({email:handleEmail(h),password:newPassword})).error;
  const oldLogin=actor();checks.old_password_rejected=!!(await oldLogin.client.auth.signInWithPassword({email:handleEmail(h),password})).error;
  const replay=await api('/api/handle-account',{action:'recover',handle:h,password,recoveryCode:a.body.recoveryCode});checks.recovery_key_single_use=replay.status===400;
  stage='rotate';const rotated=await api('/api/handle-account',{action:'rotate'},after.jar);checks.authenticated_key_rotation=rotated.status===200&&rotated.body.recoveryCode?.length===68;
  const stale=await api('/api/handle-account',{action:'recover',handle:h,password,recoveryCode:recovered.body.recoveryCode});checks.old_key_invalid_after_rotation=stale.status===400;
  await aa.client.auth.signOut();await bb.client.auth.signOut();await after.client.auth.signOut();
  return Response.json({checks,allPassed:Object.values(checks).every(Boolean),fixtures},{headers:{'Cache-Control':'private, no-store'}});
 }catch(e){return Response.json({checks,fixtures,stage,error:e instanceof Error?e.message:'unknown'},{status:500,headers:{'Cache-Control':'private, no-store'}})}
}
