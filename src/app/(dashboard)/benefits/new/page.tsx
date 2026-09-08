import { redirect } from 'next/navigation';

export default function NewBenefitPage() {
  redirect('/benefits?tab=cadastrar');
}
