import { useEffect, useMemo, useState } from 'react';
import {
  Plus, Trash2, GraduationCap, Search, Users, Pencil, X, UserPlus, Send,
} from 'lucide-react';
import { motion } from 'motion/react';
import { Button } from '@/src/components/ui/button';
import { Input, Select, FormField, Textarea } from '@/src/components/ui/input';
import { Badge, Avatar } from '@/src/components/ui/badge';
import { EmptyState } from '@/src/components/ui/card';
import { Dialog, ConfirmDialog } from '@/src/components/ui/dialog';
import { SkeletonList } from '@/src/components/ui/skeleton';
import { CredenciaisDialog } from '@/src/components/shared/CredenciaisDialog';
import { toast } from '@/src/store/ui.store';
import { staggerContainer, staggerItem } from '@/src/lib/animations';
import { mentorsService } from '@/src/services/mentoria.service';
import { tempoExperiencia } from '@/src/lib/tempo-experiencia';
import { EMAIL_DOMINIO } from '@/lib/constants';
import { useCatalogo } from '@/src/hooks/use-catalogo';
import { Paginacao, juntarOpcoes, paginar } from '@/src/components/ui/paginacao';
import type { Mentor } from '@/lib/types';
import { Checkbox } from '@/components/ui/checkbox';


type MentorRow = Mentor & { nome: string; email: string; departamento: string };

function categoriasDoMentor(mentor: MentorRow): string[] {
  const valor = mentor.categorias_suportadas as unknown;
  if (Array.isArray(valor)) return valor.map((item) => String(item));
  if (typeof valor === 'string' && valor.trim()) {
    try {
      const parsed = JSON.parse(valor) as unknown;
      if (Array.isArray(parsed)) return parsed.map((item) => String(item));
    } catch {
      return [valor];
    }
  }
  return [];
}

export default function MentoresPage() {
  const { funcaoOptions, direccaoOptions, categoriaOptions } = useCatalogo();
  const [rows, setRows] = useState<MentorRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busca, setBusca] = useState('');
  const [funcao, setFuncao] = useState('');
  const [direccao, setDireccao] = useState('');
  const [categoria, setCategoria] = useState('');
  const [pagina, setPagina] = useState(0);
  const [showCreate, setShowCreate] = useState(false);
  const [editMentor, setEditMentor] = useState<MentorRow | null>(null);
  const [removeMentor, setRemoveMentor] = useState<MentorRow | null>(null);
  const [credenciais, setCredenciais] = useState<{ email: string; password: string } | null>(null);
  const [removing, setRemoving] = useState(false);
  const [aCriarAcesso, setACriarAcesso] = useState<string | null>(null);

  async function carregar() {
    setLoading(true);
    try {
      const data = await mentorsService.list();
      setRows(data);
    } catch {
      setRows([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { carregar(); }, []);

  async function handleRemove() {
    if (!removeMentor) return;
    setRemoving(true);
    try {
      await mentorsService.remove(removeMentor.id);
      toast.success('Mentor removido');
      setRemoveMentor(null);
      carregar();
    } catch {
      toast.error('Não foi possível remover');
    } finally {
      setRemoving(false);
    }
  }

  async function criarAcesso(m: MentorRow) {
    setACriarAcesso(m.id);
    try {
      const { convite } = await mentorsService.criarAcesso(m.id);
      if (convite === 'enviado') toast.success('Convite enviado', `${m.nome} recebe um email para definir a password.`);
      else toast.success('Acesso ligado', `${m.nome} já tinha password e pode entrar.`);
      carregar();
    } catch (err) {
      const resp = (err as { response?: { data?: { error?: string; message?: string } } }).response;
      toast.error('Não foi possível criar o acesso', resp?.data?.error ?? resp?.data?.message ?? 'Tenta novamente.');
    } finally {
      setACriarAcesso(null);
    }
  }

  const opcoesFuncao = useMemo(() => juntarOpcoes(funcaoOptions, rows.map((r) => r.funcao)), [funcaoOptions, rows]);
  const opcoesDireccao = useMemo(() => juntarOpcoes(direccaoOptions, rows.map((r) => r.departamento)), [direccaoOptions, rows]);
  const opcoesCategoria = useMemo(
    () => juntarOpcoes(categoriaOptions, rows.flatMap((r) => categoriasDoMentor(r))),
    [categoriaOptions, rows],
  );

  const filtrados = useMemo(() => rows.filter((r) => {
    if (funcao && (r.funcao ?? '') !== funcao) return false;
    if (direccao && (r.departamento ?? '') !== direccao) return false;
    if (categoria && !categoriasDoMentor(r).includes(categoria)) return false;
    if (!busca) return true;
    const q = busca.toLowerCase();
    return (
      r.nome.toLowerCase().includes(q) ||
      r.email.toLowerCase().includes(q) ||
      (r.departamento ?? '').toLowerCase().includes(q) ||
      (r.funcao ?? '').toLowerCase().includes(q)
    );
  }), [rows, busca, funcao, direccao, categoria]);
  const paginaLista = paginar(filtrados, pagina);

  useEffect(() => { setPagina(0); }, [busca, funcao, direccao, categoria]);

  return (
    <motion.div
      variants={staggerContainer}
      initial="hidden"
      animate="visible"
      className="space-y-6"
    >
      <motion.div
        variants={staggerItem}
        className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between"
      >
        <div>
          <h1 className="text-2xl font-bold text-navy-800">Colaboradores</h1>
          <p className="mt-1 text-sm text-navy-500">
            {rows.length} colaborador(es) · gestão de contas com perfil <em>mentor</em>.
          </p>
        </div>
        <Button
          variant="primary"
          leftIcon={<Plus className="h-4 w-4" />}
          onClick={() => setShowCreate(true)}
        >
          Novo mentor
        </Button>
      </motion.div>

      <motion.div variants={staggerItem} className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
        <div className="relative min-w-[200px] flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-navy-400" />
          <Input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Procurar por nome, email ou direcção..."
            className="pl-9"
          />
        </div>
        <Select options={opcoesFuncao} placeholder="Todas as funções" value={funcao} onChange={setFuncao} className="w-full sm:w-44" />
        <Select options={opcoesDireccao} placeholder="Todas as direcções" value={direccao} onChange={setDireccao} className="w-full sm:w-48" />
        <Select options={opcoesCategoria} placeholder="Todas as categorias" value={categoria} onChange={setCategoria} className="w-full sm:w-44" />
      </motion.div>

      <motion.div variants={staggerItem}>
        {loading ? (
          <SkeletonList rows={5} cols={4} />
        ) : filtrados.length === 0 ? (
          <EmptyState
            icon={<GraduationCap className="h-8 w-8" />}
            title={rows.length === 0 ? 'Ainda sem mentores' : 'Sem resultados'}
            description={
              rows.length === 0
                ? 'Cria o primeiro mentor. A conta de login é gerada automaticamente.'
                : 'Ajusta a pesquisa para encontrares o mentor.'
            }
            action={
              rows.length === 0
                ? { label: 'Novo mentor', onClick: () => setShowCreate(true) }
                : undefined
            }
          />
        ) : (
          <div className="space-y-2">
            {paginaLista.visiveis.map((m) => {
              const experiencia = tempoExperiencia(m.data_inicio_contrato);
              return (
              <div
                key={m.id}
                className="flex items-center gap-4 rounded-xl border border-navy-100 bg-white p-4 transition hover:shadow-card"
              >
                <Avatar name={m.nome} size="md" />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium text-navy-800">{m.nome}</p>
                  <p className="truncate text-xs text-navy-500">
                    {m.email} · {m.departamento || '—'}
                    {experiencia ? ` · ${experiencia}` : ''}
                  </p>
                  {m.bio && <p className="mt-0.5 truncate text-xs text-navy-400">{m.bio}</p>}
                  <div className="mt-1.5 flex flex-wrap items-center gap-2">
                    <Badge variant={m.activo ? 'success' : 'neutral'} size="sm">
                      {m.activo ? 'Activo' : 'Inactivo'}
                    </Badge>
                    {m.tem_conta === false && (
                      <Badge variant="warning" size="sm">Sem conta</Badge>
                    )}
                    {m.tem_conta && m.tem_password === false && (
                      <Badge variant="neutral" size="sm">Convite pendente</Badge>
                    )}
                    {typeof m.mentorados_activos === 'number' && (
                      <span className="text-xs text-navy-500 inline-flex items-center gap-1">
                        <Users className="h-3 w-3" />
                        {m.mentorados_activos} mentorado(s)
                      </span>
                    )}
                  </div>
                </div>
                {(m.tem_conta === false || m.tem_password === false) && (
                  <Button
                    variant="secondary"
                    size="sm"
                    loading={aCriarAcesso === m.id}
                    onClick={() => criarAcesso(m)}
                    leftIcon={m.tem_conta === false ? <UserPlus className="h-4 w-4" /> : <Send className="h-4 w-4" />}
                    title={
                      m.tem_conta === false
                        ? 'Cria a conta de utilizador e envia o email para definir a password'
                        : 'Reenvia o email para definir a password'
                    }
                  >
                    <span className="hidden sm:inline">{m.tem_conta === false ? 'Criar acesso' : 'Reenviar convite'}</span>
                  </Button>
                )}
                <button
                  onClick={() => setEditMentor(m)}
                  title="Editar"
                  className="rounded-md p-1.5 text-navy-400 transition-colors hover:bg-navy-50 hover:text-navy-700"
                >
                  <Pencil className="h-4 w-4" />
                </button>
                <button
                  onClick={() => setRemoveMentor(m)}
                  title="Remover"
                  className="rounded-md p-1.5 text-error-400 transition-colors hover:bg-error-50 hover:text-error-600"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
              );
            })}
            <Paginacao
              pagina={paginaLista.actual}
              totalPaginas={paginaLista.totalPaginas}
              total={paginaLista.total}
              onChange={setPagina}
            />
          </div>
        )}
      </motion.div>

      {showCreate && (
        <MentorFormModal
          onClose={() => setShowCreate(false)}
          onCreated={(cred) => {
            setShowCreate(false);
            if (cred) setCredenciais(cred);
            carregar();
          }}
        />
      )}

      {editMentor && (
        <MentorFormModal
          mentor={editMentor}
          onClose={() => setEditMentor(null)}
          onCreated={() => {
            setEditMentor(null);
            carregar();
          }}
        />
      )}

      {credenciais && (
        <CredenciaisDialog
          titulo="Credenciais do mentor"
          descricao="Partilha estas credenciais com o mentor. A password só é mostrada agora."
          credenciais={credenciais}
          onClose={() => setCredenciais(null)}
        />
      )}

      <ConfirmDialog
        open={!!removeMentor}
        onClose={() => setRemoveMentor(null)}
        onConfirm={handleRemove}
        title="Remover mentor?"
        description={
          removeMentor
            ? `A conta de ${removeMentor.nome} será desactivada. As avaliações históricas não são apagadas.`
            : ''
        }
        confirmLabel="Sim, remover"
        destructive
        loading={removing}
      />
    </motion.div>
  );
}

function MentorFormModal({
  mentor,
  onClose,
  onCreated,
}: {
  mentor?: MentorRow;
  onClose: () => void;
  onCreated: (cred: { email: string; password: string } | null) => void;
}) {
  const { direccaoOptions } = useCatalogo();
  const isEdit = !!mentor;
  const [nome, setNome] = useState(mentor?.nome ?? '');
  const [email, setEmail] = useState(mentor?.email ?? '');
  const [departamento, setDepartamento] = useState(mentor?.departamento ?? '');
  const [bio, setBio] = useState(mentor?.bio ?? '');
  const [activo, setActivo] = useState(mentor?.activo ?? true);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  async function submit() {
    const errs: Record<string, string> = {};
    if (!nome.trim()) errs.nome = 'Obrigatório';
    if (!departamento) errs.departamento = 'Obrigatório';
    setErrors(errs);
    if (Object.keys(errs).length) return;

    setSaving(true);
    try {
      if (isEdit && mentor) {
        await mentorsService.update(mentor.id, {
          activo,
          bio: bio || null,
        });
        toast.success('Mentor actualizado');
        onCreated(null);
      } else {
        const { credenciais } = await mentorsService.create({
          nome: nome.trim(),
          email: email.trim() || undefined,
          departamento,
          bio: bio || undefined,
        });
        toast.success('Mentor criado');
        onCreated(credenciais);
      }
    } catch {
      toast.error(isEdit ? 'Erro ao actualizar' : 'Erro ao criar mentor');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open onClose={onClose} className="max-w-lg">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-navy-800">
            {isEdit ? 'Editar mentor' : 'Novo mentor'}
          </h2>
          <p className="text-sm text-navy-500">
            {isEdit
              ? 'Actualiza a bio e o estado. O nome e email de login não podem ser alterados aqui.'
              : 'É gerada uma conta de login automaticamente. Guarda as credenciais no fim.'}
          </p>
        </div>
      </div>

      <div className="space-y-4">
        <FormField label="Nome" required error={errors.nome}>
          <Input
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            error={errors.nome}
            disabled={isEdit}
          />
        </FormField>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <FormField label="Email" hint={isEdit ? 'Não editável.' : `Se vazio, é gerado do nome (@${EMAIL_DOMINIO}).`}>
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={`nome.apelido@${EMAIL_DOMINIO}`}
              disabled={isEdit}
            />
          </FormField>
          <FormField label="Direcção / Gabinete" required error={errors.departamento}>
            <Select
              options={direccaoOptions}
              placeholder="Seleccionar"
              value={departamento}
              onChange={setDepartamento}
              error={errors.departamento}
              disabled={isEdit}
            />
          </FormField>
        </div>

        <FormField label="Bio (opcional)">
          <Textarea
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            placeholder="Breve nota sobre o percurso do mentor."
            autoResize
          />
        </FormField>

        {isEdit && (
          <label className="flex items-center gap-2 text-sm text-navy-700 cursor-pointer">
            <Checkbox
              checked={activo}
              onCheckedChange={(checked) => setActivo(checked)}
            />
            Mentor activo
          </label>
        )}
      </div>

      <div className="mt-6 flex justify-end gap-3 border-t border-navy-100 pt-4">
        <Button variant="ghost" onClick={onClose} leftIcon={<X className="h-4 w-4" />}>
          Cancelar
        </Button>
        <Button variant="primary" onClick={submit} loading={saving}>
          {isEdit ? 'Guardar' : 'Criar mentor'}
        </Button>
      </div>
    </Dialog>
  );
}
