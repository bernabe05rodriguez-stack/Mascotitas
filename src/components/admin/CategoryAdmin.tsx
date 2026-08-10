'use client';

import { useState, useTransition } from 'react';
import { useFormState, useFormStatus } from 'react-dom';
import Link from 'next/link';
import { Loader2, Plus, Trash2, Pencil, CornerDownRight } from 'lucide-react';
import { saveCategoryAction, deleteCategoryAction, type ActionResult } from '@/app/admin/actions';
import { cn } from '@/lib/format';

interface Category {
  id: string;
  name: string;
  slug: string;
  icon: string | null;
  order: number;
  parentId: string | null;
  _count: { products: number };
}

const initial: ActionResult = { ok: false };

export function CategoryAdmin({ categories }: { categories: Category[] }) {
  const [editing, setEditing] = useState<Category | null>(null);
  const [creating, setCreating] = useState(false);

  const tops = categories.filter((c) => !c.parentId);
  const childrenOf = (id: string) => categories.filter((c) => c.parentId === id);

  return (
    <div className="space-y-6">
      {(creating || editing) && (
        <CategoryForm
          categories={categories}
          category={editing}
          onDone={() => {
            setEditing(null);
            setCreating(false);
          }}
        />
      )}

      {!creating && !editing && (
        <button
          type="button"
          onClick={() => setCreating(true)}
          className="btn-primary flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-semibold"
        >
          <Plus className="h-4 w-4" /> Nueva categoría
        </button>
      )}

      <div className="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-white">
        {tops.map((c) => (
          <div key={c.id}>
            <CategoryRow category={c} onEdit={() => setEditing(c)} />
            {childrenOf(c.id).map((child) => (
              <CategoryRow key={child.id} category={child} nested onEdit={() => setEditing(child)} />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

function CategoryRow({ category, nested, onEdit }: { category: Category; nested?: boolean; onEdit: () => void }) {
  const [pending, startTransition] = useTransition();
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState('');

  return (
    <div className={cn('flex items-center justify-between gap-3 px-4 py-3', nested && 'border-t border-line/50 bg-bg/40 pl-10')}>
      <div className="flex min-w-0 items-center gap-2">
        {nested && <CornerDownRight className="h-3.5 w-3.5 shrink-0 text-navy/25" />}
        <div className="min-w-0">
          <p className="truncate font-semibold text-navy">{category.name}</p>
          <p className="text-xs text-navy/45">
            <Link href={`/catalogo?category=${category.slug}`} target="_blank" className="hover:text-accent">
              /{category.slug}
            </Link>
            <span className="ml-2 tabular">{category._count.products} productos</span>
          </p>
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-1">
        {error && <span className="mr-2 text-xs text-red-500">{error}</span>}
        <button
          type="button"
          onClick={onEdit}
          aria-label={`Editar ${category.name}`}
          className="flex h-8 w-8 items-center justify-center rounded-lg text-navy/40 transition hover:bg-bg-2 hover:text-navy"
        >
          <Pencil className="h-4 w-4" />
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={() => {
            if (!confirming) {
              setConfirming(true);
              setError('');
              setTimeout(() => setConfirming(false), 4000);
              return;
            }
            startTransition(async () => {
              const res = await deleteCategoryAction(category.id);
              if (res.error) setError(res.error);
              setConfirming(false);
            });
          }}
          aria-label={`Eliminar ${category.name}`}
          className={cn(
            'flex h-8 items-center justify-center gap-1 rounded-lg px-2 text-xs font-semibold transition',
            confirming ? 'bg-red-500 text-white' : 'w-8 text-navy/40 hover:bg-red-50 hover:text-red-500',
          )}
        >
          <Trash2 className="h-4 w-4" />
          {confirming && 'Confirmar'}
        </button>
      </div>
    </div>
  );
}

function CategoryForm({
  categories,
  category,
  onDone,
}: {
  categories: Category[];
  category: Category | null;
  onDone: () => void;
}) {
  const [state, formAction] = useFormState(saveCategoryAction, initial);

  return (
    <form action={formAction} className="space-y-4 rounded-2xl border border-line bg-white p-5">
      {category && <input type="hidden" name="id" value={category.id} />}

      <h2 className="font-serif text-lg font-bold text-navy">{category ? `Editar ${category.name}` : 'Nueva categoría'}</h2>

      {state.error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{state.error}</p>}
      {state.ok && state.message && (
        <p className="rounded-lg bg-green-50 px-3 py-2 text-sm text-green-700">{state.message}</p>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <label className="block">
          <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-navy/55">Nombre</span>
          <input name="name" defaultValue={category?.name} required className="input" />
        </label>

        <label className="block">
          <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-navy/55">Dentro de</span>
          <select name="parentId" defaultValue={category?.parentId ?? ''} className="input">
            <option value="">Categoría principal</option>
            {categories
              .filter((c) => !c.parentId && c.id !== category?.id)
              .map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
          </select>
        </label>

        <label className="block">
          <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-navy/55">Ícono</span>
          <input name="icon" defaultValue={category?.icon ?? ''} placeholder="dog, cat, bone…" className="input" />
        </label>

        <label className="block">
          <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-navy/55">Orden</span>
          <input type="number" name="order" defaultValue={category?.order ?? 0} className="input tabular" />
        </label>
      </div>

      <div className="flex gap-2">
        <SaveButton />
        <button type="button" onClick={onDone} className="btn-outline rounded-xl px-5 py-2.5 text-sm font-semibold">
          Cerrar
        </button>
      </div>
    </form>
  );
}

function SaveButton() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className="btn-primary flex items-center gap-2 rounded-xl px-6 py-2.5 text-sm font-semibold">
      {pending && <Loader2 className="h-4 w-4 animate-spin" />}
      Guardar
    </button>
  );
}
