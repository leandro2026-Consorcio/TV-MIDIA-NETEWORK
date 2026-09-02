'use client';

import { useEffect, useState } from 'react';
import { AlertCircle, CheckCircle2, Loader2, Save, Sliders } from 'lucide-react';
import { getPublicSignupSettingsAction, updatePlatformTrialSettingsAction, type PublicSignupSettings } from '@/app/actions/onboarding';
import { type PlanPriceKey } from '@/lib/platform-pricing';

export default function PlatformSettingsPage() {
  const [settings, setSettings] = useState<PublicSignupSettings | null>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  useEffect(() => { getPublicSignupSettingsAction().then((result) => setSettings(result.settings)); }, []);

  async function save(event: React.FormEvent) {
    event.preventDefault();
    if (!settings) return;
    setSaving(true);
    setMessage(null);
    const result = await updatePlatformTrialSettingsAction(settings);
    setMessage(result.success ? { type: 'success', text: 'Configurações atualizadas.' } : { type: 'error', text: result.error });
    setSaving(false);
  }

  if (!settings) return <div className="py-20 flex justify-center"><Loader2 className="w-8 h-8 animate-spin text-purple-400" /></div>;
  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <header className="border-b border-slate-800 pb-5 flex items-center gap-3"><span className="bg-purple-500/10 text-purple-400 p-3 rounded-xl"><Sliders className="w-6 h-6" /></span><div><h1 className="text-2xl font-extrabold text-white">Configurações da Plataforma</h1><p className="text-sm text-slate-400">Controle o trial público e os preços comerciais exibidos no site.</p></div></header>
      <form onSubmit={save} className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-6">
        {message && <div className={`p-4 rounded-xl border text-sm flex gap-2 ${message.type === 'success' ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-300' : 'bg-rose-500/10 border-rose-500/20 text-rose-300'}`}>{message.type === 'success' ? <CheckCircle2 className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}{message.text}</div>}
        <Toggle label="Cadastro público com trial" description="Permite que novos interessados criem conta e empresa." checked={settings.enabled} onChange={(enabled) => setSettings({ ...settings, enabled })} />
        <Toggle label="Autoaprovar mídia interna própria" description="Durante o trial, mídia própria pode entrar diretamente em playlists internas." checked={settings.autoApproveTrialInternalMedia} onChange={(autoApproveTrialInternalMedia) => setSettings({ ...settings, autoApproveTrialInternalMedia })} />
        <div className="grid sm:grid-cols-2 gap-4">
          <NumberField label="Dias gratuitos" value={settings.trialDays} min={1} max={365} onChange={(trialDays) => setSettings({ ...settings, trialDays })} />
          <NumberField label="Convites VIP iniciais" value={settings.invitesCount} min={1} max={10} onChange={(invitesCount) => setSettings({ ...settings, invitesCount })} />
        </div>
        <section className="border-t border-slate-800 pt-6 space-y-4">
          <div>
            <h2 className="text-base font-bold text-white">Preços dos planos</h2>
            <p className="text-xs text-slate-400 mt-1">Valores mensais exibidos no site público. As alterações entram no ar após salvar.</p>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <PriceField label="Plano 1 TV" value={settings.planPrices['1-tv']} onChange={(value) => setPlanPrice('1-tv', value)} />
            <PriceField label="Plano 2 TVs" value={settings.planPrices['2-tvs']} onChange={(value) => setPlanPrice('2-tvs', value)} />
            <PriceField label="Plano 3 TVs" value={settings.planPrices['3-tvs']} onChange={(value) => setPlanPrice('3-tvs', value)} />
            <PriceField label="Plano 4 TVs" value={settings.planPrices['4-tvs']} onChange={(value) => setPlanPrice('4-tvs', value)} />
            <PriceField label="Plano 5 TVs" value={settings.planPrices['5-tvs']} onChange={(value) => setPlanPrice('5-tvs', value)} />
            <PriceField label="TV adicional" value={settings.planPrices['additional-tv']} onChange={(value) => setPlanPrice('additional-tv', value)} />
          </div>
        </section>
        <label className="block text-xs font-semibold text-slate-300">Mensagem com cadastro desativado<textarea value={settings.disabledMessage} onChange={(event) => setSettings({ ...settings, disabledMessage: event.target.value })} rows={3} className="mt-2 w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-sm text-slate-100 focus:outline-none focus:border-purple-500" /></label>
        <button disabled={saving} className="bg-purple-500 hover:bg-purple-600 disabled:opacity-60 text-white font-bold px-5 py-3 rounded-xl text-sm inline-flex items-center gap-2">{saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Salvar configurações</button>
      </form>
    </div>
  );

  function setPlanPrice(key: PlanPriceKey, value: number) {
    if (!settings) return;
    setSettings({ ...settings, planPrices: { ...settings.planPrices, [key]: value } });
  }
}

function Toggle({ label, description, checked, onChange }: { label: string; description: string; checked: boolean; onChange: (value: boolean) => void }) {
  return <label className="flex items-center justify-between gap-4 bg-slate-950 border border-slate-800 rounded-xl p-4"><span><strong className="block text-sm text-white">{label}</strong><span className="text-xs text-slate-500">{description}</span></span><input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} className="w-5 h-5 accent-purple-500" /></label>;
}

function NumberField({ label, value, min, max, onChange }: { label: string; value: number; min: number; max: number; onChange: (value: number) => void }) {
  return <label className="text-xs font-semibold text-slate-300">{label}<input type="number" value={value} min={min} max={max} onChange={(event) => onChange(Number(event.target.value))} className="mt-2 w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-sm text-slate-100 focus:outline-none focus:border-purple-500" /></label>;
}

function PriceField({ label, value, onChange }: { label: string; value: number; onChange: (value: number) => void }) {
  return <label className="text-xs font-semibold text-slate-300">{label}<div className="relative mt-2"><span className="absolute left-4 top-1/2 -translate-y-1/2 text-sm text-slate-500">R$</span><input type="number" value={(value / 100).toFixed(2)} min={0} max={999999.99} step="0.01" onChange={(event) => onChange(Math.max(0, Math.round(Number(event.target.value) * 100)))} className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-11 pr-4 py-3 text-sm text-slate-100 focus:outline-none focus:border-purple-500" /></div></label>;
}
