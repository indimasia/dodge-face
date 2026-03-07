export interface GameConfig {
  maxLives: number;
  gameDuration: number; // seconds
}

export const DEFAULT_CONFIG: GameConfig = {
  maxLives: 3,
  gameDuration: 60,
};

export interface Character {
  id: string;
  name: string;
  emoji: string;
  color: string;
}

export const CHARACTERS: Character[] = [
  { id: "cat", name: "Cat", emoji: "🐱", color: "#FFB347" },
  { id: "dog", name: "Dog", emoji: "🐶", color: "#87CEEB" },
  { id: "bear", name: "Bear", emoji: "🐻", color: "#DEB887" },
  { id: "fox", name: "Fox", emoji: "🦊", color: "#FF6347" },
  { id: "panda", name: "Panda", emoji: "🐼", color: "#E0E0E0" },
  { id: "rabbit", name: "Rabbit", emoji: "🐰", color: "#FFB6C1" },
  { id: "frog", name: "Frog", emoji: "🐸", color: "#90EE90" },
  { id: "alien", name: "Alien", emoji: "👽", color: "#B0E0E6" },
];

export type Expression = "happy" | "sad" | "neutral";

export interface Obstacle {
  x: number;
  y: number;
  width: number;
  height: number;
  speed: number;
  fromRight: boolean;
  shape: "rectangle" | "triangle" | "circle" | "diamond";
  color: string;
}

export interface PlayerState {
  y: number;
  targetY: number;
  lives: number;
  score: number;
  expression: Expression;
  character: Character;
  invincibleUntil: number;
}
