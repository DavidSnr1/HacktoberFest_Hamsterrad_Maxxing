"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/** Low bitrate keeps a 5-minute answer around 1.5 MB (upload limit 4 MB). */
const RECORDING_BITS_PER_SECOND = 32_000;
const PREFERRED_MIME_TYPES = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg;codecs=opus"];
/** Empty WAV, played once inside the click to unlock audio on iOS Safari. */
const SILENT_WAV = "data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAAAAA=";

type Engine = {
  context: AudioContext;
  player: HTMLAudioElement;
  outputAnalyser: AnalyserNode;
  micStream: MediaStream;
  inputAnalyser: AnalyserNode;
};

function rms(analyser: AnalyserNode, buffer: Uint8Array<ArrayBuffer>) {
  analyser.getByteTimeDomainData(buffer);
  let sum = 0;
  for (const value of buffer) {
    const v = (value - 128) / 128;
    sum += v * v;
  }
  // Scale so normal speech fills most of the 0..1 range.
  return Math.min(1, Math.sqrt(sum / buffer.length) * 4);
}

function pickMimeType() {
  if (typeof MediaRecorder === "undefined") return undefined;
  return PREFERRED_MIME_TYPES.find((type) => MediaRecorder.isTypeSupported(type));
}

/**
 * Audio for the one-way interview: plays the interviewer's lines, keeps the
 * microphone open for level metering and records one answer at a time.
 * `start` must be called from a click so browsers allow audio playback.
 */
export function useInterviewAudio() {
  const engineRef = useRef<Engine | null>(null);
  const primedRef = useRef<{ context: AudioContext; player: HTMLAudioElement } | null>(null);
  const bufferRef = useRef<Uint8Array<ArrayBuffer>>(new Uint8Array(1024));
  const recorderRef = useRef<MediaRecorder | null>(null);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isRecording, setIsRecording] = useState(false);

  /**
   * Must run synchronously inside the click handler, before any await:
   * browsers (especially iOS) only allow audio started by a user gesture.
   */
  const prime = useCallback(() => {
    if (primedRef.current || engineRef.current) return;
    const context = new AudioContext();
    const player = new Audio();
    player.preload = "auto";
    player.src = SILENT_WAV;
    player.play().catch(() => {});
    void context.resume();
    primedRef.current = { context, player };
  }, []);

  /** Builds the audio graph with the opened microphone. Call `prime` first. */
  const start = useCallback(async (micStream: MediaStream) => {
    if (engineRef.current) return;
    const primed = primedRef.current ?? { context: new AudioContext(), player: new Audio() };
    primedRef.current = null;
    const { context, player } = primed;

    const outputAnalyser = context.createAnalyser();
    outputAnalyser.fftSize = 1024;
    context.createMediaElementSource(player).connect(outputAnalyser);
    outputAnalyser.connect(context.destination);

    // Mic is analysed only, never routed to the speakers (no echo).
    const inputAnalyser = context.createAnalyser();
    inputAnalyser.fftSize = 1024;
    context.createMediaStreamSource(micStream).connect(inputAnalyser);

    engineRef.current = { context, player, outputAnalyser, micStream, inputAnalyser };
    await context.resume();
  }, []);

  /** Plays an audio URL and resolves when it has finished (or failed). */
  const play = useCallback(async (url: string) => {
    const engine = engineRef.current;
    if (!engine) return;
    await engine.context.resume();
    engine.player.src = url;
    setIsSpeaking(true);
    try {
      await new Promise<void>((resolve, reject) => {
        engine.player.onended = () => resolve();
        engine.player.onerror = () => reject(new Error("playback failed"));
        engine.player.play().catch(reject);
      });
    } finally {
      setIsSpeaking(false);
    }
  }, []);

  const stopPlayback = useCallback(() => {
    const engine = engineRef.current;
    if (!engine) return;
    engine.player.pause();
    engine.player.dispatchEvent(new Event("ended"));
  }, []);

  const startRecording = useCallback(() => {
    const engine = engineRef.current;
    if (!engine || recorderRef.current) return;
    const mimeType = pickMimeType();
    const recorder = new MediaRecorder(engine.micStream, {
      mimeType,
      audioBitsPerSecond: RECORDING_BITS_PER_SECOND,
    });
    recorder.start();
    recorderRef.current = recorder;
    setIsRecording(true);
  }, []);

  /** Stops the current recording and returns it, or null if nothing was recorded. */
  const stopRecording = useCallback(async (): Promise<Blob | null> => {
    const recorder = recorderRef.current;
    recorderRef.current = null;
    setIsRecording(false);
    if (!recorder || recorder.state === "inactive") return null;

    const chunks: Blob[] = [];
    recorder.ondataavailable = (event) => {
      if (event.data.size > 0) chunks.push(event.data);
    };
    await new Promise<void>((resolve) => {
      recorder.onstop = () => resolve();
      recorder.stop();
    });
    const blob = new Blob(chunks, { type: recorder.mimeType || "audio/webm" });
    return blob.size > 0 ? blob : null;
  }, []);

  const getOutputVolume = useCallback(() => {
    const engine = engineRef.current;
    return engine ? rms(engine.outputAnalyser, bufferRef.current) : 0;
  }, []);

  const getInputVolume = useCallback(() => {
    const engine = engineRef.current;
    return engine ? rms(engine.inputAnalyser, bufferRef.current) : 0;
  }, []);

  /** Releases microphone and audio graph. */
  const stop = useCallback(() => {
    const engine = engineRef.current;
    engineRef.current = null;
    if (recorderRef.current?.state === "recording") recorderRef.current.stop();
    recorderRef.current = null;
    if (!engine) return;
    engine.player.pause();
    engine.micStream.getTracks().forEach((track) => track.stop());
    void engine.context.close();
  }, []);

  useEffect(() => stop, [stop]);

  return {
    prime,
    start,
    play,
    stopPlayback,
    startRecording,
    stopRecording,
    getOutputVolume,
    getInputVolume,
    stop,
    isSpeaking,
    isRecording,
  };
}
