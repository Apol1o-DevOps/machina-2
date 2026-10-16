'use client';

import { useCallback, useEffect, useState } from 'react';

type Ledger = {
  id: string; deltaCents: number; reason: string; note: string | null;
  refType: string | null; refId: string | null; createdAt: number;
};

export default function BillingPage() {
  const [balance, setBalance] = useState<number | null>(null);
  const [ledger, setLedger] = useState<Ledger[]>([]);
  const [cap, setCap] = useState<{ running: number; max: number } | null>(null);
  const load = useCallback(async () => {
    const r = await fetch('/api/billing', { cache: 'no-store' });
    if (r.ok) {
      const j = await r.json();
      setBalance(j.balanceCents);
      setLedger(j.ledger);
      setCap(j.capacity);
    }
  }, []);
  useEffect(() => { void load(); }, [load]);

  return (
    <>
      <h1>billing</h1>
      <div className="sub">internal credits; admin tops up; hourly settle from your balance</div>
      <div className="card">
        <div className="grid3" style={{ alignItems: 'center' }}>
          <div>
            <div className="muted">balance</div>
            <div style={{ fontSize: 30, fontWeight: 600 }}>{balance === null ? '…' : `$${(balance / 100).toFixed(2)}`}</div>
          </div>
          <div>
            <div className="muted">host capacity</div>
            <div>{cap ? `${cap.running}/${cap.max} running` : '…'}</div>
          </div>
        </div>
      </div>
      <div className="card">
        <h3>ledger (last 50)</h3>
        <table>
          <thead><tr><th>when</th><th>reason</th><th>delta</th><th>note</th></tr></thead>
          <tbody>
            {ledger.map((l) => (
              <tr key={l.id}>
                <td>{new Date(l.createdAt).toLocaleString()}</td>
                <td>{l.reason}</td>
                <td className="mono" style={{ color: l.deltaCents >= 0 ? 'var(--ok)' : 'var(--danger)' }}>
                  {l.deltaCents >= 0 ? '+' : ''}{(l.deltaCents / 100).toFixed(2)}
                </td>
                <td className="copy">{l.note ?? '—'}</td>
              </tr>
            ))}
            {ledger.length === 0 && <tr><td colSpan={4} className="muted">no movements yet</td></tr>}
          </tbody>
        </table>
      </div>
    </>
  );
}
