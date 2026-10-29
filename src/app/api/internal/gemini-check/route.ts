import {generateText} from 'ai';import {createGoogle} from '@ai-sdk/google';
export const maxDuration=60;
export async function GET(){if(process.env.VERCEL_ENV!=="preview")return new Response(null,{status:404});try{
 const result=await generateText({model:createGoogle({apiKey:process.env.GEMINI_API_KEY})(process.env.GEMINI_MODEL!),prompt:"Reply with exactly: GEMINI_OK",maxOutputTokens:128,maxRetries:0,abortSignal:AbortSignal.timeout(45000)});
 const url=process.env.NEXT_PUBLIC_SUPABASE_URL!,key=process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!;
 const response=await fetch(url+"/auth/v1/settings",{headers:{apikey:key}});const settings=await response.json();
 return Response.json({generated:result.text.includes("GEMINI_OK"),model:process.env.GEMINI_MODEL,auth:{emailEnabled:settings.external?.email,signupDisabled:settings.disable_signup,emailAutoconfirm:settings.mailer_autoconfirm}},{headers:{"Cache-Control":"private, no-store"}});
 }catch{return Response.json({generated:false})}}
