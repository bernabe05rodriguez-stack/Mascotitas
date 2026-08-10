'use client';

import { useFormState, useFormStatus } from 'react-dom';
import { Loader2 } from 'lucide-react';
import { saveSettingsAction, type ActionResult } from '@/app/admin/actions';
import type { ShopSettings } from '@/lib/settings';

const initial: ActionResult = { ok: false };

const fmtRanges = (r: [string, string][]) => r.map(([a, b]) => `${a}-${b}`).join(', ');

export function SettingsForm({ settings }: { settings: ShopSettings }) {
  const [state, formAction] = useFormState(saveSettingsAction, initial);

  return (
    <form action={formAction} className="max-w-3xl space-y-6">
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

      <Card title="Contacto">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="WhatsApp" hint="Con código de país y sin espacios. Ej: 5492615016555">
            <input name="whatsapp" defaultValue={settings.whatsapp} className="input tabular" />
          </Field>
          <Field label="Ciudad">
            <input name="city" defaultValue={settings.city} className="input" />
          </Field>
          <Field label="Dirección">
            <input name="address" defaultValue={settings.address} className="input" />
          </Field>
          <Field label="Facebook">
            <input name="facebook" defaultValue={settings.facebook} className="input" />
          </Field>
          <Field label="Instagram">
            <input name="instagram" defaultValue={settings.instagram} className="input" />
          </Field>
        </div>
      </Card>

      <Card title="Envío">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Envío bonificado desde" hint="Total del pedido a partir del cual el envío es gratis.">
            <input type="number" min={0} name="freeShippingThreshold" defaultValue={settings.freeShippingThreshold} className="input tabular" />
          </Field>
          <Field label="Costo del envío" hint="El monto que se muestra tachado cuando es bonificado.">
            <input type="number" min={0} name="shippingCost" defaultValue={settings.shippingCost} className="input tabular" />
          </Field>
        </div>
      </Card>

      <Card title="Horarios">
        <Field label="Lunes a viernes" hint='Formato "09:00-22:00". Si cierran al mediodía, separá con coma: "09:00-14:00, 17:30-22:00"'>
          <input name="scheduleWeekday" defaultValue={fmtRanges(settings.scheduleWeekday)} className="input tabular" />
        </Field>
        <Field label="Sábados, domingos y feriados">
          <input name="scheduleWeekend" defaultValue={fmtRanges(settings.scheduleWeekend)} className="input tabular" />
        </Field>
        <Field
          label="Feriados"
          hint="Fechas AAAA-MM-DD separadas por coma. En estos días se aplica el horario de fin de semana y el cartel de Abierto/Cerrado lo tiene en cuenta."
        >
          <textarea name="holidays" defaultValue={settings.holidays.join(', ')} rows={4} className="input tabular" />
        </Field>
      </Card>

      <Card title="Aviso en la tienda">
        <Field label="Mensaje" hint="Dejalo vacío para no mostrar nada. Ej: “Cerrado por vacaciones del 1 al 10 de enero”.">
          <input name="announcement" defaultValue={settings.announcement} className="input" />
        </Field>
      </Card>

      <SubmitButton />
    </form>
  );
}

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className="btn-primary flex items-center gap-2 rounded-xl px-8 py-3 font-semibold">
      {pending && <Loader2 className="h-4 w-4 animate-spin" />}
      Guardar configuración
    </button>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-line bg-white p-5">
      <h2 className="mb-4 font-serif text-lg font-bold text-navy">{title}</h2>
      <div className="space-y-4">{children}</div>
    </section>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-navy/55">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-navy/45">{hint}</span>}
    </label>
  );
}
