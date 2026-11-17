import { useState, useRef, useEffect, useMemo } from 'react';
import { Play, CheckCircle2, Lock } from 'lucide-react';
import { Button } from '@/src/components/ui/button';
import type { WelcomeVideo } from '@/src/services/onboarding-v2.service';

interface VideoGateProps {
  video: WelcomeVideo;
  onComplete: () => void;
  ctaLabel?: string;
}

const DIRECT_RE = /\.(mp4|webm|ogg|mov)(\?.*)?$/i;

type EmbedKind = 'youtube' | 'vimeo' | 'drive';

/** Converte URLs YouTube/Vimeo/Google Drive para embed com autoplay. */
function toEmbed(url: string): { src: string; kind: EmbedKind } | null {
  try {
    const u = new URL(url);
    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    if (u.hostname.includes('youtube.com') || u.hostname === 'youtu.be') {
      const id = u.hostname === 'youtu.be'
        ? u.pathname.slice(1)
        : u.searchParams.get('v');
      if (!id) return null;
      const embed = new URL(`https://www.youtube.com/embed/${id}`);
      embed.searchParams.set('autoplay', '1');
      embed.searchParams.set('mute', '1');
      embed.searchParams.set('enablejsapi', '1');
      embed.searchParams.set('playsinline', '1');
      embed.searchParams.set('rel', '0');
      embed.searchParams.set('start', '0');
      if (origin) embed.searchParams.set('origin', origin);
      return { src: embed.toString(), kind: 'youtube' };
    }
    if (u.hostname.includes('vimeo.com')) {
      const id = u.pathname.split('/').filter(Boolean).pop();
      if (!id) return null;
      const embed = new URL(`https://player.vimeo.com/video/${id}`);
      embed.searchParams.set('autoplay', '1');
      embed.searchParams.set('muted', '1');
      embed.searchParams.set('playsinline', '1');
      return { src: embed.toString(), kind: 'vimeo' };
    }
    if (u.hostname.includes('drive.google.com')) {
      const match = u.pathname.match(/\/file\/d\/([^/]+)/);
      const id = match?.[1] ?? u.searchParams.get('id');
      if (!id) return null;
      return { src: `https://drive.google.com/file/d/${id}/preview`, kind: 'drive' };
    }
  } catch {
    /* url inválida */
  }
  return null;
}

// Fallback client-side quando o vídeo não define duracao_minima_segundos.
const DEFAULT_EMBED_MIN_WATCH = 20;

export function VideoGate({ video, onComplete, ctaLabel = 'Continuar' }: VideoGateProps) {
  const [unlocked, setUnlocked] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [remaining, setRemaining] = useState<number | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  const url = video.url?.trim() ?? '';
  const isDirect = DIRECT_RE.test(url);
  const embed = useMemo(() => (url && !isDirect ? toEmbed(url) : null), [url, isDirect]);
  const embedSrc = embed?.src ?? '';
  const embedKind = embed?.kind ?? null;
  const frameId = `welcome-video-${video.slot}`;
  const minWatch = Math.max(0, Number(video.duracao_minima_segundos) || DEFAULT_EMBED_MIN_WATCH);
  const bootRef = useRef<() => void>(() => {});

  useEffect(() => {
    if (!embedKind || !embedSrc) return;
    let cancelled = false;
    let booted = false;

    function applyYouTubeState(state: number) {
      setPlaying(state === 1 || state === 3);
      if (state === 0) setUnlocked(true);
    }

    function post(payload: unknown) {
      iframeRef.current?.contentWindow?.postMessage(JSON.stringify(payload), '*');
    }

    function armVimeo() {
      post({ method: 'addEventListener', value: 'play' });
      post({ method: 'addEventListener', value: 'pause' });
      post({ method: 'addEventListener', value: 'ended' });
      post({ method: 'play' });
    }

    function armYouTube() {
      const id = iframeRef.current?.id || frameId;
      post({ event: 'listening', id, channel: 'widget' });
      post({ event: 'command', func: 'addEventListener', args: ['onStateChange'], id, channel: 'widget' });
      post({ event: 'command', func: 'mute', args: '', id, channel: 'widget' });
      post({ event: 'command', func: 'playVideo', args: '', id, channel: 'widget' });
    }

    function boot() {
      if (cancelled || booted) return;
      booted = true;
      if (embedKind === 'youtube') armYouTube();
      if (embedKind === 'vimeo') armVimeo();
    }

    bootRef.current = boot;

    function onMessage(event: MessageEvent) {
      let data = event.data as unknown;
      if (typeof data === 'string') {
        try { data = JSON.parse(data); } catch { return; }
      }
      if (!data || typeof data !== 'object') return;
      const message = data as { event?: string; info?: number | { playerState?: number } };
      const playerState = typeof message.info === 'number' ? message.info : message.info?.playerState;

      if (embedKind === 'youtube' && (message.event === 'onStateChange' || message.event === 'infoDelivery') && playerState != null) {
        applyYouTubeState(playerState);
      }
      if (embedKind === 'vimeo' && (message.event === 'play' || message.event === 'playing')) setPlaying(true);
      if (embedKind === 'vimeo' && message.event === 'pause') setPlaying(false);
      if (embedKind === 'vimeo' && (message.event === 'ended' || message.event === 'finish')) {
        setPlaying(false);
        setUnlocked(true);
      }
    }

    function onBlur() {
      if (embedKind === 'drive' && document.activeElement === iframeRef.current) setPlaying(true);
    }

    function iframeAlreadyLoaded(frame: HTMLIFrameElement) {
      try {
        const href = frame.contentWindow?.location.href ?? '';
        return href !== '' && href !== 'about:blank';
      } catch {
        return true;
      }
    }

    window.addEventListener('message', onMessage);
    window.addEventListener('blur', onBlur);
    const frame = iframeRef.current;
    if (frame && iframeAlreadyLoaded(frame)) boot();
    return () => {
      cancelled = true;
      if (bootRef.current === boot) bootRef.current = () => {};
      window.removeEventListener('message', onMessage);
      window.removeEventListener('blur', onBlur);
    };
  }, [embedKind, embedSrc, frameId]);

  // O tempo só corre enquanto o vídeo está a reproduzir.
  useEffect(() => {
    if (isDirect || unlocked || !embedSrc || !playing) return;
    if (minWatch === 0) {
      setUnlocked(true);
      return;
    }
    setRemaining((current) => current ?? minWatch);
    const iv = setInterval(() => {
      setRemaining((current) => {
        const left = current ?? minWatch;
        if (left <= 1) {
          clearInterval(iv);
          setUnlocked(true);
          return 0;
        }
        return left - 1;
      });
    }, 1000);
    return () => clearInterval(iv);
  }, [embedSrc, isDirect, unlocked, minWatch, playing]);

  function handleTimeUpdate() {
    const el = videoRef.current;
    if (!el || !el.duration) return;
    if (el.currentTime / el.duration >= 0.9) setUnlocked(true);
  }

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col items-center">
      <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-gold-200/60 bg-gold-50 px-4 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-gold-800">
        <Play className="h-3.5 w-3.5" />
        Este vídeo é fundamental para a sua integração
      </div>
      <h2 className="text-center text-2xl font-bold text-navy-900">{video.titulo}</h2>
      {video.descricao && (
        <p className="mt-2 max-w-xl text-center text-sm text-navy-500">{video.descricao}</p>
      )}

      <div className="mt-6 aspect-video w-full overflow-hidden rounded-2xl border border-navy-100 bg-black shadow-card">
        {!url ? (
          <div className="flex h-full items-center justify-center text-navy-300">
            Vídeo ainda não configurado pelo administrador.
          </div>
        ) : isDirect ? (
          <video
            ref={videoRef}
            src={url}
            autoPlay
            muted
            playsInline
            controls
            onTimeUpdate={handleTimeUpdate}
            onEnded={() => setUnlocked(true)}
            className="h-full w-full"
          />
        ) : embed ? (
          <iframe
            id={frameId}
            ref={iframeRef}
            src={embed.src}
            title={video.titulo}
            allow="autoplay; accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            onLoad={() => bootRef.current()}
            className="h-full w-full"
          />
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-2 text-navy-300">
            <a href={url} target="_blank" rel="noreferrer" className="text-gold-400 underline">
              Abrir vídeo
            </a>
          </div>
        )}
      </div>

      <div className="mt-6 flex flex-col items-center gap-2">
        {!url && (
          <Button variant="ghost" onClick={onComplete}>
            Saltar (sem vídeo)
          </Button>
        )}
        {url && (
          <Button variant="accent" disabled={!unlocked} onClick={onComplete}>
            {unlocked ? (
              <span className="inline-flex items-center gap-1.5">
                <CheckCircle2 className="h-4 w-4" /> {ctaLabel}
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5">
                <Lock className="h-4 w-4" />
                {playing && remaining != null && remaining > 0 ? `Aguarde ${remaining}s…` : 'O vídeo está a começar…'}
              </span>
            )}
          </Button>
        )}
      </div>
    </div>
  );
}
