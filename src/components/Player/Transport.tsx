import { useEffect, useRef, useCallback } from 'react';
import { usePlayerStore } from '../../stores/playerStore';
import { useProjectStore } from '../../stores/projectStore';
import { audioEngine } from '../../services/audioEngine';
import { useParallelRecording } from '../../hooks/useParallelRecording';

function formatTime(s: number): string {
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  const ms = Math.floor((s % 1) * 10);
  return `${m}:${sec.toString().padStart(2, '0')}.${ms}`;
}

export function Transport() {
  const isPlaying = usePlayerStore(s => s.isPlaying);
  const isRecording = usePlayerStore(s => s.isRecording);
  const duration = usePlayerStore(s => s.duration);
  const currentTime = usePlayerStore(s => s.currentTime);
  const setCurrentTime = usePlayerStore(s => s.setCurrentTime);
  const setIsPlaying = usePlayerStore(s => s.setIsPlaying);
  const project = useProjectStore(s => s.project);

  const rafRef = useRef<number>(0);
  const timeDisplayRef = useRef<HTMLSpanElement>(null);
  const progressBarRef = useRef<HTMLDivElement>(null);
  const { startRecording, stopRecording, cancelRecording } = useParallelRecording();

  useEffect(() => {
    const tick = () => {
      if (audioEngine.isPlaying()) {
        const t = audioEngine.getCurrentTime();
        if (timeDisplayRef.current) {
          timeDisplayRef.current.textContent = `${formatTime(t)} / ${formatTime(duration)}`;
        }
        if (progressBarRef.current && duration > 0) {
          progressBarRef.current.style.width = `${Math.min(100, (t / duration) * 100)}%`;
        }
        if (duration > 0 && t >= duration) {
          audioEngine.stop();
          setIsPlaying(false);
          setCurrentTime(0);
        }
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [duration, setCurrentTime, setIsPlaying]);

  useEffect(() => {
    if (!audioEngine.isPlaying()) {
      if (timeDisplayRef.current) {
        timeDisplayRef.current.textContent = `${formatTime(currentTime)} / ${formatTime(duration)}`;
      }
      if (progressBarRef.current && duration > 0) {
        progressBarRef.current.style.width = `${Math.min(100, (currentTime / duration) * 100)}%`;
      } else if (progressBarRef.current) {
        progressBarRef.current.style.width = '0%';
      }
    }
  }, [currentTime, duration]);

  const handlePlayPause = useCallback(async () => {
    if (!project) return;
    if (isPlaying) {
      const t = audioEngine.getCurrentTime();
      audioEngine.pause();
      setIsPlaying(false);
      setCurrentTime(t);
    } else {
      const tracks = project.tracks.map(t => ({
        id: t.id, startTime: t.startTime, volume: t.volume, muted: t.muted,
      }));
      await audioEngine.play(tracks);
      setIsPlaying(true);
    }
  }, [project, isPlaying, setIsPlaying, setCurrentTime]);

  const handleStop = useCallback(() => {
    audioEngine.stop();
    setIsPlaying(false);
    setCurrentTime(0);
  }, [setIsPlaying, setCurrentTime]);

  const handleRecord = useCallback(() => {
    if (isRecording) {
      stopRecording();
    } else {
      startRecording();
    }
  }, [isRecording, startRecording, stopRecording]);

  const handleSeekBar = useCallback(async (e: React.MouseEvent<HTMLDivElement>) => {
    if (!project || !duration) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const t = ratio * duration;
    const wasPlaying = audioEngine.seek(t);
    setCurrentTime(t);
    if (wasPlaying) {
      const tracks = project.tracks.map(tr => ({
        id: tr.id, startTime: tr.startTime, volume: tr.volume, muted: tr.muted,
      }));
      await audioEngine.play(tracks);
      setIsPlaying(true);
    }
  }, [project, duration, setCurrentTime, setIsPlaying]);

  const progress = duration > 0 ? Math.min(100, (currentTime / duration) * 100) : 0;

  return (
    <div style={{
      padding: '12px 16px', background: '#1a1a2e', borderTop: '1px solid #333',
      display: 'flex', alignItems: 'center', gap: 12,
    }}>
      <button onClick={handleStop} disabled={!project} style={btnStyle('#555')}>■</button>
      <button
        onClick={handlePlayPause}
        disabled={!project || isRecording}
        style={btnStyle(isPlaying ? '#e67e22' : '#4a9eff')}
      >
        {isPlaying ? '⏸' : '▶'}
      </button>
      <button
        onClick={handleRecord}
        disabled={!project}
        style={btnStyle(isRecording ? '#c0392b' : '#e74c3c')}
      >
        {isRecording ? '■ Stop' : '● REC'}
      </button>
      {isRecording && (
        <button onClick={cancelRecording} style={btnStyle('#7f8c8d')}>✕ Cancel</button>
      )}
      <div
        style={{
          flex: 1, height: 6, background: '#333', borderRadius: 3,
          cursor: 'pointer', position: 'relative',
        }}
        onClick={handleSeekBar}
      >
        <div
          ref={progressBarRef}
          style={{
            width: `${progress}%`, height: '100%',
            background: '#4a9eff', borderRadius: 3,
          }}
        />
      </div>
      <span
        ref={timeDisplayRef}
        style={{ color: '#ccc', fontSize: 13, fontFamily: 'monospace', minWidth: 100 }}
      >
        {formatTime(currentTime)} / {formatTime(duration)}
      </span>
    </div>
  );
}

function btnStyle(bg: string): React.CSSProperties {
  return {
    padding: '6px 12px', background: bg, border: 'none', borderRadius: 4,
    color: '#fff', cursor: 'pointer', fontSize: 13,
  };
}
