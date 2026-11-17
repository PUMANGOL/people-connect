import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft, BadgeCheck, Banknote, CalendarClock, Check, CircleOff, ClipboardList, FilePen, FileText, Flag,
  FolderOpen, HeartPulse, IdCard, KeyRound, Laptop, ListChecks, Mail, MessageSquare, PenLine, Rocket,
  Search, Send, ShieldCheck, Undo2, Upload, UserCheck, Users, type LucideIcon,
} from 'lucide-react';
import { Button } from '@/src/components/ui/button';
import { Input, Select, FormField, Textarea } from '@/src/components/ui/input';
import { DateInput } from '@/src/components/ui/date-time-picker';
import { RichTextEditor } from '@/src/components/ui/rich-text-editor';
import { Badge } from '@/src/components/ui/badge';
import { Dialog } from '@/src/components/ui/dialog';
import { SkeletonList } from '@/src/components/ui/skeleton';
import { toast } from '@/src/store';
import { admissaoService, type AdmissaoDetalhe, type AuditoriaAdmissao, type EtapaAdmissao, type ProcessoAdmissao } from '@/src/services/admissao.service';
import { ESTADO_ADMISSAO_LABEL, SEMAFORO_LABEL, type EstadoAdmissao, type SemaforoAdmissao } from '@/src/lib/admissao-fluxo';
import { assuntoCartaOferta, corpoEmailInicial } from '@/src/lib/carta-oferta';
import { ChecklistDocumentos } from './ChecklistDocumentos';
import { useCatalogo } from '@/src/hooks/use-catalogo';
import { cn } from '@/lib/utils';

const ACCAO_LABEL: Record<string, string> = {
  admissao_criada: 'Processo criado',
  admissao_avancada: 'Etapa concluída',
  admissao_recusada: 'Decisão negativa',
  admissao_bloqueada: 'Bloqueio registado',
  admissao_recuada: 'Processo devolvido',
  admissao_transferida: 'Transferido para onboarding',
  admissao_cancelada: 'Processo encerrado',
  admissao_actualizada: 'Dados actualizados',
  admissao_oferta_enviada: 'Carta de oferta enviada',
  admissao_checklist_enviada: 'Checklist enviada ao candidato',
  admissao_checklist_reenviada: 'Link da checklist reenviado',
  admissao_documento_adicionado: 'Documento adicionado à checklist',
  admissao_documento_removido: 'Documento retirado da checklist',
  admissao_documento_avaliado: 'Documento avaliado',
};

function semaforoVariant(semaforo: SemaforoAdmissao): 'success' | 'warning' | 'error' {
  if (semaforo === 'verde') return 'success';
  if (semaforo === 'amarelo') return 'warning';
  return 'error';
}

function estadoVariant(estado: EstadoAdmissao): 'success' | 'error' | 'info' | 'neutral' {
  if (estado === 'cancelado') return 'error';
  if (estado === 'transferido_onboarding' || estado === 'pronto_para_entrada') return 'success';
  if (estado === 'rascunho') return 'neutral';
  return 'info';
}

function etapaVariant(estado: EtapaAdmissao['estado']): 'success' | 'warning' | 'info' | 'neutral' {
  if (estado === 'concluida') return 'success';
  if (estado === 'rejeitada') return 'warning';
  if (estado === 'em_curso') return 'info';
  return 'neutral';
}

const ETAPA_LABEL: Record<EtapaAdmissao['estado'], string> = {
  pendente: 'Pendente',
  em_curso: 'Em curso',
  concluida: 'Concluída',
  rejeitada: 'Devolvida',
};

function hojeIso(): string {
  const data = new Date();
  const mes = String(data.getMonth() + 1).padStart(2, '0');
  const dia = String(data.getDate()).padStart(2, '0');
  return `${data.getFullYear()}-${mes}-${dia}`;
}

function validadePorOmissao(): string {
  const data = new Date();
  data.setDate(data.getDate() + 7);
  const mes = String(data.getMonth() + 1).padStart(2, '0');
  const dia = String(data.getDate()).padStart(2, '0');
  return `${data.getFullYear()}-${mes}-${dia}`;
}

export default function AdmissaoDetalhePage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [detalhe, setDetalhe] = useState<AdmissaoDetalhe | null>(null);
  const [loading, setLoading] = useState(true);
  const [observacao, setObservacao] = useState('');
  const [aConfirmar, setAConfirmar] = useState<'avancar' | 'recusar' | null>(null);
  const [aEncerrar, setAEncerrar] = useState(false);
  const [aEditar, setAEditar] = useState(false);
  const [saving, setSaving] = useState(false);
  const [validadeOferta, setValidadeOferta] = useState(validadePorOmissao);

  function carregar() {
    if (!id) return;
    setLoading(true);
    admissaoService.get(id)
      .then(setDetalhe)
      .catch(() => toast.error('Erro', 'Não foi possível carregar o processo.'))
      .finally(() => setLoading(false));
  }

  useEffect(carregar, [id]);

  if (loading) return <SkeletonList rows={6} cols={2} />;
  if (!detalhe || !id) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" leftIcon={<ArrowLeft className="h-4 w-4" />} onClick={() => navigate('/admissao')}>Voltar</Button>
        <p className="text-sm text-navy-400">Processo não encontrado.</p>
      </div>
    );
  }

  const { processo, etapas, auditoria } = detalhe;
  const actual = etapas.find((etapa) => etapa.codigo === processo.etapa_actual);
  const fechado = processo.estado === 'cancelado' || processo.estado === 'transferido_onboarding';
  const podeEnviarCarta = processo.etapa_actual === 'ADM-004' && !processo.oferta_enviada_em;
  const grupos: Array<{ fase: string; itens: EtapaAdmissao[] }> = [];
  for (const etapa of etapas) {
    const ultimo = grupos[grupos.length - 1];
    if (!ultimo || ultimo.fase !== etapa.fase) grupos.push({ fase: etapa.fase, itens: [etapa] });
    else ultimo.itens.push(etapa);
  }

  async function enviarCarta(payload: { assunto: string; corpoHtml: string; anexoNome: string; anexoBase64: string }) {
    if (!id) return;
    if (!validadeOferta) {
      toast.error('Indique a validade da oferta');
      return;
    }
    if (!processo.email?.includes('@')) {
      toast.error('E-mail em falta', 'Indique o e-mail do candidato em Editar dados.');
      return;
    }
    setSaving(true);
    try {
      const seguinte = await admissaoService.enviarCarta(id, {
        validade: validadeOferta,
        observacao,
        ...payload,
      });
      setDetalhe(seguinte);
      setObservacao('');
      toast.success('Carta enviada', processo.email);
    } catch (err) {
      const message = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
      toast.error('Erro', message || 'Não foi possível enviar a carta.');
    } finally {
      setSaving(false);
    }
  }

  async function executar(accao: 'avancar' | 'recusar' | 'cancelar', motivo?: string) {
    if (!id) return;
    setSaving(true);
    try {
      const seguinte = await admissaoService.accao(id, {
        accao,
        observacao: accao === 'cancelar' ? undefined : observacao,
        motivo,
      });
      setDetalhe(seguinte);
      setObservacao('');
      setAConfirmar(null);
      setAEncerrar(false);
      if (detalhe?.processo.etapa_actual === 'ADM-022' && accao === 'avancar') {
        toast.success('Onboarding activado', `Link enviado para ${detalhe.processo.email}.`);
      } else {
        toast.success('Processo actualizado');
      }
    } catch (err) {
      const message = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
      toast.error('Erro', message || 'Não foi possível registar a decisão.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <button onClick={() => navigate('/admissao')} className="mb-2 inline-flex items-center gap-1 text-sm text-navy-400 hover:text-navy-700">
            <ArrowLeft className="h-4 w-4" /> Admissões
          </button>
          <h1 className="text-2xl font-bold text-navy-800">{processo.nome}</h1>
          <p className="mt-1 text-sm text-navy-400">
            {[processo.funcao, processo.direccao, processo.empresa].filter(Boolean).join(' · ') || 'Dados do posto por preencher'}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant={estadoVariant(processo.estado)}>{ESTADO_ADMISSAO_LABEL[processo.estado]}</Badge>
          <Badge variant={semaforoVariant(processo.semaforo)}>Semáforo {SEMAFORO_LABEL[processo.semaforo].toLowerCase()}</Badge>
          {!fechado && <Button variant="secondary" onClick={() => setAEditar(true)}>Editar dados</Button>}
          {!fechado && <Button variant="ghost" onClick={() => setAEncerrar(true)}>Encerrar</Button>}
        </div>
      </div>

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="min-w-0 space-y-6">
          <div className="grid gap-3 rounded-xl border border-navy-100 bg-white p-4 text-sm sm:grid-cols-2">
            <Dado label="E-mail" value={processo.email} />
            <Dado label="Gestor" value={processo.gestor} />
            <Dado label="Local" value={processo.local_trabalho} />
            <Dado label="Entrada prevista" value={processo.data_prevista_entrada ? new Date(processo.data_prevista_entrada).toLocaleDateString('pt-AO') : null} />
          </div>

          {processo.bloqueado && (
            <div className="rounded-xl border border-error-100 bg-error-50 px-4 py-3 text-sm text-error-700">
              Bloqueio na etapa actual{processo.bloqueio_motivo ? `: ${processo.bloqueio_motivo}` : '.'} Confirmar a etapa limpa o bloqueio e avança.
            </div>
          )}
          {processo.oferta_enviada_em && (
            <div className="rounded-xl border border-success-100 bg-success-50 px-4 py-3 text-sm text-success-700">
              Carta enviada{processo.oferta_destinatario ? ` para ${processo.oferta_destinatario}` : ''} em {new Date(processo.oferta_enviada_em).toLocaleString('pt-AO')}.
            </div>
          )}
          {processo.motivo_cancelamento && processo.estado === 'cancelado' && (
            <div className="rounded-xl border border-navy-100 bg-navy-50 px-4 py-3 text-sm text-navy-600">
              Motivo do encerramento: {processo.motivo_cancelamento}
            </div>
          )}

          {actual && !fechado && (
            <section className="rounded-xl border border-navy-100 bg-white p-5">
              <p className="text-xs font-semibold uppercase tracking-wide text-navy-300">{actual.fase} · {actual.codigo}</p>
              <h2 className="mt-1 text-lg font-semibold text-navy-800">{actual.nome}</h2>
              <p className="mt-1 text-sm text-navy-500">{actual.descricao}</p>
              <p className="mt-2 text-xs text-navy-400">Responsável: {actual.responsavel}</p>
              <div className="mt-4">
                <FormField label="Observação">
                  <Textarea
                    value={observacao}
                    onChange={(e) => setObservacao(e.target.value)}
                    placeholder={actual.decisao ? 'Obrigatória se a decisão for negativa.' : 'Opcional.'}
                    rows={3}
                  />
                </FormField>
              </div>
              {podeEnviarCarta ? (
                <CartaOfertaPainel
                  processo={processo}
                  validade={validadeOferta}
                  saving={saving}
                  onValidade={setValidadeOferta}
                  onEnviar={enviarCarta}
                />
              ) : actual.codigo === 'ADM-006' ? (
                <p className="mt-4 text-sm text-navy-500">
                  Monte a checklist abaixo e envie-a ao candidato. Esse envio conclui esta etapa.
                </p>
              ) : (
                <>
                  {actual.codigo === 'ADM-022' && (
                    <p className="mt-4 text-sm text-navy-500">
                      Cria a conta no People Connect, envia para {processo.email || 'o e-mail do candidato'} o link para definir a palavra-passe e abre o trilho de onboarding na data de entrada.
                    </p>
                  )}
                  <div className="mt-4 flex flex-wrap gap-2">
                    <Button variant="primary" loading={saving && aConfirmar === 'avancar'} onClick={() => setAConfirmar('avancar')}>
                      {actual.sim_etiqueta}
                    </Button>
                    {actual.nao_etiqueta && (
                      <Button variant="secondary" loading={saving && aConfirmar === 'recusar'} onClick={() => setAConfirmar('recusar')}>
                        {actual.nao_etiqueta}
                      </Button>
                    )}
                  </div>
                </>
              )}
            </section>
          )}

          {actual && actual.ordem >= 6 && (
            <ChecklistDocumentos
              processoId={id}
              etapa={processo.etapa_actual}
              fechado={fechado}
              onEnviada={() => {
                admissaoService.get(id).then(setDetalhe).catch(() => toast.error('Erro', 'A checklist foi enviada, mas o processo não recarregou.'));
              }}
            />
          )}
        </div>

        <RoadmapAdmissao grupos={grupos} auditoria={auditoria} />
      </div>

      {aConfirmar && actual && (
        <Dialog open onClose={() => setAConfirmar(null)} className="max-w-md">
          <h2 className="text-lg font-semibold text-navy-800">
            {aConfirmar === 'avancar' ? actual.sim_etiqueta : actual.nao_etiqueta}
          </h2>
          <p className="mt-2 text-sm text-navy-500">
            {aConfirmar === 'avancar'
              ? actual.codigo === 'ADM-022'
                ? `Cria a conta de ${processo.nome}, envia o link para definir a palavra-passe para ${processo.email || 'o e-mail indicado'} e abre o trilho de onboarding.`
                : `Confirma a etapa ${actual.codigo} e avança o processo.`
              : 'Esta decisão fica registada na auditoria com a observação indicada.'}
          </p>
          {observacao && <p className="mt-3 rounded-lg bg-navy-50 p-3 text-sm text-navy-600">{observacao}</p>}
          <div className="mt-6 flex justify-end gap-3">
            <Button variant="ghost" onClick={() => setAConfirmar(null)}>Voltar</Button>
            <Button
              variant="primary"
              loading={saving}
              onClick={() => {
                if (aConfirmar === 'recusar' && !observacao.trim()) {
                  toast.error('Indique o motivo da decisão');
                  return;
                }
                executar(aConfirmar);
              }}
            >
              Confirmar
            </Button>
          </div>
        </Dialog>
      )}

      {aEncerrar && (
        <EncerrarDialog
          saving={saving}
          onClose={() => setAEncerrar(false)}
          onConfirm={(motivo) => executar('cancelar', motivo)}
        />
      )}

      {aEditar && (
        <EditarDialog
          processo={processo}
          onClose={() => setAEditar(false)}
          onSaved={() => {
            setAEditar(false);
            carregar();
          }}
        />
      )}
    </div>
  );
}

const LIMITE_PDF = 8 * 1024 * 1024;

function CartaOfertaPainel({
  processo, validade, saving, onValidade, onEnviar,
}: {
  processo: ProcessoAdmissao;
  validade: string;
  saving: boolean;
  onValidade: (value: string) => void;
  onEnviar: (payload: { assunto: string; corpoHtml: string; anexoNome: string; anexoBase64: string }) => void;
}) {
  const ficheiroRef = useRef<HTMLInputElement>(null);
  const [assunto, setAssunto] = useState(() => assuntoCartaOferta(processo.nome));
  const [corpo, setCorpo] = useState(() => corpoEmailInicial({
    nome: processo.nome,
    funcao: processo.funcao,
    empresa: processo.empresa,
    validade,
  }));
  const [anexo, setAnexo] = useState<{ nome: string; base64: string } | null>(null);
  const semEmail = !processo.email?.includes('@');
  const semCorpo = !corpo.replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').trim();

  function escolherPdf(file: File | undefined) {
    if (!file) return;
    if ((file.type && file.type !== 'application/pdf') || !file.name.toLowerCase().endsWith('.pdf')) {
      toast.error('O anexo tem de ser um PDF');
      return;
    }
    if (file.size > LIMITE_PDF) {
      toast.error('PDF demasiado grande', 'O ficheiro não pode ultrapassar 8 MB.');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const base64 = String(reader.result).split(',')[1] ?? '';
      if (!base64) {
        toast.error('Não foi possível ler o PDF');
        return;
      }
      setAnexo({ nome: file.name, base64 });
    };
    reader.onerror = () => toast.error('Não foi possível ler o PDF');
    reader.readAsDataURL(file);
  }

  return (
    <div className="mt-4 space-y-4">
      <div className="rounded-xl border border-navy-100 bg-navy-25 p-4 space-y-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-navy-300">Email que será enviado</p>
        <p className="text-sm text-navy-700">
          <span className="text-navy-400">Para: </span>
          {processo.email || 'sem e-mail — preencha em Editar dados'}
        </p>
        <FormField label="Assunto" required>
          <Input value={assunto} onChange={(e) => setAssunto(e.target.value)} maxLength={180} />
        </FormField>
        <FormField label="Corpo do email" required>
          <RichTextEditor
            value={corpo}
            onChange={setCorpo}
            placeholder="Escreva a mensagem que o candidato vai receber."
          />
        </FormField>
        <FormField label="Validade da oferta" required>
          <DateInput value={validade} onChange={onValidade} minimo={hojeIso()} />
        </FormField>
      </div>
      <div className="rounded-xl border border-navy-100 p-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-navy-300">Carta em anexo</p>
        <p className="mt-2 text-sm text-navy-500">Carregue o PDF da carta de oferta. É este ficheiro que segue no email.</p>
        <input
          ref={ficheiroRef}
          type="file"
          accept="application/pdf,.pdf"
          className="hidden"
          onChange={(e) => {
            escolherPdf(e.target.files?.[0]);
            e.target.value = '';
          }}
        />
        {anexo ? (
          <div className="mt-3 flex items-center justify-between gap-3 rounded-lg border border-navy-100 bg-white px-3 py-2">
            <p className="flex min-w-0 items-center gap-2 text-sm text-navy-800">
              <FileText className="h-4 w-4 shrink-0 text-navy-400" />
              <span className="truncate">{anexo.nome}</span>
            </p>
            <Button variant="ghost" onClick={() => setAnexo(null)}>Remover</Button>
          </div>
        ) : (
          <Button variant="secondary" className="mt-3" leftIcon={<Upload className="h-4 w-4" />} onClick={() => ficheiroRef.current?.click()}>
            Carregar PDF
          </Button>
        )}
      </div>
      {semEmail && (
        <p className="text-sm text-error-700">Indique o e-mail do candidato em Editar dados para poder enviar.</p>
      )}
      <Button
        variant="primary"
        loading={saving}
        disabled={semEmail || semCorpo || !assunto.trim() || !anexo || saving}
        onClick={() => {
          if (!anexo) return;
          onEnviar({ assunto: assunto.trim(), corpoHtml: corpo, anexoNome: anexo.nome, anexoBase64: anexo.base64 });
        }}
      >
        Enviar carta de oferta
      </Button>
    </div>
  );
}

const ICONE_ETAPA: Record<string, LucideIcon> = {
  'ADM-001': UserCheck,
  'ADM-002': Banknote,
  'ADM-003': FilePen,
  'ADM-004': Mail,
  'ADM-005': MessageSquare,
  'ADM-006': FolderOpen,
  'ADM-007': Upload,
  'ADM-008': ShieldCheck,
  'ADM-009': Users,
  'ADM-010': CalendarClock,
  'ADM-011': HeartPulse,
  'ADM-012': Send,
  'ADM-013': FilePen,
  'ADM-014': PenLine,
  'ADM-015': BadgeCheck,
  'ADM-016': ListChecks,
  'ADM-017': KeyRound,
  'ADM-018': Laptop,
  'ADM-019': IdCard,
  'ADM-020': ClipboardList,
  'ADM-021': Check,
  'ADM-022': Rocket,
};

const ICONE_FASE: Record<string, LucideIcon> = {
  '1. Início': Flag,
  '2. Oferta': Mail,
  '3. Documentação': FolderOpen,
  '4. Verificações': Search,
  '5. Contratação': FilePen,
  '6. Cadastro': IdCard,
  '7. Preparação': Laptop,
  '8. Fecho': Rocket,
};

const ICONE_AUDITORIA: Record<string, LucideIcon> = {
  admissao_criada: Flag,
  admissao_avancada: Check,
  admissao_recusada: Undo2,
  admissao_bloqueada: CircleOff,
  admissao_recuada: Undo2,
  admissao_transferida: Rocket,
  admissao_cancelada: CircleOff,
  admissao_actualizada: FilePen,
  admissao_oferta_enviada: Mail,
};

function caixaEtapa(estado: EtapaAdmissao['estado']): string {
  if (estado === 'concluida') return 'bg-success-500 text-white';
  if (estado === 'em_curso') return 'bg-info-600 text-white shadow-sm ring-4 ring-info-100';
  if (estado === 'rejeitada') return 'bg-warning-500 text-white';
  return 'bg-neutral-100 text-neutral-400 ring-1 ring-neutral-200';
}

function fundoEtapa(estado: EtapaAdmissao['estado']): string {
  if (estado === 'em_curso') return 'rounded-xl bg-info-50 px-3 py-2.5';
  if (estado === 'rejeitada') return 'rounded-xl bg-warning-50 px-3 py-2.5';
  return '';
}

function RoadmapAdmissao({
  grupos, auditoria,
}: {
  grupos: Array<{ fase: string; itens: EtapaAdmissao[] }>;
  auditoria: AuditoriaAdmissao[];
}) {
  const etapas = grupos.flatMap((grupo) => grupo.itens);
  return (
    <section className="rounded-xl border border-navy-100 bg-white p-5 lg:sticky lg:top-[99px] lg:max-h-[calc(100vh-8rem)] lg:overflow-y-auto">
      <h2 className="text-sm font-semibold text-navy-800">Percurso</h2>
      <ol className="mt-4">
        {etapas.map((etapa, index) => {
          const faseNova = index === 0 || etapas[index - 1].fase !== etapa.fase;
          const ultima = index === etapas.length - 1;
          const Icone = ICONE_ETAPA[etapa.codigo] ?? Flag;
          const IconeFase = ICONE_FASE[etapa.fase] ?? Flag;
          const actual = etapa.estado === 'em_curso';
          return (
            <li key={etapa.codigo} className="relative mb-6 flex gap-3 last:mb-0">
              {!ultima && (
                <span className={cn(
                  'absolute -bottom-6 left-4 top-10 w-px',
                  etapa.estado === 'concluida' ? 'bg-success-500' : 'bg-neutral-200',
                )} />
              )}
              <span className={cn('relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl', caixaEtapa(etapa.estado))}>
                <Icone className="h-4 w-4" />
              </span>
              <div className={cn('min-w-0 flex-1', fundoEtapa(etapa.estado))}>
                {faseNova && (
                  <p className="mb-1 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-navy-300">
                    <IconeFase className="h-3 w-3" />
                    {etapa.fase}
                  </p>
                )}
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className={cn('text-sm font-medium', actual ? 'text-navy-900' : 'text-navy-800')}>
                      {etapa.codigo} · {etapa.nome}
                    </p>
                    <p className="text-xs text-navy-400">{etapa.responsavel}</p>
                    {etapa.observacao && <p className="mt-1 text-xs text-navy-500">{etapa.observacao}</p>}
                  </div>
                  <Badge variant={etapaVariant(etapa.estado)} size="sm">{ETAPA_LABEL[etapa.estado]}</Badge>
                </div>
              </div>
            </li>
          );
        })}
      </ol>

      <h2 className="mt-2 border-t border-navy-100 pt-4 text-sm font-semibold text-navy-800">Auditoria</h2>
      {auditoria.length === 0 ? (
        <p className="mt-2 text-sm text-navy-400">Sem movimentos registados.</p>
      ) : (
        <ol className="mt-4">
          {auditoria.map((item, index) => {
            const ultimo = index === auditoria.length - 1;
            const Icone = ICONE_AUDITORIA[item.accao] ?? Flag;
            const recente = index === 0;
            return (
              <li key={item.id} className="relative mb-6 flex gap-3 last:mb-0">
                {!ultimo && <span className="absolute -bottom-6 left-4 top-10 w-px bg-neutral-200" />}
                <span className={cn(
                  'relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl ring-1',
                  recente ? 'bg-navy-700 text-white ring-navy-700' : 'bg-navy-50 text-navy-400 ring-navy-100',
                )}>
                  <Icone className="h-4 w-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-navy-800">{ACCAO_LABEL[item.accao] ?? item.accao}</p>
                  <p className="text-xs text-navy-500">{item.dados_novos?.resumo || item.dados_novos?.etapa || '—'}</p>
                  <p className="mt-0.5 text-xs text-navy-400">
                    {item.utilizador_nome ?? 'Sistema'}
                    {' · '}
                    {new Date(item.timestamp).toLocaleString('pt-AO')}
                  </p>
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}

function Dado({ label, value }: { label: string; value: string | null }) {
  return (
    <div>
      <p className="text-xs text-navy-300">{label}</p>
      <p className="text-navy-700">{value || '—'}</p>
    </div>
  );
}

function EncerrarDialog({ saving, onClose, onConfirm }: { saving: boolean; onClose: () => void; onConfirm: (motivo: string) => void }) {
  const [motivo, setMotivo] = useState('');
  return (
    <Dialog open onClose={onClose} className="max-w-md">
      <h2 className="text-lg font-semibold text-navy-800">Encerrar processo</h2>
      <p className="mt-2 text-sm text-navy-500">O processo fica cancelado e deixa de avançar. O motivo fica na auditoria.</p>
      <div className="mt-4">
        <FormField label="Motivo" required>
          <Textarea value={motivo} onChange={(e) => setMotivo(e.target.value)} rows={3} />
        </FormField>
      </div>
      <div className="mt-6 flex justify-end gap-3">
        <Button variant="ghost" onClick={onClose}>Voltar</Button>
        <Button
          variant="primary"
          loading={saving}
          onClick={() => {
            if (!motivo.trim()) {
              toast.error('Indique o motivo');
              return;
            }
            onConfirm(motivo.trim());
          }}
        >
          Encerrar
        </Button>
      </div>
    </Dialog>
  );
}

function comValorActual(opcoes: Array<{ value: string; label: string }>, actual: string) {
  if (actual && !opcoes.some((opcao) => opcao.value === actual)) return [{ value: actual, label: actual }, ...opcoes];
  return opcoes;
}

function EditarDialog({ processo, onClose, onSaved }: { processo: ProcessoAdmissao; onClose: () => void; onSaved: () => void }) {
  const { funcaoOptions, direccaoOptions } = useCatalogo();
  const [form, setForm] = useState({
    nome: processo.nome,
    funcao: processo.funcao ?? '',
    direccao: processo.direccao ?? '',
    empresa: processo.empresa ?? '',
    gestor: processo.gestor ?? '',
    local_trabalho: processo.local_trabalho ?? '',
    email: processo.email ?? '',
    telefone: processo.telefone ?? '',
    tipo_contrato: processo.tipo_contrato ?? '',
    data_prevista_entrada: processo.data_prevista_entrada?.slice(0, 10) ?? '',
  });
  const [saving, setSaving] = useState(false);

  async function submit() {
    if (!form.nome.trim()) {
      toast.error('Nome obrigatório');
      return;
    }
    setSaving(true);
    try {
      await admissaoService.actualizar(processo.id, {
        ...form,
        data_prevista_entrada: form.data_prevista_entrada || null,
      });
      toast.success('Dados actualizados');
      onSaved();
    } catch {
      toast.error('Erro', 'Não foi possível actualizar os dados.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open onClose={onClose} className="max-w-lg">
      <h2 className="mb-4 text-lg font-semibold text-navy-800">Dados da admissão</h2>
      <div className="space-y-4">
        <FormField label="Nome" required>
          <Input value={form.nome} onChange={(e) => setForm((f) => ({ ...f, nome: e.target.value }))} />
        </FormField>
        <div className="grid grid-cols-2 gap-4">
          <FormField label="Função">
            <Select
              options={comValorActual(funcaoOptions, form.funcao)}
              placeholder={funcaoOptions.length ? 'Seleccionar' : 'Sem funções — crie-as no menu'}
              value={form.funcao}
              onChange={(v) => setForm((f) => ({ ...f, funcao: v }))}
            />
          </FormField>
          <FormField label="Direcção">
            <Select
              options={comValorActual(direccaoOptions, form.direccao)}
              placeholder={direccaoOptions.length ? 'Seleccionar' : 'Sem direcções — crie-as no menu'}
              value={form.direccao}
              onChange={(v) => setForm((f) => ({ ...f, direccao: v }))}
            />
          </FormField>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <FormField label="Empresa"><Input value={form.empresa} onChange={(e) => setForm((f) => ({ ...f, empresa: e.target.value }))} /></FormField>
          <FormField label="Gestor"><Input value={form.gestor} onChange={(e) => setForm((f) => ({ ...f, gestor: e.target.value }))} /></FormField>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <FormField label="Local de trabalho"><Input value={form.local_trabalho} onChange={(e) => setForm((f) => ({ ...f, local_trabalho: e.target.value }))} /></FormField>
          <FormField label="Tipo de contrato"><Input value={form.tipo_contrato} onChange={(e) => setForm((f) => ({ ...f, tipo_contrato: e.target.value }))} /></FormField>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <FormField label="E-mail"><Input type="email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} /></FormField>
          <FormField label="Telefone"><Input value={form.telefone} onChange={(e) => setForm((f) => ({ ...f, telefone: e.target.value }))} /></FormField>
        </div>
        <FormField label="Data prevista de entrada">
          <DateInput value={form.data_prevista_entrada} onChange={(v) => setForm((f) => ({ ...f, data_prevista_entrada: v }))} />
        </FormField>
      </div>
      <div className="mt-6 flex justify-end gap-3 border-t border-navy-100 pt-4">
        <Button variant="ghost" onClick={onClose}>Cancelar</Button>
        <Button variant="primary" loading={saving} onClick={submit}>Guardar</Button>
      </div>
    </Dialog>
  );
}
