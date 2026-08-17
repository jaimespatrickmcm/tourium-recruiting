// Botão de responder falando. Grava, manda pra transcrição e devolve o texto
// pro campo, onde a pessoa revisa antes de enviar. O áudio não é guardado em
// lugar nenhum: sai do navegador, vira texto e some.
//
// Existe porque pergunta aberta digitada é o maior custo do formulário: a pessoa
// abandona no meio ou responde curto pra terminar logo. Falando, ela conta a
// história inteira em um terço do tempo.

import { useCallback, useEffect, useRef, useState } from 'react';
import { Mic, Square, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';
import { cn } from '@/lib/utils';

// Corte de segurança. Cinco minutos falando dá uma resposta longa; acima disso
// quase sempre é gravação esquecida aberta, e o arquivo estoura o limite da
// função.
const MAX_SECONDS = 300;

// Ordem de preferência. Chrome e Firefox entregam webm/opus; Safari (inclusive
// no iPhone) só entrega mp4. Sem essa checagem o botão morre calado no iOS,
// que é justamente onde a maioria vai responder.
const MIME_CANDIDATES = [
  'audio/webm;codecs=opus',
  'audio/webm',
  'audio/mp4',
  'audio/ogg;codecs=opus',
];

function pickMimeType(): string | undefined {
  if (typeof MediaRecorder === 'undefined') return undefined;
  return MIME_CANDIDATES.find((t) => {
    try {
      return MediaRecorder.isTypeSupported(t);
    } catch {
      return false;
    }
  });
}

export function audioRecordingSupported(): boolean {
  return (
    typeof navigator !== 'undefined' &&
    Boolean(navigator.mediaDevices?.getUserMedia) &&
    typeof MediaRecorder !== 'undefined' &&
    pickMimeType() !== undefined
  );
}

function formatElapsed(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

type Props = {
  applicationId: string | null;
  token: string | null;
  /** Recebe o texto transcrito. O componente não sabe onde ele vai parar. */
  onTranscribed: (text: string) => void;
  disabled?: boolean;
};

export function AudioAnswerButton({ applicationId, token, onTranscribed, disabled }: Props) {
  const [recording, setRecording] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const [elapsed, setElapsed] = useState(0);

  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<number | null>(null);

  // Solta o microfone. Sem isso o indicador de gravação fica aceso no navegador
  // depois que a pessoa já parou, o que assusta com razão.
  const releaseMic = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (timerRef.current !== null) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  useEffect(() => releaseMic, [releaseMic]);

  const stop = useCallback(() => {
    if (recorderRef.current?.state === 'recording') recorderRef.current.stop();
  }, []);

  async function sendForTranscription(blob: Blob) {
    if (!applicationId || !token) {
      toast.error('Sua sessão expirou. Abra o formulário de novo pelo link do e-mail.');
      return;
    }
    setTranscribing(true);
    try {
      const form = new FormData();
      form.append('applicationId', applicationId);
      form.append('token', token);
      form.append('audio', blob, 'resposta');

      const { data, error } = await supabase.functions.invoke('transcribe-audio', { body: form });
      if (error) {
        // O corpo traz o motivo real; o .message do supabase-js é sempre genérico.
        let msg = 'Não deu pra transcrever agora. Tente de novo.';
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const ctx = (error as any).context;
        if (ctx && typeof ctx.json === 'function') {
          try {
            const parsed = await ctx.json();
            if (parsed?.error) msg = String(parsed.error);
          } catch {
            // corpo não era JSON: fica a mensagem padrão
          }
        }
        throw new Error(msg);
      }
      const text = String(data?.text ?? '').trim();
      if (!text) throw new Error('Não deu pra entender o áudio. Tente gravar de novo.');
      onTranscribed(text);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Não deu pra transcrever agora.');
    } finally {
      setTranscribing(false);
    }
  }

  async function start() {
    const mimeType = pickMimeType();
    if (!mimeType) {
      toast.error('Seu navegador não grava áudio. Pode responder escrevendo.');
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      chunksRef.current = [];

      const recorder = new MediaRecorder(stream, { mimeType });
      recorderRef.current = recorder;

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      recorder.onstop = () => {
        releaseMic();
        setRecording(false);
        setElapsed(0);
        const blob = new Blob(chunksRef.current, { type: mimeType });
        chunksRef.current = [];
        if (blob.size > 0) void sendForTranscription(blob);
      };

      recorder.start();
      setRecording(true);
      setElapsed(0);
      timerRef.current = window.setInterval(() => {
        setElapsed((prev) => {
          const next = prev + 1;
          if (next >= MAX_SECONDS) stop();
          return next;
        });
      }, 1000);
    } catch {
      releaseMic();
      toast.error(
        'Precisamos da permissão do microfone pra gravar. Libere nas configurações do navegador ou responda escrevendo.',
      );
    }
  }

  const busy = disabled || transcribing;

  return (
    <div className="flex items-center gap-2.5">
      <button
        type="button"
        onClick={() => (recording ? stop() : void start())}
        disabled={busy}
        aria-label={recording ? 'Parar gravação' : 'Responder falando'}
        className={cn(
          'inline-flex h-10 items-center gap-2 rounded-full px-4 text-footnote font-semibold transition-colors duration-200 disabled:opacity-50',
          recording
            ? 'bg-critical text-white'
            : 'border border-line bg-surface text-ink hover:bg-canvas',
        )}
      >
        {transcribing ? (
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
        ) : recording ? (
          <Square className="h-3.5 w-3.5 fill-current" aria-hidden />
        ) : (
          <Mic className="h-4 w-4" aria-hidden />
        )}
        {transcribing ? 'Transcrevendo' : recording ? `Parar ${formatElapsed(elapsed)}` : 'Falar'}
      </button>

      {recording && (
        <span className="text-caption text-ink-subtle" role="status">
          Pode falar. Quando terminar, toque em parar.
        </span>
      )}
    </div>
  );
}
