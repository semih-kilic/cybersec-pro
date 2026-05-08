/**
 * Scan Templates Page
 * Phase 3 — Pre-defined and custom scan configurations
 */
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { useScanTemplates, useCreateScanTemplate, useDeleteScanTemplate } from '../../hooks/useApiQueries';

const TOOL_ICONS: Record<string, string> = {
  nmap: '🔍', sqlmap: '💉', testssl: '🔐', wpscan: '🌐',
  nikto: '🕷️', metasploit: '💥', burpsuite: '🔬', default: '⚙️',
};

interface Template {
  id: string;
  name: string;
  description?: string;
  tool_id?: string;
  parameters?: Record<string, unknown>;
  is_public: boolean;
  use_count: number;
  created_at: string;
}

export default function ScanTemplatesPage() {
  const { t } = useTranslation();
  const { data, isLoading } = useScanTemplates();
  const createMutation = useCreateScanTemplate();
  const deleteMutation = useDeleteScanTemplate();
  const [showForm, setShowForm] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [form, setForm] = useState({
    name: '',
    description: '',
    tool_id: '',
    parameters: '{}',
    is_public: false,
  });
  const [formErr, setFormErr] = useState('');

  const templates: Template[] = ((data as { templates?: Template[] }) ?? {})?.templates ?? [];
  const publicTemplates = templates.filter(t => t.is_public);
  const privateTemplates = templates.filter(t => !t.is_public);

  const handleCreate = async () => {
    setFormErr('');
    if (!form.name.trim()) { setFormErr('Template name is required'); return; }
    let params: Record<string, unknown> = {};
    try {
      params = JSON.parse(form.parameters || '{}');
    } catch {
      setFormErr('Parameters must be valid JSON'); return;
    }
    try {
      await createMutation.mutateAsync({
        name: form.name.trim(),
        description: form.description.trim() || undefined,
        tool_id: form.tool_id.trim() || undefined,
        parameters: params,
        is_public: form.is_public,
      });
      setShowForm(false);
      setForm({ name: '', description: '', tool_id: '', parameters: '{}', is_public: false });
    } catch (e: unknown) {
      setFormErr(e instanceof Error ? e.message : 'Failed to create template');
    }
  };

  return (
    <div className="p-6 space-y-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">{t('scanTemplates.title')}</h1>
          <p className="text-gray-400 text-sm mt-1">{t('scanTemplates.subtitle')}</p>
        </div>
        <button
          onClick={() => setShowForm(s => !s)}
          className="px-4 py-2 bg-cyan-600 text-white rounded-lg hover:bg-cyan-700 transition font-medium"
        >
          {t('scanTemplates.createTemplate')}
        </button>
      </div>

      {/* Create form */}
      {showForm && (
        <motion.div
          initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}
          className="p-5 bg-gray-800 border border-cyan-500/30 rounded-xl space-y-4"
        >
          <h2 className="text-white font-semibold">{t('scanTemplates.newTemplate', 'New Scan Template')}</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-gray-400 text-xs mb-1">{t('scanTemplates.templateName', 'Template Name *')}</label>
              <input type="text" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                placeholder={t('scanTemplates.templateNamePlaceholder', 'e.g. Quick Web Scan')}
                className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white text-sm focus:outline-none focus:border-cyan-500" />
            </div>
            <div>
              <label className="block text-gray-400 text-xs mb-1">{t('scanTemplates.tool', 'Tool')}</label>
              <input type="text" value={form.tool_id} onChange={e => setForm(f => ({ ...f, tool_id: e.target.value }))}
                placeholder="nmap, sqlmap, nikto…"
                className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white text-sm focus:outline-none focus:border-cyan-500" />
            </div>
          </div>
          <div>
            <label className="block text-gray-400 text-xs mb-1">{t('scanTemplates.description', 'Description')}</label>
            <input type="text" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
              placeholder={t('scanTemplates.descriptionPlaceholder', 'Brief description of this template')}
              className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white text-sm focus:outline-none focus:border-cyan-500" />
          </div>
          <div>
            <label className="block text-gray-400 text-xs mb-1">{t('scanTemplates.parametersJson', 'Parameters (JSON)')}</label>
            <textarea value={form.parameters} onChange={e => setForm(f => ({ ...f, parameters: e.target.value }))}
              rows={3}
              className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white text-sm font-mono focus:outline-none focus:border-cyan-500" />
          </div>
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={form.is_public} onChange={e => setForm(f => ({ ...f, is_public: e.target.checked }))} className="accent-cyan-500" />
            <span className="text-gray-300 text-sm">{t('scanTemplates.makePublic', 'Make public (visible to all org members)')}</span>
          </label>
          {formErr && <p className="text-red-400 text-sm">{formErr}</p>}
          <div className="flex gap-3">
            <button onClick={handleCreate} disabled={createMutation.isPending}
              className="px-4 py-2 bg-cyan-600 text-white rounded-lg hover:bg-cyan-700 transition disabled:opacity-50 text-sm">
              {createMutation.isPending ? t('scanTemplates.creating', 'Creating…') : t('scanTemplates.createBtn', 'Create Template')}
            </button>
            <button onClick={() => { setShowForm(false); setFormErr(''); }}
              className="px-4 py-2 bg-gray-700 text-gray-300 rounded-lg hover:bg-gray-600 transition text-sm">
              {t('scanTemplates.cancel', 'Cancel')}
            </button>
          </div>
        </motion.div>
      )}

      {isLoading && <div className="text-gray-500 text-sm">{t('scanTemplates.loading', 'Loading templates…')}</div>}

      {/* Public templates */}
      {publicTemplates.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3">{t('scanTemplates.builtInTemplates', 'Built-in Templates')}</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {publicTemplates.map(tpl => (
              <TemplateCard key={tpl.id} template={tpl} onDelete={deleteMutation.mutate} deleteConfirm={deleteConfirm} setDeleteConfirm={setDeleteConfirm} isOwned={false} />
            ))}
          </div>
        </div>
      )}

      {/* Private templates */}
      {privateTemplates.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3">{t('scanTemplates.yourTemplates', 'Your Templates')}</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {privateTemplates.map(tpl => (
              <TemplateCard key={tpl.id} template={tpl} onDelete={deleteMutation.mutate} deleteConfirm={deleteConfirm} setDeleteConfirm={setDeleteConfirm} isOwned={true} />
            ))}
          </div>
        </div>
      )}

      {!isLoading && templates.length === 0 && (
        <div className="p-8 bg-gray-800 rounded-xl text-center">
          <div className="text-4xl mb-3">📋</div>
          <p className="text-white font-medium">{t('scanTemplates.noTemplates', 'No templates yet')}</p>
          <p className="text-gray-400 text-sm mt-1">{t('scanTemplates.noTemplatesDesc', 'Create your first scan template to speed up security assessments.')}</p>
        </div>
      )}
    </div>
  );
}

function TemplateCard({ template, onDelete, deleteConfirm, setDeleteConfirm, isOwned }: {
  template: Template;
  onDelete: (id: string) => void;
  deleteConfirm: string | null;
  setDeleteConfirm: (id: string | null) => void;
  isOwned: boolean;
}) {
  const { t } = useTranslation();
  const icon = TOOL_ICONS[template.tool_id ?? ''] ?? TOOL_ICONS.default;
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }}
      className="p-4 bg-gray-800 rounded-xl border border-gray-700 hover:border-gray-600 transition flex flex-col gap-3"
    >
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-2">
          <span className="text-2xl">{icon}</span>
          <div>
            <p className="text-white font-medium text-sm">{template.name}</p>
            {template.tool_id && <p className="text-gray-500 text-xs font-mono">{template.tool_id}</p>}
          </div>
        </div>
        {template.is_public && (
          <span className="px-2 py-0.5 bg-cyan-500/20 text-cyan-400 rounded text-xs">{t('scanTemplates.public', 'Public')}</span>
        )}
      </div>
      {template.description && <p className="text-gray-400 text-xs leading-relaxed">{template.description}</p>}
      {template.parameters && Object.keys(template.parameters).length > 0 && (
        <pre className="bg-gray-900 rounded p-2 text-xs text-green-400 overflow-x-auto max-h-20">
          {JSON.stringify(template.parameters, null, 2)}
        </pre>
      )}
      <div className="flex items-center justify-between mt-auto pt-2 border-t border-gray-700">
        <span className="text-gray-500 text-xs">{t('scanTemplates.usedTimes', 'Used {{count}}×', { count: template.use_count })}</span>
        {isOwned && (
          deleteConfirm === template.id ? (
            <div className="flex gap-2">
              <button onClick={() => onDelete(template.id)} className="text-red-400 text-xs hover:text-red-300">{t('scanTemplates.confirm', 'Confirm')}</button>
              <button onClick={() => setDeleteConfirm(null)} className="text-gray-500 text-xs hover:text-gray-300">{t('scanTemplates.cancel', 'Cancel')}</button>
            </div>
          ) : (
            <button onClick={() => setDeleteConfirm(template.id)} className="text-red-400 text-xs hover:text-red-300">{t('scanTemplates.delete', 'Delete')}</button>
          )
        )}
      </div>
    </motion.div>
  );
}
