import { notFound } from 'next/navigation';
import { getPublicCouponVerificationAction } from '@/app/actions/organic-benefits';
import { VerifyCouponClient } from './verify-coupon-client';

interface VerifyCouponPageProps {
  params: {
    token: string;
  };
}

export default async function VerifyCouponPage({ params }: VerifyCouponPageProps) {
  const token = params.token;
  if (!token) notFound();

  const res = await getPublicCouponVerificationAction(token);
  if (!res.success || !res.coupon) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center p-4">
        <div className="w-full max-w-md rounded-3xl border border-rose-500/30 bg-slate-900 p-8 text-center text-rose-300">
          <h1 className="text-xl font-black text-white">Cupom Não Encontrado</h1>
          <p className="mt-2 text-xs text-slate-400">
            O token ou código escaneado não corresponde a um cupom válido na rede Mídia por Mídia.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 px-4 py-12">
      <VerifyCouponClient coupon={res.coupon} token={token} />
    </div>
  );
}
