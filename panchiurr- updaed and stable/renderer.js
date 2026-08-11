// Canvas renderer for background, bird, pipes and particles

class Renderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d', { alpha: false }); // Optimize for non-transparent canvas performance

    this.width = 0;
    this.height = 0;
    this.dpr = 1;
    this.groundHeight = 110;

    // Detect mobile or small screen
    this.isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) || 
                    (window.innerWidth <= 768) || 
                    ('ontouchstart' in window);

    // Parallax scroll offsets
    this.bgStarsOffset = 0;
    this.bgSkylineOffset = 0;
    this.bgGridOffset = 0;
    this.groundOffset = 0;

    // Particles
    this.particles = [];
    this.floaters = [];

    // Skyline buildings
    this.buildings = [];
    
    this.resize();
    this.generateSkyline();
  }

  resize() {
    this.isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) || 
                    (window.innerWidth <= 768) || 
                    ('ontouchstart' in window);

    // Cap DPR on mobile screens to avoid massive 4k canvas fill-rate lag
    const maxDPR = this.isMobile ? 1.25 : 1.5;
    this.dpr = Math.min(window.devicePixelRatio || 1, maxDPR);

    this.width = window.innerWidth;
    this.height = window.innerHeight;

    this.canvas.width = Math.floor(this.width * this.dpr);
    this.canvas.height = Math.floor(this.height * this.dpr);

    this.ctx.resetTransform();
    this.ctx.scale(this.dpr, this.dpr);

    this.generateSkyline();
  }

  generateSkyline() {
    this.buildings = [];
    let curX = 0;
    const skylineWidth = this.width * 2.5;

    while (curX < skylineWidth) {
      const w = 40 + Math.random() * 70;
      const h = 140 + Math.random() * 220;
      const windowRows = Math.floor(h / 25);
      const windowCols = Math.floor(w / 18);
      const windows = [];

      for (let r = 0; r < windowRows; r++) {
        for (let c = 0; c < windowCols; c++) {
          if (Math.random() > 0.4) {
            windows.push({ r, c });
          }
        }
      }

      this.buildings.push({
        x: curX,
        width: w,
        height: h,
        windows,
        windowRows,
        windowCols,
        glowColor: Math.random() > 0.5 ? '#00f3ff' : '#ff007f'
      });

      curX += w + Math.random() * 15;
    }
  }

  updateParallax(dt, pipeSpeed) {
    const w = Math.max(1, this.width);
    this.bgStarsOffset = (this.bgStarsOffset + 15 * dt) % w;
    this.bgSkylineOffset = (this.bgSkylineOffset + pipeSpeed * 0.25 * dt) % (w * 1.5);
    this.bgGridOffset = (this.bgGridOffset + pipeSpeed * 0.6 * dt) % 60;
    this.groundOffset = (this.groundOffset + pipeSpeed * dt) % 40;
  }

  // Draw background sky & skyline
  drawBackground() {
    const ctx = this.ctx;
    const w = this.width;
    const h = this.height;

    // Sky gradient
    const skyGrad = ctx.createLinearGradient(0, 0, 0, h);
    skyGrad.addColorStop(0, '#060814');
    skyGrad.addColorStop(0.6, '#0f172a');
    skyGrad.addColorStop(1, '#1e1b4b');
    ctx.fillStyle = skyGrad;
    ctx.fillRect(0, 0, w, h);

    // Horizon & Cyber Buildings
    ctx.save();
    const horizonY = h - this.groundHeight;
    const buildingBaseY = horizonY;

    this.buildings.forEach(b => {
      const renderX = (b.x - this.bgSkylineOffset + w * 2) % (w * 1.8) - 100;
      if (renderX + b.width < 0 || renderX > w) return;

      const topY = buildingBaseY - b.height;

      ctx.fillStyle = 'rgba(15, 23, 42, 0.9)';
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
      ctx.lineWidth = 1;
      ctx.fillRect(renderX, topY, b.width, b.height);
      ctx.strokeRect(renderX, topY, b.width, b.height);

      ctx.fillStyle = b.glowColor;
      ctx.globalAlpha = 0.35;
      b.windows.forEach(win => {
        const wx = renderX + 8 + win.c * 16;
        const wy = topY + 15 + win.r * 22;
        if (wx + 8 < renderX + b.width) {
          ctx.fillRect(wx, wy, 7, 10);
        }
      });
      ctx.globalAlpha = 1.0;
    });

    ctx.restore();
  }

  // Draw ground
  drawGround() {
    const ctx = this.ctx;
    const w = this.width;
    const h = this.height;
    const groundY = h - this.groundHeight;

    const groundGrad = ctx.createLinearGradient(0, groundY, 0, h);
    groundGrad.addColorStop(0, '#0f172a');
    groundGrad.addColorStop(1, '#020617');
    ctx.fillStyle = groundGrad;
    ctx.fillRect(0, groundY, w, this.groundHeight);

    // Top border line
    ctx.strokeStyle = '#00f3ff';
    ctx.lineWidth = 3;
    if (!this.isMobile) {
      ctx.shadowColor = '#00f3ff';
      ctx.shadowBlur = 8;
    }
    ctx.beginPath();
    ctx.moveTo(0, groundY);
    ctx.lineTo(w, groundY);
    ctx.stroke();
    if (!this.isMobile) {
      ctx.shadowBlur = 0;
    }

    // Grid lines
    ctx.strokeStyle = 'rgba(0, 243, 255, 0.2)';
    ctx.lineWidth = 1;

    const gridSpacing = 50;
    const totalLines = Math.ceil(w / gridSpacing) + 2;
    for (let i = -2; i < totalLines; i++) {
      const startX = i * gridSpacing - (this.groundOffset % gridSpacing);
      ctx.beginPath();
      ctx.moveTo(startX, groundY);
      ctx.lineTo(startX - 20, h);
      ctx.stroke();
    }

    for (let y = groundY + 15; y < h; y += 25) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
      ctx.stroke();
    }
  }

  // Draw pipes
  drawPipes(pipes, mode) {
    const ctx = this.ctx;
    const worldH = this.height;

    pipes.forEach(pipe => {
      const pipeW = pipe.width;
      const pipeX = pipe.x;
      const gapY = pipe.currentGapY || pipe.baseGapY;
      const halfGap = pipe.gap / 2;

      let pipeGlow = '#00f3ff';
      let pipeGradStart = '#0284c7';
      let pipeGradEnd = '#0c4a6e';

      if (mode === 'hard') {
        pipeGlow = '#a855f7';
        pipeGradStart = '#7e22ce';
        pipeGradEnd = '#3b0764';
      } else if (mode === 'extreme') {
        pipeGlow = '#ff007f';
        pipeGradStart = '#be123c';
        pipeGradEnd = '#4c0519';
      }

      const topPipeBottom = gapY - halfGap;
      const bottomPipeTop = gapY + halfGap;
      const bottomPipeHeight = worldH - this.groundHeight - bottomPipeTop;

      const drawSinglePipe = (x, y, width, height, isTop) => {
        if (height <= 0) return;

        ctx.save();
        if (!this.isMobile) {
          ctx.shadowColor = pipeGlow;
          ctx.shadowBlur = 8;
        }

        const grad = ctx.createLinearGradient(x, 0, x + width, 0);
        grad.addColorStop(0, pipeGradEnd);
        grad.addColorStop(0.3, pipeGradStart);
        grad.addColorStop(0.7, pipeGlow);
        grad.addColorStop(1, pipeGradEnd);

        ctx.fillStyle = grad;
        ctx.fillRect(x, y, width, height);

        ctx.strokeStyle = pipeGlow;
        ctx.lineWidth = 2;
        ctx.strokeRect(x, y, width, height);

        const capHeight = 24;
        const capLipWidth = 10;
        const capX = x - capLipWidth / 2;
        const capWidth = width + capLipWidth;
        const capY = isTop ? y + height - capHeight : y;

        const capGrad = ctx.createLinearGradient(capX, 0, capX + capWidth, 0);
        capGrad.addColorStop(0, '#ffffff');
        capGrad.addColorStop(0.5, pipeGlow);
        capGrad.addColorStop(1, pipeGradEnd);

        ctx.fillStyle = capGrad;
        ctx.fillRect(capX, capY, capWidth, capHeight);
        ctx.strokeRect(capX, capY, capWidth, capHeight);

        ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
        ctx.fillRect(x + width * 0.25, y, 4, height);

        ctx.restore();
      };

      drawSinglePipe(pipeX, 0, pipeW, topPipeBottom, true);
      drawSinglePipe(pipeX, bottomPipeTop, pipeW, bottomPipeHeight, false);

      // Extreme laser beam
      if (pipe.hasLaser && pipe.laserState) {
        ctx.save();
        const laserX = pipeX + pipeW / 2;
        const laserY1 = topPipeBottom + 2;
        const laserY2 = bottomPipeTop - 2;

        if (!this.isMobile) {
          ctx.shadowColor = '#ff0055';
          ctx.shadowBlur = 10;
        }

        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 6;
        ctx.beginPath();
        ctx.moveTo(laserX, laserY1);
        ctx.lineTo(laserX, laserY2);
        ctx.stroke();

        ctx.strokeStyle = 'rgba(255, 0, 85, 0.8)';
        ctx.lineWidth = 16;
        ctx.beginPath();
        ctx.moveTo(laserX, laserY1);
        ctx.lineTo(laserX, laserY2);
        ctx.stroke();

        ctx.restore();
      }
    });
  }

  // Draw bird
  drawBird(bird, skin) {
    const ctx = this.ctx;
    ctx.save();
    ctx.translate(bird.x, bird.y);
    ctx.rotate((bird.rotation * Math.PI) / 180);

    // Skin Color Setup
    let primaryColor = '#00f3ff';
    let secondaryColor = '#0088ff';
    let trailGlow = '#00f3ff';

    if (skin === 'phoenix') {
      primaryColor = '#ff4500';
      secondaryColor = '#ffd700';
      trailGlow = '#ff4500';
    } else if (skin === 'plasma') {
      primaryColor = '#a855f7';
      secondaryColor = '#ec4899';
      trailGlow = '#a855f7';
    } else if (skin === 'matrix') {
      primaryColor = '#00ff66';
      secondaryColor = '#059669';
      trailGlow = '#00ff66';
    }

    // Bird Outer Aura Glow (Lightened blur for high FPS)
    if (!this.isMobile) {
      ctx.shadowColor = trailGlow;
      ctx.shadowBlur = 10;
    }

    // Body Capsule / Oval
    const bodyGrad = ctx.createRadialGradient(-4, -4, 2, 0, 0, bird.radius);
    bodyGrad.addColorStop(0, '#ffffff');
    bodyGrad.addColorStop(0.4, primaryColor);
    bodyGrad.addColorStop(1, secondaryColor);

    ctx.fillStyle = bodyGrad;
    ctx.beginPath();
    ctx.arc(0, 0, bird.radius, 0, Math.PI * 2);
    ctx.fill();

    // Outer cyber ring border
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Cyber Eye Visor
    ctx.fillStyle = '#0f172a';
    ctx.beginPath();
    ctx.ellipse(6, -5, 7, 5, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = primaryColor;
    ctx.beginPath();
    ctx.arc(8, -5, 3, 0, Math.PI * 2);
    ctx.fill();

    // Animated Wing Flap
    const wingY = Math.sin(bird.wingPhase * Math.PI * 2) * 8;
    ctx.fillStyle = secondaryColor;
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.ellipse(-6, wingY, 10, 5, Math.PI / 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Cyber Beak
    ctx.fillStyle = '#ffd700';
    ctx.beginPath();
    ctx.moveTo(bird.radius - 2, 0);
    ctx.lineTo(bird.radius + 10, 4);
    ctx.lineTo(bird.radius - 2, 8);
    ctx.closePath();
    ctx.fill();

    ctx.restore();
  }

  // Add trail particle from bird position
  spawnTrailParticle(bird, skin) {
    const maxParticles = this.isMobile ? 40 : 120;
    if (this.particles.length >= maxParticles) return; // Cap active particle pool for mobile

    let color = '#00f3ff';
    if (skin === 'phoenix') color = '#ff8800';
    if (skin === 'plasma') color = '#c084fc';
    if (skin === 'matrix') color = '#34d399';

    this.particles.push({
      x: bird.x - 12 + (Math.random() * 6 - 3),
      y: bird.y + (Math.random() * 8 - 4),
      vx: -80 - Math.random() * 40,
      vy: Math.random() * 30 - 15,
      size: 3 + Math.random() * 3,
      color: color,
      life: 0.35,
      maxLife: 0.35
    });
  }

  // Burst explosion on crash
  spawnExplosion(x, y, count = 30) {
    const maxCount = this.isMobile ? 20 : count;
    const colors = ['#ff007f', '#00f3ff', '#ffd700', '#ffffff'];
    for (let i = 0; i < maxCount; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 100 + Math.random() * 300;
      this.particles.push({
        x: x,
        y: y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        size: 3 + Math.random() * 4,
        color: colors[Math.floor(Math.random() * colors.length)],
        life: 0.5 + Math.random() * 0.3,
        maxLife: 0.8
      });
    }
  }

  // Floating score popups (+1, COMBO!, MILESTONE!)
  spawnFloater(x, y, text, color = '#ffd700') {
    if (this.floaters.length > 15) this.floaters.shift(); // Bound floaters pool
    this.floaters.push({
      x: x,
      y: y,
      text: text,
      color: color,
      life: 1.0,
      maxLife: 1.0
    });
  }

  updateAndDrawParticles(dt) {
    const ctx = this.ctx;

    // Render Trail / Explosion Particles (Optimized: NO shadowBlur per particle!)
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.life -= dt;
      if (p.life <= 0) {
        this.particles.splice(i, 1);
        continue;
      }

      p.x += p.vx * dt;
      p.y += p.vy * dt;

      const alpha = p.life / p.maxLife;
      ctx.globalAlpha = alpha;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size * alpha, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1.0;

    // Render Floating Text
    for (let i = this.floaters.length - 1; i >= 0; i--) {
      const f = this.floaters[i];
      f.life -= dt;
      if (f.life <= 0) {
        this.floaters.splice(i, 1);
        continue;
      }

      f.y -= 45 * dt; // float up
      const alpha = f.life / f.maxLife;

      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.font = 'bold 22px "Orbitron", sans-serif';
      ctx.fillStyle = f.color;
      ctx.textAlign = 'center';
      ctx.fillText(f.text, f.x, f.y);
      ctx.restore();
    }
  }
}
