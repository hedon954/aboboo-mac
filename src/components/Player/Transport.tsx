import { useEffect, useRef, useCallback } from 'react';
import { usePlayerStore } from '../../stores/playerStore';
import { useProjectStore } from '../../stores/projectStore';
import { audioEngine } from '../../services/audioEngine';
import { useParallelRecording } from '../../hooks/useParallelRecording';

const SPEED_PRESETS = [0.5, 0.75, 1, 1.25, 1.5, 2];
const SKIP_SECONDS = 5;

function formatTime(s: number): string {
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  const ms = Math.floor((s % 1) * 10);
  return `${m}:${sec.toString().padStart(2, '0')}.${ms}`;
}

function getTracksForPlay(project: { tracks: Array<{ id: string; startTime: number; volume: number; muted: boolean }> }) {
  return project.tracks.map(t => ({
    id: t.id, startTime: t.startTime, volume: t.volume, muted: t.muted,
  }));
}

export function Transport() {
  const isPlaying = usePlayerStore(s => s.isPlaying);
  const isRecording = usePlayerStore(s => s.isRecording);
  const duration = usePlayerStore(s => s.duration);
  const currentTime = usePlayerStore(s => s.currentTime);
  const playbackRate = usePlayerStore(s => s.playbackRate);
  const loopStart = usePlayerStore(s => s.loopStart);
  const loopEnd = usePlayerStore(s => s.loopEnd);
  const isLooping = usePlayerStore(s => s.isLooping);
  const setCurrentTime = usePlayerStore(s => s.setCurrentTime);
  const setIsPlaying = usePlayerStore(s => s.setIsPlaying);
  const setPlaybackRate = usePlayerStore(s => s.setPlaybackRate);
  const setLoopStart = usePlayerStore(s => s.setLoopStart);
  const setLoopEnd = usePlayerStore(s => s.setLoopEnd);
  const setIsLooping = usePlayerStore(s => s.setIsLooping);
  const clearLoop = usePlayerStore(s => s.clearLoop);
  const project = useProjectStore(s => s.project);

  const rafRef = useRef<number>(0);
  const timeDisplayRef = useRef<HTMLSpanElement>(null);
  const progressBarRef = useRef<HTMLDivElement>(null);
  const { startRecording, stopRecording, cancelRecording } = useParallelRecording();

  // --- rAF tick: smooth display + loop boundary + auto-stop ---
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

        const { loopStart: ls, loopEnd: le, isLooping: il } = usePlayerStore.getState();
        if (il && ls != null && le != null && t >= le) {
          audioEngine.seek(ls);
          const p = useProjectStore.getState().project;
          if (p) audioEngine.play(getTracksForPlay(p));
        } else if (duration > 0 && t >= duration) {
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

  // --- Sync display when not playing ---
  useEffect(() => {
    if (!audioEngine.isPlaying()) {
      if (timeDisplayRef.current) {
        timeDisplayRef.current.textContent = `${formatTime(currentTime)} / ${formatTime(duration)}`;
      }
      if (progressBarRef.current) {
        progressBarRef.current.style.width = duration > 0
          ? `${Math.min(100, (currentTime / duration) * 100)}%`
          : '0%';
      }
    }
  }, [currentTime, duration]);

  // --- Handlers ---
  const playPause = useCallback(async () => {
    if (!project) return;
    if (isPlaying) {
      const t = audioEngine.getCurrentTime();
      audioEngine.pause();
      setIsPlaying(false);
      setCurrentTime(t);
    } else {
      await audioEngine.play(getTracksForPlay(project));
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

  const skip = useCallback((seconds: number) => {
    if (!project) return;
    const t = Math.max(0, Math.min(duration, audioEngine.getCurrentTime() + seconds));
    const wasPlaying = audioEngine.seek(t);
    setCurrentTime(t);
    if (wasPlaying) {
      audioEngine.play(getTracksForPlay(project)).then(() => setIsPlaying(true));
    }
  }, [project, duration, setCurrentTime, setIsPlaying]);

  const cycleSpeed = useCallback((direction: 1 | -1) => {
    const idx = SPEED_PRESETS.indexOf(playbackRate);
    const next = SPEED_PRESETS[Math.max(0, Math.min(SPEED_PRESETS.length - 1, idx + direction))];
    if (next !== undefined) {
      audioEngine.setPlaybackRate(next);
      setPlaybackRate(next);
    }
  }, [playbackRate, setPlaybackRate]);

  const handleSetLoopA = useCallback(() => {
    const t = audioEngine.getCurrentTime();
    setLoopStart(t);
    if (loopEnd != null && t >= loopEnd) setLoopEnd(null);
  }, [loopEnd, setLoopStart, setLoopEnd]);

  const handleSetLoopB = useCallback(() => {
    const t = audioEngine.getCurrentTime();
    if (loopStart != null && t > loopStart) {
      setLoopEnd(t);
      setIsLooping(true);
    }
  }, [loopStart, setLoopEnd, setIsLooping]);

  const handleSeekBar = useCallback(async (e: React.MouseEvent<HTMLDivElement>) => {
    if (!project || !duration) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const t = ratio * duration;
    const wasPlaying = audioEngine.seek(t);
    setCurrentTime(t);
    if (wasPlaying) {
      await audioEngine.play(getTracksForPlay(project));
      setIsPlaying(true);
    }
  }, [project, duration, setCurrentTime, setIsPlaying]);

  // --- Keyboard shortcuts ---
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;

      const p = useProjectStore.getState().project;
      if (!p) return;

      switch (e.code) {
        case 'Space':
          e.preventDefault();
          playPause();
          break;
        case 'KeyR':
          if (!e.metaKey && !e.ctrlKey) { e.preventDefault(); handleRecord(); }
          break;
        case 'Escape':
          e.preventDefault();
          handleStop();
          break;
        case 'ArrowLeft':
          e.preventDefault();
          skip(-SKIP_SECONDS);
          break;
        case 'ArrowRight':
          e.preventDefault();
          skip(SKIP_SECONDS);
          break;
        case 'BracketLeft':
          e.preventDefault();
          cycleSpeed(-1);
          break;
        case 'BracketRight':
          e.preventDefault();
          cycleSpeed(1);
          break;
        case 'KeyA':
          if (!e.metaKey && !e.ctrlKey) { e.preventDefault(); handleSetLoopA(); }
          break;
        case 'KeyB':
          if (!e.metaKey && !e.ctrlKey) { e.preventDefault(); handleSetLoopB(); }
          break;
        case 'KeyL':
          if (!e.metaKey && !e.ctrlKey) {
            e.preventDefault();
            const st = usePlayerStore.getState();
            if (st.loopStart != null && st.loopEnd != null) {
              setIsLooping(!st.isLooping);
            }
          }
          break;
        case 'Backspace':
        case 'Delete':
          if (!e.metaKey && !e.ctrlKey) { e.preventDefault(); clearLoop(); }
          break;
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [playPause, handleStop, handleRecord, skip, cycleSpeed, handleSetLoopA, handleSetLoopB, setIsLooping, clearLoop]);

  // --- Render ---
  const progress = duration > 0 ? Math.min(100, (currentTime / duration) * 100) : 0;
  const loopLeftPct = (loopStart != null && duration > 0) ? (loopStart / duration) * 100 : 0;
  const loopWidthPct = (loopStart != null && loopEnd != null && duration > 0)
    ? ((loopEnd - loopStart) / duration) * 100 : 0;

  return (
    <div style={{ background: '#1a1a2e', borderTop: '1px solid #333' }}>
      {/* Main controls row */}
      <div style={{ padding: '8px 16px', display: 'flex', alignItems: 'center', gap: 6 }}>
        <button onClick={handleStop} disabled={!project} style={btn('#555')} title="Stop (Esc)">■</button>
        <button onClick={() => skip(-SKIP_SECONDS)} disabled={!project} style={btn('#555')} title="Back 5s (←)">⏪</button>
        <button
          onClick={playPause}
          disabled={!project || isRecording}
          style={btn(isPlaying ? '#e67e22' : '#4a9eff')}
          title="Play/Pause (Space)"
        >
          {isPlaying ? '⏸' : '▶'}
        </button>
        <button onClick={() => skip(SKIP_SECONDS)} disabled={!project} style={btn('#555')} title="Forward 5s (→)">⏩</button>
        <button
          onClick={handleRecord}
          disabled={!project}
          style={btn(isRecording ? '#c0392b' : '#e74c3c')}
          title="Record (R)"
        >
          {isRecording ? '■ Stop' : '● REC'}
        </button>
        {isRecording && (
          <button onClick={cancelRecording} style={btn('#7f8c8d')} title="Cancel recording">✕</button>
        )}

        <div style={{ width: 1, height: 20, background: '#444', margin: '0 4px' }} />

        {/* Speed control */}
        <button onClick={() => cycleSpeed(-1)} disabled={playbackRate <= SPEED_PRESETS[0]} style={smallBtn} title="Slower ([)">−</button>
        <span
          style={{
            color: playbackRate === 1 ? '#888' : '#4a9eff',
            fontSize: 12, fontFamily: 'monospace', minWidth: 36, textAlign: 'center', cursor: 'pointer',
            fontWeight: playbackRate === 1 ? 'normal' : 'bold',
          }}
          onClick={() => { audioEngine.setPlaybackRate(1); setPlaybackRate(1); }}
          title="Click to reset to 1x"
        >
          {playbackRate}x
        </span>
        <button onClick={() => cycleSpeed(1)} disabled={playbackRate >= SPEED_PRESETS[SPEED_PRESETS.length - 1]} style={smallBtn} title="Faster (])">+</button>

        <div style={{ width: 1, height: 20, background: '#444', margin: '0 4px' }} />

        {/* Loop controls */}
        <button
          onClick={handleSetLoopA}
          disabled={!project}
          style={{
            ...smallBtn,
            background: loopStart != null ? '#e67e22' : '#444',
            fontWeight: loopStart != null ? 'bold' : 'normal',
          }}
          title="Set loop start (A)"
        >A</button>
        <button
          onClick={handleSetLoopB}
          disabled={!project || loopStart == null}
          style={{
            ...smallBtn,
            background: loopEnd != null ? '#e67e22' : '#444',
            fontWeight: loopEnd != null ? 'bold' : 'normal',
          }}
          title="Set loop end (B)"
        >B</button>
        <button
          onClick={() => {
            if (loopStart != null && loopEnd != null) setIsLooping(!isLooping);
          }}
          disabled={loopStart == null || loopEnd == null}
          style={{
            ...smallBtn,
            background: isLooping ? '#27ae60' : '#444',
          }}
          title="Toggle loop (L)"
        >🔁</button>
        <button
          onClick={clearLoop}
          disabled={loopStart == null}
          style={smallBtn}
          title="Clear loop (Del)"
        >✕</button>
      </div>

      {/* Progress bar row */}
      <div style={{ padding: '4px 16px 10px', display: 'flex', alignItems: 'center', gap: 12 }}>
        <div
          style={{
            flex: 1, height: 6, background: '#333', borderRadius: 3,
            cursor: 'pointer', position: 'relative',
          }}
          onClick={handleSeekBar}
        >
          {/* Loop region highlight */}
          {loopStart != null && loopEnd != null && (
            <div style={{
              position: 'absolute', top: -2, bottom: -2,
              left: `${loopLeftPct}%`, width: `${loopWidthPct}%`,
              background: isLooping ? 'rgba(39, 174, 96, 0.25)' : 'rgba(255, 215, 0, 0.15)',
              border: `1px solid ${isLooping ? 'rgba(39, 174, 96, 0.5)' : 'rgba(255, 215, 0, 0.3)'}`,
              borderRadius: 3, pointerEvents: 'none',
            }} />
          )}
          <div
            ref={progressBarRef}
            style={{ width: `${progress}%`, height: '100%', background: '#4a9eff', borderRadius: 3 }}
          />
        </div>
        <span
          ref={timeDisplayRef}
          style={{ color: '#ccc', fontSize: 12, fontFamily: 'monospace', minWidth: 100 }}
        >
          {formatTime(currentTime)} / {formatTime(duration)}
        </span>
      </div>
    </div>
  );
}

function btn(bg: string): React.CSSProperties {
  return {
    padding: '5px 10px', background: bg, border: 'none', borderRadius: 4,
    color: '#fff', cursor: 'pointer', fontSize: 13,
  };
}

const smallBtn: React.CSSProperties = {
  padding: '3px 8px', background: '#444', border: 'none', borderRadius: 3,
  color: '#ccc', cursor: 'pointer', fontSize: 11, lineHeight: '1',
};
