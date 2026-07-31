'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Coins, Loader2, AlertCircle, X } from 'lucide-react';

interface CreditModalProps {
  companyId: string;
  companyName: string;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function CreditModal({
  companyId,
  companyName,
  isOpen,
  onClose,
  onSuccess,
}: CreditModalProps) {
  const [amount, setAmount] = useState('');
  const [type, setType] = useState<'credit' | 'debit'>('credit');
  const [source, setSource] = useState<'manual_grant' | 'purchase' | 'system_bonus' | 'refund'>('manual_grant');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const supabase = createClient();

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const numericAmount = parseFloat(amount);
    if (isNaN(numericAmount) || numericAmount <= 0) {
      setError('Por favor, informe um valor numérico positivo válido.');
      setLoading(false);
      return;
    }

    try {
      const { data, error } = await (supabase as any).rpc('process_credit_transaction', {
        p_company_id: companyId,
        p_amount: numericAmount,
        p_type: type,
        p_source: source,
        p_description: description || (type === 'credit' ? 'Concessão manual de saldo' : 'Débito manual de saldo'),
      });

      if (error) {
        setError(error.message);
        setLoading(false);
        return;
      }

      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Erro ao processar transação de créditos.');
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md p-6 shadow-2xl relative">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-slate-400 hover:text-white transition"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-3 mb-4">
          <div className="bg-amber-500/10 text-amber-400 p-2.5 rounded-xl border border-amber-500/20">
            <Coins className="w-6 h-6" />
          </div>
          <div>
            <h3 className="font-bold text-slate-100">Movimentar Créditos</h3>
            <p className="text-xs text-slate-400">{companyName}</p>
          </div>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-rose-500/10 border border-rose-500/20 rounded-xl text-rose-400 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          <div>
            <label className="block text-slate-300 font-medium mb-1">Tipo de Operação</label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setType('credit')}
                className={`py-2 rounded-xl font-bold border transition ${
                  type === 'credit'
                    ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                    : 'bg-slate-950 border-slate-800 text-slate-400'
                }`}
              >
                + Adicionar Crédito
              </button>
              <button
                type="button"
                onClick={() => setType('debit')}
                className={`py-2 rounded-xl font-bold border transition ${
                  type === 'debit'
                    ? 'bg-rose-500/10 border-rose-500/30 text-rose-400'
                    : 'bg-slate-950 border-slate-800 text-slate-400'
                }`}
              >
                - Debitar Saldo
              </button>
            </div>
          </div>

          <div>
            <label className="block text-slate-300 font-medium mb-1">Quantidade de Créditos</label>
            <input
              type="number"
              step="0.01"
              required
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="Ex: 500.00"
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-slate-100 placeholder-slate-600 text-sm focus:outline-none focus:border-sky-500"
            />
          </div>

          <div>
            <label className="block text-slate-300 font-medium mb-1">Origem da Movimentação</label>
            <select
              value={source}
              onChange={(e: any) => setSource(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-slate-100 text-sm focus:outline-none focus:border-sky-500"
            >
              <option value="manual_grant">Concessão Manual (Master)</option>
              <option value="purchase">Compra de Pacote</option>
              <option value="system_bonus">Bônus de Sistema</option>
              <option value="refund">Estorno</option>
            </select>
          </div>

          <div>
            <label className="block text-slate-300 font-medium mb-1">Descrição / Motivo</label>
            <input
              type="text"
              required
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Ex: Recarga inicial da carteira do parceiro"
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-slate-100 placeholder-slate-600 text-sm focus:outline-none focus:border-sky-500"
            />
          </div>

          <div className="pt-2 flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="w-1/2 bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold py-2.5 rounded-xl transition"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading}
              className="w-1/2 bg-amber-500 hover:bg-amber-600 disabled:bg-amber-500/50 text-slate-950 font-bold py-2.5 rounded-xl transition flex justify-center items-center gap-1.5"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Confirmar RPC'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
