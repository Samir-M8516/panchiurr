// Game controller & state machine

class GameController {
  constructor() {
    this.canvas = document.getElementById('game-canvas');
    this.physics = new PhysicsEngine();
    this.renderer = new Renderer(this.canvas);

    // State: 'MENU' | 'PLAYING' | 'PAUSED' | 'GAMEOVER'
    this.state = 'MENU';
    this.difficultyMode = 'medium';
    this.selectedSkin = 'cyan';

    // Player & Entities
    this.bird = {
      x: 120,
      y: 300,
      vy: 0,
      radius: 18,
      rotation: 0,
      wingPhase: 0
    };
    this.pipes = [];
    this.score = 0;
    this.rawScore = 0;
    this.combo = 0;
    this.maxCombo = 0;
    this.flapsCount = 0;

    // Timers
    this.lastTime = performance.now();
    this.gameTime = 0;
    this.pipeSpawnTimer = 0;
    this.trailTimer = 0;
    this.fpsUpdateTimer = 0;

    // Local Storage High Scores
    this.highScores = {
      easy: parseInt(localStorage.getItem('fb360_hs_easy') || '0', 10),
      medium: parseInt(localStorage.getItem('fb360_hs_medium') || '0', 10),
      hard: parseInt(localStorage.getItem('fb360_hs_hard') || '0', 10),
      extreme: parseInt(localStorage.getItem('fb360_hs_extreme') || '0', 10)
    };

    // FPS counter
    this.fpsFrameTimes = [];
    this.fps = 60;

    this.initUI();
    this.initEventListeners();
    this.loadHighScores();

    // Start loop
    requestAnimationFrame((t) => this.loop(t));
  }

  initUI() {
    this.ui = {
      hud: document.getElementById('game-hud'),
      hudScore: document.getElementById('hud-score'),
      hudCombo: document.getElementById('hud-combo'),
      hudMode: document.getElementById('hud-mode-display'),
      hudFps: document.getElementById('hud-fps-display'),
      
      menuOverlay: document.getElementById('menu-overlay'),
      pauseOverlay: document.getElementById('pause-overlay'),
      gameoverOverlay: document.getElementById('gameover-overlay'),

      hsEasy: document.getElementById('hs-easy'),
      hsMedium: document.getElementById('hs-medium'),
      hsHard: document.getElementById('hs-hard'),
      hsExtreme: document.getElementById('hs-extreme'),

      btnStart: document.getElementById('btn-start'),
      btnPause: document.getElementById('btn-pause'),
      btnResume: document.getElementById('btn-resume'),
      btnRestartPause: document.getElementById('btn-restart-pause'),
      btnMenuPause: document.getElementById('btn-menu-pause'),
      btnSound: document.getElementById('btn-sound'),
      iconSoundOn: document.getElementById('icon-sound-on'),
      iconSoundOff: document.getElementById('icon-sound-off'),

      btnPlayAgain: document.getElementById('btn-play-again'),
      btnChangeMode: document.getElementById('btn-change-mode'),

      goRank: document.getElementById('gameover-rank'),
      goScore: document.getElementById('go-score'),
      goBest: document.getElementById('go-best'),
      goModeLabel: document.getElementById('go-mode-label'),
      goTime: document.getElementById('go-time'),
      goCombo: document.getElementById('go-combo'),

      modeCards: document.querySelectorAll('.mode-card'),
      skinBtns: document.querySelectorAll('.skin-btn')
    };
  }

  loadHighScores() {
    this.ui.hsEasy.textContent = this.highScores.easy;
    this.ui.hsMedium.textContent = this.highScores.medium;
    this.ui.hsHard.textContent = this.highScores.hard;
    this.ui.hsExtreme.textContent = this.highScores.extreme;
  }

  initEventListeners() {
    // Window Resize
    window.addEventListener('resize', () => this.renderer.resize());

    // Controls: Spacebar / Arrow Up / Key W / Key P / Escape
    window.addEventListener('keydown', (e) => {
      if (e.code === 'Space' || e.code === 'ArrowUp' || e.code === 'KeyW') {
        e.preventDefault();
        this.handleFlapInput();
      } else if (e.code === 'KeyP' || e.code === 'Escape') {
        e.preventDefault();
        this.togglePause();
      }
    });

    // Touch & Canvas Pointer input (Instant 0ms latency for mobile)
    const onCanvasTouch = (e) => {
      // Avoid flap if clicking top HUD controls
      const clientY = e.clientY || (e.touches && e.touches[0] ? e.touches[0].clientY : 0);
      const clientX = e.clientX || (e.touches && e.touches[0] ? e.touches[0].clientX : 0);
      if (clientY < 70 && clientX > this.renderer.width - 120) return;
      
      if (e.cancelable) e.preventDefault();
      this.handleFlapInput();
    };

    this.canvas.addEventListener('pointerdown', onCanvasTouch, { passive: false });
    this.canvas.addEventListener('touchstart', onCanvasTouch, { passive: false });

    // Mode Selector buttons
    this.ui.modeCards.forEach(card => {
      card.addEventListener('click', () => {
        audio.playClick();
        this.ui.modeCards.forEach(c => c.classList.remove('active'));
        card.classList.add('active');
        this.difficultyMode = card.dataset.mode;
        this.physics.setDifficulty(this.difficultyMode);
      });
    });

    // Skin selector buttons
    this.ui.skinBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        audio.playClick();
        this.ui.skinBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.selectedSkin = btn.dataset.skin;
      });
    });

    // Start Game Button
    this.ui.btnStart.addEventListener('click', () => {
      audio.playClick();
      this.startGame();
    });

    // HUD Pause & Sound buttons
    this.ui.btnPause.addEventListener('click', (e) => {
      e.stopPropagation();
      audio.playClick();
      this.togglePause();
    });

    this.ui.btnSound.addEventListener('click', (e) => {
      e.stopPropagation();
      const isMuted = audio.toggleMute();
      if (isMuted) {
        this.ui.iconSoundOn.classList.add('hidden');
        this.ui.iconSoundOff.classList.remove('hidden');
      } else {
        this.ui.iconSoundOn.classList.remove('hidden');
        this.ui.iconSoundOff.classList.add('hidden');
        audio.playClick();
      }
    });

    // Pause Modal Buttons
    this.ui.btnResume.addEventListener('click', () => {
      audio.playClick();
      this.resumeGame();
    });

    this.ui.btnRestartPause.addEventListener('click', () => {
      audio.playClick();
      this.ui.pauseOverlay.classList.add('hidden');
      this.startGame();
    });

    this.ui.btnMenuPause.addEventListener('click', () => {
      audio.playClick();
      this.ui.pauseOverlay.classList.add('hidden');
      this.showMenu();
    });

    // Game Over Buttons
    this.ui.btnPlayAgain.addEventListener('click', () => {
      audio.playClick();
      this.ui.gameoverOverlay.classList.add('hidden');
      this.startGame();
    });

    this.ui.btnChangeMode.addEventListener('click', () => {
      audio.playClick();
      this.ui.gameoverOverlay.classList.add('hidden');
      this.showMenu();
    });
  }

  handleFlapInput() {
    audio.playMusic(); // Ensures background music starts on first user gesture
    if (this.state === 'PLAYING') {
      this.physics.flap(this.bird);
      this.flapsCount++;
      audio.playFlap();
    } else if (this.state === 'MENU') {
      this.startGame();
    } else if (this.state === 'GAMEOVER') {
      this.ui.gameoverOverlay.classList.add('hidden');
      this.startGame();
    }
  }

  startGame() {
    this.state = 'PLAYING';
    this.physics.setDifficulty(this.difficultyMode);

    audio.playMusic();

    this.bird.x = this.renderer.width * 0.22;
    this.bird.y = this.renderer.height * 0.45;
    this.bird.vy = -180;
    this.bird.rotation = 0;
    this.bird.wingPhase = 0;

    this.pipes = [];
    this.score = 0;
    this.rawScore = 0;
    this.combo = 0;
    this.maxCombo = 0;
    this.flapsCount = 0;
    this.pipeSpawnTimer = 0.5; // Spawn first pipe quickly
    this.gameTime = 0;

    // HUD Update
    this.ui.hudScore.textContent = '0';
    this.ui.hudCombo.classList.add('hidden');
    this.ui.hudMode.textContent = this.difficultyMode.toUpperCase();
    this.ui.hud.classList.remove('hidden');

    this.ui.menuOverlay.classList.add('hidden');
    this.ui.pauseOverlay.classList.add('hidden');
    this.ui.gameoverOverlay.classList.add('hidden');
  }

  togglePause() {
    if (this.state === 'PLAYING') {
      this.state = 'PAUSED';
      audio.pauseMusic();
      this.ui.pauseOverlay.classList.remove('hidden');
    } else if (this.state === 'PAUSED') {
      this.resumeGame();
    }
  }

  resumeGame() {
    this.state = 'PLAYING';
    audio.playMusic();
    this.lastTime = performance.now();
    this.ui.pauseOverlay.classList.add('hidden');
  }

  showMenu() {
    this.state = 'MENU';
    this.pipes = [];
    this.ui.hud.classList.add('hidden');
    this.ui.menuOverlay.classList.remove('hidden');
    this.loadHighScores();
  }

  spawnPipe() {
    const config = this.physics.config;
    const worldH = this.renderer.height;
    const groundH = this.renderer.groundHeight;

    const minGapY = 130 + config.pipeGap / 2;
    const maxGapY = worldH - groundH - 130 - config.pipeGap / 2;
    const gapY = minGapY + Math.random() * (maxGapY - minGapY);

    const pipeWidth = 72;
    const pipe = {
      x: this.renderer.width + 10,
      width: pipeWidth,
      baseGapY: gapY,
      currentGapY: gapY,
      gap: config.pipeGap,
      passed: false,
      moving: config.movingPipes,
      oscillateAmp: config.oscillateAmp,
      oscillateFreq: config.oscillateFreq,
      phaseOffset: Math.random() * Math.PI * 2,
      hasLaser: config.laserHazards && Math.random() > 0.4,
      laserState: true,
      laserActiveTimer: 0
    };

    this.pipes.push(pipe);
  }

  gameOver(cause) {
    this.state = 'GAMEOVER';
    audio.playHit();

    // Trigger visual particle explosion at bird position
    this.renderer.spawnExplosion(this.bird.x, this.bird.y, 35);

    // Save High Score for current mode
    const currentMode = this.difficultyMode;
    const isNewBest = this.score > this.highScores[currentMode];
    if (isNewBest) {
      this.highScores[currentMode] = this.score;
      localStorage.setItem(`fb360_hs_${currentMode}`, this.score.toString());
      audio.playFanfare();
    }

    // Format endless survival time
    const timeSecs = Math.floor(this.gameTime);
    const timeFormatted = timeSecs >= 60 ? `${Math.floor(timeSecs / 60)}m ${timeSecs % 60}s` : `${timeSecs}s`;

    // Populate Game Over Stats Card
    this.ui.goRank.textContent = isNewBest ? '🏆 NEW BEST ENDLESS RECORD!' : 'CRASH REPORT';
    this.ui.goRank.style.background = isNewBest ? 'linear-gradient(135deg, #ffd700, #ff8800)' : 'rgba(255, 0, 127, 0.2)';
    this.ui.goScore.textContent = this.score;
    this.ui.goBest.textContent = this.highScores[currentMode];
    this.ui.goModeLabel.textContent = currentMode.toUpperCase();
    this.ui.goTime.textContent = timeFormatted;
    this.ui.goCombo.textContent = `${this.maxCombo}x`;

    // Show Game Over Overlay after short delay for impact
    setTimeout(() => {
      this.ui.gameoverOverlay.classList.remove('hidden');
    }, 400);
  }

  // Main loop
  loop(currentTime) {
    const rawDt = (currentTime - this.lastTime) / 1000;
    this.lastTime = currentTime;

    // Clamp dt to 50ms to prevent giant leaps if tab loses focus
    const dt = Math.min(rawDt, 0.05);

    // Measure FPS rolling average
    this.fpsFrameTimes.push(currentTime);
    while (this.fpsFrameTimes.length > 0 && this.fpsFrameTimes[0] <= currentTime - 1000) {
      this.fpsFrameTimes.shift();
    }

    // Throttle DOM update for FPS to twice per second (prevents layout thrashing)
    this.fpsUpdateTimer += dt;
    if (this.fpsUpdateTimer >= 0.5) {
      this.fps = this.fpsFrameTimes.length;
      this.ui.hudFps.textContent = `${this.fps} FPS`;
      this.fpsUpdateTimer = 0;
    }

    // State Updates
    if (this.state === 'PLAYING') {
      this.gameTime += dt;
      this.pipeSpawnTimer += dt;
      this.trailTimer += dt;

      // Spawn pipes based on difficulty spawn interval
      if (this.pipeSpawnTimer >= this.physics.config.spawnInterval) {
        this.spawnPipe();
        this.pipeSpawnTimer = 0;
      }

      // Update Bird Physics
      this.physics.updateBird(this.bird, dt);
      this.bird.wingPhase = (this.bird.wingPhase + dt * 6) % 1.0;

      // Spawn particle trails behind bird (adjust interval for mobile vs desktop)
      const trailInterval = this.renderer.isMobile ? 0.05 : 0.03;
      if (this.trailTimer > trailInterval) {
        this.renderer.spawnTrailParticle(this.bird, this.selectedSkin);
        this.trailTimer = 0;
      }

      // Update Pipes with dynamic endless speed scaling
      const effectiveSpeed = this.physics.getEffectiveSpeed(this.score);
      this.physics.updatePipes(this.pipes, dt, this.renderer.height, this.gameTime, this.score);

      // Remove offscreen pipes & check passed score
      for (let i = this.pipes.length - 1; i >= 0; i--) {
        const pipe = this.pipes[i];
        if (!pipe.passed && pipe.x + pipe.width < this.bird.x) {
          pipe.passed = true;
          this.combo++;
          if (this.combo > this.maxCombo) this.maxCombo = this.combo;

          // Points scored with multiplier
          const pts = Math.round(1 * this.physics.config.scoreMultiplier);
          const oldScore = this.score;
          this.score += pts;
          audio.playScore();

          this.ui.hudScore.textContent = this.score;

          // Show floating text
          this.renderer.spawnFloater(this.bird.x + 20, this.bird.y - 30, `+${pts}`);

          // Endless Score Milestone Celebrations (every 10 points)
          if (Math.floor(this.score / 10) > Math.floor(oldScore / 10)) {
            const milestone = Math.floor(this.score / 10) * 10;
            this.renderer.spawnFloater(this.renderer.width / 2, 140, `🔥 MILESTONE: ${milestone}!`, '#00f3ff');
            audio.playFanfare();
          }

          if (this.combo >= 3) {
            this.ui.hudCombo.textContent = `${this.combo}x COMBO!`;
            this.ui.hudCombo.classList.remove('hidden');
          }
        }

        if (pipe.x + pipe.width < -100) {
          this.pipes.splice(i, 1);
        }
      }

      // Check Collisions
      const collision = this.physics.checkCollisions(
        this.bird,
        this.pipes,
        this.renderer.width,
        this.renderer.height,
        this.renderer.groundHeight
      );

      if (collision.hit) {
        this.gameOver(collision.cause);
      }

      // Parallax Background Update with dynamic endless speed
      this.renderer.updateParallax(dt, effectiveSpeed);

    } else if (this.state === 'MENU') {
      // Gentle floating animation for bird on Menu Screen
      this.gameTime += dt;
      this.bird.y = this.renderer.height * 0.42 + Math.sin(this.gameTime * 3) * 12;
      this.bird.rotation = Math.sin(this.gameTime * 2) * 8;
      this.bird.wingPhase = (this.bird.wingPhase + dt * 4) % 1.0;
      this.renderer.updateParallax(dt, 80);
    }

    // Canvas Rendering Pass
    this.renderer.drawBackground();
    this.renderer.drawPipes(this.pipes, this.difficultyMode);
    this.renderer.drawGround();
    this.renderer.drawBird(this.bird, this.selectedSkin);
    this.renderer.updateAndDrawParticles(dt);

    // Request Next Frame
    requestAnimationFrame((t) => this.loop(t));
  }
}

// Instantiate Game on DOM Load
window.addEventListener('DOMContentLoaded', () => {
  window.game = new GameController();
});

