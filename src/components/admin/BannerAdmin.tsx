'use client';

import Image from 'next/image';
import { useRef, useState, useTransition } from 'react';
import { useFormState, useFormStatus } from 'react-dom';
import { Loader2, Plus, Trash2, Pencil, Eye, EyeOff, ArrowUp, ArrowDown, Upload, X, ImageIcon } from 'lucide-react';
import {
  saveBannerAction,
  toggleBannerAction,
  deleteBannerAction,
  moveBannerAction,
  type ActionResult,
} from '@/app/admin/actions';
import { formatDate, cn } from '@/lib/format';

interface Banner {
  id: string;
  title: string;
  imageUrl: string;
  mobileUrl: string | null;
  linkUrl: string | null;
  alt: string | null;
  active: boolean;
  order: number;
  startsAt: Date | null;
  endsAt: Date | null;
}

const initial: ActionResult = { ok: false };

export function BannerAdmin({ banners }: { banners: Banner[] }) {
  const [editing, setEditing] = useState<Banner | null>(null);
  const [creating, setCreating] = useState(false);

  const cerrar = () => {
    setEditing(null);
    setCreating(false);
  };

  return (
    <div className="space-y-6">
      {(creating || editing) && <BannerForm banner={editing} onDone={cerrar} />}

      {!creating && !editing && (
        <button
          type="button"
          onClick={() => setCreating(true)}
          className="btn-primary flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-semibold"
        >
          <Plus className="h-4 w-4" /> Nuevo banner
        </button>
      )}

      {banners.length === 0 ? (
        <div className="rounded-2xl border border-line bg-white p-12 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-accent/10">
            <ImageIcon className="h-6 w-6 text-accent" />
          </div>
          <p className="font-semibold text-navy">Todavía no hay banners</p>
          <p className="mx-auto mt-1 max-w-md text-sm text-navy/55">
            Mientras no haya ninguno, el carrusel muestra sólo los productos destacados.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {banners.map((b, i) => (
            <BannerRow
              key={b.id}
              banner={b}
              primero={i === 0}
              ultimo={i === banners.length - 1}
              onEdit={() => {
                setCreating(false);
                setEditing(b);
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function BannerRow({
  banner,
  primero,
  ultimo,
  onEdit,
}: {
  banner: Banner;
  primero: boolean;
  ultimo: boolean;
  onEdit: () => void;
}) {
  const [pending, startTransition] = useTransition();
  const [confirming, setConfirming] = useState(false);

  const vencido = banner.endsAt && new Date(banner.endsAt) < new Date();
  const futuro = banner.startsAt && new Date(banner.startsAt) > new Date();

  return (
    <article className={cn('rounded-2xl border border-line bg-white p-4', !banner.active && 'opacity-60')}>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
        <div className="relative h-24 w-full shrink-0 overflow-hidden rounded-xl border border-line bg-bg-2 sm:h-20 sm:w-48">
          <Image src={banner.imageUrl} alt="" fill sizes="192px" className="object-cover" />
        </div>

        <div className="min-w-0 flex-1">
          <p className="font-semibold text-navy">{banner.title}</p>
          <p className="truncate text-xs text-navy/50">
            {banner.linkUrl ? `Lleva a ${banner.linkUrl}` : 'Sin link'}
            {banner.mobileUrl && ' · con versión para celular'}
          </p>

          <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
            {!banner.active && <Estado texto="Desactivado" tono="apagado" />}
            {banner.active && vencido && <Estado texto="Vencido" tono="alerta" />}
            {banner.active && futuro && <Estado texto="Programado" tono="info" />}
            {banner.active && !vencido && !futuro && <Estado texto="En la portada" tono="ok" />}

            {(banner.startsAt || banner.endsAt) && (
              <span className="text-navy/45">
                {banner.startsAt ? `desde ${formatDate(banner.startsAt)}` : ''}
                {banner.endsAt ? ` hasta ${formatDate(banner.endsAt)}` : ''}
              </span>
            )}
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-1">
          <IconBtn
            label="Subir en el orden"
            disabled={primero || pending}
            onClick={() => startTransition(() => void moveBannerAction(banner.id, 'up'))}
          >
            <ArrowUp className="h-4 w-4" />
          </IconBtn>
          <IconBtn
            label="Bajar en el orden"
            disabled={ultimo || pending}
            onClick={() => startTransition(() => void moveBannerAction(banner.id, 'down'))}
          >
            <ArrowDown className="h-4 w-4" />
          </IconBtn>
          <IconBtn
            label={banner.active ? 'Sacar de la portada' : 'Mostrar en la portada'}
            disabled={pending}
            onClick={() => startTransition(() => void toggleBannerAction(banner.id))}
          >
            {banner.active ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
          </IconBtn>
          <IconBtn label="Editar" onClick={onEdit}>
            <Pencil className="h-4 w-4" />
          </IconBtn>
          <button
            type="button"
            disabled={pending}
            onClick={() => {
              if (!confirming) {
                setConfirming(true);
                setTimeout(() => setConfirming(false), 4000);
                return;
              }
              startTransition(() => void deleteBannerAction(banner.id));
            }}
            aria-label="Eliminar banner"
            className={cn(
              'flex h-10 items-center justify-center gap-1 rounded-lg px-2 text-xs font-semibold transition sm:h-9',
              confirming ? 'bg-red-500 text-white' : 'w-10 text-navy/40 hover:bg-red-50 hover:text-red-500 sm:w-9',
            )}
          >
            <Trash2 className="h-4 w-4" />
            {confirming && 'Confirmar'}
          </button>
        </div>
      </div>
    </article>
  );
}

function Estado({ texto, tono }: { texto: string; tono: 'ok' | 'alerta' | 'info' | 'apagado' }) {
  const tonos = {
    ok: 'bg-green-50 text-green-700',
    alerta: 'bg-amber-50 text-amber-700',
    info: 'bg-blue-50 text-blue-700',
    apagado: 'bg-bg-2 text-navy/50',
  };
  return <span className={`rounded-full px-2.5 py-1 font-semibold ${tonos[tono]}`}>{texto}</span>;
}

function IconBtn({
  label,
  disabled,
  onClick,
  children,
}: {
  label: string;
  disabled?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className="flex h-10 w-10 items-center justify-center rounded-lg text-navy/40 transition hover:bg-bg-2 hover:text-navy disabled:opacity-25 sm:h-9 sm:w-9"
    >
      {children}
    </button>
  );
}

/* ------------------------------------------------------------- formulario */

function BannerForm({ banner, onDone }: { banner: Banner | null; onDone: () => void }) {
  const [state, formAction] = useFormState(saveBannerAction, initial);
  const [imageUrl, setImageUrl] = useState(banner?.imageUrl ?? '');
  const [mobileUrl, setMobileUrl] = useState(banner?.mobileUrl ?? '');

  const iso = (d: Date | null) => (d ? new Date(d).toISOString().slice(0, 10) : '');

  return (
    <form action={formAction} className="space-y-5 rounded-2xl border border-line bg-white p-5">
      {banner && <input type="hidden" name="id" value={banner.id} />}
      <input type="hidden" name="imageUrl" value={imageUrl} />
      <input type="hidden" name="mobileUrl" value={mobileUrl} />

      <h2 className="font-serif text-lg font-bold text-navy">{banner ? `Editar ${banner.title}` : 'Nuevo banner'}</h2>

      {state.error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{state.error}</p>}
      {state.ok && state.message && (
        <p className="rounded-lg bg-green-50 px-3 py-2 text-sm text-green-700">{state.message}</p>
      )}

      <div className="grid gap-5 lg:grid-cols-2">
        <Uploader
          label="Imagen para computadora"
          hint="Apaisada, idealmente 1600×500. Se convierte sola a WebP sin recortarse."
          value={imageUrl}
          onChange={setImageUrl}
          aspect="aspect-[16/5]"
        />
        <Uploader
          label="Imagen para celular"
          hint="Opcional, más cuadrada. Sin esto, en el celular se recorta la de arriba."
          value={mobileUrl}
          onChange={setMobileUrl}
          aspect="aspect-[4/3]"
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Campo label="Nombre" hint="Sólo para reconocerlo acá.">
          <input name="title" defaultValue={banner?.title} required placeholder="Envío en el día" className="input" />
        </Campo>

        <Campo label="Link" hint="A dónde va al tocarlo. Ej: /catalogo?offers=1">
          <input name="linkUrl" defaultValue={banner?.linkUrl ?? ''} placeholder="/catalogo" className="input" />
        </Campo>

        <Campo label="Texto alternativo" hint="Qué dice la placa. Lo usan los lectores de pantalla y Google.">
          <input name="alt" defaultValue={banner?.alt ?? ''} placeholder="Envío bonificado en compras desde $20.000" className="input" />
        </Campo>

        <Campo label="Orden" hint="Menor number, más arriba en el carrusel.">
          <input type="number" name="order" defaultValue={banner?.order ?? 0} className="input tabular" />
        </Campo>

        <Campo label="Mostrar desde" hint="Opcional. Antes de esa fecha no aparece.">
          <input type="date" name="startsAt" defaultValue={iso(banner?.startsAt ?? null)} className="input" />
        </Campo>

        <Campo label="Mostrar hasta" hint="Opcional. Después de esa fecha se apaga solo.">
          <input type="date" name="endsAt" defaultValue={iso(banner?.endsAt ?? null)} className="input" />
        </Campo>
      </div>

      <label className="flex items-center gap-3">
        <input type="checkbox" name="active" defaultChecked={banner?.active ?? true} className="h-5 w-9 accent-accent" />
        <span className="text-sm font-medium text-navy">Activo</span>
      </label>

      <div className="flex gap-2">
        <GuardarBtn />
        <button type="button" onClick={onDone} className="btn-outline rounded-xl px-5 py-2.5 text-sm font-semibold">
          Cerrar
        </button>
      </div>
    </form>
  );
}

function Uploader({
  label,
  hint,
  value,
  onChange,
  aspect,
}: {
  label: string;
  hint: string;
  value: string;
  onChange: (url: string) => void;
  aspect: string;
}) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const input = useRef<HTMLInputElement>(null);

  async function subir(file: File | undefined) {
    if (!file) return;
    setUploading(true);
    setError('');
    const fd = new FormData();
    fd.set('file', file);
    // Modo banner: no se recorta a cuadrado ni se le pone fondo blanco.
    fd.set('mode', 'banner');
    try {
      const res = await fetch('/api/admin/upload', { method: 'POST', body: fd });
      const data = await res.json();
      if (!res.ok) setError(data.error ?? 'No se pudo subir');
      else onChange(data.url);
    } catch {
      setError('Falló la subida');
    } finally {
      setUploading(false);
      if (input.current) input.current.value = '';
    }
  }

  return (
    <div>
      <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-navy/55">{label}</span>

      {value ? (
        <div className={`group relative w-full overflow-hidden rounded-xl border border-line bg-bg-2 ${aspect}`}>
          <Image src={value} alt="" fill sizes="600px" className="object-cover" />
          <button
            type="button"
            onClick={() => onChange('')}
            aria-label="Quitar imagen"
            className="absolute right-2 top-2 flex h-9 w-9 items-center justify-center rounded-full bg-white/90 text-navy/60 transition hover:text-red-500"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => input.current?.click()}
          disabled={uploading}
          className={`flex w-full flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-line text-navy/40 transition hover:border-accent hover:text-accent ${aspect}`}
        >
          {uploading ? <Loader2 className="h-6 w-6 animate-spin" /> : <Upload className="h-6 w-6" />}
          <span className="text-xs font-semibold">{uploading ? 'Subiendo…' : 'Subir imagen'}</span>
        </button>
      )}

      <input
        ref={input}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/avif"
        onChange={(e) => subir(e.target.files?.[0])}
        className="hidden"
      />

      {error && <p className="mt-1 text-sm font-medium text-red-500">{error}</p>}
      <p className="mt-1 text-xs text-navy/45">{hint}</p>
    </div>
  );
}

function GuardarBtn() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className="btn-primary flex items-center gap-2 rounded-xl px-6 py-2.5 text-sm font-semibold">
      {pending && <Loader2 className="h-4 w-4 animate-spin" />}
      Guardar
    </button>
  );
}

function Campo({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-navy/55">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-navy/45">{hint}</span>}
    </label>
  );
}
