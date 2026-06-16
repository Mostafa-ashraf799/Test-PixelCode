// =============================================
// 🎮 NEON BREAKER — Professional Brick Breaker
// Built with React + Canvas
// =============================================

const { useState, useEffect, useRef, useCallback } = React;

// =============================================
// CONSTANTS
// =============================================
const CANVAS_W = 800;
const CANVAS_H = 600;
const PADDLE_W = 120;
const PADDLE_H = 14;
const BALL_R = 7;
const BALL_SPEED = 5;
const BRICK_ROWS = 5;
const BRICK_COLS = 10;
const BRICK_W = 70;
const BRICK_H = 22;
const BRICK_PAD = 4;
const BRICK_OFFSET_TOP = 60;
const BRICK_OFFSET_LEFT = 30;
const MAX_LIVES = 3;
const POWERUP_CHANCE = 0.25;
const POWERUP_SPEED = 2.5;

// Neon color palettes per level
const LEVEL_CONFIGS = [
  {
    name: "Neon Dawn",
    rows: 4,
    cols: 10,
    speed: 5,
    colors: ["#ff0066", "#ff3399", "#ff66cc", "#ff99dd"],
    bg: "#0a0a1a",
  },
  {
    name: "Cyber Storm",
    rows: 5,
    cols: 10,
    speed: 6,
    colors: ["#00ffff", "#00ccff", "#0099ff", "#0066ff", "#3333ff"],
    bg: "#0a0a1a",
  },
  {
    name: "Plasma Inferno",
    rows: 6,
    cols: 10,
    speed: 7,
    colors: ["#00ff66", "#33ff33", "#66ff00", "#ccff00", "#ffcc00", "#ff6600"],
    bg: "#0a0a1a",
  },
];

const POWERUP_TYPES = [
  { type: "wide", label: "Wide Paddle", color: "#0ff", symbol: "↔" },
  { type: "fire", label: "Fire Ball", color: "#f60", symbol: "🔥" },
  { type: "multi", label: "Multi Ball", color: "#f0f", symbol: "⊕" },
  { type: "magnet", label: "Magnetic", color: "#ff0", symbol: "🧲" },
];

// =============================================
// UTILITY FUNCTIONS
// =============================================
function rand(min, max) {
  return Math.random() * (max - min) + min;
}

function randInt(min, max) {
  return Math.floor(rand(min, max + 1));
}

function clamp(val, min, max) {
  return Math.max(min, Math.min(max, val));
}

function rectCollision(rx, ry, rw, rh, cx, cy, cr) {
  const closestX = clamp(cx, rx, rx + rw);
  const closestY = clamp(cy, ry, ry + rh);
  const dx = cx - closestX;
  const dy = cy - closestY;
  return dx * dx + dy * dy < cr * cr;
}

// =============================================
// PARTICLE SYSTEM
// =============================================
class Particle {
  constructor(x, y, color) {
    this.x = x;
    this.y = y;
    this.color = color;
    this.vx = rand(-3, 3);
    this.vy = rand(-3, 3);
    this.life = 1;
    this.decay = rand(0.015, 0.035);
    this.size = rand(1.5, 4);
  }
  update() {
    this.x += this.vx;
    this.y += this.vy;
    this.vy += 0.05;
    this.life -= this.decay;
  }
  draw(ctx) {
    ctx.save();
    ctx.globalAlpha = this.life;
    ctx.shadowColor = this.color;
    ctx.shadowBlur = 8;
    ctx.fillStyle = this.color;
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

// =============================================
// STAR BACKGROUND
// =============================================
class Star {
  constructor(w, h) {
    this.x = rand(0, w);
    this.y = rand(0, h);
    this.size = rand(0.5, 2);
    this.speed = rand(0.1, 0.5);
    this.brightness = rand(0.3, 1);
    this.twinkleSpeed = rand(0.01, 0.03);
    this.twinkleOffset = rand(0, Math.PI * 2);
  }
  update(time) {
    this.y += this.speed;
    if (this.y > CANVAS_H + 5) {
      this.y = -5;
      this.x = rand(0, CANVAS_W);
    }
  }
  draw(ctx, time) {
    const twinkle = 0.5 + 0.5 * Math.sin(time * this.twinkleSpeed + this.twinkleOffset);
    const alpha = this.brightness * twinkle;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.fillStyle = "#fff";
    ctx.shadowColor = "#fff";
    ctx.shadowBlur = 4;
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

// =============================================
// POWER-UP CLASS
// =============================================
class PowerUp {
  constructor(x, y, type) {
    this.x = x;
    this.y = y;
    this.w = 24;
    this.h = 24;
    this.type = type;
    this.speed = POWERUP_SPEED;
    this.alive = true;
    this.angle = 0;
  }
  update() {
    this.y += this.speed;
    this.angle += 0.05;
    if (this.y > CANVAS_H) this.alive = false;
  }
  draw(ctx) {
    const config = POWERUP_TYPES.find((p) => p.type === this.type);
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(this.angle);
    // Glow
    ctx.shadowColor = config.color;
    ctx.shadowBlur = 15;
    // Box
    ctx.fillStyle = config.color;
    ctx.globalAlpha = 0.3;
    ctx.fillRect(-this.w / 2, -this.h / 2, this.w, this.h);
    ctx.globalAlpha = 1;
    ctx.strokeStyle = config.color;
    ctx.lineWidth = 2;
    ctx.strokeRect(-this.w / 2, -this.h / 2, this.w, this.h);
    // Symbol
    ctx.fillStyle = config.color;
    ctx.font = "14px Arial";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(config.symbol, 0, 0);
    ctx.restore();
  }
}

// =============================================
// BRICK CLASS
// =============================================
class Brick {
  constructor(x, y, color, hits, points) {
    this.x = x;
    this.y = y;
    this.w = BRICK_W;
    this.h = BRICK_H;
    this.color = color;
    this.hits = hits;
    this.maxHits = hits;
    this.points = points;
    this.alive = true;
    this.shakeOffset = 0;
    this.shakeTime = 0;
  }
  hit() {
    this.hits--;
    this.shakeTime = 6;
    if (this.hits <= 0) {
      this.alive = false;
      return true;
    }
    return false;
  }
  update() {
    if (this.shakeTime > 0) {
      this.shakeOffset = (Math.random() - 0.5) * 4;
      this.shakeTime--;
    } else {
      this.shakeOffset = 0;
    }
  }
  draw(ctx) {
    if (!this.alive) return;
    const sx = this.x + this.shakeOffset;
    const alpha = 0.4 + 0.6 * (this.hits / this.maxHits);
    ctx.save();
    // Glow
    ctx.shadowColor = this.color;
    ctx.shadowBlur = 12;
    ctx.globalAlpha = alpha;
    // Fill
    ctx.fillStyle = this.color;
    ctx.fillRect(sx, this.y, this.w, this.h);
    // Inner highlight
    ctx.globalAlpha = 0.15;
    ctx.fillStyle = "#fff";
    ctx.fillRect(sx, this.y, this.w, this.h / 3);
    // Border
    ctx.globalAlpha = alpha;
    ctx.strokeStyle = this.color;
    ctx.lineWidth = 1.5;
    ctx.strokeRect(sx, this.y, this.w, this.h);
    // Hit indicator
    if (this.maxHits > 1) {
      ctx.globalAlpha = 0.9;
      ctx.fillStyle = "#fff";
      ctx.font = "bold 11px Arial";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(this.hits, sx + this.w / 2, this.y + this.h / 2);
    }
    ctx.restore();
  }
}

// =============================================
// BALL CLASS
// =============================================
class Ball {
  constructor(x, y, speed) {
    this.startX = x;
    this.startY = y;
    this.x = x;
    this.y = y;
    this.r = BALL_R;
    this.speed = speed;
    this.dx = speed * (Math.random() > 0.5 ? 1 : -1) * 0.7;
    this.dy = -speed;
    this.fireBall = false;
    this.alive = true;
    this.trail = [];
  }
  reset(x, y, speed) {
    this.x = x !== undefined ? x : this.startX;
    this.y = y !== undefined ? y : this.startY;
    this.speed = speed;
    this.dx = speed * (Math.random() > 0.5 ? 1 : -1) * 0.7;
    this.dy = -speed;
    this.fireBall = false;
    this.alive = true;
    this.trail = [];
  }
  update(paddle) {
    // Trail
    this.trail.push({ x: this.x, y: this.y });
    if (this.trail.length > 10) this.trail.shift();

    this.x += this.dx;
    this.y += this.dy;

    // Wall collisions
    if (this.x - this.r < 0) {
      this.x = this.r;
      this.dx = Math.abs(this.dx);
    }
    if (this.x + this.r > CANVAS_W) {
      this.x = CANVAS_W - this.r;
      this.dx = -Math.abs(this.dx);
    }
    if (this.y - this.r < 0) {
      this.y = this.r;
      this.dy = Math.abs(this.dy);
    }
    // Bottom — lose ball
    if (this.y + this.r > CANVAS_H) {
      this.alive = false;
    }
  }
  draw(ctx) {
    // Trail
    for (let i = 0; i < this.trail.length; i++) {
      const t = this.trail[i];
      const alpha = (i / this.trail.length) * 0.4;
      const size = this.r * (i / this.trail.length);
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.fillStyle = this.fireBall ? "#f60" : "#0ff";
      ctx.shadowColor = this.fireBall ? "#f60" : "#0ff";
      ctx.shadowBlur = 6;
      ctx.beginPath();
      ctx.arc(t.x, t.y, size, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
    // Ball
    ctx.save();
    ctx.shadowColor = this.fireBall ? "#f60" : "#0ff";
    ctx.shadowBlur = 20;
    ctx.fillStyle = this.fireBall ? "#f60" : "#fff";
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.r, 0, Math.PI * 2);
    ctx.fill();
    // Inner glow
    ctx.shadowBlur = 0;
    ctx.fillStyle = this.fireColor ? "#ffaa00" : "#0ff";
    ctx.globalAlpha = 0.6;
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.r * 0.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
  get fireColor() {
    return this.fireBall;
  }
}

// =============================================
// PADDLE CLASS
// =============================================
class Paddle {
  constructor() {
    this.w = PADDLE_W;
    this.h = PADDLE_H;
    this.x = CANVAS_W / 2 - this.w / 2;
    this.y = CANVAS_H - 40;
    this.baseWidth = PADDLE_W;
    this.magnetic = false;
  }
  reset() {
    this.w = this.baseWidth;
    this.x = CANVAS_W / 2 - this.w / 2;
    this.magnetic = false;
  }
  moveTo(mx) {
    this.x = clamp(mx - this.w / 2, 0, CANVAS_W - this.w);
  }
  draw(ctx) {
    ctx.save();
    const gradient = ctx.createLinearGradient(this.x, this.y, this.x + this.w, this.y);
    gradient.addColorStop(0, this.magenta ? "#ff0" : "#0ff");
    gradient.addColorStop(0.5, this.magenta ? "#ff0" : "#0ff");
    gradient.addColorStop(1, this.magenta ? "#ff0" : "#0ff");
    ctx.shadowColor = this.magnetic ? "#ff0" : "#0ff";
    ctx.shadowBlur = 20;
    ctx.fillStyle = this.magnetic ? "#ff0" : "#0ff";
    ctx.beginPath();
    ctx.roundRect(this.x, this.y, this.w, this.h, 7);
    ctx.fill();
    // Highlight
    ctx.shadowBlur = 0;
    ctx.fillStyle = "#fff";
    ctx.globalAlpha = 0.3;
    ctx.beginPath();
    ctx.roundRect(this.x + 4, this.y + 2, this.w - 8, this.h / 3, 3);
    ctx.fill();
    ctx.restore();
  }
  get magnetize() {
    return (this.magnetic = true);
  }
}

// =============================================
// GAME STATE
// =============================================
function createBricks(level) {
  const config = LEVEL_CONFIGS[level % LEVEL_CONFIGS.length];
  const bricks = [];
  for (let r = 0; r < config.rows; r++) {
    for (let c = 0; c < config.cols; c++) {
      const x = BRICK_OFFSET_LEFT + c * (BRICK_W + BRICK_PAD);
      const y = BRICK_OFFSET_TOP + r * (BRICK_H + BRICK_PAD);
      const color = config.colors[r % config.colors.length];
      const hits = level >= 2 && r < 2 ? 2 : 1;
      const points = (config.rows - r) * 10;
      bricks.push(new Brick(x, y, color, hits, points));
    }
  }
  return bricks;
}

function initGameState() {
  return {
    score: 0,
    lives: MAX_LIVES,
    level: 0,
    status: "start", // start, playing, paused, levelComplete, gameOver, won
    balls: [],
    bricks: [],
    powerUps: [],
    particles: [],
    activePowerUps: {},
    combo: 0,
    comboTimer: 0,
  };
}

// =============================================
// MAIN REACT COMPONENT
// =============================================
function NeonBreaker() {
  const canvasRef = useRef(null);
  const gameStateRef = useRef(initGameState());
  const paddleRef = useRef(new Paddle());
  const starsRef = useRef([]);
  const mouseXRef = useRef(CANVAS_W / 2);
  const keysRef = useRef({ left: false, right: false });
  const animFrameRef = useRef(0);
  const timeRef = useRef(0);
  const flashRef = useRef({ alpha: 0, color: "#fff" });
  const [, forceUpdate] = useState(0);

  // Initialize stars
  useEffect(() => {
    starsRef.current = [];
    for (let i = 0; i < 80; i++) {
      starsRef.current.push(new Star(CANVAS_W, CANVAS_H));
    }
  }, []);

  // Spawn power-up
  const spawnPowerUp = useCallback((x, y) => {
    if (Math.random() < POWERUP_CHANCE) {
      const type = POWERUP_TYPES[randInt(0, POWERUP_TYPES.length - 1)].type;
      gameStateRef.current.powerUps.push(new PowerUp(x, y, type));
    }
  }, []);

  // Apply power-up
  const applyPowerUp = useCallback((type) => {
    const gs = gameStateRef.current;
    const paddle = paddleRef.current;
    switch (type) {
      case "wide":
        paddle.w = paddle.baseWidth * 1.6;
        gs.activePowerUps.wide = 600; // frames
        break;
      case "fire":
        gs.balls.forEach((b) => (b.fireBall = true));
        gs.activePowerUps.fire = 480;
        break;
      case "multi": {
        const alive = gs.balls.filter((b) => b.alive);
        if (alive.length > 0) {
          const src = alive[0];
          for (let i = 0; i < 2; i++) {
            const nb = new Ball(src.x, src.y, src.speed);
            nb.dx = src.speed * (i === 0 ? -0.8 : 0.8);
            nb.dy = -src.speed;
            nb.fireBall = src.fireBall;
            gs.balls.push(nb);
          }
        }
        break;
      }
      case "magnet":
        paddle.magnetic = true;
        gs.activePowerUps.magnet = 600;
        break;
    }
  }, []);

  // Spawn particles
  const spawnParticles = useCallback((x, y, color, count) => {
    for (let i = 0; i < count; i++) {
      gameStateRef.current.particles.push(new Particle(x, y, color));
    }
  }, []);

  // Start level
  const startLevel = useCallback((level) => {
    const gs = gameStateRef.current;
    const config = LEVEL_CONFIGS[level % LEVEL_CONFIGS.length];
    gs.level = level;
    gs.bricks = createBricks(level);
    gs.balls = [new Ball(CANVAS_W / 2, CANVAS_H - 60, config.speed)];
    gs.balls[0].dx = config.speed * (Math.random() > 0.5 ? 0.7 : -0.7);
    gs.balls[0].dy = -config.speed;
    gs.powerUps = [];
    gs.particles = [];
    gs.activePowerUps = {};
    gs.combo = 0;
    paddleRef.current.reset();
    gs.status = "playing";
    forceUpdate((n) => n + 1);
  }, []);

  // Start game
  const startGame = useCallback(() => {
    const gs = gameStateRef.current;
    gs.score = 0;
    gs.lives = MAX_LIVES;
    gs.level = 0;
    startLevel(0);
  }, [startLevel]);

  // Next level
  const nextLevel = useCallback(() => {
    const gs = gameStateRef.current;
    if (gs.level + 1 >= LEVEL_CONFIGS.length) {
      gs.status = "won";
      flashRef.current = { alpha: 0.6, color: "#0f0" };
    } else {
      startLevel(gs.level + 1);
    }
    forceUpdate((n) => n + 1);
  }, [startLevel]);

  // Input handlers
  useEffect(() => {
    const handleMouseMove = (e) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      const scaleX = CANVAS_W / rect.width;
      mouseXRef.current = (e.clientX - rect.left) * scaleX;
    };
    const handleTouchMove = (e) => {
      e.preventDefault();
      const canvas = canvasRef.current;
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      const scaleX = CANVAS_W / rect.width;
      mouseXRef.current = (e.touches[0].clientX - rect.left) * scaleX;
    };
    const handleKeyDown = (e) => {
      if (e.key === "ArrowLeft" || e.key === "a") keysRef.current.left = true;
      if (e.key === "ArrowRight" || e.key === "d") keysRef.current.right = true;
      if (e.key === " " || e.key === "Enter") {
        const gs = gameStateRef.current;
        if (gs.status === "start") startGame();
        else if (gs.status === "gameOver" || gs.status === "won") startGame();
        else if (gs.status === "levelComplete") nextLevel();
      }
    };
    const handleKeyUp = (e) => {
      if (e.key === "ArrowLeft" || e.key === "a") keysRef.current.left = false;
      if (e.key === "ArrowRight" || e.key === "d") keysRef.current.right = false;
    };
    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("touchmove", handleTouchMove, { passive: false });
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("touchmove", handleTouchMove);
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, [startGame, nextLevel]);

  // Game loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");

    const gameLoop = () => {
      timeRef.current++;
      const gs = gameStateRef.current;
      const paddle = paddleRef.current;

      // --- UPDATE ---
      if (gs.status === "playing") {
        // Stars
        starsRef.current.forEach((s) => s.update(timeRef.current));

        // Paddle movement
        const keys = keysRef.current;
        if (keys.left) paddle.x -= 8;
        if (keys.right) paddle.x += 8;
        paddle.x = clamp(paddle.x, 0, CANVAS_W - paddle.w);
        paddle.moveTo(mouseXRef.current);

        // Update power-up timers
        for (const key in gs.activePowerUps) {
          gs.activePowerUps[key]--;
          if (gs.activePowerUps[key] <= 0) {
            delete gs.activePowerUps[key];
            if (key === "wide") paddle.w = paddle.baseWidth;
            if (key === "fire") gs.balls.forEach((b) => (b.fireBall = false));
            if (key === "magnet") paddle.magnetic = false;
          }
        }

        // Combo timer
        if (gs.comboTimer > 0) {
          gs.comboTimer--;
          if (gs.comboTimer <= 0) gs.combo = 0;
        }

        // Update balls
        gs.balls.forEach((ball) => {
          if (!ball.alive) return;
          ball.update(paddle);

          // Paddle collision
          if (
            ball.dy > 0 &&
            ball.y + ball.r >= paddle.y &&
            ball.y + ball.r <= paddle.y + paddle.h + 4 &&
            ball.x >= paddle.x - ball.r &&
            ball.x <= paddle.x + paddle.w + ball.r
          ) {
            // Calculate bounce angle based on hit position
            const hitPos = (ball.x - paddle.x) / paddle.w; // 0 to 1
            const angle = (hitPos - 0.5) * Math.PI * 0.7; // -63° to +63°
            const speed = Math.sqrt(ball.dx * ball.dx + ball.dy * ball.dy);
            ball.dx = speed * Math.sin(angle);
            ball.dy = -speed * Math.cos(angle);
            ball.y = paddle.y - ball.r;
            spawnParticles(ball.x, ball.y, "#0ff", 5);
          }

          // Brick collisions
          gs.bricks.forEach((brick) => {
            if (!brick.alive) return;
            if (
              rectCollision(brick.x, brick.y, brick.w, brick.h, ball.x, ball.y, ball.r)
            ) {
              // Determine collision side
              const overlapLeft = ball.x + ball.r - brick.x;
              const overlapRight = brick.x + brick.w - (ball.x - ball.r);
              const overlapTop = ball.y + ball.r - brick.y;
              const overlapBottom = brick.y + brick.h - (ball.y - ball.r);
              const minOverlap = Math.min(overlapLeft, overlapRight, overlapTop, overlapBottom);

              if (!ball.fireBall) {
                if (minOverlap === overlapLeft || minOverlap === overlapRight) {
                  ball.dx = -ball.dx;
                } else {
                  ball.dy = -ball.dy;
                }
              }

              const destroyed = brick.hit();
              if (destroyed) {
                gs.combo++;
                gs.comboTimer = 90;
                const comboMultiplier = Math.min(gs.combo, 5);
                gs.score += brick.points * comboMultiplier;
                spawnParticles(
                  brick.x + brick.w / 2,
                  brick.y + brick.h / 2,
                  brick.color,
                  15
                );
                spawnPowerUp(brick.x + brick.w / 2, brick.y + brick.h / 2);
                flashRef.current = { alpha: 0.15, color: brick.color };
              } else {
                spawnParticles(ball.x, ball.y, brick.color, 5);
              }
            }
          });
        });

        // Remove dead balls
        gs.balls = gs.balls.filter((b) => b.alive);

        // Check if all balls lost
        if (gs.balls.length === 0) {
          gs.lives--;
          if (gs.lives <= 0) {
            gs.status = "gameOver";
            flashRef.current = { alpha: 0.5, color: "#f00" };
          } else {
            const config = LEVEL_CONFIGS[gs.level % LEVEL_CONFIGS.length];
            const newBall = new Ball(CANVAS_W / 2, CANVAS_H - 60, config.speed);
            newBall.dx = config.speed * (Math.random() > 0.5 ? 0.7 : -0.7);
            gs.balls.push(newBall);
          }
        }

        // Update bricks
        gs.bricks.forEach((b) => b.update());

        // Check level complete
        if (gs.bricks.every((b) => !b.alive)) {
          gs.status = "levelComplete";
          flashRef.current = { alpha: 0.4, color: "#0f0" };
        }

        // Update power-ups
        gs.powerUps.forEach((p) => p.update());
        gs.powerUps.forEach((p) => {
          if (!p.alive) return;
          // Check paddle collision
          if (
            p.y + p.h / 2 >= paddle.y &&
            p.y - p.h / 2 <= paddle.y + paddle.h &&
            p.x + p.w / 2 >= paddle.x &&
            p.x - p.w / 2 <= paddle.x + paddle.w
          ) {
            p.alive = false;
            applyPowerUp(p.type);
            spawnParticles(p.x, p.y, "#ff0", 10);
          }
        });
        gs.powerUps = gs.powerUps.filter((p) => p.alive);

        // Update particles
        gs.particles.forEach((p) => p.update());
        gs.particles = gs.particles.filter((p) => p.life > 0);
      } else {
        // Still update stars for visual effect
        starsRef.current.forEach((s) => s.update(timeRef.current));
      }

      // --- DRAW ---
      // Background
      ctx.fillStyle = "#0a0a1a";
      ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

      // Stars
      starsRef.current.forEach((s) => s.draw(ctx, timeRef.current));

      // Bricks
      if (gs.status === "playing" || gs.status === "levelComplete") {
        gs.bricks.forEach((b) => b.draw(ctx));
      }

      // Power-ups
      gs.powerUps.forEach((p) => p.draw(ctx));

      // Particles
      gs.particles.forEach((p) => p.draw(ctx));

      // Balls
      gs.balls.forEach((b) => b.draw(ctx));

      // Paddle
      if (gs.status === "playing") {
        paddle.draw(ctx);
      }

      // Combo display
      if (gs.combo > 1 && gs.status === "playing") {
        ctx.save();
        ctx.globalAlpha = Math.min(1, gs.comboTimer / 30);
        ctx.fillStyle = "#ff0";
        ctx.shadowColor = "#ff0";
        ctx.shadowBlur = 15;
        ctx.font = "bold 28px Arial";
        ctx.textAlign = "center";
        ctx.fillText(`${gs.combo}x COMBO!`, CANVAS_W / 2, CANVAS_H / 2);
        ctx.restore();
      }

      // Active power-up indicators
      let puY = 20;
      for (const key in gs.activePowerUps) {
        const config = POWERUP_TYPES.find((p) => p.type === key);
        if (config) {
          ctx.save();
          ctx.globalAlpha = 0.8;
          ctx.fillStyle = config.color;
          ctx.shadowColor = config.color;
          ctx.shadowBlur = 8;
          ctx.font = "bold 13px Arial";
          ctx.textAlign = "right";
          const frames = gs.activePowerUps[key];
          const seconds = Math.ceil(frames / 60);
          ctx.fillText(`${config.label} ${seconds}s`, CANVAS_W - 15, puY);
          ctx.restore();
          puY += 20;
        }
      }

      // Flash effect
      if (flashRef.current.alpha > 0) {
        ctx.save();
        ctx.globalAlpha = flashRef.current.alpha;
        ctx.fillStyle = flashRef.current.color;
        ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
        ctx.restore();
        flashRef.current.alpha *= 0.92;
        if (flashRef.current.alpha < 0.01) flashRef.current.alpha = 0;
      }

      animFrameRef.current = requestAnimationFrame(gameLoop);
    };

    animFrameRef.current = requestAnimationFrame(gameLoop);
    return () => cancelAnimationFrame(animFrameRef.current);
  }, [applyPowerUp, spawnParticles, spawnPowerUp]);

  // Render UI
  const gs = gameStateRef.current;

  return (
    <div className="game-container">
      {/* HUD */}
      {(gs.status === "playing" || gs.status === "levelComplete") && (
        <div className="hud-bar">
          <div className="hud-item">
            <span className="hud-label">Score</span>
            <span className="hud-value">{gs.score}</span>
          </div>
          <div className="hud-item">
            <span className="hud-label">Level</span>
            <span className="hud-value level">
              {gs.level + 1} — {LEVEL_CONFIGS[gs.level % LEVEL_CONFIGS.length].name}
            </span>
          </div>
          <div className="hud-item">
            <span className="hud-label">Lives</span>
            <span className="hud-value lives">
              {"♥".repeat(gs.lives)}
            </span>
          </div>
        </div>
      )}

      {/* Canvas + Overlays */}
      <div style={{ position: "relative" }}>
        <canvas
          ref={canvasRef}
          width={CANVAS_W}
          height={CANVAS_H}
          className="game-canvas"
        />

        {/* Start Screen */}
        {gs.status === "start" && (
          <div className="overlay-screen">
            <div className="overlay-title">Neon Breaker</div>
            <div className="overlay-subtitle">
              Break all the bricks. Rule the neon.
            </div>
            <button className="overlay-btn" onClick={startGame}>
              Start Game
            </button>
            <div className="controls-hint">
              Move: Mouse / Arrow Keys / A & D &nbsp;|&nbsp; Launch: Click
            </div>
          </div>
        )}

        {/* Level Complete */}
        {gs.status === "levelComplete" && (
          <div className="overlay-screen">
            <div className="level-text">
              Level {gs.level + 1} Complete!
            </div>
            <div className="overlay-score">Score: {gs.score}</div>
            <button className="overlay-btn win" onClick={nextLevel}>
              {gs.level + 1 >= LEVEL_CONFIGS.length
                ? "Claim Victory"
                : "Next Level"}
            </button>
          </div>
        )}

        {/* Game Over */}
        {gs.status === "gameOver" && (
          <div className="overlay-screen">
            <div className="overlay-title" style={{ color: "#f44" }}>
              Game Over
            </div>
            <div className="overlay-score">Final Score: {gs.score}</div>
            <button className="overlay-btn lose" onClick={startGame}>
              Try Again
            </button>
          </div>
        )}

        {/* Won */}
        {gs.status === "won" && (
          <div className="overlay-screen">
            <div className="overlay-title">🏆 You Won! 🏆</div>
            <div className="overlay-score">Final Score: {gs.score}</div>
            <div className="overlay-subtitle">
              You conquered all levels!
            </div>
            <button className="overlay-btn win" onClick={startGame}>
              Play Again
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// Mount React app
const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(<NeonBreaker />);