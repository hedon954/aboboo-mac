export class AudioRecorder {
  private stream: MediaStream | null = null;
  private recorder: MediaRecorder | null = null;
  private chunks: Blob[] = [];
  private recordingStartTime = 0;

  async initialize(): Promise<void> {
    if (this.stream) return;
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      throw new Error(`Microphone access denied: ${msg}`);
    }
  }

  startRecording(currentTime: number): void {
    if (!this.stream) throw new Error('Recorder not initialized');
    this.chunks = [];
    this.recordingStartTime = currentTime;

    const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
      ? 'audio/webm;codecs=opus'
      : MediaRecorder.isTypeSupported('audio/webm')
      ? 'audio/webm'
      : '';

    this.recorder = mimeType
      ? new MediaRecorder(this.stream, { mimeType })
      : new MediaRecorder(this.stream);

    this.recorder.ondataavailable = e => {
      if (e.data.size > 0) this.chunks.push(e.data);
    };
    this.recorder.start(100);
  }

  stopRecording(): Promise<{ blob: Blob; startTime: number }> {
    return new Promise(resolve => {
      if (!this.recorder || this.recorder.state === 'inactive') {
        const blob = this.chunks.length > 0
          ? new Blob(this.chunks, { type: 'audio/webm' })
          : new Blob();
        this.chunks = [];
        resolve({ blob, startTime: this.recordingStartTime });
        return;
      }
      const mimeType = this.recorder.mimeType || 'audio/webm';
      this.recorder.onstop = () => {
        const blob = new Blob(this.chunks, { type: mimeType });
        this.chunks = [];
        resolve({ blob, startTime: this.recordingStartTime });
      };
      this.recorder.stop();
    });
  }

  cancelRecording(): void {
    if (this.recorder && this.recorder.state !== 'inactive') {
      this.recorder.onstop = null;
      this.recorder.ondataavailable = null;
      try { this.recorder.stop(); } catch { /* ignore */ }
    }
    this.chunks = [];
    this.recorder = null;
  }

  isRecording(): boolean {
    return this.recorder?.state === 'recording';
  }

  getStartTime(): number {
    return this.recordingStartTime;
  }

  dispose() {
    this.stream?.getTracks().forEach(t => t.stop());
    this.stream = null;
    this.recorder = null;
  }
}

export const audioRecorder = new AudioRecorder();
