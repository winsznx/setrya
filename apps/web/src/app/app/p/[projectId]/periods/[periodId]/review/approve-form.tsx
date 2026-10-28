'use client';

import { useRouter } from 'next/navigation';
import { formatZec } from '@setrya/domain';
import { useState } from 'react';

import { StepUpConfirm } from '@/components/period/step-up';
import { CheckboxField } from '@/components/ui/field';
import { api } from '@/lib/client/api';

export function ApproveForm({ projectId, periodId, revision, totalZat, count, fingerprints }: { projectId: string; periodId: string; revision: number; totalZat: string; count: number; fingerprints: { name: string; fp: string; zat: string }[] }) {
  const router = useRouter();
  const [confirmed, setConfirmed] = useState(false);
  return (
    <StepUpConfirm
      action="approve_period"
      targetId={periodId}
      label={`Freeze and approve ${count} payment${count === 1 ? '' : 's'}`}
      disabled={!confirmed}
      onConfirmed={async (token) => {
        const r = await api(`/api/v1/projects/${projectId}/periods/${periodId}/approve`, { method: 'POST', body: { stepUpToken: token, expectedRevision: revision, confirmTotalZat: totalZat } });
        if (!r.ok) return r.error.message;
        router.push(`/app/p/${projectId}/periods/${periodId}?approved=1`);
        return null;
      }}
    >
      <ul className="space-y-1 rounded-row bg-surface-muted p-3 text-body-s">
        {fingerprints.map((f) => (
          <li key={f.fp + f.name} className="flex justify-between gap-2"><span className="truncate">{f.name} <span className="font-mono text-label text-ink-muted">{f.fp}</span></span><span className="tnum">{formatZec(BigInt(f.zat), { trim: true })}</span></li>
        ))}
      </ul>
      <CheckboxField checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} label={`I confirm ${formatZec(BigInt(totalZat))} ZEC to these ${count} destination${count === 1 ? '' : 's'}, checked by fingerprint`} hint="Approval records the snapshot. You will see and authorise the actual transaction separately." />
    </StepUpConfirm>
  );
}
