import { getSettings } from '@/lib/settings';
import { SettingsForm } from '@/components/admin/SettingsForm';

export const dynamic = 'force-dynamic';

export default async function AdminConfigPage() {
  const settings = await getSettings();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-serif text-2xl font-bold text-navy">Configuración</h1>
        <p className="text-sm text-navy/55">
          Horarios, contacto y envío. Antes esto estaba escrito a mano dentro del código.
        </p>
      </div>
      <SettingsForm settings={settings} />
    </div>
  );
}
