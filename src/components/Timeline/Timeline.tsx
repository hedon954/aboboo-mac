import { useProjectStore } from '../../stores/projectStore';
import { usePlayerStore } from '../../stores/playerStore';
import { audioEngine } from '../../services/audioEngine';
import { Waveform } from './Waveform';
import type { Track } from '../../types/project';

interface TrackRowProps {
  track: Track;
  blobUrl: string;
  onSeek: (time: number) => void;
  loopStart: number | null;
  loopEnd: number | null;
  isLooping: boolean;
  projectDuration: number;
}

function TrackRow({ track, blobUrl, onSeek, loopStart, loopEnd, isLooping, projectDuration }: TrackRowProps) {
  const { updateTrack, removeTrack } = useProjectStore();

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 0', borderBottom: '1px solid #333' }}>
      <div style={{ width: 120, flexShrink: 0 }}>
        <div style={{ fontSize: 12, color: '#ccc', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {track.name}
        </div>
        <div style={{ display: 'flex', gap: 4, marginTop: 4, alignItems: 'center' }}>
          <button
            onClick={() => {
              const newMuted = !track.muted;
              updateTrack(track.id, { muted: newMuted });
              audioEngine.setVolume(track.id, track.volume, newMuted);
            }}
            style={{
              fontSize: 10, padding: '2px 6px',
              background: track.muted ? '#c0392b' : '#4a9eff',
              border: 'none', borderRadius: 3, color: '#fff', cursor: 'pointer',
            }}
          >
            {track.muted ? '🔇' : '🔊'}
          </button>
          {track.type === 'recording' && (
            <button
              onClick={() => {
                removeTrack(track.id);
                audioEngine.removeBuffer(track.id);
              }}
              style={{ fontSize: 10, padding: '2px 6px', background: '#c0392b', border: 'none', borderRadius: 3, color: '#fff', cursor: 'pointer' }}
            >
              ✕
            </button>
          )}
          <input
            type="range" min={0} max={1} step={0.01}
            value={track.volume}
            onChange={e => {
              const v = parseFloat(e.target.value);
              updateTrack(track.id, { volume: v });
              audioEngine.setVolume(track.id, v, track.muted);
            }}
            style={{ width: 50 }}
          />
        </div>
      </div>
      <div style={{ flex: 1 }}>
        <Waveform
          url={blobUrl}
          trackStartTime={track.startTime}
          onSeek={onSeek}
          onReady={(d) => updateTrack(track.id, { duration: d })}
          color={track.type === 'original' ? '#4a9eff' : '#2ecc71'}
          loopStart={loopStart}
          loopEnd={loopEnd}
          isLooping={isLooping}
          projectDuration={projectDuration}
        />
      </div>
    </div>
  );
}

export function Timeline() {
  const { project, blobUrls } = useProjectStore();
  const { setCurrentTime, setIsPlaying, duration, loopStart, loopEnd, isLooping } = usePlayerStore();

  const handleSeek = async (time: number) => {
    const wasPlaying = audioEngine.seek(time);
    setCurrentTime(time);
    if (wasPlaying && project) {
      const tracks = project.tracks.map(t => ({
        id: t.id, startTime: t.startTime, volume: t.volume, muted: t.muted,
      }));
      await audioEngine.play(tracks);
      setIsPlaying(true);
    }
  };

  if (!project) return null;

  return (
    <div style={{ flex: 1, overflowY: 'auto', padding: '0 16px' }}>
      {project.tracks.map(track => {
        const url = blobUrls.get(track.id);
        if (!url) return null;
        return (
          <TrackRow
            key={track.id}
            track={track}
            blobUrl={url}
            onSeek={handleSeek}
            loopStart={loopStart}
            loopEnd={loopEnd}
            isLooping={isLooping}
            projectDuration={duration}
          />
        );
      })}
    </div>
  );
}
