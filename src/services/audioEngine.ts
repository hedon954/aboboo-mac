export class AudioEngine {
  private ctx: AudioContext | null = null;
  private sources: Map<string, AudioBufferSourceNode> = new Map();
  private buffers: Map<string, AudioBuffer> = new Map();
  private gainNodes: Map<string, GainNode> = new Map();
  private playStartRealTime = 0;
  private playStartAudioTime = 0;
  private pausedAt = 0;
  private playing = false;
  private rate = 1;

  private getCtx(): AudioContext {
    if (!this.ctx) this.ctx = new AudioContext();
    return this.ctx;
  }

  async loadAudio(id: string, arrayBuffer: ArrayBuffer): Promise<number> {
    const ctx = this.getCtx();
    const copy = arrayBuffer.slice(0);
    const audioBuffer = await ctx.decodeAudioData(copy);
    this.buffers.set(id, audioBuffer);
    return audioBuffer.duration;
  }

  async play(tracks: Array<{ id: string; startTime: number; volume: number; muted: boolean }>) {
    if (this.playing) return;
    const ctx = this.getCtx();
    if (ctx.state === 'suspended') await ctx.resume();
    const offset = this.pausedAt;

    for (const track of tracks) {
      const buffer = this.buffers.get(track.id);
      if (!buffer) continue;

      const trackOffset = Math.max(0, offset - track.startTime);
      if (trackOffset >= buffer.duration) continue;

      const gain = ctx.createGain();
      gain.gain.value = track.muted ? 0 : track.volume;
      gain.connect(ctx.destination);

      const source = ctx.createBufferSource();
      source.buffer = buffer;
      source.playbackRate.value = this.rate;
      source.connect(gain);

      const delay = Math.max(0, (track.startTime - offset) / this.rate);
      source.start(ctx.currentTime + delay, trackOffset);

      this.sources.set(track.id, source);
      this.gainNodes.set(track.id, gain);
    }

    this.playStartRealTime = ctx.currentTime;
    this.playStartAudioTime = offset;
    this.playing = true;
  }

  pause() {
    if (!this.playing) return;
    this.pausedAt = this.getCurrentTime();
    this.stopSources();
    this.playing = false;
  }

  stop() {
    this.pause();
    this.pausedAt = 0;
  }

  seek(time: number): boolean {
    const wasPlaying = this.playing;
    if (wasPlaying) this.pause();
    this.pausedAt = time;
    return wasPlaying;
  }

  getCurrentTime(): number {
    if (!this.ctx) return 0;
    if (!this.playing) return this.pausedAt;
    const realElapsed = this.ctx.currentTime - this.playStartRealTime;
    return this.playStartAudioTime + realElapsed * this.rate;
  }

  isPlaying(): boolean {
    return this.playing;
  }

  setPlaybackRate(newRate: number) {
    if (this.playing && this.ctx) {
      const currentAudioTime = this.getCurrentTime();
      this.playStartAudioTime = currentAudioTime;
      this.playStartRealTime = this.ctx.currentTime;
      this.sources.forEach(source => {
        source.playbackRate.value = newRate;
      });
    }
    this.rate = newRate;
  }

  getPlaybackRate(): number {
    return this.rate;
  }

  setVolume(id: string, volume: number, muted: boolean) {
    const gain = this.gainNodes.get(id);
    if (gain) gain.gain.value = muted ? 0 : volume;
  }

  hasBuffer(id: string): boolean {
    return this.buffers.has(id);
  }

  removeBuffer(id: string) {
    this.buffers.delete(id);
  }

  private stopSources() {
    this.sources.forEach(s => {
      try { s.stop(); } catch { /* already stopped */ }
    });
    this.sources.clear();
    this.gainNodes.clear();
  }

  dispose() {
    this.stop();
    this.ctx?.close();
    this.ctx = null;
    this.buffers.clear();
  }
}

export const audioEngine = new AudioEngine();
