import { useEffect, useRef } from 'react';
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
  const { isPlaying, isRecording, currentTime, duration, setCurrentTime, setIsPlaying } = usePlayerStore();
  const { project } = useProjectStore();
  const rafRef = useRef<number>(0);
  const { startRecording, pauseRecording, stopRecording } = useParallelRecording();

  useEffect(() => {
    const tick = () => {
      if (audioEngine.isPlaying()) {
        const t = audioEngine.getCurrentTime();
        setCurrentTime(t);
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

  const handlePlayPause = async () => {
    if (!project) return;
    if (isPlaying) {
      audioEngine.pause();
      setIsPlaying(false);
    } else {
      const tracks = project.tracks.map(t => ({ id: t.id, startTime: t.startTime, volume: t.volume, muted: t.muted }));
      await audioEngine.play(tracks);
      setIsPlaying(true);
    }
  };

  const handleStop = () => {
    audioEngine.stop();
    setIsPlaying(false);
    setCurrentTime(0);
  };

  const handleRecord = () => {
    if (isRecording) {
      pauseRecording();
    } else {
      startRecording();
    }
  };

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <div style={{ padding: '12px 16px', background: '#1a1a2e', borderTop: '1px solid #333', display: 'flex', alignItems: 'center', gap: 12 }}>
      <button onClick={handleStop} disabled={!project} style={btnStyle('#555')}>■</button>
      <button onClick={handlePlayPause} disabled={!project} style={btnStyle(isPlaying ? '#e67e22' : '#4a9eff')}>
        {isPlaying ? '⏸' : '▶'}
      </button>
      <button onClick={handleRecord} disabled={!project} style={btnStyle(isRecording ? '#c0392b' : '#e74c3c')}>
        {isRecording ? '⏸ REC' : '● REC'}
      </button>
      <button onClick={stopRecording} disabled={!isRecording} style={btnStyle('#7f8c8d')}>■ Stop Rec</button>
      <div style={{ flex: 1, height: 4, background: '#333', borderRadius: 2, cursor: 'pointer' }}
        onClick={e => {
          if (!project) return;
          const rect = e.currentTarget.getBoundingClientRect();
          const ratio = (e.clientX - rect.left) / rect.width;
          const t = ratio * duration;
          audioEngine.seek(t);
          setCurrentTime(t);
        }}
      >
        <div style={{ width: `${progress}%`, height: '100%', background: '#4a9eff', borderRadius: 2 }} />
      </div>
      <span style={{ color: '#ccc', fontSize: 13, fontFamily: 'monospace', minWidth: 80 }}>
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
