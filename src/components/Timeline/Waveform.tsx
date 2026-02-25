import { useEffect, useRef } from 'react';
import WaveSurfer from 'wavesurfer.js';

interface WaveformProps {
  url: string;
  currentTime: number;
  duration: number;
  onSeek: (time: number) => void;
  onReady: (duration: number) => void;
  color?: string;
}

export function Waveform({ url, currentTime, duration, onSeek, onReady, color = '#4a9eff' }: WaveformProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const wsRef = useRef<WaveSurfer | null>(null);
  const seekingRef = useRef(false);

  useEffect(() => {
    if (!containerRef.current) return;
    const ws = WaveSurfer.create({
      container: containerRef.current,
      waveColor: color,
      progressColor: color.replace('ff', '88'),
      height: 60,
      normalize: true,
      interact: true,
    });
    ws.load(url);
    ws.on('ready', () => onReady(ws.getDuration()));
    ws.on('seeking', (t) => {
      seekingRef.current = true;
      onSeek(t);
    });
    wsRef.current = ws;
    return () => { ws.destroy(); wsRef.current = null; };
  }, [url]);

  useEffect(() => {
    const ws = wsRef.current;
    if (!ws || seekingRef.current) { seekingRef.current = false; return; }
    if (duration > 0) ws.seekTo(currentTime / duration);
  }, [currentTime, duration]);

  return <div ref={containerRef} style={{ width: '100%' }} />;
}
