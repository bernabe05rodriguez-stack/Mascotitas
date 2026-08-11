import type { Metadata } from 'next';
import Link from 'next/link';
import { Fraunces, Poppins } from 'next/font/google';
import '../globals.css';
import { getSession } from '@/lib/auth';
import { logoutAction } from './actions';
import { AdminNav } from '@/components/admin/AdminNav';

const fraunces = Fraunces({ subsets: ['latin'], weight: ['600', '800'], variable: '--font-fraunces', display: 'swap' });
const poppins = Poppins({ subsets: ['latin'], weight: ['400', '500', '600', '700'], variable: '--font-poppins', display: 'swap' });

export const metadata: Metadata = {
  title: 'Panel — Mascotitas',
  robots: { index: false, follow: false },
};

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();

  // El login usa este mismo layout pero sin la barra lateral.
  if (!session) {
    return (
      <div className={`${fraunces.variable} ${poppins.variable} min-h-screen bg-bg font-sans`}>{children}</div>
    );
  }

  return (
    <div className={`${fraunces.variable} ${poppins.variable} min-h-screen bg-bg font-sans`}>
      <div className="flex min-h-screen flex-col lg:flex-row">
        <AdminNav />

        <div className="min-w-0 flex-1">
          <header className="flex items-center justify-between gap-4 border-b border-line bg-white px-6 py-4">
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-navy">{session.name ?? session.email}</p>
              <p className="truncate text-xs text-navy/50">Panel de administración</p>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <Link
                href="/"
                target="_blank"
                className="btn-outline flex min-h-[42px] items-center rounded-full px-4 py-2 text-sm font-semibold"
              >
                Ver tienda
              </Link>
              <form action={logoutAction}>
                <button type="submit" className="min-h-[42px] rounded-full px-4 py-2 text-sm font-semibold text-navy/60 transition hover:bg-bg-2 hover:text-red-500">
                  Salir
                </button>
              </form>
            </div>
          </header>

          <main className="p-6">{children}</main>
        </div>
      </div>
    </div>
  );
}
