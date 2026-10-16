import { requireUser } from '@/lib/auth';
import { NextResponse } from 'next/server';

export function json(data: unknown, status = 200): NextResponse {
  return NextResponse.json(data, { status });
}

export function err(message: string, status = 400): NextResponse {
  return NextResponse.json({ error: message }, { status });
}

/** Session guard. Returns [user, errorResponse]. */
export async function session(): Promise<
  [{ id: string; name: string; role: string }, null] | [null, NextResponse]
> {
  const user = await requireUser();
  if (!user) return [null, err('unauthorized', 401)];
  return [user, null];
}

export async function requireAdmin(): Promise<
  [{ id: string; name: string; role: string }, null] | [null, NextResponse]
> {
  const [user, e] = await session();
  if (e) return [null, e];
  if (user.role !== 'admin') return [null, err('admin only', 403)];
  return [user, null];
}

export function uuid(): string {
  return crypto.randomUUID();
}
