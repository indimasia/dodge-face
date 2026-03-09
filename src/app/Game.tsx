"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import {
  GameConfig,
  DEFAULT_CONFIG,
  Character,
  CHARACTERS,
  Obstacle,
  PlayerState,
  Expression,
  GameMode,
} from "./types";
import { useFaceDetection } from "./useFaceDetection";
import GameCanvas from "./GameCanvas";

type GamePhase = "setup" | "playing" | "gameover";

const CHAR_SIZE = 50;
const MOVE_SPEED = 4;
const HUD_HEIGHT = 85;
const OBSTACLE_COLORS = [
  "#e74c3c",
  "#e67e22",
  "#f1c40f",
  "#2ecc71",
  "#3498db",
  "#9b59b6",
  "#1abc9c",
];
const SHAPES: Obstacle["shape"][] = ["rectangle", "triangle", "circle", "diamond"];

// difficulty is 0..1 based on elapsed time ratio
function createObstacle(fullWidth: number, fullHeight: number, difficulty: number): Obstacle {
  const fromRight = Math.random() > 0.5;
  const h = 30 + Math.random() * 50;
  const w = 40 + Math.random() * 80;
  // Speed scales from 2-5 at start to 5-10 at max difficulty
  const baseSpeed = 2 + difficulty * 3;
  const speedRange = 3 + difficulty * 4;
  return {
    x: fromRight ? fullWidth : -w,
    y: 100 + Math.random() * (fullHeight - 140 - h),
    width: w,
    height: h,
    speed: baseSpeed + Math.random() * speedRange,
    fromRight,
    shape: SHAPES[Math.floor(Math.random() * SHAPES.length)],
    color: OBSTACLE_COLORS[Math.floor(Math.random() * OBSTACLE_COLORS.length)],
  };
}

// Check collision: playerX is the center-x of the player in full-screen coords
function checkCollision(
  playerX: number,
  playerY: number,
  obs: Obstacle
): boolean {
  const px = playerX - CHAR_SIZE / 2;
  const py = playerY - CHAR_SIZE / 2;
  return (
    px < obs.x + obs.width &&
    px + CHAR_SIZE > obs.x &&
    py < obs.y + obs.height &&
    py + CHAR_SIZE > obs.y
  );
}

export default function Game() {
  const [phase, setPhase] = useState<GamePhase>("setup");
  const [config, setConfig] = useState<GameConfig>(DEFAULT_CONFIG);
  const [p1Char, setP1Char] = useState<Character>(CHARACTERS[0]);
  const [p2Char, setP2Char] = useState<Character>(CHARACTERS[1]);
  const [timeLeft, setTimeLeft] = useState(config.gameDuration);

  const { player1Expression, player2Expression, videoRef, isLoading, error } =
    useFaceDetection();

  const p1Ref = useRef<PlayerState | null>(null);
  const p2Ref = useRef<PlayerState | null>(null);
  const obsRef = useRef<Obstacle[]>([]);
  const expr1Ref = useRef<Expression>("neutral");
  const expr2Ref = useRef<Expression>("neutral");
  const phaseRef = useRef<GamePhase>("setup");
  // The resolved mode for the current round ("dodge" or "collect", never "random")
  const [activeMode, setActiveMode] = useState<"dodge" | "collect">("dodge");
  const activeModeRef = useRef<"dodge" | "collect">("dodge");

  const [renderTick, setRenderTick] = useState(0);

  const [winSize, setWinSize] = useState({ w: 960, h: 600 });
  useEffect(() => {
    function onResize() {
      setWinSize({ w: window.innerWidth, h: window.innerHeight });
    }
    onResize();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  const fullWidth = winSize.w;
  const fullHeight = winSize.h;
  const halfWidth = Math.floor(fullWidth / 2);

  useEffect(() => {
    expr1Ref.current = player1Expression;
  }, [player1Expression]);
  useEffect(() => {
    expr2Ref.current = player2Expression;
  }, [player2Expression]);
  useEffect(() => {
    phaseRef.current = phase;
  }, [phase]);

  const startGame = useCallback(() => {
    const resolved: "dodge" | "collect" =
      config.gameMode === "random"
        ? Math.random() > 0.5
          ? "dodge"
          : "collect"
        : config.gameMode === "collect"
        ? "collect"
        : "dodge";
    setActiveMode(resolved);
    activeModeRef.current = resolved;

    const mkPlayer = (char: Character): PlayerState => ({
      y: fullHeight / 2,
      targetY: fullHeight / 2,
      lives: config.maxLives,
      score: 0,
      expression: "neutral",
      character: char,
      invincibleUntil: 0,
    });

    p1Ref.current = mkPlayer(p1Char);
    p2Ref.current = mkPlayer(p2Char);
    obsRef.current = [];
    setTimeLeft(config.gameDuration);
    setPhase("playing");
  }, [config, p1Char, p2Char, fullHeight]);

  // Game timer
  useEffect(() => {
    if (phase !== "playing") return;
    const interval = setInterval(() => {
      setTimeLeft((t) => {
        if (t <= 1) {
          setPhase("gameover");
          return 0;
        }
        return t - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [phase]);

  // Main game loop
  useEffect(() => {
    if (phase !== "playing") return;

    let running = true;
    let lastSpawn = 0;
    let scoreTick = 0;
    const startTime = Date.now();
    const gameDurationMs = config.gameDuration * 1000;

    // Player X positions in full-screen coords
    const p1X = halfWidth / 2; // center of left half
    const p2X = halfWidth + halfWidth / 2; // center of right half

    function loop(timestamp: number) {
      if (!running || !p1Ref.current || !p2Ref.current) return;
      if (phaseRef.current !== "playing") return;

      // Difficulty ramps from 0 to 1 over the game duration
      const elapsed = Date.now() - startTime;
      const difficulty = Math.min(1, elapsed / gameDurationMs);

      // Spawn interval: 800ms at start -> 250ms at max difficulty
      const spawnInterval = 800 - difficulty * 550;
      // Number of obstacles per spawn: 1 at start, up to 3 at max difficulty
      const spawnCount = 1 + Math.floor(difficulty * 2);

      if (timestamp - lastSpawn > spawnInterval) {
        lastSpawn = timestamp;
        const newObs: Obstacle[] = [];
        for (let i = 0; i < spawnCount; i++) {
          newObs.push(createObstacle(fullWidth, fullHeight, difficulty));
        }
        obsRef.current = [...obsRef.current, ...newObs];
      }

      // Score tick
      if (timestamp - scoreTick > 500) {
        scoreTick = timestamp;
        if (p1Ref.current.lives > 0) p1Ref.current.score++;
        if (p2Ref.current.lives > 0) p2Ref.current.score++;
      }

      // Move obstacles
      const movedObs = obsRef.current.map((obs) => ({
        ...obs,
        x: obs.x + (obs.fromRight ? -obs.speed : obs.speed),
      }));

      // Update P1
      const e1 = expr1Ref.current;
      let p1 = p1Ref.current;
      let t1 = p1.targetY;
      if (e1 === "happy") t1 = Math.max(HUD_HEIGHT + CHAR_SIZE / 2, t1 - MOVE_SPEED);
      else if (e1 === "sad") t1 = Math.min(fullHeight - CHAR_SIZE, t1 + MOVE_SPEED);
      const y1 = p1.y + (t1 - p1.y) * 0.15;

      // Update P2
      const e2 = expr2Ref.current;
      let p2 = p2Ref.current;
      let t2 = p2.targetY;
      if (e2 === "happy") t2 = Math.max(HUD_HEIGHT + CHAR_SIZE / 2, t2 - MOVE_SPEED);
      else if (e2 === "sad") t2 = Math.min(fullHeight - CHAR_SIZE, t2 + MOVE_SPEED);
      const y2 = p2.y + (t2 - p2.y) * 0.15;

      // Collision detection
      let lives1 = p1.lives;
      let inv1 = p1.invincibleUntil;
      let score1 = p1.score;
      let lives2 = p2.lives;
      let inv2 = p2.invincibleUntil;
      let score2 = p2.score;
      const now = Date.now();
      const hitSet = new Set<number>();
      const mode = activeModeRef.current;

      movedObs.forEach((obs, i) => {
        if (mode === "dodge") {
          // Dodge mode: collisions lose lives
          if (now > inv1 && lives1 > 0 && checkCollision(p1X, y1, obs)) {
            lives1--;
            inv1 = now + 1500;
            hitSet.add(i);
          }
          if (now > inv2 && lives2 > 0 && checkCollision(p2X, y2, obs)) {
            lives2--;
            inv2 = now + 1500;
            hitSet.add(i);
          }
        } else {
          // Collect mode: collisions gain points
          if (lives1 > 0 && checkCollision(p1X, y1, obs)) {
            score1 += 3;
            hitSet.add(i);
          }
          if (lives2 > 0 && checkCollision(p2X, y2, obs)) {
            score2 += 3;
            hitSet.add(i);
          }
        }
      });

      // Remove hit and off-screen obstacles
      obsRef.current = movedObs.filter((obs, i) => {
        if (hitSet.has(i)) return false;
        if (obs.fromRight && obs.x + obs.width < -10) return false;
        if (!obs.fromRight && obs.x > fullWidth + 10) return false;
        return true;
      });

      p1Ref.current = {
        ...p1,
        y: y1,
        targetY: t1,
        lives: Math.max(0, lives1),
        score: mode === "collect" ? score1 : p1.score,
        expression: e1,
        invincibleUntil: inv1,
      };

      p2Ref.current = {
        ...p2,
        y: y2,
        targetY: t2,
        lives: Math.max(0, lives2),
        score: mode === "collect" ? score2 : p2.score,
        expression: e2,
        invincibleUntil: inv2,
      };

      // In dodge mode, losing all lives ends the game
      // In collect mode, only the timer ends the game
      if (mode === "dodge" && (lives1 <= 0 || lives2 <= 0)) {
        setPhase("gameover");
        setRenderTick((t) => t + 1);
        return;
      }

      setRenderTick((t) => t + 1);

      if (running) {
        requestAnimationFrame(loop);
      }
    }

    requestAnimationFrame(loop);
    return () => {
      running = false;
    };
  }, [phase, fullWidth, fullHeight, halfWidth, config.gameDuration]);

  // Fullscreen camera background
  const cameraBackground = (
    <video
      ref={videoRef}
      className="fixed inset-0 w-full h-full object-cover transform scale-x-[-1]"
      style={{ zIndex: 0 }}
      muted
      playsInline
    />
  );

  if (phase === "setup") {
    return (
      <div className="fixed inset-0 overflow-hidden">
        {cameraBackground}
        <div className="fixed inset-0 bg-black/60" style={{ zIndex: 1 }} />

        <div
          className="fixed inset-0 flex flex-col items-center justify-center p-4 text-white"
          style={{ zIndex: 2 }}
        >
          <h1 className="text-5xl font-bold mb-2 bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
            Dodge Face
          </h1>
          <p className="text-gray-300 mb-6 text-center max-w-md">
            Use your facial expressions to dodge obstacles!
            <br />
            Smile to go UP, look sad to go DOWN.
          </p>

          {/* Expression preview */}
          <div className="mb-6 flex gap-6 text-lg">
            <span className="bg-black/50 rounded-lg px-4 py-2">
              P1:{" "}
              {player1Expression === "happy"
                ? "😊 Happy"
                : player1Expression === "sad"
                ? "😢 Sad"
                : "😐 Neutral"}
            </span>
            <span className="bg-black/50 rounded-lg px-4 py-2">
              P2:{" "}
              {player2Expression === "happy"
                ? "😊 Happy"
                : player2Expression === "sad"
                ? "😢 Sad"
                : "😐 Neutral"}
            </span>
          </div>

          {isLoading && (
            <div className="mb-4 flex items-center gap-2">
              <div className="animate-spin w-5 h-5 border-2 border-purple-500 border-t-transparent rounded-full" />
              <p className="text-sm text-gray-400">Loading face detection...</p>
            </div>
          )}
          {error && <p className="text-red-400 text-sm mb-4">{error}</p>}

          {/* Configuration */}
          <div className="flex gap-8 mb-6">
            <div className="flex flex-col items-center gap-2">
              <label className="text-sm text-gray-300">Lives</label>
              <input
                type="number"
                min={1}
                max={10}
                value={config.maxLives}
                onChange={(e) =>
                  setConfig({
                    ...config,
                    maxLives: Math.max(1, parseInt(e.target.value) || 3),
                  })
                }
                className="w-20 bg-black/50 border border-white/20 rounded px-3 py-2 text-center backdrop-blur"
              />
            </div>
            <div className="flex flex-col items-center gap-2">
              <label className="text-sm text-gray-300">Duration (sec)</label>
              <input
                type="number"
                min={10}
                max={300}
                value={config.gameDuration}
                onChange={(e) =>
                  setConfig({
                    ...config,
                    gameDuration: Math.max(10, parseInt(e.target.value) || 60),
                  })
                }
                className="w-20 bg-black/50 border border-white/20 rounded px-3 py-2 text-center backdrop-blur"
              />
            </div>
          </div>

          {/* Game mode selection */}
          <div className="flex gap-3 mb-6">
            {(
              [
                { mode: "dodge" as GameMode, label: "Dodge", desc: "Avoid obstacles" },
                { mode: "collect" as GameMode, label: "Collect", desc: "Hit obstacles for points" },
                { mode: "random" as GameMode, label: "Random", desc: "Surprise!" },
              ] as const
            ).map(({ mode, label, desc }) => (
              <button
                key={mode}
                onClick={() => setConfig({ ...config, gameMode: mode })}
                className={`px-4 py-3 rounded-lg text-sm font-semibold transition-all ${
                  config.gameMode === mode
                    ? "bg-purple-600 ring-2 ring-purple-400 text-white"
                    : "bg-black/40 text-gray-300 hover:bg-black/60 backdrop-blur"
                }`}
              >
                <div>{label}</div>
                <div className="text-xs font-normal opacity-70">{desc}</div>
              </button>
            ))}
          </div>

          {/* Character selection */}
          <div className="flex gap-12 mb-6">
            {[
              { label: "Player 1", selected: p1Char, setSelected: setP1Char },
              { label: "Player 2", selected: p2Char, setSelected: setP2Char },
            ].map(({ label, selected, setSelected }) => (
              <div key={label} className="flex flex-col items-center">
                <h3 className="text-lg font-semibold mb-3">{label}</h3>
                <div className="grid grid-cols-4 gap-2">
                  {CHARACTERS.map((char) => (
                    <button
                      key={char.id}
                      onClick={() => setSelected(char)}
                      className={`w-14 h-14 rounded-lg text-2xl flex items-center justify-center transition-all ${
                        selected.id === char.id
                          ? "bg-purple-600 ring-2 ring-purple-400 scale-110"
                          : "bg-black/40 hover:bg-black/60 backdrop-blur"
                      }`}
                    >
                      {char.emoji}
                    </button>
                  ))}
                </div>
                <p className="mt-2 text-sm text-gray-300">{selected.name}</p>
              </div>
            ))}
          </div>

          <button
            onClick={startGame}
            disabled={isLoading || !!error}
            className="px-10 py-4 bg-gradient-to-r from-purple-600 to-pink-600 rounded-xl text-xl font-bold
              hover:from-purple-500 hover:to-pink-500 transition-all disabled:opacity-50 disabled:cursor-not-allowed
              shadow-lg shadow-purple-500/30"
          >
            Start Game
          </button>
        </div>
      </div>
    );
  }

  if (phase === "gameover") {
    const p1 = p1Ref.current!;
    const p2 = p2Ref.current!;
    const winner =
      p1.lives > p2.lives
        ? "Player 1"
        : p2.lives > p1.lives
        ? "Player 2"
        : p1.score > p2.score
        ? "Player 1"
        : p2.score > p1.score
        ? "Player 2"
        : null;

    return (
      <div className="fixed inset-0 overflow-hidden">
        {cameraBackground}
        <div className="fixed inset-0 bg-black/70" style={{ zIndex: 1 }} />

        <div
          className="fixed inset-0 flex flex-col items-center justify-center p-4 text-white"
          style={{ zIndex: 2 }}
        >
          <h1 className="text-5xl font-bold mb-2">Game Over!</h1>
          <p className="text-lg mb-6" style={{ color: activeMode === "dodge" ? "#e74c3c" : "#2ecc71" }}>
            Mode: {activeMode === "dodge" ? "Dodge" : "Collect"}
          </p>

          <div className="flex gap-12 mb-8">
            {[
              { label: "Player 1", state: p1 },
              { label: "Player 2", state: p2 },
            ].map(({ label, state }) => (
              <div
                key={label}
                className={`bg-black/50 backdrop-blur rounded-xl p-6 text-center border-2 ${
                  winner === label ? "border-yellow-500" : "border-white/20"
                }`}
              >
                <p className="text-5xl mb-2">{state.character.emoji}</p>
                <h3 className="text-xl font-bold mb-2">{label}</h3>
                <p className="text-3xl font-bold text-purple-400 mb-1">
                  {state.score}
                </p>
                <p className="text-sm text-gray-300">points</p>
                <p className="text-sm text-gray-300 mt-2">
                  {state.lives} {state.lives === 1 ? "life" : "lives"} remaining
                </p>
                {winner === label && (
                  <p className="mt-3 text-yellow-400 font-bold text-lg">Winner!</p>
                )}
              </div>
            ))}
          </div>

          {!winner && (
            <p className="text-2xl text-yellow-400 font-bold mb-6">
              It&apos;s a tie!
            </p>
          )}

          <button
            onClick={() => setPhase("setup")}
            className="px-8 py-3 bg-gradient-to-r from-purple-600 to-pink-600 rounded-xl text-lg font-bold
              hover:from-purple-500 hover:to-pink-500 transition-all shadow-lg shadow-purple-500/30"
          >
            Play Again
          </button>
        </div>
      </div>
    );
  }

  // Playing phase
  const p1Display = p1Ref.current!;
  const p2Display = p2Ref.current!;
  void renderTick;

  return (
    <div className="fixed inset-0 overflow-hidden">
      {cameraBackground}
      <div className="fixed inset-0 bg-black/30" style={{ zIndex: 1 }} />

      {/* Single full-width game canvas */}
      <div className="fixed inset-0" style={{ zIndex: 2 }}>
        <GameCanvas
          width={fullWidth}
          height={fullHeight}
          player1={p1Display}
          player2={p2Display}
          expression1={player1Expression}
          expression2={player2Expression}
          obstacles={obsRef.current}
          timeLeft={timeLeft}
          config={config}
          activeMode={activeMode}
        />
      </div>
    </div>
  );
}
