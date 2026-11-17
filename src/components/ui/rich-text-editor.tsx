import { useEffect, type ReactNode } from 'react';
import { useEditor, EditorContent, useEditorState, type Editor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { Placeholder, CharacterCount } from '@tiptap/extensions';
import {
  Bold, Italic, Underline, Strikethrough, Heading2, Heading3, List, ListOrdered, Quote, Link2, Undo2, Redo2, Minus,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface RichTextEditorProps {
  /** HTML. String vazia = editor vazio. */
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
  /** Limite de caracteres de texto (sem contar as tags). */
  maxLength?: number;
  className?: string;
  /** Classes extra da área de escrita (ex.: cor do texto igual à da publicação). */
  conteudoClassName?: string;
}

/** Converte texto simples (publicações antigas) em parágrafos HTML. */
export function textoParaHtml(texto: string): string {
  const bruto = typeof texto === 'string' ? texto : '';
  if (!bruto) return '';
  if (/<\/?[a-z][\s\S]*>/i.test(bruto)) return bruto;
  const escapar = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  return bruto
    .split(/\n{2,}/)
    .map((par) => `<p>${escapar(par).replace(/\n/g, '<br>')}</p>`)
    .join('');
}

export function RichTextEditor({ value, onChange, placeholder, maxLength, className, conteudoClassName }: RichTextEditorProps) {
  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        heading: { levels: [2, 3] },
        link: { openOnClick: false, autolink: true, defaultProtocol: 'https' },
      }),
      Placeholder.configure({ placeholder: placeholder ?? '' }),
      CharacterCount.configure({ limit: maxLength }),
    ],
    content: textoParaHtml(value),
    editorProps: {
      attributes: { class: cn('rich-text min-h-[200px] px-4 py-3 focus:outline-none', conteudoClassName) },
    },
    onUpdate: ({ editor: e }) => onChange(e.isEmpty ? '' : e.getHTML()),
  });

  // Sincroniza alterações externas (ex.: limpar o formulário após publicar)
  useEffect(() => {
    if (!editor) return;
    const actual = editor.isEmpty ? '' : editor.getHTML();
    if (value !== actual) editor.commands.setContent(textoParaHtml(value), { emitUpdate: false });
  }, [value, editor]);

  const caracteres = useEditorState({
    editor,
    selector: ({ editor: e }) => e?.storage.characterCount.characters() ?? 0,
  });

  return (
    <div
      className={cn(
        'rounded-md border border-input bg-white transition-[border-color,box-shadow] focus-within:border-primary focus-within:shadow-focus',
        className,
      )}
    >
      {editor && <Toolbar editor={editor} />}
      <EditorContent editor={editor} />
      {maxLength != null && (
        <p className="border-t border-neutral-100 px-4 py-1.5 text-right text-[11px] text-neutral-400">
          {caracteres ?? 0} / {maxLength}
        </p>
      )}
    </div>
  );
}

function Toolbar({ editor }: { editor: Editor }) {
  const estado = useEditorState({
    editor,
    selector: ({ editor: e }) => ({
      bold: e.isActive('bold'),
      italic: e.isActive('italic'),
      underline: e.isActive('underline'),
      strike: e.isActive('strike'),
      h2: e.isActive('heading', { level: 2 }),
      h3: e.isActive('heading', { level: 3 }),
      bulletList: e.isActive('bulletList'),
      orderedList: e.isActive('orderedList'),
      blockquote: e.isActive('blockquote'),
      link: e.isActive('link'),
      canUndo: e.can().undo(),
      canRedo: e.can().redo(),
    }),
  });

  function editarLink() {
    const anterior = editor.getAttributes('link').href as string | undefined;
    const url = window.prompt('Endereço do link (https://…). Deixa vazio para remover.', anterior ?? 'https://');
    if (url === null) return;
    if (!url.trim() || url.trim() === 'https://') {
      editor.chain().focus().extendMarkRange('link').unsetLink().run();
      return;
    }
    editor.chain().focus().extendMarkRange('link').setLink({ href: url.trim() }).run();
  }

  const c = () => editor.chain().focus();

  return (
    <div className="flex flex-wrap items-center gap-0.5 border-b border-neutral-100 px-2 py-1.5">
      <ToolButton label="Negrito" active={estado.bold} onClick={() => c().toggleBold().run()}><Bold /></ToolButton>
      <ToolButton label="Itálico" active={estado.italic} onClick={() => c().toggleItalic().run()}><Italic /></ToolButton>
      <ToolButton label="Sublinhado" active={estado.underline} onClick={() => c().toggleUnderline().run()}><Underline /></ToolButton>
      <ToolButton label="Riscado" active={estado.strike} onClick={() => c().toggleStrike().run()}><Strikethrough /></ToolButton>
      <Separador />
      <ToolButton label="Título" active={estado.h2} onClick={() => c().toggleHeading({ level: 2 }).run()}><Heading2 /></ToolButton>
      <ToolButton label="Subtítulo" active={estado.h3} onClick={() => c().toggleHeading({ level: 3 }).run()}><Heading3 /></ToolButton>
      <Separador />
      <ToolButton label="Lista" active={estado.bulletList} onClick={() => c().toggleBulletList().run()}><List /></ToolButton>
      <ToolButton label="Lista numerada" active={estado.orderedList} onClick={() => c().toggleOrderedList().run()}><ListOrdered /></ToolButton>
      <ToolButton label="Citação" active={estado.blockquote} onClick={() => c().toggleBlockquote().run()}><Quote /></ToolButton>
      <ToolButton label="Linha separadora" onClick={() => c().setHorizontalRule().run()}><Minus /></ToolButton>
      <ToolButton label="Link" active={estado.link} onClick={editarLink}><Link2 /></ToolButton>
      <Separador />
      <ToolButton label="Desfazer" disabled={!estado.canUndo} onClick={() => c().undo().run()}><Undo2 /></ToolButton>
      <ToolButton label="Refazer" disabled={!estado.canRedo} onClick={() => c().redo().run()}><Redo2 /></ToolButton>
    </div>
  );
}

function ToolButton({
  label, active, disabled, onClick, children,
}: {
  label: string;
  active?: boolean;
  disabled?: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      aria-pressed={active}
      disabled={disabled}
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      className={cn(
        'inline-flex h-8 w-8 items-center justify-center rounded-md transition-colors [&>svg]:h-4 [&>svg]:w-4',
        active ? 'bg-navy-100 text-navy-800' : 'text-neutral-500 hover:bg-neutral-100 hover:text-neutral-800',
        'disabled:pointer-events-none disabled:opacity-40',
      )}
    >
      {children}
    </button>
  );
}

function Separador() {
  return <span className="mx-1 h-5 w-px bg-neutral-200" />;
}
