'use client';

import { useEffect, useState } from 'react';
import { Gauge, Loader2, Power } from 'lucide-react';
import { getScreenCapacityActivationAction, initializeScreenCapacityCycleAction, saveScreenOperatingScheduleAction, setScreenCapacityRolloutAction } from '@/app/actions/screen-capacity';

export function ScreenCapacityActivationPanel({screenId}:{screenId:string}){
  const [data,setData]=useState<any>(null); const [busy,setBusy]=useState(false); const [message,setMessage]=useState('');
  const [opens,setOpens]=useState('08:00'); const [closes,setCloses]=useState('16:00');
  const load=async()=>{const result=await getScreenCapacityActivationAction(screenId);setData(result);const weekday=result.success?result.schedule?.find((row:any)=>!row.is_closed):null;if(weekday){setOpens(String(weekday.opens_at).slice(0,5));setCloses(String(weekday.closes_at).slice(0,5));}};
  useEffect(()=>{void load();},[screenId]);
  const run=async(action:()=>Promise<any>)=>{setBusy(true);setMessage('');const result=await action();setMessage(result.success?'Operação concluída.':result.error||'Não foi possível concluir.');await load();setBusy(false);};
  if(!data?.success)return null;
  const cycle=data.cycle; const enabled=!!data.rollout?.dynamic_player_enabled;
  return <section className="rounded-2xl border border-purple-500/30 bg-slate-900 p-5 sm:p-6">
    <div className="flex items-center gap-2"><Gauge className="h-5 w-5 text-purple-400"/><h2 className="font-bold text-white">Capacidade e grade da TV</h2></div>
    <p className="mt-1 text-xs text-slate-400">Rollout individual. A configuração pública permanece desligada.</p>
    <div className="mt-4 grid gap-3 sm:grid-cols-3">
      <label className="text-xs text-slate-400">Abertura<input type="time" value={opens} onChange={e=>setOpens(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 p-2 text-white"/></label>
      <label className="text-xs text-slate-400">Fechamento<input type="time" value={closes} onChange={e=>setCloses(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 p-2 text-white"/></label>
      <div className="text-xs text-slate-400">Fuso horário<div className="mt-1 rounded-lg border border-slate-700 bg-slate-950 p-2 text-white">America/Cuiaba</div></div>
    </div>
    <div className="mt-4 flex flex-wrap gap-2">
      <button disabled={busy} onClick={()=>run(()=>saveScreenOperatingScheduleAction(screenId,opens,closes))} className="rounded-lg bg-sky-600 px-3 py-2 text-xs font-bold text-white disabled:opacity-50">Salvar segunda a sexta</button>
      <button disabled={busy} onClick={()=>run(()=>initializeScreenCapacityCycleAction(screenId))} className="rounded-lg bg-purple-600 px-3 py-2 text-xs font-bold text-white disabled:opacity-50">Gerar ciclo atual</button>
      {data.master&&<button disabled={busy} onClick={()=>run(()=>setScreenCapacityRolloutAction(screenId,!enabled))} className={`rounded-lg px-3 py-2 text-xs font-bold text-white disabled:opacity-50 ${enabled?'bg-rose-600':'bg-emerald-600'}`}><Power className="mr-1 inline h-3.5 w-3.5"/>{enabled?'Desligar motor':'Ativar somente nesta TV'}</button>}
      {busy&&<Loader2 className="h-5 w-5 animate-spin text-slate-400"/>}
    </div>
    {cycle?<div className="mt-4 grid grid-cols-2 gap-2 text-xs sm:grid-cols-4"><Metric label="Período" value={`${cycle.period_start} — ${cycle.period_end}`}/><Metric label="Horas previstas" value={`${(Number(cycle.planned_minutes)/60).toFixed(1)}h`}/><Metric label="Capacidade técnica" value={Number(cycle.theoretical_capacity).toLocaleString('pt-BR')}/><Metric label="Direito de mídia" value={`${Number(cycle.rights_released).toLocaleString('pt-BR')} / ${Number(cycle.rights_target).toLocaleString('pt-BR')}`}/></div>:<p className="mt-4 text-xs text-amber-300">Nenhum ciclo calculado.</p>}
    {message&&<p className="mt-3 text-xs text-slate-300">{message}</p>}
  </section>;
}
function Metric({label,value}:{label:string;value:string}){return <div className="rounded-lg bg-slate-950 p-3"><span className="block text-slate-500">{label}</span><b className="text-slate-200">{value}</b></div>}
