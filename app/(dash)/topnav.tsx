'use client';

import { useRouter, usePathname } from 'next/navigation';
import { signOut } from 'next-auth/react';

export function TopNav({ name, role }: { name: string; role: string }) {
  const pathname = usePathname();
  const router = useRouter();
  const links = [
    { href: '/instances', label: 'instances' },
    { href: '/keys', label: 'ssh keys' },
    { href: '/billing', label: 'billing' },
    ...(role === 'admin' ? [{ href: '/admin', label: 'admin' }] : []),
  ];
  return (
    <>
      <div className="brand">machina</div>
      <nav>
        {links.map((l) => (
          <a key={l.href} href={l.href} className={pathname.startsWith(l.href) ? 'active' : ''}>
            {l.label}
          </a>
        ))}
      </nav>
      <div className="spacer" />
      <span className="muted">{name}</span>
      <button
        onClick={() => signOut({ callbackUrl: '/signin' }).then(() => router.push('/signin'))}
        style={{ padding: '4px 10px', fontSize: 13 }}
      >
        sign out
      </button>
    </>
  );
}
