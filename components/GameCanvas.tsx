import React, { useRef, useEffect, useState, useCallback } from 'react';
import { GameStatus, Obstacle, Cloud, Particle, Star } from '../types';
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
import { Share2, RefreshCw, Trophy, Play, Check } from 'lucide-react';

interface GameCanvasProps {
  onGameOver: (score: number) => void;
  highScore: number;
}

const GameCanvas: React.FC<GameCanvasProps> = ({ onGameOver, highScore }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const requestRef = useRef<number>(0);
  const scoreRef = useRef<number>(0);
  
  // Game State Refs
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
  const particlesRef = useRef<Particle[]>([]);
  const starsRef = useRef<Star[]>([]);
  const gameSpeedRef = useRef<number>(INITIAL_SPEED);
  const frameCountRef = useRef<number>(0);
  const cycleRef = useRef<number>(0); // 0 to 1 representing day/night cycle

  // React State for UI
  const [displayStatus, setDisplayStatus] = useState<GameStatus>(GameStatus.START);
  const [currentScore, setCurrentScore] = useState(0);
  const [isNewRecord, setIsNewRecord] = useState(false);
  const [copySuccess, setCopySuccess] = useState(false);

  // --- Helpers ---
  
  // Initialize Stars (for night time)
  useEffect(() => {
    for(let i=0; i<50; i++) {
        starsRef.current.push({
            id: i,
            x: Math.random() * CANVAS_WIDTH,
            y: Math.random() * (GROUND_Y - 50),
            opacity: Math.random(),
            size: Math.random() * 2
        });
    }
  }, []);

  // --- Particle System ---
  const spawnParticles = (x: number, y: number, count: number, type: 'dust' | 'impact') => {
    for (let i = 0; i < count; i++) {
      particlesRef.current.push({
        id: Date.now() + Math.random(),
        x: x,
        y: y,
        vx: (Math.random() - 0.5) * (type === 'impact' ? 5 : 2),
        vy: (Math.random() - 1) * (type === 'impact' ? 5 : 2),
        life: 1.0,
        decay: 0.02 + Math.random() * 0.03,
        size: type === 'impact' ? 3 + Math.random() * 3 : 2 + Math.random() * 2,
        color: type === 'impact' ? '#94a3b8' : '#cbd5e1'
      });
    }
  };

  const spawnObstacle = () => {
    const typeChance = Math.random();
    let type: Obstacle['type'] = 'CACTUS_SMALL';
    let width = 30;
    let height = 50;
    let y = GROUND_Y - height;

    // Bird Spawn Logic (only after score > 150)
    if (scoreRef.current > 150 && Math.random() > 0.75) {
        type = 'BIRD';
        width = 40;
        height = 30;
        // Two heights: Low (jump over), Mid (tricky jump)
        const isHigh = Math.random() > 0.5; 
        y = isHigh 
          ? GROUND_Y - PLAYER_HEIGHT - 10  // Mid-air (requires clean jump)
          : GROUND_Y - 50; // Low (standard jump)
    } else if (Math.random() > 0.8) {
        // Rock Logic
        type = 'ROCK';
        width = 40;
        height = 25; // Low
        y = GROUND_Y - height;
    } else if (typeChance > 0.6) {
      type = 'CACTUS_LARGE';
      width = 40;
      height = 70;
      y = GROUND_Y - height;
    }

    const obstacle: Obstacle = {
      id: Date.now() + Math.random(),
      x: CANVAS_WIDTH + Math.random() * 100,
      y: y,
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
    setIsNewRecord(false);
    setCopySuccess(false);
    gameSpeedRef.current = INITIAL_SPEED;
    obstaclesRef.current = [];
    cloudsRef.current = [];
    particlesRef.current = [];
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
      // Jump Dust
      spawnParticles(playerRef.current.x + PLAYER_WIDTH / 2, playerRef.current.y + PLAYER_HEIGHT, 5, 'dust');
    }
  }, []);

  const update = () => {
    if (statusRef.current !== GameStatus.PLAYING) return;

    const player = playerRef.current;
    frameCountRef.current++;
    
    // Cycle Day/Night (Complete cycle every 3000 frames)
    cycleRef.current = (frameCountRef.current % 3000) / 3000;

    // Physics
    player.vy += GRAVITY;
    player.y += player.vy;

    // Ground collision
    if (player.y >= GROUND_Y - PLAYER_HEIGHT) {
      if (player.isJumping) {
        // Just landed
        spawnParticles(player.x + PLAYER_WIDTH / 2, GROUND_Y, 8, 'dust');
      }
      player.y = GROUND_Y - PLAYER_HEIGHT;
      player.vy = 0;
      player.isJumping = false;
      
      // Running particles
      if (frameCountRef.current % 8 === 0) {
         spawnParticles(player.x + 10, GROUND_Y, 2, 'dust');
      }
    }

    // Speed progression
    if (gameSpeedRef.current < MAX_SPEED) {
      gameSpeedRef.current += SPEED_INCREMENT;
    }

    // Score
    scoreRef.current += 0.1 * (gameSpeedRef.current / INITIAL_SPEED);
    if (Math.floor(scoreRef.current) > currentScore) {
      setCurrentScore(Math.floor(scoreRef.current));
    }

    // Obstacles
    const lastObstacle = obstaclesRef.current[obstaclesRef.current.length - 1];
    if (!lastObstacle || (CANVAS_WIDTH - lastObstacle.x > OBSTACLE_SPAWN_MIN_GAP + Math.random() * OBSTACLE_SPAWN_MAX_GAP)) {
      spawnObstacle();
    }

    obstaclesRef.current.forEach(obs => {
      obs.x -= gameSpeedRef.current;
    });
    obstaclesRef.current = obstaclesRef.current.filter(obs => obs.x + obs.width > -100);

    // Clouds
    if (Math.random() < 0.01) spawnCloud();
    cloudsRef.current.forEach(cloud => {
      cloud.x -= cloud.speed;
    });
    cloudsRef.current = cloudsRef.current.filter(cloud => cloud.x > -100);

    // Particles
    particlesRef.current.forEach(p => {
      p.x -= gameSpeedRef.current; // Move with world
      p.x += p.vx; // Own velocity
      p.y += p.vy;
      p.life -= p.decay;
    });
    particlesRef.current = particlesRef.current.filter(p => p.life > 0);

    // Collision Detection
    const hitboxPadding = 8;
    const playerHitbox = {
      x: player.x + hitboxPadding,
      y: player.y + hitboxPadding,
      width: PLAYER_WIDTH - hitboxPadding * 2,
      height: PLAYER_HEIGHT - hitboxPadding * 2
    };

    for (const obs of obstaclesRef.current) {
      let obsHitbox = {
        x: obs.x + 4,
        y: obs.y + 4,
        width: obs.width - 8,
        height: obs.height - 8
      };

      if (obs.type === 'BIRD') {
        obsHitbox = {
            x: obs.x + 2,
            y: obs.y + 10,
            width: obs.width - 4,
            height: obs.height - 14
        }
      } else if (obs.type === 'ROCK') {
         obsHitbox = {
            x: obs.x + 2,
            y: obs.y + 2,
            width: obs.width - 4,
            height: obs.height - 4
        }
      }

      if (
        playerHitbox.x < obsHitbox.x + obsHitbox.width &&
        playerHitbox.x + playerHitbox.width > obsHitbox.x &&
        playerHitbox.y < obsHitbox.y + obsHitbox.height &&
        playerHitbox.y + playerHitbox.height > obsHitbox.y
      ) {
        // Crash
        
        // Calculate record status BEFORE updating parent/highScore prop
        const finalScore = Math.floor(scoreRef.current);
        if (finalScore > highScore) {
            setIsNewRecord(true);
        } else {
            setIsNewRecord(false);
        }

        statusRef.current = GameStatus.GAME_OVER;
        setDisplayStatus(GameStatus.GAME_OVER);
        onGameOver(finalScore);
        
        // Impact particles
        spawnParticles(player.x + PLAYER_WIDTH/2, player.y + PLAYER_HEIGHT/2, 20, 'impact');
      }
    }
  };

  // --- Draw Helpers ---
  
  // Interpolate two hex colors
  const lerpColor = (a: string, b: string, amount: number) => {
    const ah = parseInt(a.replace(/#/g, ''), 16),
      ar = ah >> 16, ag = ah >> 8 & 0xff, ab = ah & 0xff,
      bh = parseInt(b.replace(/#/g, ''), 16),
      br = bh >> 16, bg = bh >> 8 & 0xff, bb = bh & 0xff,
      rr = ar + amount * (br - ar),
      rg = ag + amount * (bg - ag),
      rb = ab + amount * (bb - ab);
    return '#' + ((1 << 24) + (rr << 16) + (rg << 8) + rb | 0).toString(16).slice(1);
  };

  // Get Sky Color based on cycle
  const getSkyColor = (t: number) => {
      // 0.0 - 0.3: Day (#38bdf8)
      // 0.3 - 0.4: Sunset (#fdba74)
      // 0.4 - 0.5: Dusk (#1e293b)
      // 0.5 - 0.9: Night (#0f172a)
      // 0.9 - 1.0: Sunrise (#fcd34d)
      if (t < 0.3) return '#38bdf8';
      if (t < 0.4) return lerpColor('#38bdf8', '#fdba74', (t - 0.3) * 10);
      if (t < 0.5) return lerpColor('#fdba74', '#0f172a', (t - 0.4) * 10);
      if (t < 0.9) return '#0f172a';
      return lerpColor('#0f172a', '#38bdf8', (t - 0.9) * 10);
  };
  
  const drawRock = (ctx: CanvasRenderingContext2D, obs: Obstacle) => {
    ctx.save();
    ctx.translate(obs.x, obs.y);
    
    ctx.fillStyle = '#64748b'; // slate-500
    ctx.beginPath();
    ctx.moveTo(0, obs.height);
    ctx.lineTo(5, 5);
    ctx.lineTo(obs.width - 5, 2);
    ctx.lineTo(obs.width, obs.height);
    ctx.fill();
    
    // texture
    ctx.fillStyle = '#475569';
    ctx.beginPath();
    ctx.arc(10, 15, 3, 0, Math.PI * 2);
    ctx.arc(25, 10, 4, 0, Math.PI * 2);
    ctx.fill();
    
    ctx.restore();
  };

  const drawBird = (ctx: CanvasRenderingContext2D, obs: Obstacle) => {
    ctx.save();
    ctx.translate(obs.x, obs.y);
    
    const flap = Math.floor(frameCountRef.current / 10) % 2 === 0;
    
    ctx.fillStyle = '#1e293b'; // slate-800
    
    // Body
    ctx.beginPath();
    ctx.ellipse(20, 15, 12, 6, 0, 0, Math.PI * 2);
    ctx.fill();
    
    // Head
    ctx.beginPath();
    ctx.arc(8, 12, 6, 0, Math.PI * 2);
    ctx.fill();
    
    // Beak
    ctx.fillStyle = '#f59e0b'; // amber-500
    ctx.beginPath();
    ctx.moveTo(3, 12);
    ctx.lineTo(-2, 14);
    ctx.lineTo(3, 16);
    ctx.fill();

    // Eye
    ctx.fillStyle = 'white';
    ctx.beginPath();
    ctx.arc(6, 10, 1.5, 0, Math.PI * 2);
    ctx.fill();

    // Wings
    ctx.fillStyle = '#334155'; // slate-700
    ctx.beginPath();
    if (flap) {
        // Wings up
        ctx.moveTo(15, 10);
        ctx.lineTo(25, -5);
        ctx.lineTo(32, 10);
    } else {
        // Wings down
        ctx.moveTo(15, 10);
        ctx.lineTo(25, 25);
        ctx.lineTo(32, 10);
    }
    ctx.fill();

    ctx.restore();
  };

  const drawBoy = (ctx: CanvasRenderingContext2D, x: number, y: number, isJumping: boolean, frame: number) => {
    ctx.save();
    ctx.translate(x, y);

    // --- CHARACTER DESIGN ---
    const COLORS = {
      SKIN: '#FFD1AA',
      SHIRT: '#39FF14', // NEON GREEN
      SHORTS: '#C2B280', // Beige/Khaki
      SOCKS: '#111827',  // Black socks
      SHOES: '#1F2937', // Dark Grey shoes
      HAIR: '#5D4037',  // Medium Brown
      GLASSES: '#000000',
      EYES: '#000000'
    };

    const CENTER_X = 17;
    const runCycle = Math.floor(frame / 5) % 2; 
    const legOffset = isJumping ? 0 : (runCycle === 0 ? 5 : -5);

    const leftKneeX = (CENTER_X - 4) + (isJumping ? 10 : legOffset * 2);
    const leftFootX = (CENTER_X - 4) + (isJumping ? 5 : legOffset * 3);
    const rightKneeX = (CENTER_X + 4) + (isJumping ? 10 : -legOffset * 2);
    const rightFootX = (CENTER_X + 4) + (isJumping ? 5 : -legOffset * 3);

    // Legs
    ctx.strokeStyle = COLORS.SKIN;
    ctx.lineWidth = 4;
    ctx.beginPath(); ctx.moveTo(CENTER_X - 4, 50); ctx.lineTo(leftKneeX, 70); ctx.lineTo(leftFootX, 78); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(CENTER_X + 4, 50); ctx.lineTo(rightKneeX, 70); ctx.lineTo(rightFootX, 78); ctx.stroke();

    // Socks & Shoes
    ctx.fillStyle = COLORS.SOCKS;
    ctx.beginPath(); ctx.rect(leftFootX - 2, 74, 4, 6); ctx.fill();
    ctx.beginPath(); ctx.rect(rightFootX - 2, 74, 4, 6); ctx.fill();
    ctx.fillStyle = COLORS.SHOES;
    ctx.beginPath(); ctx.ellipse(leftFootX, 80, 6, 3, 0, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(rightFootX, 80, 6, 3, 0, 0, Math.PI * 2); ctx.fill();

    // Body
    ctx.fillStyle = COLORS.SHORTS;
    ctx.fillRect(CENTER_X - 7, 45, 14, 12); 
    ctx.fillStyle = COLORS.SHIRT;
    ctx.fillRect(CENTER_X - 7, 25, 14, 25);
    
    // Arms
    ctx.strokeStyle = COLORS.SKIN;
    ctx.lineWidth = 3; 
    ctx.beginPath(); ctx.moveTo(CENTER_X, 30); ctx.lineTo(CENTER_X + 13, 45 - legOffset); ctx.stroke();

    // Head
    ctx.fillStyle = COLORS.SKIN;
    ctx.beginPath(); ctx.arc(CENTER_X, 15, 11, 0, Math.PI * 2); ctx.fill();

    // Hair
    ctx.fillStyle = COLORS.HAIR;
    ctx.beginPath();
    ctx.arc(CENTER_X, 13, 11, Math.PI + 0.5, Math.PI * 2 - 0.5);
    ctx.lineTo(CENTER_X + 11, 18); ctx.lineTo(CENTER_X + 10, 12);
    ctx.lineTo(CENTER_X, 5); ctx.lineTo(CENTER_X - 10, 12); ctx.lineTo(CENTER_X - 11, 18); ctx.fill();

    // Glasses
    ctx.strokeStyle = COLORS.GLASSES;
    ctx.lineWidth = 2; 
    ctx.beginPath(); ctx.arc(CENTER_X - 5, 15, 5.5, 0, Math.PI * 2); ctx.stroke();
    ctx.beginPath(); ctx.arc(CENTER_X + 5, 15, 5.5, 0, Math.PI * 2); ctx.stroke();
    ctx.fillStyle = COLORS.EYES;
    ctx.beginPath(); ctx.arc(CENTER_X - 5, 15, 1.5, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(CENTER_X + 5, 15, 1.5, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.moveTo(CENTER_X, 15); ctx.lineTo(CENTER_X, 15); ctx.stroke();
    ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(CENTER_X - 10, 14); ctx.lineTo(CENTER_X - 11, 12); ctx.stroke();

    // Smile
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = '#8B5A2B';
    ctx.beginPath(); ctx.arc(CENTER_X, 21, 4, 0.2, Math.PI - 0.2); ctx.stroke();

    ctx.restore();
  };

  const draw = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // -- Background --
    const skyColor = getSkyColor(cycleRef.current);
    ctx.fillStyle = skyColor;
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    // Stars (Visible at night)
    if (cycleRef.current > 0.45 && cycleRef.current < 0.95) {
        ctx.fillStyle = 'white';
        starsRef.current.forEach(star => {
            ctx.globalAlpha = star.opacity * (cycleRef.current > 0.5 && cycleRef.current < 0.9 ? 1 : 0.5);
            ctx.beginPath();
            ctx.arc(star.x, star.y, star.size, 0, Math.PI * 2);
            ctx.fill();
        });
        ctx.globalAlpha = 1;
    }

    // -- Clouds --
    ctx.fillStyle = 'rgba(255, 255, 255, 0.6)'; 
    cloudsRef.current.forEach(cloud => {
      ctx.beginPath();
      ctx.arc(cloud.x, cloud.y, 20 * cloud.scale, 0, Math.PI * 2);
      ctx.arc(cloud.x + 15 * cloud.scale, cloud.y - 10 * cloud.scale, 25 * cloud.scale, 0, Math.PI * 2);
      ctx.arc(cloud.x + 35 * cloud.scale, cloud.y, 20 * cloud.scale, 0, Math.PI * 2);
      ctx.fill();
    });

    // -- Ground --
    ctx.beginPath();
    ctx.strokeStyle = '#334155';
    ctx.lineWidth = 2;
    ctx.moveTo(0, GROUND_Y);
    ctx.lineTo(CANVAS_WIDTH, GROUND_Y);
    ctx.stroke();
    
    // Ground Fill
    ctx.fillStyle = '#f1f5f9';
    ctx.fillRect(0, GROUND_Y, CANVAS_WIDTH, CANVAS_HEIGHT - GROUND_Y);

    // -- Obstacles --
    obstaclesRef.current.forEach(obs => {
      if (obs.type === 'BIRD') {
        drawBird(ctx, obs);
      } else if (obs.type === 'ROCK') {
        drawRock(ctx, obs);
      } else {
        // Cactus
        ctx.fillStyle = '#16a34a'; // green-600
        const w = obs.width;
        const h = obs.height;
        const x = obs.x;
        const y = obs.y;
        ctx.fillRect(x + w * 0.3, y, w * 0.4, h);
        ctx.fillRect(x, y + h * 0.3, w * 0.3, h * 0.1);
        ctx.fillRect(x, y + h * 0.1, w * 0.1, h * 0.3);
        ctx.fillRect(x + w * 0.7, y + h * 0.4, w * 0.3, h * 0.1);
        ctx.fillRect(x + w * 0.9, y + h * 0.2, w * 0.1, h * 0.3);
      }
    });

    // -- Particles --
    particlesRef.current.forEach(p => {
        ctx.save();
        ctx.globalAlpha = p.life;
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    });

    // -- Player --
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
  }, []);

  // Input handling
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space' || e.code === 'ArrowUp') {
        e.preventDefault();
        jump();
      }
    };
    
    // Allow touch on the window for better mobile response
    const handleTouchStart = (e: TouchEvent) => {
       // Only jump if not interacting with a button
       const target = e.target as HTMLElement;
       if (target.tagName !== 'BUTTON') {
          e.preventDefault(); // prevent scroll
          jump();
       }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('touchstart', handleTouchStart, { passive: false });
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('touchstart', handleTouchStart);
    };
  }, [jump]);


  const handleShare = async () => {
    const text = `Je viens de faire ${currentScore} points sur Quentin Qui Court ! 🏃‍♂️💨 Essaye de me battre !`;
    const shareData = {
        title: 'Quentin Qui Court',
        text: text,
        url: window.location.href,
    };
    
    if (navigator.share && navigator.canShare && navigator.canShare(shareData)) {
      try {
        await navigator.share(shareData);
      } catch (err) {
        console.log('Share canceled or failed:', err);
      }
    } else {
      // Fallback: Copy to clipboard
      try {
        await navigator.clipboard.writeText(`${text} ${window.location.href}`);
        setCopySuccess(true);
        setTimeout(() => setCopySuccess(false), 2000);
      } catch (err) {
        alert("Impossible de partager automatiquement. Copiez l'URL pour partager !");
      }
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
        <div className="flex items-center gap-2 px-2 py-1 bg-white/50 rounded-md backdrop-blur-sm">
           <span className="text-slate-500 text-sm">HI</span> {highScore.toString().padStart(5, '0')}
        </div>
        <div className="px-2 py-1 bg-white/50 rounded-md backdrop-blur-sm">
           {currentScore.toString().padStart(5, '0')}
        </div>
      </div>

      {/* Start Screen Overlay */}
      {displayStatus === GameStatus.START && (
        <div className="absolute inset-0 bg-black/40 backdrop-blur-sm flex flex-col items-center justify-center text-white p-6 text-center z-10">
          <div className="bg-white p-8 rounded-2xl shadow-2xl text-slate-800 max-w-md w-full animate-fade-in-up">
            <h1 className="text-3xl md:text-4xl font-extrabold mb-2 text-blue-600">Quentin Qui Court</h1>
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
                Appuie pour sauter
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Game Over Overlay */}
      {displayStatus === GameStatus.GAME_OVER && (
        <div className="absolute inset-0 bg-black/50 backdrop-blur-md flex flex-col items-center justify-center text-white p-4 z-10">
           <div className="bg-white p-8 rounded-2xl shadow-2xl text-slate-800 max-w-sm w-full text-center transform transition-all scale-100">
             <div className="mb-2 text-red-500 font-extrabold text-2xl uppercase tracking-widest">Game Over</div>
             <div className="text-5xl font-black text-slate-900 mb-6 font-mono">{currentScore}</div>
             
             {isNewRecord && currentScore > 0 && (
               <div className="mb-6 flex items-center justify-center gap-2 text-yellow-600 font-bold bg-yellow-100 py-2 rounded-lg border border-yellow-200">
                 <Trophy size={20} fill="currentColor" /> Nouveau Record !
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
                  className={`flex flex-col items-center justify-center gap-1 py-3 rounded-xl font-bold transition-all ${copySuccess ? 'bg-green-100 text-green-700' : 'bg-blue-100 hover:bg-blue-200 text-blue-700'}`}
                >
                  {copySuccess ? <Check size={24} /> : <Share2 size={24} />}
                  <span>{copySuccess ? 'Copié !' : 'Partager'}</span>
                </button>
             </div>
           </div>
        </div>
      )}
    </div>
  );
};

export default GameCanvas;