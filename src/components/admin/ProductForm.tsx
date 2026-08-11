'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useState, useRef } from 'react';
import { useFormState, useFormStatus } from 'react-dom';
import { Plus, Trash2, Loader2, Upload, X, GripVertical } from 'lucide-react';
import { saveProductAction, deleteProductAction, type ActionResult } from '@/app/admin/actions';
import { cn } from '@/lib/format';

interface VariantDraft {
  id?: string;
  label: string;
  price: string;
  originalPrice: string;
}

interface Props {
  categories: { id: string; name: string; parentId: string | null }[];
  brands: { id: string; name: string }[];
  product?: {
    id: string;
    name: string;
    slug: string;
    description: string | null;
    categoryId: string;
    brandId: string | null;
    petType: string | null;
    stock: number;
    featured: boolean;
    active: boolean;
    legacyId: string | null;
    variants: { id: string; label: string; price: number; originalPrice: number | null }[];
    images: { url: string }[];
  };
}

const initial: ActionResult = { ok: false };

export function ProductForm({ categories, brands, product }: Props) {
  const [state, formAction] = useFormState(saveProductAction, initial);

  const [variants, setVariants] = useState<VariantDraft[]>(
    product?.variants.length
      ? product.variants.map((v) => ({
          id: v.id,
          label: v.label,
          price: String(v.price),
          originalPrice: v.originalPrice ? String(v.originalPrice) : '',
        }))
      : [{ label: 'Unidad', price: '', originalPrice: '' }],
  );
  const [images, setImages] = useState<string[]>(product?.images.map((i) => i.url) ?? []);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const fileInput = useRef<HTMLInputElement>(null);

  async function handleFiles(files: FileList | null) {
    if (!files?.length) return;
    setUploading(true);
    setUploadError('');
    for (const file of Array.from(files).slice(0, 5)) {
      const fd = new FormData();
      fd.set('file', file);
      try {
        const res = await fetch('/api/admin/upload', { method: 'POST', body: fd });
        const data = await res.json();
        if (!res.ok) setUploadError(data.error ?? 'No se pudo subir la imagen');
        else setImages((prev) => [...prev, data.url]);
      } catch {
        setUploadError('Falló la subida');
      }
    }
    setUploading(false);
    if (fileInput.current) fileInput.current.value = '';
  }

  return (
    <form action={formAction} className="space-y-6">
      {product && <input type="hidden" name="id" value={product.id} />}

      {state.error && (
        <p role="alert" className="rounded-xl bg-red-50 px-4 py-3 text-sm font-medium text-red-600">
          {state.error}
        </p>
      )}
      {state.ok && state.message && (
        <p role="status" className="rounded-xl bg-green-50 px-4 py-3 text-sm font-medium text-green-700">
          {state.message}
        </p>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          {/* Datos básicos */}
          <Card title="Datos del producto">
            <Field label="Nombre" required>
              <input
                name="name"
                defaultValue={product?.name}
                required
                className="input"
                placeholder="Ej: ROYAL CANIN ADULTO MINI"
              />
            </Field>

            <Field label="Descripción" hint="Opcional. Aparece en la ficha y ayuda al SEO.">
              <textarea name="description" defaultValue={product?.description ?? ''} rows={3} className="input" />
            </Field>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Categoría" required>
                <select name="categoryId" defaultValue={product?.categoryId ?? ''} required className="input">
                  <option value="">Elegir…</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.parentId ? '   ' : ''}
                      {c.name}
                    </option>
                  ))}
                </select>
              </Field>

              <Field label="Marca">
                <select name="brandId" defaultValue={product?.brandId ?? ''} className="input">
                  <option value="">Sin marca</option>
                  {brands.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name}
                    </option>
                  ))}
                </select>
              </Field>

              <Field label="Para qué mascota" hint="Se usa en el filtro Perros/Gatos.">
                <select name="petType" defaultValue={product?.petType ?? ''} className="input">
                  <option value="">Indistinto</option>
                  <option value="PERRO">Perros</option>
                  <option value="GATO">Gatos</option>
                  <option value="OTRO">Otros</option>
                </select>
              </Field>

              <Field label="Stock" hint="0 = se muestra como agotado.">
                <input type="number" min={0} name="stock" defaultValue={product?.stock ?? 0} className="input" />
              </Field>
            </div>
          </Card>

          {/* Variantes */}
          <Card
            title="Presentaciones y precios"
            action={
              <button
                type="button"
                onClick={() => setVariants((v) => [...v, { label: '', price: '', originalPrice: '' }])}
                className="flex items-center gap-1.5 text-sm font-semibold text-accent hover:underline"
              >
                <Plus className="h-4 w-4" /> Agregar
              </button>
            }
          >
            <div className="space-y-3">
              <div className="hidden gap-3 text-xs font-semibold uppercase tracking-wide text-navy/45 sm:grid sm:grid-cols-[1fr_1fr_1fr_auto]">
                <span>Presentación</span>
                <span>Precio</span>
                <span>Precio tachado (oferta)</span>
                <span />
              </div>

              {variants.map((v, i) => (
                <div key={i} className="grid gap-3 sm:grid-cols-[1fr_1fr_1fr_auto]">
                  {v.id && <input type="hidden" name={`variant_${i}_id`} value={v.id} />}
                  <input
                    name={`variant_${i}_label`}
                    value={v.label}
                    onChange={(e) =>
                      setVariants((prev) => prev.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)))
                    }
                    placeholder="15KG / T2 / Unidad"
                    className="input"
                  />
                  <input
                    type="number"
                    min={0}
                    name={`variant_${i}_price`}
                    value={v.price}
                    onChange={(e) =>
                      setVariants((prev) => prev.map((x, j) => (j === i ? { ...x, price: e.target.value } : x)))
                    }
                    placeholder="Precio que se cobra"
                    className="input tabular"
                  />
                  <input
                    type="number"
                    min={0}
                    name={`variant_${i}_originalPrice`}
                    value={v.originalPrice}
                    onChange={(e) =>
                      setVariants((prev) => prev.map((x, j) => (j === i ? { ...x, originalPrice: e.target.value } : x)))
                    }
                    placeholder="Vacío = sin oferta"
                    className="input tabular"
                  />
                  <button
                    type="button"
                    onClick={() => setVariants((prev) => prev.filter((_, j) => j !== i))}
                    disabled={variants.length === 1}
                    aria-label="Quitar presentación"
                    className="flex h-10 w-10 items-center justify-center rounded-lg text-navy/40 transition hover:bg-red-50 hover:text-red-500 disabled:opacity-30"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}

              <p className="text-xs text-navy/45">
                El precio tachado sólo se muestra si es mayor al precio que se cobra. Así no se puede publicar una
                &ldquo;oferta&rdquo; que en realidad sea más cara.
              </p>
            </div>
          </Card>

          {/* Imágenes */}
          <Card title="Fotos">
            {images.map((url) => (
              <input key={url} type="hidden" name="imageUrls" value={url} />
            ))}

            <div className="flex flex-wrap gap-3">
              {images.map((url, i) => (
                <div key={url} className="group relative h-24 w-24 overflow-hidden rounded-xl border border-line bg-white">
                  <Image src={url} alt="" fill sizes="96px" className="object-contain p-1" />
                  {i === 0 && (
                    <span className="absolute inset-x-0 bottom-0 bg-navy/75 py-0.5 text-center text-[11px] font-semibold text-white">
                      Principal
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={() => setImages((prev) => prev.filter((u) => u !== url))}
                    aria-label="Quitar foto"
                    className="absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded-full bg-white/90 text-navy/60 opacity-0 transition group-hover:opacity-100 hover:text-red-500"
                  >
                    <X className="h-3 w-3" />
                  </button>
                  {i > 0 && (
                    <button
                      type="button"
                      onClick={() =>
                        setImages((prev) => {
                          const next = [...prev];
                          [next[i - 1], next[i]] = [next[i], next[i - 1]];
                          return next;
                        })
                      }
                      aria-label="Mover antes"
                      className="absolute left-1 top-1 flex h-6 w-6 items-center justify-center rounded-full bg-white/90 text-navy/60 opacity-0 transition group-hover:opacity-100"
                    >
                      <GripVertical className="h-3 w-3" />
                    </button>
                  )}
                </div>
              ))}

              <button
                type="button"
                onClick={() => fileInput.current?.click()}
                disabled={uploading}
                className="flex h-24 w-24 flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed border-line text-navy/40 transition hover:border-accent hover:text-accent"
              >
                {uploading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Upload className="h-5 w-5" />}
                <span className="text-[11px] font-semibold">{uploading ? 'Subiendo…' : 'Subir'}</span>
              </button>
            </div>

            <input
              ref={fileInput}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/avif"
              multiple
              onChange={(e) => handleFiles(e.target.files)}
              className="hidden"
            />

            {uploadError && <p className="text-sm font-medium text-red-500">{uploadError}</p>}
            <p className="text-xs text-navy/45">
              La primera foto es la que se ve en el catálogo. Se convierten a WebP con fondo blanco automáticamente.
            </p>
          </Card>
        </div>

        {/* Columna lateral */}
        <div className="space-y-6">
          <Card title="Publicación">
            <label className="flex items-center justify-between gap-3 py-2">
              <span className="text-sm font-medium text-navy">Visible en la tienda</span>
              <input type="checkbox" name="active" defaultChecked={product?.active ?? true} className="h-5 w-9 accent-accent" />
            </label>
            <label className="flex items-center justify-between gap-3 py-2">
              <span className="text-sm font-medium text-navy">Destacado</span>
              <input type="checkbox" name="featured" defaultChecked={product?.featured ?? false} className="h-5 w-9 accent-accent" />
            </label>
            <p className="text-xs text-navy/45">Los destacados salen en el carrusel de la portada.</p>

            {product && (
              <div className="mt-4 space-y-2 border-t border-line pt-4 text-xs text-navy/50">
                <p>
                  URL:{' '}
                  <Link href={`/producto/${product.slug}`} target="_blank" className="font-medium text-accent hover:underline">
                    /producto/{product.slug}
                  </Link>
                </p>
                {product.legacyId && <p className="tabular">Código del Sheet: {product.legacyId}</p>}
              </div>
            )}
          </Card>

          <div className="flex flex-col gap-2">
            <SubmitButton isNew={!product} />
            <Link href="/admin/productos" className="btn-outline rounded-xl py-3 text-center text-sm font-semibold">
              Volver
            </Link>
            {product && <DeleteButton productId={product.id} />}
          </div>
        </div>
      </div>
    </form>
  );
}

function SubmitButton({ isNew }: { isNew: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className="btn-primary flex items-center justify-center gap-2 rounded-xl py-3 font-semibold">
      {pending && <Loader2 className="h-4 w-4 animate-spin" />}
      {isNew ? 'Crear producto' : 'Guardar cambios'}
    </button>
  );
}

function DeleteButton({ productId }: { productId: string }) {
  const [confirming, setConfirming] = useState(false);
  const [msg, setMsg] = useState('');

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={async () => {
          if (!confirming) {
            setConfirming(true);
            setTimeout(() => setConfirming(false), 4000);
            return;
          }
          const res = await deleteProductAction(productId);
          if (res.error) setMsg(res.error);
          else window.location.href = '/admin/productos';
        }}
        className={cn(
          'w-full rounded-xl py-3 text-sm font-semibold transition',
          confirming ? 'bg-red-500 text-white' : 'text-navy/50 hover:text-red-500',
        )}
      >
        {confirming ? '¿Seguro? Tocá de nuevo' : 'Eliminar producto'}
      </button>
      {msg && <p className="text-xs text-red-500">{msg}</p>}
    </div>
  );
}

function Card({ title, action, children }: { title: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-line bg-white p-5">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="font-serif text-lg font-bold text-navy">{title}</h2>
        {action}
      </div>
      <div className="space-y-4">{children}</div>
    </section>
  );
}

function Field({
  label,
  hint,
  required,
  children,
}: {
  label: string;
  hint?: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-navy/55">
        {label}
        {required && <span className="ml-0.5 text-accent">*</span>}
      </span>
      {children}
      {hint && <span className="mt-1 block text-xs text-navy/45">{hint}</span>}
    </label>
  );
}
