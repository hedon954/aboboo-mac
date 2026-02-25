import { create } from 'zustand';

interface PlayerState {
  currentTime: number;
  duration: number;
  isPlaying: boolean;
  isRecording: boolean;
  playbackRate: number;
  loopStart: number | null;
  loopEnd: number | null;
  isLooping: boolean;
  setCurrentTime: (t: number) => void;
  setDuration: (d: number) => void;
  setIsPlaying: (v: boolean) => void;
  setIsRecording: (v: boolean) => void;
  setPlaybackRate: (r: number) => void;
  setLoopStart: (t: number | null) => void;
  setLoopEnd: (t: number | null) => void;
  setIsLooping: (v: boolean) => void;
  clearLoop: () => void;
}

export const usePlayerStore = create<PlayerState>(set => ({
  currentTime: 0,
  duration: 0,
  isPlaying: false,
  isRecording: false,
  playbackRate: 1,
  loopStart: null,
  loopEnd: null,
  isLooping: false,
  setCurrentTime: (t) => set({ currentTime: t }),
  setDuration: (d) => set({ duration: d }),
  setIsPlaying: (v) => set({ isPlaying: v }),
  setIsRecording: (v) => set({ isRecording: v }),
  setPlaybackRate: (r) => set({ playbackRate: r }),
  setLoopStart: (t) => set({ loopStart: t }),
  setLoopEnd: (t) => set({ loopEnd: t }),
  setIsLooping: (v) => set({ isLooping: v }),
  clearLoop: () => set({ loopStart: null, loopEnd: null, isLooping: false }),
}));
