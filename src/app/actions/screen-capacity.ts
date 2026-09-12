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
