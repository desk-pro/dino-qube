import React, { useRef, useEffect, useState, useCallback } from 'react';
import { GameStatus, Obstacle, Cloud } from '../types';
import {
  CANVAS_WIDTH,
  CANVAS_HEIGHT,
  GROUND_Y,
  GRAVITY,
  JUMP_FORCE,
  INITIAL_SPEED,
  SPEED_INCREMENT,
  MAX_SPEED,
  PLAYER_WIDTH,
  PLAYER_HEIGHT,
  PLAYER_START_X,
  OBSTACLE_SPAWN_MIN_GAP,
  OBSTACLE_SPAWN_MAX_GAP
} from '../constants';
import { Volume2, VolumeX, Share2, RefreshCw, Trophy, Play } from 'lucide-react';

interface GameCanvasProps {
  onGameOver: (score: number) => void;
  highScore: number;
}

const GameCanvas: React.FC<GameCanvasProps> = ({ onGameOver, highScore }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const requestRef = useRef<number>(0);
  const scoreRef = useRef<number>(0);
  
  // Game State Refs (for performance in loop)
  const statusRef = useRef<GameStatus>(GameStatus.START);
  const playerRef = useRef({
    x: PLAYER_START_X,
    y: GROUND_Y - PLAYER_HEIGHT,
    vy: 0,
    isJumping: false,
    frame: 0
  });
  const obstaclesRef = useRef<Obstacle[]>([]);
  const cloudsRef = useRef<Cloud[]>([]);
  const gameSpeedRef = useRef<number>(INITIAL_SPEED);
  const frameCountRef = useRef<number>(0);

  // React State for UI
  const [displayStatus, setDisplayStatus] = useState<GameStatus>(GameStatus.START);
  const [currentScore, setCurrentScore] = useState(0);
  const [isMuted, setIsMuted] = useState(false);

  // Sound Effects (simulated with AudioContext later if needed, but keeping simple for now)
  const playSound = (type: 'jump' | 'score' | 'hit') => {
    if (isMuted) return;
    // Simple Web Audio API beep implementation could go here
    // For now, we focus on visuals
  };

  const spawnObstacle = () => {
    const typeChance = Math.random();
    let type: Obstacle['type'] = 'CACTUS_SMALL';
    let width = 30;
    let height = 50;

    if (typeChance > 0.7) {
      type = 'CACTUS_LARGE';
      width = 40;
      height = 70;
    } 
    // Add Birds later for difficulty

    const obstacle: Obstacle = {
      id: Date.now() + Math.random(),
      x: CANVAS_WIDTH + Math.random() * 100,
      y: GROUND_Y - height,
      width,
      height,
      type
    };
    obstaclesRef.current.push(obstacle);
  };

  const spawnCloud = () => {
    const cloud: Cloud = {
      id: Date.now() + Math.random(),
      x: CANVAS_WIDTH,
      y: Math.random() * (CANVAS_HEIGHT / 2),
      speed: 0.5 + Math.random() * 1,
      scale: 0.5 + Math.random() * 0.8
    };
    cloudsRef.current.push(cloud);
  };

  const resetGame = () => {
    statusRef.current = GameStatus.PLAYING;
    setDisplayStatus(GameStatus.PLAYING);
    scoreRef.current = 0;
    setCurrentScore(0);
    gameSpeedRef.current = INITIAL_SPEED;
    obstaclesRef.current = [];
    cloudsRef.current = [];
    playerRef.current = {
      x: PLAYER_START_X,
      y: GROUND_Y - PLAYER_HEIGHT,
      vy: 0,
      isJumping: false,
      frame: 0
    };
    frameCountRef.current = 0;
  };

  const jump = useCallback(() => {
    if (statusRef.current !== GameStatus.PLAYING) {
      if (statusRef.current === GameStatus.START || statusRef.current === GameStatus.GAME_OVER) {
        resetGame();
      }
      return;
    }

    if (!playerRef.current.isJumping) {
      playerRef.current.vy = JUMP_FORCE;
      playerRef.current.isJumping = true;
      playSound('jump');
    }
  }, []);

  const update = () => {
    if (statusRef.current !== GameStatus.PLAYING) return;

    const player = playerRef.current;
    frameCountRef.current++;

    // Physics
    player.vy += GRAVITY;
    player.y += player.vy;

    // Ground collision
    if (player.y >= GROUND_Y - PLAYER_HEIGHT) {
      player.y = GROUND_Y - PLAYER_HEIGHT;
      player.vy = 0;
      player.isJumping = false;
    }

    // Speed progression
    if (gameSpeedRef.current < MAX_SPEED) {
      gameSpeedRef.current += SPEED_INCREMENT;
    }

    // Score
    scoreRef.current += 0.1 * (gameSpeedRef.current / INITIAL_SPEED);
    if (Math.floor(scoreRef.current) > currentScore) {
      setCurrentScore(Math.floor(scoreRef.current));
      if (Math.floor(scoreRef.current) % 100 === 0 && Math.floor(scoreRef.current) > 0) {
        playSound('score');
      }
    }

    // Obstacles
    // Spawn logic
    const lastObstacle = obstaclesRef.current[obstaclesRef.current.length - 1];
    if (!lastObstacle || (CANVAS_WIDTH - lastObstacle.x > OBSTACLE_SPAWN_MIN_GAP + Math.random() * OBSTACLE_SPAWN_MAX_GAP)) {
      spawnObstacle();
    }

    obstaclesRef.current.forEach(obs => {
      obs.x -= gameSpeedRef.current;
    });

    // Remove off-screen obstacles
    obstaclesRef.current = obstaclesRef.current.filter(obs => obs.x + obs.width > -100);

    // Clouds
    if (Math.random() < 0.01) spawnCloud();
    cloudsRef.current.forEach(cloud => {
      cloud.x -= cloud.speed;
    });
    cloudsRef.current = cloudsRef.current.filter(cloud => cloud.x > -100);

    // Collision Detection
    // Shrink hitboxes slightly for fair play
    const hitboxPadding = 8;
    const playerHitbox = {
      x: player.x + hitboxPadding,
      y: player.y + hitboxPadding,
      width: PLAYER_WIDTH - hitboxPadding * 2,
      height: PLAYER_HEIGHT - hitboxPadding * 2
    };

    for (const obs of obstaclesRef.current) {
      const obsHitbox = {
        x: obs.x + 4,
        y: obs.y + 4,
        width: obs.width - 8,
        height: obs.height - 8
      };

      if (
        playerHitbox.x < obsHitbox.x + obsHitbox.width &&
        playerHitbox.x + playerHitbox.width > obsHitbox.x &&
        playerHitbox.y < obsHitbox.y + obsHitbox.height &&
        playerHitbox.y + playerHitbox.height > obsHitbox.y
      ) {
        // Crash
        statusRef.current = GameStatus.GAME_OVER;
        setDisplayStatus(GameStatus.GAME_OVER);
        onGameOver(Math.floor(scoreRef.current));
        playSound('hit');
      }
    }
  };

  const drawBoy = (ctx: CanvasRenderingContext2D, x: number, y: number, isJumping: boolean, frame: number) => {
    ctx.save();
    ctx.translate(x, y);

    // Running animation frame
    const runCycle = Math.floor(frame / 5) % 2; 
    const legOffset = isJumping ? 0 : (runCycle === 0 ? 5 : -5);

    // Color Palette
    const skinColor = '#FFD1AA';
    const shirtColor = '#3B82F6'; // Blue-500
    const shortsColor = '#1F2937'; // Gray-800
    const shoeColor = '#DC2626'; // Red-600

    // Legs
    ctx.strokeStyle = skinColor;
    ctx.lineWidth = 4;
    
    // Left Leg
    ctx.beginPath();
    ctx.moveTo(15, 50); // Hip
    ctx.lineTo(15 + (isJumping ? -10 : legOffset * 2), 70); // Knee
    ctx.lineTo(15 + (isJumping ? -5 : legOffset * 3), 80); // Foot
    ctx.stroke();

    // Right Leg
    ctx.beginPath();
    ctx.moveTo(29, 50); // Hip
    ctx.lineTo(29 - (isJumping ? 10 : legOffset * 2), 70); // Knee
    ctx.lineTo(29 - (isJumping ? 5 : legOffset * 3), 80); // Foot
    ctx.stroke();

    // Shoes
    ctx.fillStyle = shoeColor;
    // Left Shoe
    ctx.beginPath();
    ctx.ellipse(15 + (isJumping ? -5 : legOffset * 3), 80, 6, 3, 0, 0, Math.PI * 2);
    ctx.fill();
    // Right Shoe
    ctx.beginPath();
    ctx.ellipse(29 - (isJumping ? 5 : legOffset * 3), 80, 6, 3, 0, 0, Math.PI * 2);
    ctx.fill();

    // Body (Shirt)
    ctx.fillStyle = shirtColor;
    ctx.fillRect(10, 25, 24, 30);

    // Arms
    ctx.strokeStyle = skinColor;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(22, 30); // Shoulder
    ctx.lineTo(35, 45 - legOffset); // Hand
    ctx.stroke();

    // Head
    ctx.fillStyle = skinColor;
    ctx.beginPath();
    ctx.arc(22, 15, 14, 0, Math.PI * 2);
    ctx.fill();

    // Hair
    ctx.fillStyle = '#4B2610'; // Brown
    ctx.beginPath();
    ctx.arc(22, 13, 14, Math.PI, Math.PI * 2);
    ctx.lineTo(36, 15);
    ctx.lineTo(8, 15);
    ctx.fill();
    // Little spike
    ctx.beginPath();
    ctx.moveTo(22, 0);
    ctx.lineTo(28, 5);
    ctx.lineTo(16, 5);
    ctx.fill();

    // Glasses (The distinctive feature)
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 2;
    // Left lens
    ctx.strokeRect(14, 12, 6, 4);
    // Right lens
    ctx.strokeRect(24, 12, 6, 4);
    // Bridge
    ctx.beginPath();
    ctx.moveTo(20, 14);
    ctx.lineTo(24, 14);
    ctx.stroke();
    // Temples (arms of glasses)
    ctx.beginPath();
    ctx.moveTo(14, 13);
    ctx.lineTo(8, 11);
    ctx.stroke();

    // Smile
    ctx.beginPath();
    ctx.arc(22, 22, 4, 0, Math.PI);
    ctx.stroke();

    ctx.restore();
  };

  const draw = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Clear
    ctx.fillStyle = '#f8fafc'; // slate-50 background
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    // Draw Clouds
    ctx.fillStyle = '#e2e8f0'; // slate-200
    cloudsRef.current.forEach(cloud => {
      ctx.beginPath();
      ctx.arc(cloud.x, cloud.y, 20 * cloud.scale, 0, Math.PI * 2);
      ctx.arc(cloud.x + 15 * cloud.scale, cloud.y - 10 * cloud.scale, 25 * cloud.scale, 0, Math.PI * 2);
      ctx.arc(cloud.x + 35 * cloud.scale, cloud.y, 20 * cloud.scale, 0, Math.PI * 2);
      ctx.fill();
    });

    // Draw Ground Line
    ctx.beginPath();
    ctx.strokeStyle = '#475569'; // slate-600
    ctx.lineWidth = 2;
    ctx.moveTo(0, GROUND_Y);
    ctx.lineTo(CANVAS_WIDTH, GROUND_Y);
    ctx.stroke();

    // Draw Obstacles
    ctx.fillStyle = '#16a34a'; // green-600 for cactus
    obstaclesRef.current.forEach(obs => {
      // Simple Cactus shape
      const w = obs.width;
      const h = obs.height;
      const x = obs.x;
      const y = obs.y;
      
      // Main stem
      ctx.fillRect(x + w * 0.3, y, w * 0.4, h);
      // Left arm
      ctx.fillRect(x, y + h * 0.3, w * 0.3, h * 0.1);
      ctx.fillRect(x, y + h * 0.1, w * 0.1, h * 0.3);
      // Right arm
      ctx.fillRect(x + w * 0.7, y + h * 0.4, w * 0.3, h * 0.1);
      ctx.fillRect(x + w * 0.9, y + h * 0.2, w * 0.1, h * 0.3);
    });

    // Draw Player
    const p = playerRef.current;
    drawBoy(ctx, p.x, p.y, p.isJumping, frameCountRef.current);
  };

  const loop = () => {
    update();
    draw();
    requestRef.current = requestAnimationFrame(loop);
  };

  useEffect(() => {
    requestRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(requestRef.current);
  }, []); // Run once on mount

  // Input handling
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space' || e.code === 'ArrowUp') {
        e.preventDefault(); // Prevent scrolling
        jump();
      }
    };
    const handleTouchStart = (e: TouchEvent) => {
       // Prevent default only if it's strictly game area interaction if needed, 
       // but here we generally want to jump on tap.
       jump();
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('touchstart', handleTouchStart);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('touchstart', handleTouchStart);
    };
  }, [jump]);


  // Helper for sharing
  const handleShare = async () => {
    const text = `Je viens de faire ${currentScore} points sur Le Garçon à Lunettes ! 🏃‍♂️💨 Essaye de me battre !`;
    
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'Le Garçon à Lunettes',
          text: text,
          url: window.location.href,
        });
      } catch (err) {
        console.log('Share canceled');
      }
    } else {
      navigator.clipboard.writeText(text + " " + window.location.href);
      alert('Score copié dans le presse-papier !');
    }
  };

  return (
    <div className="relative w-full max-w-3xl mx-auto rounded-xl overflow-hidden shadow-2xl bg-white aspect-[2/1] border-4 border-slate-800">
      <canvas
        ref={canvasRef}
        width={CANVAS_WIDTH}
        height={CANVAS_HEIGHT}
        className="w-full h-full block"
      />

      {/* HUD */}
      <div className="absolute top-4 right-4 flex gap-4 font-mono font-bold text-slate-700 text-lg md:text-xl select-none">
        <div className="flex items-center gap-2">
           <span className="text-slate-400 text-sm">HI</span> {highScore.toString().padStart(5, '0')}
        </div>
        <div>
           {currentScore.toString().padStart(5, '0')}
        </div>
      </div>

      <button 
        onClick={() => setIsMuted(!isMuted)}
        className="absolute top-4 left-4 p-2 bg-white/80 rounded-full hover:bg-white text-slate-700 transition-colors"
      >
        {isMuted ? <VolumeX size={20} /> : <Volume2 size={20} />}
      </button>

      {/* Start Screen Overlay */}
      {displayStatus === GameStatus.START && (
        <div className="absolute inset-0 bg-black/40 backdrop-blur-sm flex flex-col items-center justify-center text-white p-6 text-center">
          <div className="bg-white p-8 rounded-2xl shadow-2xl text-slate-800 max-w-md w-full animate-fade-in-up">
            <h1 className="text-3xl md:text-4xl font-extrabold mb-2 text-blue-600">Le Garçon à Lunettes</h1>
            <p className="text-slate-500 mb-6">Évite les obstacles. Cours aussi loin que possible !</p>
            
            <div className="flex flex-col gap-4">
              <button 
                onClick={resetGame}
                className="flex items-center justify-center gap-2 w-full py-4 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold text-lg transition-transform hover:scale-[1.02] active:scale-[0.98]"
              >
                <Play size={24} fill="currentColor" />
                JOUER
              </button>
              
              <div className="text-sm text-slate-400 mt-2">
                Espace ou Toucher pour sauter
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Game Over Overlay */}
      {displayStatus === GameStatus.GAME_OVER && (
        <div className="absolute inset-0 bg-black/50 backdrop-blur-md flex flex-col items-center justify-center text-white p-4">
           <div className="bg-white p-8 rounded-2xl shadow-2xl text-slate-800 max-w-sm w-full text-center transform transition-all scale-100">
             <div className="mb-2 text-red-500 font-extrabold text-2xl uppercase tracking-widest">Game Over</div>
             <div className="text-5xl font-black text-slate-900 mb-6 font-mono">{currentScore}</div>
             
             {currentScore >= highScore && currentScore > 0 && (
               <div className="mb-6 flex items-center justify-center gap-2 text-yellow-500 font-bold bg-yellow-50 py-2 rounded-lg">
                 <Trophy size={20} /> Nouveau Record !
               </div>
             )}

             <div className="grid grid-cols-2 gap-3">
                <button 
                  onClick={resetGame}
                  className="flex flex-col items-center justify-center gap-1 py-3 bg-slate-900 hover:bg-slate-800 text-white rounded-xl font-bold transition-colors"
                >
                  <RefreshCw size={24} />
                  <span>Rejouer</span>
                </button>
                <button 
                  onClick={handleShare}
                  className="flex flex-col items-center justify-center gap-1 py-3 bg-blue-100 hover:bg-blue-200 text-blue-700 rounded-xl font-bold transition-colors"
                >
                  <Share2 size={24} />
                  <span>Partager</span>
                </button>
             </div>
           </div>
        </div>
      )}
    </div>
  );
};

export default GameCanvas;