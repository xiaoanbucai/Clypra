/**
 * AudioClock - Master timing source for timeline playback
 *
 * Uses AudioContext as the authoritative clock to prevent sync drift
 * between multiple video elements. This is the same pattern used by
 * professional web-based editors like OpenCut.
 */

export class AudioClock {
  private audioContext: AudioContext;
  private playStartAudioTime: number = 0;
  private playStartTimelineTime: number = 0;
  private _isPlaying: boolean = false;

  constructor() {
    // Create AudioContext (will be suspended until first user interaction)
    this.audioContext = new AudioContext();
  }

  /**
   * Start playback from the given timeline time
   */
  play(currentTimelineTime: number) {
    // Resume AudioContext if suspended (required by browser autoplay policies)
    if (this.audioContext.state === "suspended") {
      this.audioContext.resume();
    }

    this.playStartAudioTime = this.audioContext.currentTime;
    this.playStartTimelineTime = currentTimelineTime;
    this._isPlaying = true;
  }

  /**
   * Pause playback and return the current timeline time
   */
  pause(): number {
    const currentTime = this.getCurrentTime();
    this._isPlaying = false;
    return currentTime;
  }

  /**
   * Get the current timeline time
   *
   * When playing: calculates elapsed time from AudioContext
   * When paused: returns the paused time
   */
  getCurrentTime(): number {
    if (!this._isPlaying) {
      return this.playStartTimelineTime;
    }
    const elapsed = this.audioContext.currentTime - this.playStartAudioTime;
    return this.playStartTimelineTime + elapsed;
  }

  /**
   * Seek to a specific timeline time
   */
  seek(time: number) {
    this.playStartTimelineTime = time;
    if (this._isPlaying) {
      // Reset audio clock reference if playing
      this.playStartAudioTime = this.audioContext.currentTime;
    }
  }

  /**
   * Check if currently playing
   */
  get isPlaying(): boolean {
    return this._isPlaying;
  }

  /**
   * Get the underlying AudioContext (for audio playback)
   */
  getAudioContext(): AudioContext {
    return this.audioContext;
  }

  /**
   * Clean up resources
   */
  dispose() {
    if (this.audioContext.state !== "closed") {
      this.audioContext.close();
    }
  }
}
