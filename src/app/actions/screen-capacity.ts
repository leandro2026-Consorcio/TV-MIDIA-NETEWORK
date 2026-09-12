'use server';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';

export async function getScreenCapacityOverviewAction() {
  const supabase=createClient(); const {data:{user}}=await supabase.auth.getUser();
  if(!user)return {success:false as const,error:'Usuário não autenticado.'};
  const {data:members}=await (supabase.from('company_users') as any).select('company_id').eq('user_id',user.id).eq('is_active',true);
  const companyIds=(members||[]).map((m:any)=>m.company_id); if(!companyIds.length)return {success:true as const,screens:[],cycles:[],plans:[],flags:{}};
  const [{data:screens},{data:inventories},{data:plans},{data:settings}]=await Promise.all([
    (supabase.from('screens') as any).select('id,company_id,name,status,last_ping_at').in('company_id',companyIds),
    (supabase.from('media_inventory') as any).select('id,source_id,owner_id').eq('source_type','company_screen').in('owner_id',companyIds),
    (supabase.from('screen_capacity_plan_versions') as any).select('*').is('effective_to',null).order('code'),
    (supabase.from('platform_settings') as any).select('key,value').in('key',['dynamic_screen_capacity_enabled','screen_capacity_certification_enabled','screen_commercial_inventory_enabled']),
  ]);
  const inventoryIds=(inventories||[]).map((i:any)=>i.id);
  const {data:cycles}=inventoryIds.length?await (supabase.rpc as any)('screen_capacity_status',{p_company_id:null}):{data:[]};
  return {success:true as const,screens:screens||[],inventories:inventories||[],cycles:cycles||[],plans:plans||[],flags:Object.fromEntries((settings||[]).map((s:any)=>[s.key,s.value===true||s.value==='true']))};
}

export async function setScreenCapacityPresetAction(screenId:string,preset:'balanced'|'more_news'|'more_network'|'more_own'){
  const supabase=createClient(); const {data:{user}}=await supabase.auth.getUser(); if(!user)return {success:false as const,error:'Usuário não autenticado.'};
  const {data:screen}=await (supabase.from('screens') as any).select('id,company_id').eq('id',screenId).maybeSingle(); if(!screen)return {success:false as const,error:'TV não encontrada ou acesso negado.'};
  const {data:member}=await (supabase.from('company_users') as any).select('company_id').eq('company_id',screen.company_id).eq('user_id',user.id).eq('is_active',true).in('role',['owner','admin']).maybeSingle();
  if(!member)return {success:false as const,error:'Somente administradores da empresa podem alterar o perfil.'};
  const {error}=await (supabase.from('screen_capacity_preferences') as any).upsert({screen_id:screenId,excess_preset:preset,updated_by:user.id,updated_at:new Date().toISOString()},{onConflict:'screen_id'});
  if(error)return {success:false as const,error:error.message}; revalidatePath('/dashboard'); return {success:true as const};
}

async function capacityManager(screenId:string){
  const supabase=createClient(); const {data:{user}}=await supabase.auth.getUser();
  if(!user)return {ok:false as const,error:'Usuário não autenticado.',supabase,user:null,screen:null,master:false};
  const {data:screen}=await (supabase.from('screens') as any).select('id,company_id,name,status,paired_at,device_type,venue_type').eq('id',screenId).maybeSingle();
  if(!screen)return {ok:false as const,error:'TV não encontrada.',supabase,user,screen:null,master:false};
  const [{data:profile},{data:member}]=await Promise.all([
    (supabase.from('profiles') as any).select('is_master_admin').eq('id',user.id).maybeSingle(),
    (supabase.from('company_users') as any).select('role').eq('company_id',screen.company_id).eq('user_id',user.id).eq('is_active',true).maybeSingle(),
  ]);
  const master=profile?.is_master_admin===true;
  if(!master&&!['owner','admin'].includes(member?.role))return {ok:false as const,error:'Acesso negado.',supabase,user,screen:null,master};
  return {ok:true as const,error:null,supabase,user,screen,master};
}

export async function getScreenCapacityActivationAction(screenId:string){
  const auth=await capacityManager(screenId); if(!auth.ok)return {success:false as const,error:auth.error};
  const {supabase,screen}=auth;
  const [{data:schedule},{data:rollout},{data:inventory}]=await Promise.all([
    (supabase.from('screen_operating_schedules') as any).select('*').eq('screen_id',screenId).is('effective_to',null).order('weekday'),
    (supabase.from('screen_capacity_rollouts') as any).select('*').eq('screen_id',screenId).maybeSingle(),
    (supabase.from('media_inventory') as any).select('id').eq('source_type','company_screen').eq('source_id',screenId).maybeSingle(),
  ]);
  const {data:cycles}=inventory?.id?await (supabase.from('inventory_capacity_periods') as any).select('*').eq('media_inventory_id',inventory.id).order('period_start',{ascending:false}).limit(1):{data:[]};
  return {success:true as const,screen,schedule:schedule||[],rollout:rollout||null,cycle:cycles?.[0]||null,master:auth.master};
}

export async function saveScreenOperatingScheduleAction(screenId:string,opensAt:string,closesAt:string,timezone='America/Cuiaba'){
  const auth=await capacityManager(screenId); if(!auth.ok)return {success:false as const,error:auth.error};
  if(!/^([01]\d|2[0-3]):[0-5]\d$/.test(opensAt)||!/^([01]\d|2[0-3]):[0-5]\d$/.test(closesAt)||opensAt>=closesAt)return {success:false as const,error:'Horário inválido.'};
  const effectiveFrom=new Date().toISOString().slice(0,10);
  const rows=Array.from({length:7},(_,weekday)=>({screen_id:screenId,weekday,opens_at:weekday>=1&&weekday<=5?opensAt:null,closes_at:weekday>=1&&weekday<=5?closesAt:null,is_closed:weekday===0||weekday===6,effective_from:effectiveFrom,effective_to:null,timezone,updated_at:new Date().toISOString()}));
  const {error}=await (auth.supabase.from('screen_operating_schedules') as any).upsert(rows,{onConflict:'screen_id,weekday,effective_from'});
  if(error)return {success:false as const,error:error.message}; revalidatePath(`/screens/${screenId}`);revalidatePath('/dashboard');return {success:true as const};
}

export async function initializeScreenCapacityCycleAction(screenId:string){
  const auth=await capacityManager(screenId); if(!auth.ok)return {success:false as const,error:auth.error};
  const now=new Date(); const start=now.toISOString().slice(0,10); const cycleEnd=new Date(now);cycleEnd.setUTCDate(cycleEnd.getUTCDate()+30);const end=cycleEnd.toISOString().slice(0,10);
  const key=`capacity:${screenId}:${start}:mpm_standard`;
  const {data:cycleId,error}=await (auth.supabase.rpc as any)('initialize_screen_capacity_cycle',{p_screen_id:screenId,p_plan_code:'mpm_standard',p_start:start,p_end:end,p_idempotency_key:key});
  if(error)return {success:false as const,error:error.message};
  const {error:dailyError}=await (auth.supabase.rpc as any)('materialize_screen_capacity_daily',{p_capacity_period_id:cycleId});
  if(dailyError)return {success:false as const,error:dailyError.message}; revalidatePath(`/screens/${screenId}`);revalidatePath('/dashboard');return {success:true as const};
}

export async function setScreenCapacityRolloutAction(screenId:string,enabled:boolean){
  const auth=await capacityManager(screenId); if(!auth.ok)return {success:false as const,error:auth.error};
  if(!auth.master)return {success:false as const,error:'Somente o Master pode alterar o rollout controlado.'};
  const {error}=await (auth.supabase.from('screen_capacity_rollouts') as any).upsert({screen_id:screenId,dynamic_player_enabled:enabled,capacity_tracking_enabled:enabled,starts_at:new Date().toISOString(),ends_at:null,activated_by:auth.user.id,reason:'controlled_homologation',updated_at:new Date().toISOString()},{onConflict:'screen_id'});
  if(error)return {success:false as const,error:error.message}; revalidatePath(`/screens/${screenId}`);return {success:true as const};
}
