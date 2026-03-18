import type { ReactNode } from 'react';

export function Layout({ children }: { children: ReactNode }) {
  return (
    <div className="h-screen overflow-hidden bg-slate-950">
      {children}
    </div>
  );
}
