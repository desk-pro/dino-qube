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
  type: 'CACTUS_SMALL' | 'CACTUS_LARGE' | 'BIRD';
}

export interface Cloud {
  id: number;
  x: number;
  y: number;
  speed: number;
  scale: number;
}

export interface GameState {
  status: GameStatus;
  score: number;
  highScore: number;
  speed: number;
}