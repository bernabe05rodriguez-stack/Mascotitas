import Link from 'next/link';
import { PawPrint } from 'lucide-react';

export default function NotFound() {
  return (
    <div className="flex min-h-[70vh] flex-col items-center justify-center px-4 text-center">
      <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-3xl bg-accent/10">
        <PawPrint className="h-9 w-9 text-accent" />
      </div>
      <h1 className="text-3xl font-extrabold text-navy md:text-4xl">No encontramos esta página</h1>
      <p className="mt-3 max-w-sm text-navy/60">
        Puede que el producto ya no esté disponible o que el link esté mal escrito.
      </p>
      <Link href="/catalogo" className="btn-primary mt-8 rounded-full px-7 py-3 font-semibold">
        Ver el catálogo
      </Link>
    </div>
  );
}
