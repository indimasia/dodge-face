"use client";

import { useEffect, useRef, useCallback, useState } from "react";
import * as faceapi from "face-api.js";
import { Expression } from "./types";

interface FaceDetectionResult {
  player1Expression: Expression;
  player2Expression: Expression;
  videoRef: (el: HTMLVideoElement | null) => void;
  isLoading: boolean;
  isReady: boolean;
  error: string | null;
}

export function useFaceDetection(): FaceDetectionResult {
  const videoElRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isReady, setIsReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const expressionsRef = useRef<{
    player1: Expression;
    player2: Expression;
  }>({ player1: "neutral", player2: "neutral" });
  const [expressions, setExpressions] = useState<{
    player1: Expression;
    player2: Expression;
  }>({ player1: "neutral", player2: "neutral" });
  const animFrameRef = useRef<number>(0);
  const modelsLoadedRef = useRef(false);

  // Callback ref: whenever a <video> element mounts, attach the stream
  const videoRef = useCallback((el: HTMLVideoElement | null) => {
    videoElRef.current = el;
    if (el && streamRef.current) {
      el.srcObject = streamRef.current;
      el.play().catch(() => {});
    }
  }, []);

  const mapExpression = useCallback(
    (faceExpressions: faceapi.FaceExpressions): Expression => {
      const happy = faceExpressions.happy;
      const sad =
        faceExpressions.sad +
        faceExpressions.angry +
        faceExpressions.fearful;

      if (happy > 0.4) return "happy";
      if (sad > 0.25) return "sad";
      return "neutral";
    },
    []
  );

  // Load models and start camera once
  useEffect(() => {
    let cancelled = false;

    async function init() {
      try {
        await faceapi.nets.tinyFaceDetector.loadFromUri("/models");
        await faceapi.nets.faceExpressionNet.loadFromUri("/models");
        modelsLoadedRef.current = true;

        const stream = await navigator.mediaDevices.getUserMedia({
          video: { width: 640, height: 480, facingMode: "user" },
        });

        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }

        streamRef.current = stream;

        if (videoElRef.current) {
          videoElRef.current.srcObject = stream;
          await videoElRef.current.play();
        }

        setIsLoading(false);
        setIsReady(true);
      } catch (err) {
        console.error("Face detection init error:", err);
        setError("Could not access camera. Please allow camera access.");
        setIsLoading(false);
      }
    }

    init();

    return () => {
      cancelled = true;
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      }
    };
  }, []);

  // Always-on face detection loop (runs as soon as models + camera are ready)
  useEffect(() => {
    if (!isReady || error) return;

    let running = true;
    let lastDetection = 0;
    const DETECTION_INTERVAL = 150;

    async function detect(timestamp: number) {
      if (!running) return;

      const video = videoElRef.current;
      if (!video || video.readyState < 2) {
        if (running) animFrameRef.current = requestAnimationFrame(detect);
        return;
      }

      if (timestamp - lastDetection >= DETECTION_INTERVAL) {
        lastDetection = timestamp;

        try {
          const detections = await faceapi
            .detectAllFaces(
              video,
              new faceapi.TinyFaceDetectorOptions({
                inputSize: 416,
                scoreThreshold: 0.2,
              })
            )
            .withFaceExpressions();

          if (detections.length >= 1) {
            // Use face X position to assign to correct player.
            // Camera is mirrored: rightmost in raw camera = left on screen (P1),
            // leftmost in raw camera = right on screen (P2).
            // Raw video midpoint determines which side a face is on.
            const videoMidX = video.videoWidth / 2;

            let newP1: Expression = expressionsRef.current.player1;
            let newP2: Expression = expressionsRef.current.player2;

            if (detections.length >= 2) {
              const sorted = [...detections].sort(
                (a, b) => a.detection.box.x - b.detection.box.x
              );
              newP1 = mapExpression(sorted[sorted.length - 1].expressions);
              newP2 = mapExpression(sorted[0].expressions);
            } else {
              // Single face: assign based on which side of the video it's on
              const face = detections[0];
              const faceCenterX =
                face.detection.box.x + face.detection.box.width / 2;

              if (faceCenterX >= videoMidX) {
                // Right side of raw video = left on screen = P1
                newP1 = mapExpression(face.expressions);
              } else {
                // Left side of raw video = right on screen = P2
                newP2 = mapExpression(face.expressions);
              }
            }

            if (
              newP1 !== expressionsRef.current.player1 ||
              newP2 !== expressionsRef.current.player2
            ) {
              expressionsRef.current = { player1: newP1, player2: newP2 };
              setExpressions({ player1: newP1, player2: newP2 });
            }
          }
        } catch {
          // Detection can fail on some frames
        }
      }

      if (running) {
        animFrameRef.current = requestAnimationFrame(detect);
      }
    }

    animFrameRef.current = requestAnimationFrame(detect);

    return () => {
      running = false;
      cancelAnimationFrame(animFrameRef.current);
    };
  }, [isReady, error, mapExpression]);

  return {
    player1Expression: expressions.player1,
    player2Expression: expressions.player2,
    videoRef,
    isLoading,
    isReady,
    error,
  };
}
