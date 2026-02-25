import { useEffect, useRef } from 'react';
import WaveSurfer from 'wavesurfer.js';
import { audioEngine } from '../../services/audioEngine';

interface WaveformProps {
  url: string;
  trackStartTime: number;
  onSeek: (projectTime: number) => void;
  onReady: (duration: number) => void;
  color?: string;
}

function makeProgressColor(color: string): string {
  if (color.startsWith('#') && color.length === 7) {
    const r = parseInt(color.slice(1, 3), 16);
    const g = parseInt(color.slice(3, 5), 16);
    const b = parseInt(color.slice(5, 7), 16);
    return `rgba(${r}, ${g}, ${b}, 0.4)`;
  }
  return color;
}

export function Waveform({ url, trackStartTime, onSeek, onReady, color = '#4a9eff' }: WaveformProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const wsRef = useRef<WaveSurfer | null>(null);
  const rafRef = useRef<number>(0);
  const lastFractionRef = useRef(-1);

  const trackStartTimeRef = useRef(trackStartTime);
  const onSeekRef = useRef(onSeek);
  const onReadyRef = useRef(onReady);
  trackStartTimeRef.current = trackStartTime;
  onSeekRef.current = onSeek;
  onReadyRef.current = onReady;

  useEffect(() => {
    if (!containerRef.current) return;

    const progressColor = makeProgressColor(color);
    const ws = WaveSurfer.create({
      container: containerRef.current,
      waveColor: color,
      progressColor,
      height: 60,
      normalize: true,
      interact: true,
      cursorWidth: 1,
      cursorColor: '#fff',
    });

    ws.load(url);
    ws.on('ready', () => onReadyRef.current(ws.getDuration()));
    ws.on('interaction', (time: number) => {
      const projectTime = trackStartTimeRef.current + time;
      onSeekRef.current(projectTime);
    });
    wsRef.current = ws;

    const tick = () => {
      const w = wsRef.current;
      if (w) {
        const dur = w.getDuration();
        if (dur > 0) {
          const globalTime = audioEngine.getCurrentTime();
          const localTime = globalTime - trackStartTimeRef.current;
          const fraction = Math.max(0, Math.min(1, localTime / dur));
          if (Math.abs(fraction - lastFractionRef.current) > 0.0005) {
            w.seekTo(fraction);
            lastFractionRef.current = fraction;
          }
        }
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(rafRef.current);
      ws.destroy();
      wsRef.current = null;
      lastFractionRef.current = -1;
    };
  }, [url, color]);

  return <div ref={containerRef} style={{ width: '100%' }} />;
}
