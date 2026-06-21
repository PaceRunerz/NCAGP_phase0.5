'use client';
import dynamic from 'next/dynamic';
const FeedbackWidget = dynamic(
  () => import('./FeedbackWidget').then(m => ({ default: m.FeedbackWidget })),
  { ssr: false }
);
export default function FeedbackWidgetClient() {
  return <FeedbackWidget />;  srvr
}
