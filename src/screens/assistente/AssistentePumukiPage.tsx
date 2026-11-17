import { PumukiConversa } from '@/src/components/assistente/PumukiChat';

/** Página Assistente Virtual: a mesma conversa do Pumuki da bolha flutuante, directamente na página (sem cartão). */
export default function AssistentePumukiPage() {
  return (
    <div className="mx-auto h-[calc(100vh-67px-3rem)] max-w-4xl md:h-[calc(100vh-67px-4rem)]">
      <PumukiConversa variante="pagina" className="h-full" />
    </div>
  );
}
