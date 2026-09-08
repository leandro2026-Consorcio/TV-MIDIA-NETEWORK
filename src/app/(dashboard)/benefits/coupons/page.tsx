import { redirect } from 'next/navigation';

export default function CouponsBenefitPage() {
  redirect('/benefits?tab=cupons');
}
