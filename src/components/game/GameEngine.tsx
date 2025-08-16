import { useEffect, useRef, useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';

type GameState = 'start' | 'playing' | 'paused' | 'gameOver';
type Lane = 0 | 1 | 2; // left, center, right

interface Player {
  lane: Lane;
  x: number;
  y: number;
  isJumping: boolean;
  isSliding: boolean;
  jumpHeight: number;
  jumpVelocity: number;
  health: number;
  maxHealth: number;
  isInvulnerable: boolean;
  powerUpActive: boolean;
  powerUpType: 'shield' | 'speed' | 'magnet' | 'health' | null;
  powerUpTimer: number;
}

interface Obstacle {
  id: number;
  lane: Lane;
  x: number;
  y: number;
  width: number;
  height: number;
  type: 'barrier' | 'train' | 'tunnel' | 'spike' | 'laser';
  rotation: number;
  animationFrame: number;
}

interface Coin {
  id: number;
  lane: Lane;
  x: number;
  y: number;
  collected: boolean;
  value: number;
  type: 'normal' | 'gold' | 'diamond';
  rotation: number;
  animationFrame: number;
}

interface PowerUp {
  id: number;
  lane: Lane;
  x: number;
  y: number;
  type: 'shield' | 'speed' | 'magnet' | 'health';
  collected: boolean;
  rotation: number;
  animationFrame: number;
}

interface Particle {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  color: string;
  size: number;
}

const GAME_WIDTH = 900;
const GAME_HEIGHT = 600;
const LANE_WIDTH = GAME_WIDTH / 3;
const PLAYER_WIDTH = 40;
const PLAYER_HEIGHT = 60;
const TRACK_HEIGHT = 600;
const GAME_SPEED = 6;
const JUMP_POWER = 18;
const GRAVITY = 0.9;
const MAX_JUMP_HEIGHT = 120;

export const GameEngine = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const gameLoopRef = useRef<number>();
  const [gameState, setGameState] = useState<GameState>('start');
  const [score, setScore] = useState(0);
  const [coins, setCoins] = useState(0);
  const [highScore, setHighScore] = useState(0);
  const [level, setLevel] = useState(1);
  
  const [player, setPlayer] = useState<Player>({
    lane: 1,
    x: LANE_WIDTH + LANE_WIDTH / 2 - PLAYER_WIDTH / 2,
    y: GAME_HEIGHT - 100, // Player starts at bottom of screen
    isJumping: false,
    isSliding: false,
    jumpHeight: 0,
    jumpVelocity: 0,
    health: 100,
    maxHealth: 100,
    isInvulnerable: false,
    powerUpActive: false,
    powerUpType: null,
    powerUpTimer: 0
  });

  const [obstacles, setObstacles] = useState<Obstacle[]>([]);
  const [gameCoins, setGameCoins] = useState<Coin[]>([]);
  const [powerUps, setPowerUps] = useState<PowerUp[]>([]);
  const [particles, setParticles] = useState<Particle[]>([]);
  
  const obstacleIdRef = useRef(0);
  const coinIdRef = useRef(0);
  const powerUpIdRef = useRef(0);
  const particleIdRef = useRef(0);
  const distanceRef = useRef(0);
  const frameCountRef = useRef(0);

  const createParticle = useCallback((x: number, y: number, color: string, count: number = 5) => {
    const newParticles: Particle[] = [];
    for (let i = 0; i < count; i++) {
      newParticles.push({
        id: particleIdRef.current++,
        x,
        y,
        vx: (Math.random() - 0.5) * 8,
        vy: (Math.random() - 0.5) * 8,
        life: 1,
        maxLife: 1,
        color,
        size: Math.random() * 3 + 2
      });
    }
    setParticles(prev => [...prev, ...newParticles]);
  }, []);

  const drawGame = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Clear canvas
    ctx.clearRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

    // Draw animated background
    const time = frameCountRef.current * 0.02;
    const gradient = ctx.createLinearGradient(0, 0, 0, GAME_HEIGHT);
    gradient.addColorStop(0, `hsl(${240 + Math.sin(time) * 10}, 100%, 8%)`);
    gradient.addColorStop(1, `hsl(${270 + Math.cos(time) * 15}, 80%, 15%)`);
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

    // Draw moving stars
    ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
    for (let i = 0; i < 50; i++) {
      const x = (i * 37) % GAME_WIDTH;
      const y = (i * 73 + time * 20) % GAME_HEIGHT;
      const size = Math.sin(time + i) * 0.5 + 1;
      ctx.beginPath();
      ctx.arc(x, y, size, 0, Math.PI * 2);
      ctx.fill();
    }

    // Draw track with perspective effect
    const trackY = GAME_HEIGHT - TRACK_HEIGHT;
    const trackGradient = ctx.createLinearGradient(0, trackY, 0, GAME_HEIGHT);
    trackGradient.addColorStop(0, 'hsl(240, 30%, 12%)');
    trackGradient.addColorStop(0.5, 'hsl(240, 40%, 10%)');
    trackGradient.addColorStop(1, 'hsl(240, 50%, 8%)');
    ctx.fillStyle = trackGradient;
    ctx.fillRect(0, trackY, GAME_WIDTH, TRACK_HEIGHT);

    // Draw track border with glow
    ctx.strokeStyle = 'hsl(240, 50%, 25%)';
    ctx.lineWidth = 3;
    ctx.shadowColor = 'hsl(240, 50%, 25%)';
    ctx.shadowBlur = 10;
    ctx.beginPath();
    ctx.moveTo(0, trackY);
    ctx.lineTo(GAME_WIDTH, trackY);
    ctx.stroke();
    ctx.shadowBlur = 0;

    // Draw lane divider lines with animation
    ctx.strokeStyle = 'hsl(240, 50%, 30%)';
    ctx.lineWidth = 2;
    ctx.setLineDash([30, 15]);
    ctx.lineDashOffset = -time * 2;
    
    for (let i = 1; i < 3; i++) {
      ctx.beginPath();
      ctx.moveTo(i * LANE_WIDTH, trackY + 20);
      ctx.lineTo(i * LANE_WIDTH, GAME_HEIGHT - 20);
      ctx.stroke();
    }
    ctx.setLineDash([]);

    // Draw particles
    particles.forEach(particle => {
      ctx.globalAlpha = particle.life;
      ctx.fillStyle = particle.color;
      ctx.beginPath();
      ctx.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.globalAlpha = 1;

    // Draw power-ups
    powerUps.forEach(powerUp => {
      if (!powerUp.collected) {
        const colors = {
          shield: 'hsl(195, 100%, 55%)',
          speed: 'hsl(120, 100%, 50%)',
          magnet: 'hsl(45, 100%, 60%)',
          health: 'hsl(0, 100%, 50%)'
        };
        
        ctx.save();
        ctx.translate(powerUp.x + 20, powerUp.y + 20);
        ctx.rotate(powerUp.rotation);
        
        // Draw power-up icon
        ctx.fillStyle = colors[powerUp.type];
        ctx.shadowColor = colors[powerUp.type];
        ctx.shadowBlur = 20;
        
        if (powerUp.type === 'shield') {
          ctx.beginPath();
          ctx.arc(0, 0, 20, 0, Math.PI * 2);
          ctx.fill();
          ctx.strokeStyle = 'white';
          ctx.lineWidth = 3;
          ctx.stroke();
        } else if (powerUp.type === 'speed') {
          ctx.fillRect(-15, -15, 30, 30);
        } else if (powerUp.type === 'magnet') {
          ctx.beginPath();
          ctx.moveTo(-15, 15);
          ctx.lineTo(0, -15);
          ctx.lineTo(15, 15);
          ctx.closePath();
          ctx.fill();
        } else if (powerUp.type === 'health') {
          ctx.beginPath();
          ctx.moveTo(0, -15);
          ctx.lineTo(10, -5);
          ctx.lineTo(15, 0);
          ctx.lineTo(10, 5);
          ctx.lineTo(0, 15);
          ctx.lineTo(-10, 5);
          ctx.lineTo(-15, 0);
          ctx.lineTo(-10, -5);
          ctx.closePath();
          ctx.fill();
        }
        
        ctx.shadowBlur = 0;
        ctx.restore();
      }
    });

    // Draw obstacles with enhanced graphics
    obstacles.forEach(obstacle => {
      ctx.save();
      ctx.translate(obstacle.x + obstacle.width / 2, obstacle.y + obstacle.height / 2);
      ctx.rotate(obstacle.rotation);
      
      let color = 'hsl(0, 84%, 60%)';
      let shadowColor = 'hsl(0, 84%, 60%)';
      
      if (obstacle.type === 'train') {
        color = 'hsl(240, 50%, 30%)';
        shadowColor = 'hsl(240, 50%, 30%)';
      } else if (obstacle.type === 'tunnel') {
        color = 'hsl(30, 80%, 40%)';
        shadowColor = 'hsl(30, 80%, 40%)';
      } else if (obstacle.type === 'spike') {
        color = 'hsl(0, 100%, 40%)';
        shadowColor = 'hsl(0, 100%, 40%)';
      } else if (obstacle.type === 'laser') {
        color = 'hsl(0, 100%, 60%)';
        shadowColor = 'hsl(0, 100%, 60%)';
      }
      
      ctx.fillStyle = color;
      ctx.shadowColor = shadowColor;
      ctx.shadowBlur = 15;
      
      if (obstacle.type === 'spike') {
        ctx.beginPath();
        ctx.moveTo(0, -obstacle.height / 2);
        ctx.lineTo(-obstacle.width / 2, obstacle.height / 2);
        ctx.lineTo(obstacle.width / 2, obstacle.height / 2);
        ctx.closePath();
        ctx.fill();
      } else if (obstacle.type === 'laser') {
        ctx.fillRect(-obstacle.width / 2, -obstacle.height / 2, obstacle.width, obstacle.height);
        // Add laser beam effect
        ctx.strokeStyle = 'hsl(0, 100%, 80%)';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(-obstacle.width / 2, 0);
        ctx.lineTo(obstacle.width / 2, 0);
        ctx.stroke();
      } else {
        ctx.fillRect(-obstacle.width / 2, -obstacle.height / 2, obstacle.width, obstacle.height);
      }
      
      ctx.shadowBlur = 0;
      ctx.restore();
    });

    // Draw coins with enhanced graphics
    gameCoins.forEach(coin => {
      if (!coin.collected) {
        ctx.save();
        ctx.translate(coin.x + 15, coin.y + 15);
        ctx.rotate(coin.rotation);
        
        let color = 'hsl(45, 100%, 60%)';
        let size = 15;
        
        if (coin.type === 'gold') {
          color = 'hsl(45, 100%, 50%)';
          size = 18;
        } else if (coin.type === 'diamond') {
          color = 'hsl(195, 100%, 70%)';
          size = 20;
        }
        
        ctx.fillStyle = color;
        ctx.shadowColor = color;
        ctx.shadowBlur = 20;
        ctx.beginPath();
        ctx.arc(0, 0, size, 0, Math.PI * 2);
        ctx.fill();
        
        // Add shine effect
        ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
        ctx.beginPath();
        ctx.arc(-size * 0.3, -size * 0.3, size * 0.3, 0, Math.PI * 2);
        ctx.fill();
        
        ctx.shadowBlur = 0;
        ctx.restore();
      }
    });

    // Draw player with enhanced graphics
    const playerY = player.y - player.jumpHeight + (player.isSliding ? 20 : 0); // Player is at bottom, jumping reduces Y
    const playerHeight = player.isSliding ? PLAYER_HEIGHT * 0.6 : PLAYER_HEIGHT;
    
    ctx.save();
    ctx.translate(player.x + PLAYER_WIDTH / 2, playerY + playerHeight / 2);
    
    // Player glow effect
    if (player.powerUpActive) {
      const glowColors = {
        shield: 'hsl(195, 100%, 55%)',
        speed: 'hsl(120, 100%, 50%)',
        magnet: 'hsl(45, 100%, 60%)'
      };
      
      if (player.powerUpType && glowColors[player.powerUpType]) {
        ctx.shadowColor = glowColors[player.powerUpType];
        ctx.shadowBlur = 30;
      }
    }
    
    // Player body
    ctx.fillStyle = 'hsl(270, 100%, 65%)';
    ctx.fillRect(-PLAYER_WIDTH / 2, -playerHeight / 2, PLAYER_WIDTH, playerHeight);
    
    // Player details
    ctx.fillStyle = 'hsl(270, 100%, 45%)';
    ctx.fillRect(-PLAYER_WIDTH / 2 + 5, -playerHeight / 2 + 5, PLAYER_WIDTH - 10, 10);
    
    // Eyes
    ctx.fillStyle = 'white';
    ctx.beginPath();
    ctx.arc(-8, -playerHeight / 2 + 15, 4, 0, Math.PI * 2);
    ctx.arc(8, -playerHeight / 2 + 15, 4, 0, Math.PI * 2);
    ctx.fill();
    
    ctx.fillStyle = 'black';
    ctx.beginPath();
    ctx.arc(-8, -playerHeight / 2 + 15, 2, 0, Math.PI * 2);
    ctx.arc(8, -playerHeight / 2 + 15, 2, 0, Math.PI * 2);
    ctx.fill();
    
    ctx.shadowBlur = 0;
    ctx.restore();

    // Draw health bar
    if (gameState === 'playing') {
      const barWidth = 200;
      const barHeight = 20;
      const barX = 20;
      const barY = 20;
      
      // Background
      ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
      ctx.fillRect(barX, barY, barWidth, barHeight);
      
      // Health bar
      const healthPercent = player.health / player.maxHealth;
      const healthColor = healthPercent > 0.6 ? 'hsl(120, 100%, 50%)' : 
                         healthPercent > 0.3 ? 'hsl(45, 100%, 50%)' : 'hsl(0, 100%, 50%)';
      
      ctx.fillStyle = healthColor;
      ctx.fillRect(barX + 2, barY + 2, (barWidth - 4) * healthPercent, barHeight - 4);
      
      // Border
      ctx.strokeStyle = 'white';
      ctx.lineWidth = 2;
      ctx.strokeRect(barX, barY, barWidth, barHeight);
    }
  }, [player, obstacles, gameCoins, powerUps, particles]);

  const drawLogo = useCallback((ctx: CanvasRenderingContext2D, x: number, y: number, size: number) => {
    ctx.save();
    ctx.translate(x, y);
    
    // Logo background circle with glow
    const gradient = ctx.createRadialGradient(0, 0, 0, 0, 0, size);
    gradient.addColorStop(0, 'hsl(270, 100%, 75%)');
    gradient.addColorStop(0.7, 'hsl(270, 100%, 55%)');
    gradient.addColorStop(1, 'hsl(270, 100%, 35%)');
    
    ctx.shadowColor = 'hsl(270, 100%, 65%)';
    ctx.shadowBlur = 20;
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(0, 0, size, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
    
    // Inner circle
    ctx.fillStyle = 'hsl(270, 100%, 85%)';
    ctx.beginPath();
    ctx.arc(0, 0, size * 0.7, 0, Math.PI * 2);
    ctx.fill();
    
    // Runner figure
    ctx.fillStyle = 'hsl(270, 100%, 25%)';
    
    // Head
    ctx.beginPath();
    ctx.arc(0, -size * 0.3, size * 0.15, 0, Math.PI * 2);
    ctx.fill();
    
    // Body
    ctx.fillRect(-size * 0.1, -size * 0.1, size * 0.2, size * 0.4);
    
    // Arms (running pose)
    ctx.save();
    ctx.translate(-size * 0.15, -size * 0.05);
    ctx.rotate(Math.sin(frameCountRef.current * 0.1) * 0.3);
    ctx.fillRect(-size * 0.05, -size * 0.15, size * 0.1, size * 0.3);
    ctx.restore();
    
    ctx.save();
    ctx.translate(size * 0.15, -size * 0.05);
    ctx.rotate(-Math.sin(frameCountRef.current * 0.1) * 0.3);
    ctx.fillRect(-size * 0.05, -size * 0.15, size * 0.1, size * 0.3);
    ctx.restore();
    
    // Legs (running pose)
    ctx.save();
    ctx.translate(-size * 0.08, size * 0.15);
    ctx.rotate(Math.sin(frameCountRef.current * 0.1 + 1) * 0.4);
    ctx.fillRect(-size * 0.06, -size * 0.25, size * 0.12, size * 0.25);
    ctx.restore();
    
    ctx.save();
    ctx.translate(size * 0.08, size * 0.15);
    ctx.rotate(-Math.sin(frameCountRef.current * 0.1 + 1) * 0.4);
    ctx.fillRect(-size * 0.06, -size * 0.25, size * 0.12, size * 0.25);
    ctx.restore();
    
    // Speed lines
    ctx.strokeStyle = 'hsl(270, 100%, 75%)';
    ctx.lineWidth = 2;
    ctx.setLineDash([5, 5]);
    
    for (let i = 0; i < 3; i++) {
      ctx.beginPath();
      ctx.moveTo(-size * 0.8 + i * size * 0.1, -size * 0.3 + i * size * 0.1);
      ctx.lineTo(-size * 1.2 + i * size * 0.1, -size * 0.1 + i * size * 0.1);
      ctx.stroke();
    }
    
    ctx.setLineDash([]);
    
    ctx.restore();
  }, []);

  const spawnObstacle = useCallback(() => {
    const lane = Math.floor(Math.random() * 3) as Lane;
    const obstacleTypes: Obstacle['type'][] = ['barrier', 'train', 'tunnel', 'spike', 'laser'];
    const type = obstacleTypes[Math.floor(Math.random() * obstacleTypes.length)];
    
    let width = 60;
    let height = 80;
    
    if (type === 'spike') {
      width = 40;
      height = 60;
    } else if (type === 'laser') {
      width = 80;
      height = 20;
    }
    
    const obstacle: Obstacle = {
      id: obstacleIdRef.current++,
      lane,
      x: lane * LANE_WIDTH + LANE_WIDTH / 2 - width / 2,
      y: 50, // Obstacles spawn at top of screen
      width,
      height,
      type,
      rotation: 0,
      animationFrame: 0
    };
    setObstacles(prev => [...prev, obstacle]);
  }, []);

  const spawnCoin = useCallback(() => {
    const lane = Math.floor(Math.random() * 3) as Lane;
    const coinTypes: Coin['type'][] = ['normal', 'gold', 'diamond'];
    const type = coinTypes[Math.floor(Math.random() * coinTypes.length)];
    
    const coin: Coin = {
      id: coinIdRef.current++,
      lane,
      x: lane * LANE_WIDTH + LANE_WIDTH / 2 - 15,
      y: 30, // Coins spawn at top of screen
      collected: false,
      value: type === 'normal' ? 1 : type === 'gold' ? 5 : 10,
      type,
      rotation: 0,
      animationFrame: 0
    };
    setGameCoins(prev => [...prev, coin]);
  }, []);

  const spawnPowerUp = useCallback(() => {
    const lane = Math.floor(Math.random() * 3) as Lane;
    const powerUpTypes: PowerUp['type'][] = ['shield', 'speed', 'magnet', 'health'];
    const type = powerUpTypes[Math.floor(Math.random() * powerUpTypes.length)];
    
    const powerUp: PowerUp = {
      id: powerUpIdRef.current++,
      lane,
      x: lane * LANE_WIDTH + LANE_WIDTH / 2 - 20,
      y: 30, // Power-ups spawn at top of screen
      type,
      collected: false,
      rotation: 0,
      animationFrame: 0
    };
    setPowerUps(prev => [...prev, powerUp]);
  }, []);

  const checkCollisions = useCallback(() => {
    if (player.isInvulnerable) return;
    
    const playerRect = {
      x: player.x,
      y: player.y - player.jumpHeight + (player.isSliding ? 20 : 0), // Player is at bottom, jumping reduces Y position
      width: PLAYER_WIDTH,
      height: player.isSliding ? PLAYER_HEIGHT * 0.6 : PLAYER_HEIGHT
    };

    // Check obstacle collisions
    for (const obstacle of obstacles) {
      if (obstacle.x < playerRect.x + playerRect.width &&
          obstacle.x + obstacle.width > playerRect.x &&
          obstacle.y < playerRect.y + playerRect.height &&
          obstacle.y + obstacle.height > playerRect.y) {
        
        if (player.powerUpActive && player.powerUpType === 'shield') {
          // Shield protects from damage
          createParticle(player.x + PLAYER_WIDTH / 2, player.y, 'hsl(195, 100%, 55%)', 10);
          return;
        }
        
        // Take damage
        setPlayer(prev => ({
          ...prev,
          health: Math.max(0, prev.health - 25),
          isInvulnerable: true
        }));
        
        createParticle(player.x + PLAYER_WIDTH / 2, player.y, 'hsl(0, 100%, 50%)', 15);
        
        // Check if player dies
        if (player.health <= 25) {
          setGameState('gameOver');
          if (score > highScore) {
            setHighScore(score);
          }
          return;
        }
        
        // Invulnerability period
        setTimeout(() => {
          setPlayer(prev => ({ ...prev, isInvulnerable: false }));
        }, 2000);
        
        return;
      }
    }

    // Check coin collections
    setGameCoins(prev => prev.map(coin => {
      if (!coin.collected &&
          coin.x < playerRect.x + playerRect.width &&
          coin.x + 30 > playerRect.x &&
          coin.y < playerRect.y + playerRect.height &&
          coin.y + 30 > playerRect.y) {
        
        const coinValue = coin.value;
        setCoins(c => c + coinValue);
        createParticle(coin.x + 15, coin.y + 15, 'hsl(45, 100%, 60%)', 8);
        return { ...coin, collected: true };
      }
      return coin;
    }));

    // Check power-up collections
    setPowerUps(prev => prev.map(powerUp => {
      if (!powerUp.collected &&
          powerUp.x < playerRect.x + PLAYER_WIDTH &&
          powerUp.x + 40 > playerRect.x &&
          powerUp.y < playerRect.y + playerRect.height &&
          powerUp.y + 40 > playerRect.y) {
        
        setPlayer(prev => ({
          ...prev,
          powerUpActive: true,
          powerUpType: powerUp.type,
          powerUpTimer: 10000, // 10 seconds
          health: powerUp.type === 'health' ? Math.min(prev.maxHealth, prev.health + 25) : prev.health
        }));
        
        createParticle(powerUp.x + 20, powerUp.y + 20, 'hsl(195, 100%, 55%)', 12);
        return { ...powerUp, collected: true };
      }
      return powerUp;
    }));
  }, [player, obstacles, highScore, score, createParticle]);

  const gameLoop = useCallback(() => {
    if (gameState !== 'playing') return;

    frameCountRef.current++;

    // Update player physics
    setPlayer(prev => {
      const newPlayer = { ...prev };
      
      if (newPlayer.isJumping) {
        newPlayer.jumpVelocity += JUMP_POWER;
        newPlayer.jumpHeight += newPlayer.jumpVelocity;
        if (newPlayer.jumpHeight >= MAX_JUMP_HEIGHT) {
          newPlayer.isJumping = false;
          newPlayer.jumpVelocity = 0;
        }
      } else if (newPlayer.jumpHeight > 0) {
        newPlayer.jumpHeight -= GRAVITY;
        if (newPlayer.jumpHeight <= 0) {
          newPlayer.jumpHeight = 0;
          newPlayer.jumpVelocity = 0;
        }
      }

      // Update power-up timer
      if (newPlayer.powerUpActive && newPlayer.powerUpTimer > 0) {
        newPlayer.powerUpTimer -= 16; // Assuming 60fps
        if (newPlayer.powerUpTimer <= 0) {
          newPlayer.powerUpActive = false;
          newPlayer.powerUpType = null;
        }
      }

      return newPlayer;
    });

    // Update obstacles
    setObstacles(prev => prev
      .map(obstacle => ({
        ...obstacle,
        y: obstacle.y + GAME_SPEED, // This now moves obstacles downward
        rotation: obstacle.rotation + 0.02,
        animationFrame: obstacle.animationFrame + 1
      }))
      .filter(obstacle => obstacle.y < GAME_HEIGHT + 100) // Remove obstacles that go below screen
    );

    // Update coins
    setGameCoins(prev => prev
      .map(coin => ({
        ...coin,
        y: coin.y + GAME_SPEED, // This now moves coins downward
        rotation: coin.rotation + 0.05,
        animationFrame: coin.animationFrame + 1
      }))
      .filter(coin => coin.y < GAME_HEIGHT + 50) // Remove coins that go below screen
    );

    // Update power-ups
    setPowerUps(prev => prev
      .map(powerUp => ({
        ...powerUp,
        y: powerUp.y + GAME_SPEED, // This now moves power-ups downward
        rotation: powerUp.rotation + 0.03,
        animationFrame: powerUp.animationFrame + 1
      }))
      .filter(powerUp => powerUp.y < GAME_HEIGHT + 50) // Remove power-ups that go below screen
    );

    // Update particles
    setParticles(prev => prev
      .map(particle => ({
        ...particle,
        x: particle.x + particle.vx,
        y: particle.y + particle.vy,
        life: particle.life - 0.02,
        vy: particle.vy + 0.1 // gravity
      }))
      .filter(particle => particle.life > 0)
    );

    // Spawn obstacles and collectibles
    distanceRef.current += GAME_SPEED;
    if (distanceRef.current % 100 === 0) {
      spawnObstacle();
    }
    if (distanceRef.current % 150 === 0) {
      spawnCoin();
    }
    if (distanceRef.current % 300 === 0) {
      spawnPowerUp();
    }

    // Update score and level
    const newScore = Math.floor(distanceRef.current / 10);
    setScore(newScore);
    
    const newLevel = Math.floor(newScore / 100) + 1;
    if (newLevel !== level) {
      setLevel(newLevel);
    }

    checkCollisions();
    drawGame();

    gameLoopRef.current = requestAnimationFrame(gameLoop);
  }, [gameState, spawnObstacle, spawnCoin, spawnPowerUp, checkCollisions, drawGame, level]);

  const startGame = () => {
    setGameState('playing');
    setScore(0);
    setCoins(0);
    setLevel(1);
    distanceRef.current = 0;
    frameCountRef.current = 0;
    setObstacles([]);
    setGameCoins([]);
    setPowerUps([]);
    setParticles([]);
    setPlayer({
      lane: 1,
      x: LANE_WIDTH + LANE_WIDTH / 2 - PLAYER_WIDTH / 2,
      y: GAME_HEIGHT - 100, // Player starts at bottom of screen
      isJumping: false,
      isSliding: false,
      jumpHeight: 0,
      jumpVelocity: 0,
      health: 100,
      maxHealth: 100,
      isInvulnerable: false,
      powerUpActive: false,
      powerUpType: null,
      powerUpTimer: 0
    });
  };

  const resetGame = () => {
    setGameState('start');
    if (gameLoopRef.current) {
      cancelAnimationFrame(gameLoopRef.current);
    }
  };

  const togglePause = () => {
    if (gameState === 'playing') {
      setGameState('paused');
    } else if (gameState === 'paused') {
      setGameState('playing');
    }
  };

  const handleKeyPress = useCallback((event: KeyboardEvent) => {
    if (gameState === 'start') {
      if (event.key === ' ') {
        startGame();
        event.preventDefault();
      }
      return;
    }

    if (gameState === 'gameOver') {
      if (event.key === ' ') {
        startGame();
        event.preventDefault();
      }
      return;
    }

    if (gameState === 'paused') {
      if (event.key === ' ') {
        setGameState('playing');
        event.preventDefault();
      }
      return;
    }

    if (gameState !== 'playing') return;

    setPlayer(prev => {
      let newPlayer = { ...prev };
      
      switch (event.key) {
        case 'ArrowLeft':
        case 'a':
        case 'A':
          if (newPlayer.lane > 0) {
            newPlayer.lane = (newPlayer.lane - 1) as Lane;
            newPlayer.x = newPlayer.lane * LANE_WIDTH + LANE_WIDTH / 2 - PLAYER_WIDTH / 2;
          }
          break;
        case 'ArrowRight':
        case 'd':
        case 'D':
          if (newPlayer.lane < 2) {
            newPlayer.lane = (newPlayer.lane + 1) as Lane;
            newPlayer.x = newPlayer.lane * LANE_WIDTH + LANE_WIDTH / 2 - PLAYER_WIDTH / 2;
          }
          break;
        case ' ':
        case 'ArrowUp':
        case 'w':
        case 'W':
          if (newPlayer.jumpHeight === 0) {
            newPlayer.isJumping = true;
            newPlayer.jumpVelocity = 0;
          }
          event.preventDefault();
          break;
        case 'ArrowDown':
        case 's':
        case 'S':
          newPlayer.isSliding = true;
          setTimeout(() => {
            setPlayer(p => ({ ...p, isSliding: false }));
          }, 500);
          break;
        case 'p':
        case 'P':
        case 'Escape':
          togglePause();
          event.preventDefault();
          break;
      }
      
      return newPlayer;
    });
  }, [gameState]);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [handleKeyPress]);

  useEffect(() => {
    if (gameState === 'playing') {
      gameLoopRef.current = requestAnimationFrame(gameLoop);
    } else if (gameLoopRef.current) {
      cancelAnimationFrame(gameLoopRef.current);
    }

    return () => {
      if (gameLoopRef.current) {
        cancelAnimationFrame(gameLoopRef.current);
      }
    };
  }, [gameState, gameLoop]);

  useEffect(() => {
    drawGame();
  }, [drawGame]);

  return (
    <div className="game-container">
      <canvas
        ref={canvasRef}
        width={GAME_WIDTH}
        height={GAME_HEIGHT}
        className="game-canvas"
        style={{
          imageRendering: 'crisp-edges'
        }}
      />
      
      <div className="game-ui">
        {gameState === 'playing' && (
          <div className="game-score">
            <div className="text-3xl font-bold mb-2">Level {level}</div>
            <div className="text-2xl mb-1">Distance: {score}m</div>
            <div className="text-xl text-game-coin">Coins: {coins}</div>
            <div className="text-lg text-muted-foreground">High Score: {highScore}m</div>
          </div>
        )}

        {gameState === 'start' && (
          <div className="game-menu">
            <div className="logo-container mb-6">
              <canvas
                width={120}
                height={120}
                className="game-logo"
                ref={(canvas) => {
                  if (canvas) {
                    const ctx = canvas.getContext('2d');
                    if (ctx) {
                      drawLogo(ctx, 60, 60, 50);
                    }
                  }
                }}
              />
            </div>
            <h1 className="game-title">Lane Leaper Runner</h1>
            <p className="game-instructions">
              <strong>Controls:</strong><br />
              WASD or Arrow Keys to move and jump<br />
              Space to jump • S/Down to slide<br />
              P or Escape to pause<br />
              Collect coins, power-ups, and avoid obstacles!
            </p>
            <div className="text-lg text-muted-foreground mb-6">
              <div className="mb-2">🎯 Normal Coins: 1 point</div>
              <div className="mb-2">🥇 Gold Coins: 5 points</div>
              <div className="mb-2">💎 Diamond Coins: 10 points</div>
              <div className="mb-2">🛡️ Shield: Protects from damage</div>
              <div className="mb-2">⚡ Speed: Temporary speed boost</div>
              <div className="mb-2">🧲 Magnet: Attracts nearby coins</div>
              <div className="mb-2">❤️ Health: Restores health</div>
            </div>
            <Button onClick={startGame} className="game-button">
              Start Running!
            </Button>
          </div>
        )}

        {gameState === 'paused' && (
          <div className="game-menu">
            <h2 className="text-4xl font-bold mb-4">Game Paused</h2>
            <p className="text-lg mb-6">Press Space or P to resume</p>
            <div className="flex gap-4">
              <Button onClick={() => setGameState('playing')} className="game-button">
                Resume
              </Button>
              <Button onClick={resetGame} variant="outline" className="game-button">
                Main Menu
              </Button>
            </div>
          </div>
        )}

        {gameState === 'gameOver' && (
          <div className="game-menu">
            <h2 className="text-4xl font-bold mb-4 text-destructive">Game Over!</h2>
            <div className="text-2xl mb-2">Final Distance: {score}m</div>
            <div className="text-xl mb-2 text-game-coin">Coins Collected: {coins}</div>
            <div className="text-lg mb-2">Level Reached: {level}</div>
            {score > highScore && (
              <div className="text-2xl mb-4 text-game-success">🎉 New High Score! 🎉</div>
            )}
            <div className="flex gap-4">
              <Button onClick={startGame} className="game-button">
                Try Again
              </Button>
              <Button onClick={resetGame} variant="outline" className="game-button">
                Main Menu
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
