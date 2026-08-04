'use client';

import { useEffect, useState } from 'react';
import { AlertCircle, CheckCircle2, Loader2, Save, Sliders } from 'lucide-react';
import { getPublicSignupSettingsAction, updatePlatformTrialSettingsAction, type PublicSignupSettings } from '@/app/actions/onboarding';

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
      <header className="border-b border-slate-800 pb-5 flex items-center gap-3"><span className="bg-purple-500/10 text-purple-400 p-3 rounded-xl"><Sliders className="w-6 h-6" /></span><div><h1 className="text-2xl font-extrabold text-white">Configuração do Trial Público</h1><p className="text-sm text-slate-400">Controle o onboarding empresarial sem alterar cobrança ou financeiro.</p></div></header>
      <form onSubmit={save} className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-6">
        {message && <div className={`p-4 rounded-xl border text-sm flex gap-2 ${message.type === 'success' ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-300' : 'bg-rose-500/10 border-rose-500/20 text-rose-300'}`}>{message.type === 'success' ? <CheckCircle2 className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}{message.text}</div>}
        <Toggle label="Cadastro público com trial" description="Permite que novos interessados criem conta e empresa." checked={settings.enabled} onChange={(enabled) => setSettings({ ...settings, enabled })} />
        <Toggle label="Autoaprovar mídia interna própria" description="Durante o trial, mídia própria pode entrar diretamente em playlists internas." checked={settings.autoApproveTrialInternalMedia} onChange={(autoApproveTrialInternalMedia) => setSettings({ ...settings, autoApproveTrialInternalMedia })} />
        <div className="grid sm:grid-cols-2 gap-4">
          <NumberField label="Dias gratuitos" value={settings.trialDays} min={1} max={365} onChange={(trialDays) => setSettings({ ...settings, trialDays })} />
          <NumberField label="Convites VIP iniciais" value={settings.invitesCount} min={1} max={10} onChange={(invitesCount) => setSettings({ ...settings, invitesCount })} />
        </div>
        <label className="block text-xs font-semibold text-slate-300">Mensagem com cadastro desativado<textarea value={settings.disabledMessage} onChange={(event) => setSettings({ ...settings, disabledMessage: event.target.value })} rows={3} className="mt-2 w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-sm text-slate-100 focus:outline-none focus:border-purple-500" /></label>
        <button disabled={saving} className="bg-purple-500 hover:bg-purple-600 disabled:opacity-60 text-white font-bold px-5 py-3 rounded-xl text-sm inline-flex items-center gap-2">{saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Salvar configurações</button>
      </form>
    </div>
  );
}

function Toggle({ label, description, checked, onChange }: { label: string; description: string; checked: boolean; onChange: (value: boolean) => void }) {
  return <label className="flex items-center justify-between gap-4 bg-slate-950 border border-slate-800 rounded-xl p-4"><span><strong className="block text-sm text-white">{label}</strong><span className="text-xs text-slate-500">{description}</span></span><input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} className="w-5 h-5 accent-purple-500" /></label>;
}

function NumberField({ label, value, min, max, onChange }: { label: string; value: number; min: number; max: number; onChange: (value: number) => void }) {
  return <label className="text-xs font-semibold text-slate-300">{label}<input type="number" value={value} min={min} max={max} onChange={(event) => onChange(Number(event.target.value))} className="mt-2 w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-sm text-slate-100 focus:outline-none focus:border-purple-500" /></label>;
}
