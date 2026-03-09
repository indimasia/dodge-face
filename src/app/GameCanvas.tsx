"use client";

import { useEffect, useRef, useCallback } from "react";
import { Obstacle, PlayerState, Expression, GameConfig } from "./types";

interface GameCanvasProps {
  width: number;
  height: number;
  player1: PlayerState;
  player2: PlayerState;
  expression1: Expression;
  expression2: Expression;
  obstacles: Obstacle[];
  timeLeft: number;
  config: GameConfig;
  activeMode: "dodge" | "collect";
}

function drawObstacle(ctx: CanvasRenderingContext2D, obs: Obstacle) {
  ctx.fillStyle = obs.color;
  ctx.strokeStyle = "rgba(255,255,255,0.6)";
  ctx.lineWidth = 2;

  switch (obs.shape) {
    case "rectangle":
      ctx.fillRect(obs.x, obs.y, obs.width, obs.height);
      ctx.strokeRect(obs.x, obs.y, obs.width, obs.height);
      break;

    case "circle":
      ctx.beginPath();
      ctx.ellipse(
        obs.x + obs.width / 2,
        obs.y + obs.height / 2,
        obs.width / 2,
        obs.height / 2,
        0,
        0,
        Math.PI * 2
      );
      ctx.fill();
      ctx.stroke();
      break;

    case "triangle":
      ctx.beginPath();
      ctx.moveTo(obs.x + obs.width / 2, obs.y);
      ctx.lineTo(obs.x + obs.width, obs.y + obs.height);
      ctx.lineTo(obs.x, obs.y + obs.height);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      break;

    case "diamond":
      ctx.beginPath();
      ctx.moveTo(obs.x + obs.width / 2, obs.y);
      ctx.lineTo(obs.x + obs.width, obs.y + obs.height / 2);
      ctx.lineTo(obs.x + obs.width / 2, obs.y + obs.height);
      ctx.lineTo(obs.x, obs.y + obs.height / 2);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      break;
  }
}

function drawPlayer(
  ctx: CanvasRenderingContext2D,
  player: PlayerState,
  expression: Expression,
  x: number
) {
  const charSize = 50;
  const isInvincible = player.invincibleUntil > Date.now();

  if (isInvincible && Math.floor(Date.now() / 100) % 2 === 0) {
    ctx.globalAlpha = 0.4;
  }

  ctx.shadowColor = player.character.color;
  ctx.shadowBlur = 25;
  ctx.font = `${charSize}px serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(player.character.emoji, x, player.y);
  ctx.shadowBlur = 0;
  ctx.globalAlpha = 1;

  // Expression arrow
  if (expression === "happy") {
    ctx.fillStyle = "#00ff88";
    ctx.shadowColor = "#00ff88";
    ctx.shadowBlur = 10;
    ctx.font = "24px sans-serif";
    ctx.fillText("\u25B2", x, player.y - charSize / 2 - 15);
  } else if (expression === "sad") {
    ctx.fillStyle = "#ff4444";
    ctx.shadowColor = "#ff4444";
    ctx.shadowBlur = 10;
    ctx.font = "24px sans-serif";
    ctx.fillText("\u25BC", x, player.y + charSize / 2 + 15);
  }
  ctx.shadowBlur = 0;
}

function drawHUD(
  ctx: CanvasRenderingContext2D,
  player: PlayerState,
  expression: Expression,
  config: GameConfig,
  timeLeft: number,
  xStart: number,
  halfWidth: number,
  playerIndex: number,
  activeMode: "dodge" | "collect"
) {
  // HUD background
  ctx.fillStyle = "rgba(0,0,0,0.5)";
  ctx.fillRect(xStart, 0, halfWidth, 85);

  const pad = xStart + 12;
  const right = xStart + halfWidth - 12;

  // Player label
  ctx.fillStyle = "#fff";
  ctx.font = "bold 18px monospace";
  ctx.textAlign = "left";
  ctx.fillText(`P${playerIndex + 1}`, pad, 25);

  // Hearts
  ctx.font = "18px serif";
  for (let i = 0; i < config.maxLives; i++) {
    ctx.fillStyle = i < player.lives ? "#ff4444" : "#555";
    ctx.fillText("\u2665", pad + i * 22, 50);
  }

  // Score
  ctx.fillStyle = "#fff";
  ctx.font = "bold 14px monospace";
  ctx.fillText(`Score: ${player.score}`, pad, 75);

  // Timer
  ctx.textAlign = "right";
  ctx.fillStyle = timeLeft <= 10 ? "#ff4444" : "#fff";
  ctx.font = "bold 20px monospace";
  ctx.fillText(`${timeLeft}s`, right, 25);

  // Expression label
  ctx.font = "14px monospace";
  if (expression === "happy") {
    ctx.fillStyle = "#00ff88";
    ctx.fillText("HAPPY \u2191", right, 50);
  } else if (expression === "sad") {
    ctx.fillStyle = "#ff4444";
    ctx.fillText("SAD \u2193", right, 50);
  } else {
    ctx.fillStyle = "#aaa";
    ctx.fillText("NEUTRAL \u2014", right, 50);
  }

  // Mode badge
  ctx.fillStyle = activeMode === "dodge" ? "#e74c3c" : "#2ecc71";
  ctx.font = "bold 12px monospace";
  ctx.fillText(activeMode === "dodge" ? "DODGE" : "COLLECT", right, 72);
}

export default function GameCanvas({
  width,
  height,
  player1,
  player2,
  expression1,
  expression2,
  obstacles,
  timeLeft,
  config,
  activeMode,
}: GameCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const halfWidth = Math.floor(width / 2);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.clearRect(0, 0, width, height);

    // Draw all obstacles (they span the full width)
    ctx.globalAlpha = 0.85;
    obstacles.forEach((obs) => drawObstacle(ctx, obs));
    ctx.globalAlpha = 1;

    // Draw P1 character (center of left half)
    drawPlayer(ctx, player1, expression1, halfWidth / 2);

    // Draw P2 character (center of right half)
    drawPlayer(ctx, player2, expression2, halfWidth + halfWidth / 2);

    // Bold divider line between players
    const gradient = ctx.createLinearGradient(0, 0, 0, height);
    gradient.addColorStop(0, "rgba(168, 85, 247, 0.9)");
    gradient.addColorStop(0.5, "rgba(236, 72, 153, 0.9)");
    gradient.addColorStop(1, "rgba(168, 85, 247, 0.9)");
    ctx.strokeStyle = gradient;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(halfWidth, 0);
    ctx.lineTo(halfWidth, height);
    ctx.stroke();

    // Glow effect on divider
    ctx.shadowColor = "rgba(168, 85, 247, 0.6)";
    ctx.shadowBlur = 15;
    ctx.strokeStyle = "rgba(255, 255, 255, 0.3)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(halfWidth, 0);
    ctx.lineTo(halfWidth, height);
    ctx.stroke();
    ctx.shadowBlur = 0;

    // HUD for each player
    drawHUD(ctx, player1, expression1, config, timeLeft, 0, halfWidth, 0, activeMode);
    drawHUD(ctx, player2, expression2, config, timeLeft, halfWidth, halfWidth, 1, activeMode);

    // HUD divider segment (bold on top of HUD)
    ctx.strokeStyle = gradient;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(halfWidth, 0);
    ctx.lineTo(halfWidth, 85);
    ctx.stroke();
  }, [width, height, halfWidth, player1, player2, expression1, expression2, obstacles, timeLeft, config, activeMode]);

  useEffect(() => {
    draw();
  }, [draw]);

  return (
    <canvas
      ref={canvasRef}
      width={width}
      height={height}
      className="block"
    />
  );
}
