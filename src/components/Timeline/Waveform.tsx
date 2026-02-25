import { useEffect, useRef, useMemo } from 'react';
import WaveSurfer from 'wavesurfer.js';
import { audioEngine } from '../../services/audioEngine';

interface WaveformProps {
  url: string;
  trackStartTime: number;
  onSeek: (projectTime: number) => void;
  onReady: (duration: number) => void;
  color?: string;
  loopStart?: number | null;
  loopEnd?: number | null;
  isLooping?: boolean;
  projectDuration?: number;
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

export function Waveform({
  url, trackStartTime, onSeek, onReady, color = '#4a9eff',
  loopStart, loopEnd, isLooping, projectDuration,
}: WaveformProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const wsRef = useRef<WaveSurfer | null>(null);
  const rafRef = useRef<number>(0);
  const lastFractionRef = useRef(-1);
  const wsDurationRef = useRef(0);

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
    ws.on('ready', () => {
      wsDurationRef.current = ws.getDuration();
      onReadyRef.current(ws.getDuration());
    });
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

  const loopOverlay = useMemo(() => {
    if (loopStart == null || loopEnd == null || !projectDuration || projectDuration <= 0) return null;
    const dur = wsDurationRef.current || projectDuration;
    const localStart = Math.max(0, loopStart - trackStartTime);
    const localEnd = Math.min(dur, loopEnd - trackStartTime);
    if (localEnd <= localStart) return null;
    const left = (localStart / dur) * 100;
    const width = ((localEnd - localStart) / dur) * 100;
    return { left: `${left}%`, width: `${width}%` };
  }, [loopStart, loopEnd, projectDuration, trackStartTime]);

  return (
    <div style={{ position: 'relative', width: '100%' }}>
      <div ref={containerRef} style={{ width: '100%' }} />
      {loopOverlay && (
        <div style={{
          position: 'absolute', top: 0, bottom: 0,
          left: loopOverlay.left, width: loopOverlay.width,
          background: isLooping ? 'rgba(39, 174, 96, 0.2)' : 'rgba(255, 215, 0, 0.12)',
          borderLeft: `2px solid ${isLooping ? '#27ae60' : '#f1c40f'}`,
          borderRight: `2px solid ${isLooping ? '#27ae60' : '#f1c40f'}`,
          pointerEvents: 'none',
        }} />
      )}
    </div>
  );
}
