// Game Physics & Difficulty Settings

const DIFFICULTY_CONFIG = {
  easy: {
    name: 'EASY',
    gravity: 1100,         
    jumpImpulse: -390,      
    pipeGap: 185,           
    pipeSpeed: 170,         
    spawnInterval: 2.3,     
    movingPipes: false,
    oscillateAmp: 0,
    oscillateFreq: 0,
    laserHazards: false,
    scoreMultiplier: 1.0,
    maxRotation: 70,        
  },
  medium: {
    name: 'MEDIUM',
    gravity: 1500,
    jumpImpulse: -460,
    pipeGap: 142,
    pipeSpeed: 230,
    spawnInterval: 1.85,
    movingPipes: false,
    oscillateAmp: 0,
    oscillateFreq: 0,
    laserHazards: false,
    scoreMultiplier: 1.5,
    maxRotation: 80,
  },
  hard: {
    name: 'HARD',
    gravity: 1850,
    jumpImpulse: -510,
    pipeGap: 118,
    pipeSpeed: 290,
    spawnInterval: 1.45,
    movingPipes: true,
    oscillateAmp: 45,
    oscillateFreq: 2.0,
    laserHazards: false,
    scoreMultiplier: 2.0,
    maxRotation: 85,
  },
  extreme: {
    name: 'EXTREME',
    gravity: 2200,
    jumpImpulse: -560,
    pipeGap: 96,
    pipeSpeed: 360,
    spawnInterval: 1.15,
    movingPipes: true,
    oscillateAmp: 80,
    oscillateFreq: 3.2,
    laserHazards: true,
    scoreMultiplier: 3.0,
    maxRotation: 90,
  }
};

class PhysicsEngine {
  constructor() {
    this.mode = 'medium';
    this.config = DIFFICULTY_CONFIG.medium;
  }

  setDifficulty(mode) {
    if (DIFFICULTY_CONFIG[mode]) {
      this.mode = mode;
      this.config = DIFFICULTY_CONFIG[mode];
    }
  }


  updateBird(bird, dt) {
  
    bird.vy += this.config.gravity * dt;
    bird.y += bird.vy * dt;


    let targetRotation = 0;
    if (bird.vy < 0) {
      targetRotation = -25;
    } else {
      targetRotation = Math.min(this.config.maxRotation, (bird.vy / 600) * this.config.maxRotation);
    }
  
    bird.rotation += (targetRotation - bird.rotation) * Math.min(1.0, dt * 18);
  }

  
  flap(bird) {
    bird.vy = this.config.jumpImpulse;
    bird.wingPhase = 1.0;
  }

  
  getEffectiveSpeed(score = 0) {
    const scale = 1 + Math.min(score, 200) * 0.003;
    return this.config.pipeSpeed * scale;
  }


  updatePipes(pipes, dt, worldHeight, gameTime, score = 0) {
    const effectiveSpeed = this.getEffectiveSpeed(score);

    for (let i = pipes.length - 1; i >= 0; i--) {
      const pipe = pipes[i];
      pipe.x -= effectiveSpeed * dt;

  
      if (pipe.moving) {
        const timeWrapped = gameTime % 1000;
        pipe.currentGapY = pipe.baseGapY + Math.sin(timeWrapped * pipe.oscillateFreq + pipe.phaseOffset) * pipe.oscillateAmp;
        const minGapY = 100 + pipe.gap / 2;
        const maxGapY = worldHeight - 120 - pipe.gap / 2;
        pipe.currentGapY = Math.max(minGapY, Math.min(maxGapY, pipe.currentGapY));
      }

     
      if (pipe.hasLaser) {
        pipe.laserActiveTimer += dt;
        if (pipe.laserActiveTimer > 2.5) {
          pipe.laserState = !pipe.laserState;
          pipe.laserActiveTimer = 0;
        }
      }
    }
  }


  checkCollisions(bird, pipes, worldWidth, worldHeight, groundHeight) {
    const birdX = bird.x;
    const birdY = bird.y;
    const birdRadius = bird.radius * 0.8;


    if (birdY + birdRadius >= worldHeight - groundHeight) {
      return { hit: true, cause: 'ground' };
    }
    if (birdY - birdRadius <= 0) {
      return { hit: true, cause: 'ceiling' };
    }


    for (const pipe of pipes) {
      const pipeWidth = pipe.width;
      const gapY = pipe.currentGapY || pipe.baseGapY;
      const halfGap = pipe.gap / 2;

      const topPipeRect = {
        left: pipe.x,
        right: pipe.x + pipeWidth,
        top: 0,
        bottom: gapY - halfGap
      };

      const bottomPipeRect = {
        left: pipe.x,
        right: pipe.x + pipeWidth,
        top: gapY + halfGap,
        bottom: worldHeight - groundHeight
      };

      if (this.circleRectIntersect(birdX, birdY, birdRadius, topPipeRect)) {
        return { hit: true, cause: 'pipe' };
      }

      if (this.circleRectIntersect(birdX, birdY, birdRadius, bottomPipeRect)) {
        return { hit: true, cause: 'pipe' };
      }

    
      if (pipe.hasLaser && pipe.laserState) {
        const laserX = pipe.x + pipeWidth / 2;
        const laserWidth = 14;
        const laserRect = {
          left: laserX - laserWidth / 2,
          right: laserX + laserWidth / 2,
          top: gapY - halfGap + 10,
          bottom: gapY + halfGap - 10
        };
        if (this.circleRectIntersect(birdX, birdY, birdRadius, laserRect)) {
          return { hit: true, cause: 'laser' };
        }
      }
    }

    return { hit: false };
  }

  circleRectIntersect(cx, cy, radius, rect) {
    const closestX = Math.max(rect.left, Math.min(cx, rect.right));
    const closestY = Math.max(rect.top, Math.min(cy, rect.bottom));

    const distanceX = cx - closestX;
    const distanceY = cy - closestY;
    const distanceSquared = (distanceX * distanceX) + (distanceY * distanceY);

    return distanceSquared < (radius * radius);
  }
}
