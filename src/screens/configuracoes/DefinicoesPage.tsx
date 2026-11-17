import { useState, useEffect, useCallback } from 'react';
import { User, Bell, Building2, Bot, RotateCcw, Save } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '@/src/components/ui/card';
import { Button } from '@/src/components/ui/button';
import { Input, FormField, Select, Textarea } from '@/src/components/ui/input';
import { Badge, Avatar } from '@/src/components/ui/badge';
import { useAuthStore } from '@/src/store/auth.store';
import { toast } from '@/src/store';
import { motion } from 'motion/react';
import { staggerContainer, staggerItem } from '@/src/lib/animations';
import {
  agentConfigService,
  type AgentConfig,
} from '@/src/services/agent-config.service';
import { DIRECCOES } from '@/lib/constants';
import { Checkbox } from '@/components/ui/checkbox';

type Tab = 'perfil' | 'preferencias' | 'direccoes' | 'agente';

const emptyAgent: AgentConfig = {
  system_prompt: '',
  mensagem_boas_vindas: '',
  email_escalacao: 'dpc@pumangol.ao',
  temperature: 0.25,
  max_tokens: 900,
  top_k: 6,
  min_relevance_score: 0.5,
  max_tool_steps: 3,
  reasoning_effort: 'low',
};

export default function DefinicoesPage() {
  const { user } = useAuthStore();
  const isAdmin = user?.role === 'rh_admin';
  const [tab, setTab] = useState<Tab>('perfil');
  const [prefs, setPrefs] = useState({
    tema: 'claro',
    idioma: 'pt-AO',
    notifEmailVagas: true,
    notifEmailOnboarding: true,
    notifEmailEscalacoes: true,
  });

  const [agentForm, setAgentForm] = useState<AgentConfig>(emptyAgent);
  const [agentDefaults, setAgentDefaults] = useState<AgentConfig | null>(null);
  const [agentLoading, setAgentLoading] = useState(false);
  const [agentSaving, setAgentSaving] = useState(false);
  const [agentDirty, setAgentDirty] = useState(false);

  const loadAgent = useCallback(async () => {
    if (!isAdmin) return;
    setAgentLoading(true);
    try {
      const { data, defaults } = await agentConfigService.getAdmin();
      setAgentForm(data);
      setAgentDefaults(defaults);
      setAgentDirty(false);
    } catch (err) {
      toast.error(
        'Config do agente',
        err instanceof Error ? err.message : 'Não foi possível carregar. Corre a migração 008 se necessário.'
      );
    } finally {
      setAgentLoading(false);
    }
  }, [isAdmin]);

  useEffect(() => {
    if (tab === 'agente' && isAdmin) loadAgent();
  }, [tab, isAdmin, loadAgent]);

  function handleSavePrefs() {
    toast.success('Preferências guardadas', 'As tuas preferências foram actualizadas.');
  }

  function patchAgent<K extends keyof AgentConfig>(key: K, value: AgentConfig[K]) {
    setAgentForm((f) => ({ ...f, [key]: value }));
    setAgentDirty(true);
  }

  async function handleSaveAgent() {
    setAgentSaving(true);
    try {
      const saved = await agentConfigService.update({
        system_prompt: agentForm.system_prompt,
        mensagem_boas_vindas: agentForm.mensagem_boas_vindas,
        email_escalacao: agentForm.email_escalacao,
        temperature: Number(agentForm.temperature),
        max_tokens: Number(agentForm.max_tokens),
        top_k: Number(agentForm.top_k),
        min_relevance_score: Number(agentForm.min_relevance_score),
        max_tool_steps: Number(agentForm.max_tool_steps),
        reasoning_effort: agentForm.reasoning_effort,
      });
      setAgentForm(saved);
      setAgentDirty(false);
      toast.success('Agente actualizado', 'As alterações aplicam-se nos próximos turnos (até 30s).');
    } catch (err) {
      toast.error('Erro ao guardar', err instanceof Error ? err.message : 'Falha na API');
    } finally {
      setAgentSaving(false);
    }
  }

  async function handleResetAgent() {
    if (!confirm('Restaurar defaults de fábrica do Agente DPC? O system prompt actual será substituído.')) {
      return;
    }
    setAgentSaving(true);
    try {
      const saved = await agentConfigService.reset();
      setAgentForm(saved);
      setAgentDirty(false);
      toast.success('Defaults restaurados', 'Configuração de fábrica aplicada.');
    } catch (err) {
      toast.error('Erro', err instanceof Error ? err.message : 'Falha ao restaurar');
    } finally {
      setAgentSaving(false);
    }
  }

  const tabs: { value: Tab; label: string; icon: typeof User; adminOnly?: boolean }[] = [
    { value: 'perfil', label: 'Perfil', icon: User },
    { value: 'preferencias', label: 'Preferências', icon: Bell },
    { value: 'direccoes', label: 'Direcções', icon: Building2 },
    { value: 'agente', label: 'Agente DPC', icon: Bot, adminOnly: true },
  ];

  return (
    <motion.div variants={staggerContainer} initial="hidden" animate="visible" className="space-y-6">
      <motion.div variants={staggerItem}>
        <h1 className="text-2xl font-bold text-navy-800">Definições</h1>
        <p className="text-navy-400 text-sm mt-1">
          Configuração do teu perfil, preferências, organização e do Agente DPC
        </p>
      </motion.div>

      <motion.div variants={staggerItem} className="flex gap-1 border-b border-navy-100 overflow-x-auto">
        {tabs
          .filter((t) => !t.adminOnly || isAdmin)
          .map((t) => (
            <button
              key={t.value}
              onClick={() => setTab(t.value)}
              className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 whitespace-nowrap ${
                tab === t.value
                  ? 'border-gold-500 text-navy-800'
                  : 'border-transparent text-navy-400 hover:text-navy-600'
              }`}
            >
              <t.icon className="w-4 h-4" />
              {t.label}
            </button>
          ))}
      </motion.div>

      {tab === 'perfil' && (
        <motion.div variants={staggerItem}>
          <Card>
            <CardHeader>
              <CardTitle>O Meu Perfil</CardTitle>
              <Badge variant="info" size="sm">SSO Microsoft</Badge>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 mb-6 pb-6 border-b border-navy-50">
                <Avatar name={user?.nome ?? 'Utilizador'} size="lg" />
                <div>
                  <p className="text-lg font-semibold text-navy-800">{user?.nome ?? '—'}</p>
                  <p className="text-sm text-navy-500">{user?.email ?? '—'}</p>
                  <Badge variant="accent" size="sm" className="mt-2">
                    {user?.role === 'rh_admin' ? 'RH Admin' : 'Novo Colaborador'}
                  </Badge>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField label="Nome">
                  <Input value={user?.nome ?? ''} disabled />
                </FormField>
                <FormField label="Email">
                  <Input value={user?.email ?? ''} disabled />
                </FormField>
                <FormField label="Departamento">
                  <Input value={user?.departamento ?? 'Direcção de Pessoas e Cultura'} disabled />
                </FormField>
                <FormField label="Perfil">
                  <Input value={user?.role === 'rh_admin' ? 'RH Admin' : 'Novo Colaborador'} disabled />
                </FormField>
              </div>

              <p className="text-xs text-navy-400 mt-4">
                Os dados do perfil são geridos pelo Microsoft Entra ID (SSO). Para alterações, contacta a DPC em{' '}
                <a href="mailto:dpc@pumangol.ao" className="text-gold-700 hover:underline">
                  dpc@pumangol.ao
                </a>
                .
              </p>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {tab === 'preferencias' && (
        <motion.div variants={staggerItem} className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Aparência</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField label="Tema" hint="Aplica-se em toda a plataforma">
                  <Select
                    options={[
                      { value: 'claro', label: 'Claro (recomendado)' },
                      { value: 'escuro', label: 'Escuro (em breve)' },
                      { value: 'sistema', label: 'Sistema' },
                    ]}
                    value={prefs.tema}
                    onChange={(v) => setPrefs((p) => ({ ...p, tema: v }))}
                  />
                </FormField>
                <FormField label="Idioma">
                  <Select
                    options={[{ value: 'pt-AO', label: 'Português (Angola)' }]}
                    value={prefs.idioma}
                    onChange={(v) => setPrefs((p) => ({ ...p, idioma: v }))}
                  />
                </FormField>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Notificações por Email</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {[
                  {
                    key: 'notifEmailVagas' as const,
                    label: 'Novas vagas e movimentos no pipeline',
                    desc: 'Recebe email quando um candidato avança',
                  },
                  {
                    key: 'notifEmailOnboarding' as const,
                    label: 'Estado do onboarding',
                    desc: 'Alertas sobre atrasos e conclusões',
                  },
                  {
                    key: 'notifEmailEscalacoes' as const,
                    label: 'Escalações do chatbot',
                    desc: 'Perguntas escaladas para a DPC',
                  },
                ].map((n) => (
                  <label key={n.key} className="flex items-start gap-3 py-2 cursor-pointer">
                    <Checkbox
                      checked={prefs[n.key]}
                      onCheckedChange={(checked) => setPrefs((p) => ({ ...p, [n.key]: checked }))}
                      className="mt-1"
                    />
                    <div className="flex-1">
                      <p className="text-sm font-medium text-navy-800">{n.label}</p>
                      <p className="text-xs text-navy-400">{n.desc}</p>
                    </div>
                  </label>
                ))}
              </div>
            </CardContent>
          </Card>

          <div className="flex justify-end">
            <Button variant="primary" onClick={handleSavePrefs}>
              Guardar Preferências
            </Button>
          </div>
        </motion.div>
      )}

      {tab === 'direccoes' && (
        <motion.div variants={staggerItem}>
          <Card>
            <CardHeader>
              <CardTitle>Direcções e Gabinetes Pumangol</CardTitle>
              <span className="text-xs text-navy-400">{DIRECCOES.length} registadas</span>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-navy-100">
                      <th className="text-left px-4 py-3 font-medium text-navy-500">Direcção / Gabinete</th>
                      <th className="text-left px-4 py-3 font-medium text-navy-500">Owner FAQ</th>
                      <th className="text-left px-4 py-3 font-medium text-navy-500">Estado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {DIRECCOES.map((nome) => (
                      <tr key={nome} className="border-b border-navy-50 hover:bg-navy-25">
                        <td className="px-4 py-3 text-navy-700">{nome}</td>
                        <td className="px-4 py-3 text-navy-500">—</td>
                        <td className="px-4 py-3">
                          <Badge variant="warning" size="sm" dot>
                            Sem owner
                          </Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="text-xs text-navy-400 mt-4">
                Para adicionar ou editar direcções, contacta a equipa DSI.
              </p>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {tab === 'agente' && isAdmin && (
        <motion.div variants={staggerItem} className="space-y-4">
          {agentLoading ? (
            <div className="flex items-center justify-center h-40">
              <div className="w-8 h-8 border-4 border-gold-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : (
            <>
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Bot className="w-5 h-5 text-gold-500" />
                    Identidade do Agente
                  </CardTitle>
                  {agentForm.updated_at && (
                    <span className="text-xs text-navy-400">
                      Actualizado {new Date(agentForm.updated_at).toLocaleString('pt-AO')}
                      {agentForm.source === 'defaults' ? ' · defaults de código' : ''}
                    </span>
                  )}
                </CardHeader>
                <CardContent className="space-y-4">
                  <FormField
                    label="System prompt"
                    hint="Instruções base do modelo. Máx. 12 000 caracteres. Alterações impactam todas as respostas."
                  >
                    <Textarea
                      value={agentForm.system_prompt}
                      onChange={(e) => patchAgent('system_prompt', e.target.value)}
                      className="min-h-[220px] font-mono text-xs"
                      maxLength={12000}
                      showCount
                    />
                  </FormField>
                  <FormField
                    label="Mensagem de boas-vindas"
                    hint="Mostrada no ecrã vazio do chat do assistente"
                  >
                    <Textarea
                      value={agentForm.mensagem_boas_vindas}
                      onChange={(e) => patchAgent('mensagem_boas_vindas', e.target.value)}
                      maxLength={1000}
                      showCount
                    />
                  </FormField>
                  <FormField label="Email de escalação" hint="Referência nas respostas quando o agente escala">
                    <Input
                      type="email"
                      value={agentForm.email_escalacao}
                      onChange={(e) => patchAgent('email_escalacao', e.target.value)}
                    />
                  </FormField>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Geração (LLM)</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField
                      label={`Temperatura (${agentForm.temperature})`}
                      hint="0 = determinístico · 1.5 = mais criativo"
                    >
                      <input
                        type="range"
                        min={0}
                        max={1.5}
                        step={0.05}
                        value={agentForm.temperature}
                        onChange={(e) => patchAgent('temperature', Number(e.target.value))}
                        className="w-full accent-gold-500"
                      />
                    </FormField>
                    <FormField label="Max tokens" hint="Comprimento máximo da resposta">
                      <Input
                        type="number"
                        min={100}
                        max={4000}
                        value={agentForm.max_tokens}
                        onChange={(e) => patchAgent('max_tokens', Number(e.target.value))}
                      />
                    </FormField>
                    <FormField label="Max tool steps" hint="Quantas voltas de ferramentas por pergunta">
                      <Input
                        type="number"
                        min={1}
                        max={8}
                        value={agentForm.max_tool_steps}
                        onChange={(e) => patchAgent('max_tool_steps', Number(e.target.value))}
                      />
                    </FormField>
                    <FormField label="Reasoning effort" hint="Impacto em latência (NVIDIA path)">
                      <Select
                        options={[
                          { value: 'low', label: 'Low (~2–4s) — recomendado' },
                          { value: 'medium', label: 'Medium (~8–12s)' },
                          { value: 'high', label: 'High (~15–30s)' },
                        ]}
                        value={agentForm.reasoning_effort}
                        onChange={(v) =>
                          patchAgent('reasoning_effort', v as AgentConfig['reasoning_effort'])
                        }
                      />
                    </FormField>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Retrieval (RAG)</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField label="Top K" hint="Nº de trechos (chunks/FAQs) injectados no contexto">
                      <Input
                        type="number"
                        min={1}
                        max={20}
                        value={agentForm.top_k}
                        onChange={(e) => patchAgent('top_k', Number(e.target.value))}
                      />
                    </FormField>
                    <FormField
                      label={`Threshold de relevância (${agentForm.min_relevance_score})`}
                      hint="Abaixo deste score o agente tende a escalar para a DPC"
                    >
                      <input
                        type="range"
                        min={0}
                        max={1}
                        step={0.05}
                        value={agentForm.min_relevance_score}
                        onChange={(e) =>
                          patchAgent('min_relevance_score', Number(e.target.value))
                        }
                        className="w-full accent-gold-500"
                      />
                    </FormField>
                  </div>
                  <p className="text-xs text-navy-400 mt-4">
                    Modelos e API keys continuam em variáveis de ambiente do servidor (não editáveis aqui).
                    {agentDefaults &&
                      ` Defaults de fábrica: temp ${agentDefaults.temperature}, topK ${agentDefaults.top_k}, threshold ${agentDefaults.min_relevance_score}.`}
                  </p>
                </CardContent>
              </Card>

              <div className="flex flex-col sm:flex-row justify-between gap-3">
                <Button
                  variant="ghost"
                  leftIcon={<RotateCcw className="w-4 h-4" />}
                  onClick={handleResetAgent}
                  disabled={agentSaving}
                >
                  Restaurar defaults
                </Button>
                <Button
                  variant="primary"
                  leftIcon={<Save className="w-4 h-4" />}
                  onClick={handleSaveAgent}
                  loading={agentSaving}
                  disabled={!agentDirty && !agentSaving}
                >
                  Guardar config do agente
                </Button>
              </div>
            </>
          )}
        </motion.div>
      )}
    </motion.div>
  );
}
