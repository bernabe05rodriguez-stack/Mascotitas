'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutDashboard, Package, ShoppingBag, Tags, Ticket, Settings, Image as ImageIcon, PawPrint, Store, Users } from 'lucide-react';
import { cn } from '@/lib/format';

const LINKS = [
  { href: '/admin', label: 'Resumen', icon: LayoutDashboard, exact: true },
  { href: '/admin/venta', label: 'Venta', icon: Store },
  { href: '/admin/productos', label: 'Productos', icon: Package },
  { href: '/admin/pedidos', label: 'Pedidos', icon: ShoppingBag },
  { href: '/admin/clientes', label: 'Clientes', icon: Users },
  { href: '/admin/banners', label: 'Banners', icon: ImageIcon },
  { href: '/admin/categorias', label: 'Categorías', icon: Tags },
  { href: '/admin/cupones', label: 'Cupones', icon: Ticket },
  { href: '/admin/config', label: 'Configuración', icon: Settings },
];

export function AdminNav() {
  const pathname = usePathname();

  return (
    <nav className="shrink-0 border-b border-line bg-navy px-4 py-3 lg:w-56 lg:border-b-0 lg:border-r lg:px-4 lg:py-6">
      <Link href="/admin" className="mb-0 flex items-center gap-2 px-2 lg:mb-8">
        <PawPrint className="h-5 w-5 text-accent" />
        <span className="font-serif text-lg font-bold text-white">Mascotitas</span>
      </Link>

      <ul className="flex gap-1 overflow-x-auto scrollbar-hide lg:flex-col lg:gap-0.5 lg:overflow-visible">
        {LINKS.map(({ href, label, icon: Icon, exact }) => {
          const active = exact ? pathname === href : pathname.startsWith(href);
          return (
            <li key={href} className="shrink-0">
              <Link
                href={href}
                className={cn(
                  'flex min-h-[42px] items-center gap-2.5 whitespace-nowrap rounded-lg px-3 py-2 text-sm font-medium transition lg:min-h-0',
                  active ? 'bg-accent text-white' : 'text-white/65 hover:bg-white/10 hover:text-white',
                )}
              >
                <Icon className="h-4 w-4" />
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
