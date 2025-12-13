export enum GameStatus {
  START = 'START',
  PLAYING = 'PLAYING',
  GAME_OVER = 'GAME_OVER'
}

export interface GameObject {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface Obstacle extends GameObject {
  id: number;
  type: 'CACTUS_SMALL' | 'CACTUS_LARGE' | 'BIRD' | 'ROCK';
}

export interface Cloud {
  id: number;
  x: number;
  y: number;
  speed: number;
  scale: number;
}

export interface Star {
  id: number;
  x: number;
  y: number;
  opacity: number;
  size: number;
}

export interface Particle {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number; // 0 to 1
  decay: number;
  size: number;
  color: string;
}

export interface GameState {
  status: GameStatus;
  score: number;
  highScore: number;
  speed: number;
}