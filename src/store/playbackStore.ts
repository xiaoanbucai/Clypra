import { create } from "zustand";

interface PlaybackStore {
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  frameRate: number;
  playbackSpeed: number;
  audioContext: AudioContext | null;
  playStartAudioTime: number;
  playStartTimelineTime: number;
  rafId: number | null;
  play: () => void;
  pause: () => void;
  stop: () => void;
  seek: (time: number) => void;
  setDuration: (duration: number) => void;
  setFrameRate: (fps: number) => void;
  setPlaybackSpeed: (speed: number) => void;
}

export const usePlaybackStore = create<PlaybackStore>((set, get) => ({
  isPlaying: false,
  currentTime: 0,
  duration: 0,
  frameRate: 30,
  playbackSpeed: 1.0,
  audioContext: null,
  playStartAudioTime: 0,
  playStartTimelineTime: 0,
  rafId: null,

  play: () => {
    const state = get();
    if (state.isPlaying) return;

    // Initialize AudioContext if needed
    if (!state.audioContext) {
      set({ audioContext: new AudioContext() });
    }

    const audioContext = get().audioContext!;

    // Resume AudioContext if suspended (browser autoplay policy)
    if (audioContext.state === "suspended") {
      audioContext.resume();
    }

    // Record the start times
    const playStartAudioTime = audioContext.currentTime;
    const playStartTimelineTime = state.currentTime;

    set({
      isPlaying: true,
      playStartAudioTime,
      playStartTimelineTime,
    });

    // Use requestAnimationFrame for smooth updates
    const updateTime = () => {
      const current = get();
      if (!current.isPlaying) return;

      const audioContext = current.audioContext!;
      const elapsed = (audioContext.currentTime - current.playStartAudioTime) * current.playbackSpeed;
      const newTime = current.playStartTimelineTime + elapsed;

      if (newTime >= current.duration) {
        // Reached the end
        set({
          currentTime: current.duration,
          isPlaying: false,
          rafId: null,
        });
      } else {
        set({ currentTime: newTime });
        const rafId = requestAnimationFrame(updateTime);
        set({ rafId });
      }
    };

    const rafId = requestAnimationFrame(updateTime);
    set({ rafId });
  },

  pause: () => {
    const state = get();
    if (state.rafId) {
      cancelAnimationFrame(state.rafId);
    }
    set({ isPlaying: false, rafId: null });
  },

  stop: () => {
    const state = get();
    if (state.rafId) {
      cancelAnimationFrame(state.rafId);
    }
    set({ isPlaying: false, currentTime: 0, rafId: null });
  },

  seek: (time) => {
    const state = get();
    if (state.rafId) {
      cancelAnimationFrame(state.rafId);
    }
    const clamped = Math.max(0, Math.min(time, state.duration));
    set({
      currentTime: clamped,
      isPlaying: false,
      rafId: null,
      playStartTimelineTime: clamped,
    });
  },

  setDuration: (duration) => {
    set({ duration });
  },

  setFrameRate: (fps) => {
    set({ frameRate: Math.max(1, fps) });
  },

  setPlaybackSpeed: (speed) => {
    const state = get();
    const wasPlaying = state.isPlaying;

    // If playing, pause and restart to apply new speed
    if (wasPlaying) {
      state.pause();
    }

    set({ playbackSpeed: Math.max(0.1, Math.min(4, speed)) });

    if (wasPlaying) {
      // Small delay to ensure state is updated
      setTimeout(() => get().play(), 0);
    }
  },
}));
