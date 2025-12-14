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

const MAX_PARTICLES = 60;
const TARGET_FPS = 60;
const FRAME_TIME = 1000 / TARGET_FPS;

const GameCanvas: React.FC<GameCanvasProps> = ({ onGameOver, highScore }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const requestRef = useRef<number>(0);
  const scoreRef = useRef<number>(0);
  const lastTimeRef = useRef<number>(0);
  const onGameOverRef = useRef(onGameOver);
  const highScoreRef = useRef(highScore);

  useEffect(() => {
    onGameOverRef.current = onGameOver;
  }, [onGameOver]);

  useEffect(() => {
    highScoreRef.current = highScore;
  }, [highScore]);
  
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
  
  const particlesRef = useRef<Particle[]>(
    Array.from({ length: MAX_PARTICLES }, (_, i) => ({
      id: i,
      x: 0, y: 0, vx: 0, vy: 0, life: 0, decay: 0, size: 0, color: '#000', active: false
    }))
  );
  const starsRef = useRef<Star[]>([]);
  const gameSpeedRef = useRef<number>(INITIAL_SPEED);
  const frameCountRef = useRef<number>(0);
  const cycleRef = useRef<number>(0);

  // React State for UI
  const [displayStatus, setDisplayStatus] = useState<GameStatus>(GameStatus.START);
  const [currentScore, setCurrentScore] = useState(0);
  const [isNewRecord, setIsNewRecord] = useState(false);
  const [copySuccess, setCopySuccess] = useState(false);

  // --- Helpers ---
  
  useEffect(() => {
    if (starsRef.current.length === 0) {
      for(let i=0; i<50; i++) {
          starsRef.current.push({
              id: i,
              x: Math.random() * CANVAS_WIDTH,
              y: Math.random() * (GROUND_Y - 50),
              opacity: Math.random(),
              size: Math.random() * 2
          });
      }
    }
  }, []);

  const spawnParticles = (x: number, y: number, count: number, type: 'dust' | 'impact') => {
    let spawnedCount = 0;
    for (let i = 0; i < particlesRef.current.length; i++) {
      if (spawnedCount >= count) break;
      const p = particlesRef.current[i];
      if (!p.active) {
        p.active = true;
        p.x = x;
        p.y = y;
        p.vx = (Math.random() - 0.5) * (type === 'impact' ? 5 : 2);
        p.vy = (Math.random() - 1) * (type === 'impact' ? 5 : 2);
        p.life = 1.0;
        p.decay = 0.02 + Math.random() * 0.03;
        p.size = type === 'impact' ? 3 + Math.random() * 3 : 2 + Math.random() * 2;
        p.color = type === 'impact' ? '#94a3b8' : '#cbd5e1';
        spawnedCount++;
      }
    }
  };

  const spawnObstacle = () => {
    const r = Math.random();
    let type: any = 'BONSAI_SMALL'; 
    let width = 35;
    let height = 45;
    let y = GROUND_Y - height;

    // Logique d'apparition du Torii (Très rare, seulement après un certain score)
    const canSpawnTorii = scoreRef.current > 300;
    const isTorii = canSpawnTorii && r > 0.96; // 4% de chance si conditions réunies

    if (isTorii) {
        type = 'TORII';
        width = 50;
        height = 65; // Assez grand
        y = GROUND_Y - height;
    } else if (scoreRef.current > 150 && r > 0.82) {
        // Oiseau
        type = 'BIRD';
        width = 40;
        height = 30;
        const isHigh = Math.random() > 0.5; 
        y = isHigh 
          ? GROUND_Y - PLAYER_HEIGHT - 10 
          : GROUND_Y - 50;
    } else if (r > 0.88) {
        // Rocher
        type = 'ROCK';
        width = 40;
        height = 25;
        y = GROUND_Y - height;
    } else if (r > 0.5) {
        // Grand Bonsaï - Avec variation de taille aléatoire
        type = 'BONSAI_LARGE';
        const scale = 0.85 + Math.random() * 0.4; // Échelle de 0.85 à 1.25
        width = 45 * scale;
        height = 65 * scale;
        y = GROUND_Y - height;
    } else {
        // Petit Bonsaï (Défaut) - Avec variation de taille aléatoire
        type = 'BONSAI_SMALL';
        const scale = 0.85 + Math.random() * 0.4; // Échelle de 0.85 à 1.25
        width = 35 * scale;
        height = 45 * scale;
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
    
    particlesRef.current.forEach(p => p.active = false);

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
      spawnParticles(playerRef.current.x + PLAYER_WIDTH / 2, playerRef.current.y + PLAYER_HEIGHT, 5, 'dust');
    }
  }, []);

  const update = (dt: number) => {
    if (statusRef.current !== GameStatus.PLAYING) return;

    const player = playerRef.current;
    
    frameCountRef.current += 1 * dt;
    cycleRef.current = (frameCountRef.current % 3000) / 3000;

    // Physics
    player.vy += GRAVITY * dt;
    player.y += player.vy * dt;

    // Ground collision
    if (player.y >= GROUND_Y - PLAYER_HEIGHT) {
      if (player.isJumping) {
        spawnParticles(player.x + PLAYER_WIDTH / 2, GROUND_Y, 8, 'dust');
      }
      player.y = GROUND_Y - PLAYER_HEIGHT;
      player.vy = 0;
      player.isJumping = false;
      
      if (Math.floor(frameCountRef.current) % 8 === 0) {
         spawnParticles(player.x + 10, GROUND_Y, 2, 'dust');
      }
    }

    // Speed progression
    if (gameSpeedRef.current < MAX_SPEED) {
      gameSpeedRef.current += SPEED_INCREMENT * dt;
    }

    // Score
    scoreRef.current += 0.1 * (gameSpeedRef.current / INITIAL_SPEED) * dt;
    if (Math.floor(scoreRef.current) > currentScore) {
      setCurrentScore(Math.floor(scoreRef.current));
    }

    // Obstacles spawning
    const lastObstacle = obstaclesRef.current[obstaclesRef.current.length - 1];
    if (!lastObstacle || (CANVAS_WIDTH - lastObstacle.x > OBSTACLE_SPAWN_MIN_GAP + Math.random() * OBSTACLE_SPAWN_MAX_GAP)) {
      spawnObstacle();
    }

    // Update Obstacles with dt
    let activeObsCount = 0;
    for (let i = 0; i < obstaclesRef.current.length; i++) {
        const obs = obstaclesRef.current[i];
        obs.x -= gameSpeedRef.current * dt;
        
        if (obs.x + obs.width > -100) {
            if (i !== activeObsCount) {
                obstaclesRef.current[activeObsCount] = obs;
            }
            activeObsCount++;
        }
    }
    obstaclesRef.current.length = activeObsCount;

    // Clouds
    if (Math.random() < 0.01 * dt) spawnCloud();
    let activeCloudCount = 0;
    for (let i = 0; i < cloudsRef.current.length; i++) {
        const cloud = cloudsRef.current[i];
        cloud.x -= cloud.speed * dt;
        if (cloud.x > -100) {
             if (i !== activeCloudCount) {
                 cloudsRef.current[activeCloudCount] = cloud;
             }
             activeCloudCount++;
        }
    }
    cloudsRef.current.length = activeCloudCount;

    // Particles
    for (let i = 0; i < particlesRef.current.length; i++) {
        const p = particlesRef.current[i];
        if (p.active) {
            p.x -= gameSpeedRef.current * dt;
            p.x += p.vx * dt;
            p.y += p.vy * dt;
            p.life -= p.decay * dt;
            if (p.life <= 0) {
                p.active = false;
            }
        }
    }

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
      } else if (obs.type === 'TORII') {
          // Hitbox un peu plus indulgente pour le Torii car il est large visuellement
          obsHitbox = {
            x: obs.x + 10,
            y: obs.y + 2,
            width: obs.width - 20,
            height: obs.height - 4
          }
      }

      if (
        playerHitbox.x < obsHitbox.x + obsHitbox.width &&
        playerHitbox.x + playerHitbox.width > obsHitbox.x &&
        playerHitbox.y < obsHitbox.y + obsHitbox.height &&
        playerHitbox.y + playerHitbox.height > obsHitbox.y
      ) {
        const finalScore = Math.floor(scoreRef.current);
        if (finalScore > highScoreRef.current) {
            setIsNewRecord(true);
        } else {
            setIsNewRecord(false);
        }

        statusRef.current = GameStatus.GAME_OVER;
        setDisplayStatus(GameStatus.GAME_OVER);
        onGameOverRef.current(finalScore);
        
        spawnParticles(player.x + PLAYER_WIDTH/2, player.y + PLAYER_HEIGHT/2, 20, 'impact');
      }
    }
  };

  // --- Draw Helpers ---
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

  const getSkyColor = (t: number) => {
      if (t < 0.3) return '#38bdf8';
      if (t < 0.4) return lerpColor('#38bdf8', '#fdba74', (t - 0.3) * 10);
      if (t < 0.5) return lerpColor('#fdba74', '#0f172a', (t - 0.4) * 10);
      if (t < 0.9) return '#0f172a';
      return lerpColor('#0f172a', '#38bdf8', (t - 0.9) * 10);
  };
  
  const drawRock = (ctx: CanvasRenderingContext2D, obs: Obstacle) => {
    ctx.save();
    ctx.translate(obs.x, obs.y);
    ctx.fillStyle = '#64748b'; 
    ctx.beginPath();
    ctx.moveTo(0, obs.height);
    ctx.lineTo(5, 5);
    ctx.lineTo(obs.width - 5, 2);
    ctx.lineTo(obs.width, obs.height);
    ctx.fill();
    ctx.fillStyle = '#475569';
    ctx.beginPath();
    ctx.arc(10, 15, 3, 0, Math.PI * 2);
    ctx.arc(25, 10, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  };

  // Dessin du Bonsaï dynamique (s'adapte à w et h)
  const drawBonsai = (ctx: CanvasRenderingContext2D, obs: Obstacle) => {
    ctx.save();
    ctx.translate(obs.x, obs.y);

    const w = obs.width;
    const h = obs.height;

    // Pot (Céramique sombre) - Hauteur proportionnelle (~20% de la hauteur totale)
    ctx.fillStyle = '#3E2723'; 
    const potH = h * 0.2; 
    
    ctx.beginPath();
    ctx.moveTo(w * 0.2, h); // bas gauche
    ctx.lineTo(w * 0.8, h); // bas droite
    ctx.lineTo(w * 0.9, h - potH); // haut droite
    ctx.lineTo(w * 0.1, h - potH); // haut gauche
    ctx.fill();

    // Tronc (Tortueux)
    ctx.strokeStyle = '#5D4037';
    ctx.lineWidth = w * 0.12; // Largeur de trait relative
    ctx.lineCap = 'round';
    ctx.beginPath();
    
    const trunkStart = h - potH;
    ctx.moveTo(w * 0.5, trunkStart);
    // Courbes relatives à la largeur et hauteur
    ctx.quadraticCurveTo(w * 0.3, trunkStart - (h * 0.2), w * 0.6, trunkStart - (h * 0.4));
    ctx.quadraticCurveTo(w * 0.8, trunkStart - (h * 0.6), w * 0.5, trunkStart - (h * 0.8));
    ctx.stroke();

    // Feuillage (Nuages verts)
    ctx.fillStyle = '#2E7D32'; 
    
    // Bas
    ctx.beginPath();
    ctx.arc(w * 0.3, trunkStart - (h * 0.3), w * 0.25, 0, Math.PI * 2);
    ctx.fill();
    // Milieu
    ctx.beginPath();
    ctx.arc(w * 0.75, trunkStart - (h * 0.5), w * 0.3, 0, Math.PI * 2);
    ctx.fill();
    // Haut
    ctx.beginPath();
    ctx.arc(w * 0.5, trunkStart - (h * 0.8), w * 0.35, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  };

  // NOUVEAU : Dessin du Torii
  const drawTorii = (ctx: CanvasRenderingContext2D, obs: Obstacle) => {
    ctx.save();
    ctx.translate(obs.x, obs.y);
    
    const RED = '#DC2626'; // Rouge vermillon
    const BLACK = '#1a1a1a';

    // Piliers (Hashira)
    ctx.fillStyle = RED;
    // Gauche
    ctx.fillRect(5, 0, 6, obs.height);
    // Droite
    ctx.fillRect(obs.width - 11, 0, 6, obs.height);

    // Lintel inférieur (Nuki) - Traverse les piliers
    ctx.fillRect(0, 15, obs.width, 5);

    // Lintel supérieur (Kasagi) - Courbé et noir sur le dessus
    ctx.fillStyle = BLACK;
    ctx.beginPath();
    // Forme courbée du toit
    ctx.moveTo(0, 5); // Coin haut gauche
    ctx.quadraticCurveTo(obs.width / 2, 0, obs.width, 5); // Courbe vers le haut
    ctx.lineTo(obs.width + 2, 0); // Pointe
    ctx.lineTo(obs.width, 10);
    ctx.quadraticCurveTo(obs.width / 2, 5, 0, 10); // Courbe bas
    ctx.lineTo(-2, 0);
    ctx.fill();
    
    // Partie rouge du lintel supérieur (Shimaki)
    ctx.fillStyle = RED;
    ctx.fillRect(2, 5, obs.width - 4, 6);

    // Tablette au centre (Gakuzuka)
    ctx.fillStyle = BLACK;
    ctx.fillRect(obs.width/2 - 3, 5, 6, 10);

    ctx.restore();
  };

  const drawBird = (ctx: CanvasRenderingContext2D, obs: Obstacle) => {
    ctx.save();
    ctx.translate(obs.x, obs.y);
    const flap = Math.floor(frameCountRef.current / 10) % 2 === 0;
    ctx.fillStyle = '#1e293b'; 
    ctx.beginPath();
    ctx.ellipse(20, 15, 12, 6, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(8, 12, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#f59e0b';
    ctx.beginPath();
    ctx.moveTo(3, 12);
    ctx.lineTo(-2, 14);
    ctx.lineTo(3, 16);
    ctx.fill();
    ctx.fillStyle = 'white';
    ctx.beginPath();
    ctx.arc(6, 10, 1.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#334155';
    ctx.beginPath();
    if (flap) {
        ctx.moveTo(15, 10);
        ctx.lineTo(25, -5);
        ctx.lineTo(32, 10);
    } else {
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

    const COLORS = {
      SKIN: '#FFD1AA',
      SHIRT: '#39FF14',
      SHORTS: '#1f2937',
      SOCKS: '#111827',
      SHOES: '#1F2937',
      HAIR: '#5D4037',
      GLASSES: '#000000',
    };

    const t = frame * 0.25; 
    const swingRange = 0.8;
    const legLeftAngle = isJumping ? 0.2 : Math.sin(t) * swingRange;
    const legRightAngle = isJumping ? -0.4 : Math.sin(t + Math.PI) * swingRange;
    const armLeftAngle = isJumping ? -2.5 : Math.sin(t + Math.PI) * swingRange * 0.8;
    const armRightAngle = isJumping ? -2.5 : Math.sin(t) * swingRange * 0.8;

    const HEAD_X = 17;
    const HEAD_Y = 12;
    const NECK_Y = 22;
    const WAIST_Y = 48;
    const SHOULDER_Y = 25;
    
    // --- LEFT LIMBS (BACKGROUND) ---
    ctx.save();
    ctx.translate(HEAD_X, SHOULDER_Y);
    ctx.rotate(armLeftAngle);
    ctx.fillStyle = COLORS.SKIN;
    ctx.strokeStyle = COLORS.SKIN;
    ctx.lineWidth = 4;
    ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(0,0); ctx.lineTo(0, 25); ctx.stroke();
    ctx.restore();

    ctx.save();
    ctx.translate(HEAD_X, WAIST_Y);
    ctx.rotate(legLeftAngle);
    ctx.strokeStyle = COLORS.SKIN;
    ctx.lineWidth = 4;
    ctx.beginPath(); ctx.moveTo(0,0); ctx.lineTo(0, 18); ctx.stroke();
    ctx.translate(0, 18);
    ctx.rotate(isJumping ? 0.2 : (legLeftAngle > 0 ? 0.5 : 0.1)); 
    ctx.beginPath(); ctx.moveTo(0,0); ctx.lineTo(0, 18); ctx.stroke();
    ctx.translate(0, 18);
    ctx.fillStyle = COLORS.SHOES;
    ctx.fillRect(-2, 0, 8, 4);
    ctx.restore();


    // --- RIGHT LIMBS (FOREGROUND) ---
    ctx.save();
    ctx.translate(HEAD_X, WAIST_Y);
    ctx.rotate(legRightAngle);
    ctx.strokeStyle = COLORS.SKIN;
    ctx.lineWidth = 4;
    ctx.beginPath(); ctx.moveTo(0,0); ctx.lineTo(0, 18); ctx.stroke();
    ctx.translate(0, 18);
    ctx.rotate(isJumping ? 0.2 : (legRightAngle > 0 ? 0.5 : 0.1));
    ctx.beginPath(); ctx.moveTo(0,0); ctx.lineTo(0, 18); ctx.stroke();
    ctx.translate(0, 18);
    ctx.fillStyle = COLORS.SHOES;
    ctx.fillRect(-2, 0, 8, 4);
    ctx.restore();

    // --- BODY ---
    ctx.fillStyle = COLORS.SHIRT;
    ctx.fillRect(HEAD_X - 6, NECK_Y, 12, WAIST_Y - NECK_Y);
    ctx.fillStyle = COLORS.SHORTS;
    ctx.fillRect(HEAD_X - 6, WAIST_Y, 12, 10);

    // --- HEAD ---
    ctx.fillStyle = COLORS.SKIN;
    ctx.fillRect(HEAD_X - 2, HEAD_Y + 5, 4, 6);
    ctx.fillStyle = COLORS.SKIN;
    ctx.beginPath();
    ctx.arc(HEAD_X, HEAD_Y, 9, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = COLORS.HAIR;
    ctx.beginPath();
    ctx.arc(HEAD_X, HEAD_Y, 9.5, Math.PI * 0.7, Math.PI * 1.7, false);
    ctx.quadraticCurveTo(HEAD_X + 7, HEAD_Y - 4, HEAD_X, HEAD_Y - 8); 
    ctx.quadraticCurveTo(HEAD_X - 7, HEAD_Y - 4, HEAD_X - 8, HEAD_Y + 3); 
    ctx.fill();

    ctx.strokeStyle = COLORS.GLASSES;
    ctx.lineWidth = 0.3;
    ctx.beginPath();
    ctx.moveTo(HEAD_X + 2, HEAD_Y - 3);
    ctx.lineTo(HEAD_X + 9, HEAD_Y - 3);
    ctx.lineTo(HEAD_X + 9, HEAD_Y + 2);
    ctx.lineTo(HEAD_X + 2, HEAD_Y + 2);
    ctx.closePath();
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(HEAD_X + 2, HEAD_Y - 1);
    ctx.lineTo(HEAD_X - 2, HEAD_Y - 2); 
    ctx.stroke();

    ctx.fillStyle = 'black';
    ctx.beginPath();
    ctx.arc(HEAD_X + 6, HEAD_Y - 0.5, 1, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = '#3E2723';
    ctx.lineWidth = 0.5;
    ctx.beginPath();
    ctx.moveTo(HEAD_X + 6, HEAD_Y + 5);
    ctx.lineTo(HEAD_X + 9, HEAD_Y + 5);
    ctx.stroke();

    ctx.save();
    ctx.translate(HEAD_X, SHOULDER_Y);
    ctx.rotate(armRightAngle);
    ctx.fillStyle = COLORS.SKIN;
    ctx.strokeStyle = COLORS.SKIN;
    ctx.lineWidth = 4;
    ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(0,0); ctx.lineTo(0, 15); ctx.stroke();
    ctx.translate(0, 15);
    ctx.rotate(-0.5); 
    ctx.beginPath(); ctx.moveTo(0,0); ctx.lineTo(0, 12); ctx.stroke();
    ctx.restore();

    ctx.restore();
  };

  const draw = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const skyColor = getSkyColor(cycleRef.current);
    ctx.fillStyle = skyColor;
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

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

    ctx.fillStyle = 'rgba(255, 255, 255, 0.6)'; 
    cloudsRef.current.forEach(cloud => {
      ctx.beginPath();
      ctx.arc(cloud.x, cloud.y, 20 * cloud.scale, 0, Math.PI * 2);
      ctx.arc(cloud.x + 15 * cloud.scale, cloud.y - 10 * cloud.scale, 25 * cloud.scale, 0, Math.PI * 2);
      ctx.arc(cloud.x + 35 * cloud.scale, cloud.y, 20 * cloud.scale, 0, Math.PI * 2);
      ctx.fill();
    });

    ctx.beginPath();
    ctx.strokeStyle = '#334155';
    ctx.lineWidth = 2;
    ctx.moveTo(0, GROUND_Y);
    ctx.lineTo(CANVAS_WIDTH, GROUND_Y);
    ctx.stroke();
    
    ctx.fillStyle = '#f1f5f9';
    ctx.fillRect(0, GROUND_Y, CANVAS_WIDTH, CANVAS_HEIGHT - GROUND_Y);

    obstaclesRef.current.forEach(obs => {
      if (obs.type === 'BIRD') {
        drawBird(ctx, obs);
      } else if (obs.type === 'ROCK') {
        drawRock(ctx, obs);
      } else if (obs.type === 'TORII') {
        drawTorii(ctx, obs);
      } else {
        // Dessin par défaut (les Bonsaïs remplacent les cactus)
        drawBonsai(ctx, obs);
      }
    });

    particlesRef.current.forEach(p => {
        if (p.active) {
          ctx.save();
          ctx.globalAlpha = p.life;
          ctx.fillStyle = p.color;
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
        }
    });

    const p = playerRef.current;
    drawBoy(ctx, p.x, p.y, p.isJumping, frameCountRef.current);
  };

  const loop = (time: number) => {
    if (lastTimeRef.current === 0) {
        lastTimeRef.current = time;
    }
    const deltaTime = time - lastTimeRef.current;
    lastTimeRef.current = time;
    
    const dt = Math.min(deltaTime / FRAME_TIME, 4);

    update(dt);
    draw();
    requestRef.current = requestAnimationFrame(loop);
  };

  useEffect(() => {
    requestRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(requestRef.current);
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space' || e.code === 'ArrowUp') {
        e.preventDefault();
        jump();
      }
    };
    
    const handleTouchStart = (e: TouchEvent) => {
       const target = e.target as HTMLElement;
       if (target.tagName !== 'BUTTON') {
          e.preventDefault(); 
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
      <div className="absolute top-4 right-4 flex gap-4 font-mono font-bold text-slate-700 text-lg md:text-xl select-none z-10">
        <div className="flex items-center gap-2 px-2 py-1 bg-white/50 rounded-md backdrop-blur-sm">
           <span className="text-slate-500 text-sm">HI</span> {highScore.toString().padStart(5, '0')}
        </div>
        <div className="px-2 py-1 bg-white/50 rounded-md backdrop-blur-sm">
           {currentScore.toString().padStart(5, '0')}
        </div>
      </div>

      {/* Start Screen Overlay */}
      {displayStatus === GameStatus.START && (
        <div className="absolute inset-0 bg-black/40 backdrop-blur-sm flex flex-col items-center justify-center text-white z-10 p-2">
          <div className="bg-white/95 p-3 md:p-8 rounded-xl md:rounded-2xl shadow-2xl text-slate-800 w-[90%] md:w-auto max-w-md animate-fade-in-up flex flex-col items-center justify-center">
            <h1 className="text-xl md:text-4xl font-extrabold mb-1 md:mb-2 text-blue-600 leading-none">Quentin Qui Court</h1>
            <p className="text-slate-500 mb-2 md:mb-6 text-xs md:text-base leading-tight">Évite les obstacles !</p>
            
            <div className="flex flex-col gap-2 md:gap-4 w-full">
              <button 
                onClick={resetGame}
                className="flex items-center justify-center gap-2 w-full py-2 md:py-4 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold text-sm md:text-lg transition-transform hover:scale-[1.02] active:scale-[0.98]"
              >
                <Play size={16} className="md:w-6 md:h-6" fill="currentColor" />
                JOUER
              </button>
              
              <div className="text-[10px] md:text-sm text-slate-400 mt-1 text-center">
                Appuie pour sauter
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Game Over Overlay */}
      {displayStatus === GameStatus.GAME_OVER && (
        <div className="absolute inset-0 bg-black/50 backdrop-blur-md flex flex-col items-center justify-center text-white z-10 p-2">
           <div className="bg-white/95 p-3 md:p-8 rounded-xl md:rounded-2xl shadow-2xl text-slate-800 w-[90%] md:w-auto max-w-sm text-center transform transition-all scale-100 flex flex-col items-center justify-center">
             <div className="mb-1 text-red-500 font-extrabold text-sm md:text-2xl uppercase tracking-widest leading-none">Game Over</div>
             <div className="text-3xl md:text-5xl font-black text-slate-900 mb-2 md:mb-6 font-mono leading-tight">{currentScore}</div>
             
             {isNewRecord && currentScore > 0 && (
               <div className="mb-2 md:mb-6 flex items-center justify-center gap-2 text-yellow-600 font-bold bg-yellow-100 py-1 px-2 md:py-2 rounded-lg border border-yellow-200 text-xs md:text-base">
                 <Trophy size={14} className="md:w-5 md:h-5" fill="currentColor" /> Nouveau Record !
               </div>
             )}

             <div className="grid grid-cols-2 gap-2 md:gap-3 w-full">
                <button 
                  onClick={resetGame}
                  className="flex flex-col items-center justify-center gap-1 py-1.5 md:py-3 bg-slate-900 hover:bg-slate-800 text-white rounded-xl font-bold transition-colors text-xs md:text-base"
                >
                  <RefreshCw size={16} className="md:w-6 md:h-6" />
                  <span>Rejouer</span>
                </button>
                <button 
                  onClick={handleShare}
                  className={`flex flex-col items-center justify-center gap-1 py-1.5 md:py-3 rounded-xl font-bold transition-all text-xs md:text-base ${copySuccess ? 'bg-green-100 text-green-700' : 'bg-blue-100 hover:bg-blue-200 text-blue-700'}`}
                >
                  {copySuccess ? <Check size={16} className="md:w-6 md:h-6" /> : <Share2 size={16} className="md:w-6 md:h-6" />}
                  <span>{copySuccess ? 'Copié' : 'Partager'}</span>
                </button>
             </div>
           </div>
        </div>
      )}
    </div>
  );
};

export default GameCanvas;