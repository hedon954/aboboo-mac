import { useRef, useCallback } from 'react';
import { audioEngine } from '../services/audioEngine';
import { audioRecorder } from '../services/recorder';
import { usePlayerStore } from '../stores/playerStore';
import { useProjectStore } from '../stores/projectStore';

export function useParallelRecording() {
  const lastRecordingStart = useRef(0);
  const { setIsRecording, setIsPlaying, setCurrentTime } = usePlayerStore();
  const { project, addTrack, addRecordingBlob, setBlobUrl } = useProjectStore();

  const startRecording = useCallback(async () => {
    if (!project) return;
    try {
      await audioRecorder.initialize();
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Microphone access failed');
      return;
    }

    const time = audioEngine.getCurrentTime();
    lastRecordingStart.current = time;
    audioRecorder.startRecording(time);

    const tracks = project.tracks.map(t => ({
      id: t.id,
      startTime: t.startTime,
      volume: t.volume,
      muted: t.muted,
    }));
    await audioEngine.play(tracks);
    setIsPlaying(true);
    setIsRecording(true);
  }, [project, setIsPlaying, setIsRecording]);

  const stopRecording = useCallback(async () => {
    audioEngine.pause();
    setIsPlaying(false);
    setIsRecording(false);

    const { blob, startTime } = await audioRecorder.stopRecording();
    if (blob.size === 0) return;

    const url = URL.createObjectURL(blob);
    const track = addTrack({
      type: 'recording',
      name: `Recording ${new Date().toLocaleTimeString()}`,
      audioPath: '',
      startTime,
      duration: 0,
      volume: 1,
      muted: false,
      recordingStart: startTime,
    });

    addRecordingBlob(track.id, blob);
    setBlobUrl(track.id, url);

    const ab = await blob.arrayBuffer();
    const duration = await audioEngine.loadAudio(track.id, ab);
    useProjectStore.getState().updateTrack(track.id, { duration });

    setCurrentTime(startTime);
    audioEngine.seek(startTime);
  }, [addTrack, addRecordingBlob, setBlobUrl, setIsPlaying, setIsRecording, setCurrentTime]);

  const cancelRecording = useCallback(() => {
    audioEngine.pause();
    audioRecorder.cancelRecording();
    setIsPlaying(false);
    setIsRecording(false);

    const start = lastRecordingStart.current;
    setCurrentTime(start);
    audioEngine.seek(start);
  }, [setIsPlaying, setIsRecording, setCurrentTime]);

  return { startRecording, stopRecording, cancelRecording };
}
