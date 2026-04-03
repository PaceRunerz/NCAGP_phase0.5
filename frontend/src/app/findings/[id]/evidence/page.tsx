'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { EvidencePortal } from '@/components/evidence/EvidencePortal';
import { apiFetch } from '@/lib/utils';
import { ArrowLeft } from 'lucide-react';

export default function EvidencePage() {
  const { id } = useParams<{ id: string }>();
  const [finding, setFinding] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    apiFetch(`/api/findings?auditId=${id}`)
      .then((data) => {
        // Find the specific finding from the list
        const found = data.findings?.find((f: any) => f.id === id);
        if (found) {
          setFinding(found);
        } else {
          setError('Finding not found or access denied.');
        }
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center min-h-screen">
        <div className="w-8 h-8 border-2 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" />
      </div>
    );
  }

  if (error || !finding) {
    return (
      <div className="p-6">
        <div className="text-red-400 text-center mt-20">{error || 'Finding not found'}</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950">
      <div className="px-6 pt-6">
        <a
          href="/findings"
          className="inline-flex items-center gap-2 text-sm text-slate-400 hover:text-white mb-4 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Findings
        </a>
      </div>
      <EvidencePortal finding={finding} />
    </div>
  );
}
