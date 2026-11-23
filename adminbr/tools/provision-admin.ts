import {createClient} from '@supabase/supabase-js';
import {prisma} from '../src/infrastructure/db.js';
import {config} from '../src/config.js';
import {resolveAdminSession} from '../src/modules/auth/admin-session.js';
import {buildApp} from '../src/app.js';
let input='';for await(const chunk of process.stdin)input+=chunk;
const {email,password}=JSON.parse(input);
if(typeof email!=='string'||typeof password!=='string'||!password)throw new Error('Supply email and password through stdin');
const admin=createClient(config.supabaseUrl,config.supabaseSecretKey,{auth:{persistSession:false,autoRefreshToken:false}});
const client=createClient(config.supabaseUrl,config.supabasePublishableKey,{auth:{persistSession:false,autoRefreshToken:false}});
let createdId:string|undefined;
try{
 const result=await admin.auth.admin.createUser({email,password,email_confirm:true,user_metadata:{full_name:'Admin Operator'}});
 let account=result.data.user;
 if(result.error){
  if(!['email_exists','email_address_exists'].includes(result.error.code||''))throw result.error;
  for(let page=1;!account;page++){
   const found=await admin.auth.admin.listUsers({page,perPage:100});if(found.error)throw found.error;
   account=found.data.users.find(user=>user.email?.toLowerCase()===email.toLowerCase())||null;
   if(found.data.users.length<100)break;
  }
  if(!account)throw new Error('Existing account could not be resolved');
  const updated=await admin.auth.admin.updateUserById(account.id,{password,email_confirm:true});if(updated.error)throw updated.error;
 }else{createdId=account!.id;}
 const conflict=await prisma.user.findUnique({where:{email},select:{id:true}});
 if(conflict&&conflict.id!==account!.id)throw new Error('Account ID conflict requires reconciliation');
 await prisma.user.upsert({where:{id:account!.id},create:{id:account!.id,email,role:'ADMIN',fullName:'Admin Operator'},update:{email,role:'ADMIN'}});
 createdId=undefined;
 const login=await client.auth.signInWithPassword({email,password});if(login.error)throw login.error;
 const token=login.data.session!.access_token;
 const verified=await resolveAdminSession(token,client.auth,prisma.user);
 const app=buildApp();
 try{
  const response=await app.inject({method:'GET',url:'/api/v1/admin/auth/me',headers:{authorization:`Bearer ${token}`}});
  if(response.statusCode!==200)throw new Error('Authenticated API verification failed');
  console.log(JSON.stringify({email:verified.email,role:verified.role,loginVerified:true,adminApiStatus:response.statusCode}));
 }finally{await app.close();}
 await client.auth.signOut({scope:'local'});
}catch(error:any){
 if(createdId)await admin.auth.admin.deleteUser(createdId);
 console.error(JSON.stringify({setupFailed:true,code:error.code||error.name,status:error.status,reason:'Admin setup or verification failed; no credentials logged.'}));process.exitCode=1;
}finally{await prisma.$disconnect();}
