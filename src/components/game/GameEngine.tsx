import { useEffect, useRef, useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';

type GameState = 'start' | 'playing' | 'gameOver';
type Lane = 0 | 1 | 2; // left, center, right

interface Player {
  lane: Lane;
  x: number;
  y: number;
  isJumping: boolean;
  isSliding: boolean;
  jumpHeight: number;
}

interface Obstacle {
  id: number;
  lane: Lane;
  x: number;
  y: number;
  width: number;
  height: number;
  type: 'barrier' | 'train' | 'tunnel';
}

interface Coin {
  id: number;
  lane: Lane;
  x: number;
  y: number;
  collected: boolean;
}

const GAME_WIDTH = 800;
const GAME_HEIGHT = 600;
const LANE_WIDTH = GAME_WIDTH / 3;
const PLAYER_WIDTH = 40;
const PLAYER_HEIGHT = 60;
const TRACK_HEIGHT = 200;
const GAME_SPEED = 5;
const JUMP_POWER = 15;
const GRAVITY = 0.8;

export const GameEngine = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const gameLoopRef = useRef<number>();
  const [gameState, setGameState] = useState<GameState>('start');
  const [score, setScore] = useState(0);
  const [coins, setCoins] = useState(0);
  
  const [player, setPlayer] = useState<Player>({
    lane: 1,
    x: LANE_WIDTH + LANE_WIDTH / 2 - PLAYER_WIDTH / 2,
    y: GAME_HEIGHT - TRACK_HEIGHT + 50,
    isJumping: false,
    isSliding: false,
    jumpHeight: 0
  });

  const [obstacles, setObstacles] = useState<Obstacle[]>([]);
  const [gameCoins, setGameCoins] = useState<Coin[]>([]);
  const obstacleIdRef = useRef(0);
  const coinIdRef = useRef(0);
  const distanceRef = useRef(0);

  const drawGame = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Clear canvas
    ctx.clearRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

    // Draw background gradient
    const gradient = ctx.createLinearGradient(0, 0, 0, GAME_HEIGHT);
    gradient.addColorStop(0, 'hsl(240, 100%, 8%)');
    gradient.addColorStop(1, 'hsl(270, 80%, 15%)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

    // Draw track
    const trackY = GAME_HEIGHT - TRACK_HEIGHT;
    const trackGradient = ctx.createLinearGradient(0, trackY, 0, GAME_HEIGHT);
    trackGradient.addColorStop(0, 'hsl(240, 30%, 12%)');
    trackGradient.addColorStop(1, 'hsl(240, 50%, 8%)');
    ctx.fillStyle = trackGradient;
    ctx.fillRect(0, trackY, GAME_WIDTH, TRACK_HEIGHT);

    // Draw track border
    ctx.strokeStyle = 'hsl(240, 50%, 25%)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(0, trackY);
    ctx.lineTo(GAME_WIDTH, trackY);
    ctx.stroke();
    // Draw lane divider lines
    ctx.strokeStyle = 'hsl(240, 50%, 30%)';
    ctx.lineWidth = 2;
    ctx.setLineDash([30, 15]);
    
    for (let i = 1; i < 3; i++) {
      ctx.beginPath();
      ctx.moveTo(i * LANE_WIDTH, trackY + 20);
      ctx.lineTo(i * LANE_WIDTH, GAME_HEIGHT - 20);
      ctx.stroke();
    }
    ctx.setLineDash([]);

    // Draw obstacles
    obstacles.forEach(obstacle => {
      ctx.fillStyle = 'hsl(0, 84%, 60%)';
      ctx.shadowColor = 'hsl(0, 84%, 60%)';
      ctx.shadowBlur = 15;
      ctx.fillRect(obstacle.x, obstacle.y, obstacle.width, obstacle.height);
      ctx.shadowBlur = 0;
    });

    // Draw coins
    gameCoins.forEach(coin => {
      if (!coin.collected) {
        ctx.fillStyle = 'hsl(45, 100%, 60%)';
        ctx.shadowColor = 'hsl(45, 100%, 60%)';
        ctx.shadowBlur = 20;
        ctx.beginPath();
        ctx.arc(coin.x + 15, coin.y + 15, 15, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
      }
    });

    // Draw player
    const playerY = player.y - player.jumpHeight + (player.isSliding ? 20 : 0);
    const playerHeight = player.isSliding ? PLAYER_HEIGHT * 0.6 : PLAYER_HEIGHT;
    
    ctx.fillStyle = 'hsl(270, 100%, 65%)';
    ctx.shadowColor = 'hsl(270, 100%, 65%)';
    ctx.shadowBlur = 20;
    ctx.fillRect(player.x, playerY, PLAYER_WIDTH, playerHeight);
    ctx.shadowBlur = 0;

    // Draw player glow effect
    ctx.fillStyle = 'hsl(270, 100%, 65%, 0.3)';
    ctx.fillRect(player.x - 5, playerY - 5, PLAYER_WIDTH + 10, playerHeight + 10);
  }, [player, obstacles, gameCoins]);

  const spawnObstacle = useCallback(() => {
    const lane = Math.floor(Math.random() * 3) as Lane;
    const obstacle: Obstacle = {
      id: obstacleIdRef.current++,
      lane,
      x: lane * LANE_WIDTH + LANE_WIDTH / 2 - 30,
      y: GAME_HEIGHT - TRACK_HEIGHT + 50,
      width: 60,
      height: 80,
      type: 'barrier'
    };
    setObstacles(prev => [...prev, obstacle]);
  }, []);

  const spawnCoin = useCallback(() => {
    const lane = Math.floor(Math.random() * 3) as Lane;
    const coin: Coin = {
      id: coinIdRef.current++,
      lane,
      x: lane * LANE_WIDTH + LANE_WIDTH / 2 - 15,
      y: GAME_HEIGHT - TRACK_HEIGHT + 30,
      collected: false
    };
    setGameCoins(prev => [...prev, coin]);
  }, []);

  const checkCollisions = useCallback(() => {
    const playerRect = {
      x: player.x,
      y: player.y - player.jumpHeight + (player.isSliding ? 20 : 0),
      width: PLAYER_WIDTH,
      height: player.isSliding ? PLAYER_HEIGHT * 0.6 : PLAYER_HEIGHT
    };

    // Check obstacle collisions
    for (const obstacle of obstacles) {
      if (obstacle.x < playerRect.x + playerRect.width &&
          obstacle.x + obstacle.width > playerRect.x &&
          obstacle.y < playerRect.y + playerRect.height &&
          obstacle.y + obstacle.height > playerRect.y) {
        setGameState('gameOver');
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
        setCoins(c => c + 1);
        return { ...coin, collected: true };
      }
      return coin;
    }));
  }, [player, obstacles]);

  const gameLoop = useCallback(() => {
    if (gameState !== 'playing') return;

    // Update player physics
    setPlayer(prev => {
      let newPlayer = { ...prev };
      
      if (newPlayer.isJumping) {
        newPlayer.jumpHeight += JUMP_POWER;
        if (newPlayer.jumpHeight >= 100) {
          newPlayer.isJumping = false;
        }
      } else if (newPlayer.jumpHeight > 0) {
        newPlayer.jumpHeight -= GRAVITY;
        if (newPlayer.jumpHeight <= 0) {
          newPlayer.jumpHeight = 0;
        }
      }

      return newPlayer;
    });

    // Update obstacles
    setObstacles(prev => prev
      .map(obstacle => ({ ...obstacle, y: obstacle.y + GAME_SPEED }))
      .filter(obstacle => obstacle.y < GAME_HEIGHT + 100)
    );

    // Update coins
    setGameCoins(prev => prev
      .map(coin => ({ ...coin, y: coin.y + GAME_SPEED }))
      .filter(coin => coin.y < GAME_HEIGHT + 50)
    );

    // Spawn obstacles and coins
    distanceRef.current += GAME_SPEED;
    if (distanceRef.current % 120 === 0) {
      spawnObstacle();
    }
    if (distanceRef.current % 180 === 0) {
      spawnCoin();
    }

    // Update score
    setScore(Math.floor(distanceRef.current / 10));

    checkCollisions();
    drawGame();

    gameLoopRef.current = requestAnimationFrame(gameLoop);
  }, [gameState, spawnObstacle, spawnCoin, checkCollisions, drawGame]);

  const startGame = () => {
    setGameState('playing');
    setScore(0);
    setCoins(0);
    distanceRef.current = 0;
    setObstacles([]);
    setGameCoins([]);
    setPlayer({
      lane: 1,
      x: LANE_WIDTH + LANE_WIDTH / 2 - PLAYER_WIDTH / 2,
      y: GAME_HEIGHT - TRACK_HEIGHT + 50,
      isJumping: false,
      isSliding: false,
      jumpHeight: 0
    });
  };

  const resetGame = () => {
    setGameState('start');
    if (gameLoopRef.current) {
      cancelAnimationFrame(gameLoopRef.current);
    }
  };

  const handleKeyPress = useCallback((event: KeyboardEvent) => {
    if (gameState !== 'playing') return;

    setPlayer(prev => {
      let newPlayer = { ...prev };
      
      switch (event.key) {
        case 'ArrowLeft':
          if (newPlayer.lane > 0) {
            newPlayer.lane = (newPlayer.lane - 1) as Lane;
            newPlayer.x = newPlayer.lane * LANE_WIDTH + LANE_WIDTH / 2 - PLAYER_WIDTH / 2;
          }
          break;
        case 'ArrowRight':
          if (newPlayer.lane < 2) {
            newPlayer.lane = (newPlayer.lane + 1) as Lane;
            newPlayer.x = newPlayer.lane * LANE_WIDTH + LANE_WIDTH / 2 - PLAYER_WIDTH / 2;
          }
          break;
        case ' ':
        case 'ArrowUp':
          if (newPlayer.jumpHeight === 0) {
            newPlayer.isJumping = true;
          }
          event.preventDefault();
          break;
        case 'ArrowDown':
          newPlayer.isSliding = true;
          setTimeout(() => {
            setPlayer(p => ({ ...p, isSliding: false }));
          }, 500);
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
      />
      
      <div className="game-ui">
        {gameState === 'playing' && (
          <div className="game-score">
            <div>Distance: {score}m</div>
            <div className="text-2xl text-game-coin">Coins: {coins}</div>
          </div>
        )}

        {gameState === 'start' && (
          <div className="game-menu">
            <h1 className="game-title">Lane Leaper</h1>
            <p className="game-instructions">
              Use arrow keys to move and jump<br />
              Space bar to jump • Down arrow to slide<br />
              Collect coins and avoid obstacles!
            </p>
            <Button onClick={startGame} className="game-button">
              Start Running!
            </Button>
          </div>
        )}

        {gameState === 'gameOver' && (
          <div className="game-menu">
            <h2 className="text-4xl font-bold mb-4 text-destructive">Game Over!</h2>
            <div className="text-2xl mb-2">Final Distance: {score}m</div>
            <div className="text-xl mb-8 text-game-coin">Coins Collected: {coins}</div>
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