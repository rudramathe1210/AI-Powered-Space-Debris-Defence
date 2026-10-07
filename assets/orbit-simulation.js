/**
 * OrbitShield Orbital Simulation & Physics Engine
 * High-performance 60FPS dual-mode (2D Tactical & 3D Spherical) orbital dynamics simulator.
 */

class OrbitSimulation {
  constructor(canvasId, options = {}) {
    this.canvas = document.getElementById(canvasId);
    if (!this.canvas) throw new Error(`Canvas #${canvasId} not found`);
    this.ctx = this.canvas.getContext('2d');

    // Simulation State
    this.isPlaying = true;
    this.speedMultiplier = 1; // 1x, 5x, 30x, 120x, 600x
    this.simTime = 0; // seconds relative to reference epoch (T0 = TCA)
    this.tcaOffset = -138 * 60; // Start 138 minutes before TCA for default DEB-7750
    this.currentSimSeconds = this.tcaOffset;

    // View & Camera Parameters
    this.viewMode = '2D'; // '2D' or '3D'
    this.zoom = 1.0;
    this.panX = 0;
    this.panY = 0;
    this.rotX = 0.35; // 3D pitch
    this.rotY = -0.55; // 3D yaw
    this.isDragging = false;
    this.lastMouseX = 0;
    this.lastMouseY = 0;

    // Display Toggles
    this.showCorridor = true;
    this.showTrails = true;
    this.showVectors = true;
    this.showDebrisField = true;

    // Active Satellite & Scenario
    this.satellite = {
      id: 'AURORA-7',
      altitude: 550, // km
      inclination: 97.6, // deg
      period: 95.6 * 60, // ~5736 sec
      radiusPx: 175,
      maneuverDelta: 0, // km added by burn
      fuel: 86.4
    };

    this.scenario = {
      id: 'DEB-7750',
      missDistance: 842, // meters at TCA
      relativeVelocity: 7.8, // km/s
      tcaMinutes: 138,
      altitude: 562,
      score: 48,
      type: 'Rocket body fragment'
    };

    // Maneuver State
    this.isBurning = false;
    this.burnParticles = [];
    this.maneuverExecuted = false;

    // Earth Texture
    this.earthImg = new Image();
    this.earthImg.src = 'assets/earth.jpg';
    this.earthRadiusPx = 95;
    this.earthAngle = 0;

    // Background Debris Field (50 particles)
    this.debrisParticles = this.generateDebrisField(55);

    // Callbacks
    this.onTelemetryUpdate = options.onTelemetryUpdate || null;
    this.onAlert = options.onAlert || null;

    // Setup event listeners & start loop
    this.initEvents();
    this.resizeCanvas();
    window.addEventListener('resize', () => this.resizeCanvas());

    this.lastTimestamp = performance.now();
    this.animate = this.animate.bind(this);
    requestAnimationFrame(this.animate);
  }

  generateDebrisField(count) {
    const list = [];
    for (let i = 0; i < count; i++) {
      const radius = 115 + Math.random() * 140; // LEO to MEO
      const speed = (0.0004 + Math.random() * 0.0007) * (Math.random() > 0.15 ? 1 : -1);
      const angle = Math.random() * Math.PI * 2;
      const tilt = (Math.random() - 0.5) * 1.2;
      const size = Math.random() > 0.7 ? 2.5 : 1.5;
      const id = `DEB-${Math.floor(1000 + Math.random() * 9000)}`;
      list.push({ radius, speed, angle, tilt, size, id });
    }
    return list;
  }

  resizeCanvas() {
    const rect = this.canvas.parentElement.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    this.canvas.width = rect.width * dpr;
    this.canvas.height = rect.height * dpr;
    this.ctx.scale(dpr, dpr);
    this.width = rect.width;
    this.height = rect.height;
  }

  initEvents() {
    this.canvas.addEventListener('mousedown', (e) => {
      this.isDragging = true;
      this.lastMouseX = e.clientX;
      this.lastMouseY = e.clientY;
    });

    window.addEventListener('mousemove', (e) => {
      if (!this.isDragging) return;
      const dx = e.clientX - this.lastMouseX;
      const dy = e.clientY - this.lastMouseY;
      this.lastMouseX = e.clientX;
      this.lastMouseY = e.clientY;

      if (this.viewMode === '3D') {
        this.rotY += dx * 0.008;
        this.rotX += dy * 0.008;
        this.rotX = Math.max(-Math.PI / 2 + 0.1, Math.min(Math.PI / 2 - 0.1, this.rotX));
      } else {
        this.panX += dx;
        this.panY += dy;
      }
    });

    window.addEventListener('mouseup', () => {
      this.isDragging = false;
    });

    this.canvas.addEventListener('wheel', (e) => {
      e.preventDefault();
      const zoomFactor = e.deltaY < 0 ? 1.08 : 0.92;
      this.zoom = Math.max(0.4, Math.min(3.0, this.zoom * zoomFactor));
    });
  }

  setScenario(scenario) {
    this.scenario = { ...scenario };
    this.tcaOffset = -scenario.tcaMinutes * 60;
    this.currentSimSeconds = this.tcaOffset;
    this.maneuverExecuted = false;
    this.satellite.maneuverDelta = 0;
  }

  setSatellite(sat) {
    this.satellite = { ...this.satellite, ...sat };
  }

  setSpeed(multiplier) {
    this.speedMultiplier = multiplier;
  }

  togglePlay() {
    this.isPlaying = !this.isPlaying;
    return this.isPlaying;
  }

  resetView() {
    this.zoom = 1.0;
    this.panX = 0;
    this.panY = 0;
    this.rotX = 0.35;
    this.rotY = -0.55;
  }

  scrubTime(percent) {
    // Range from -60 min to +60 min relative to TCA (or relative to total window)
    const windowSeconds = 120 * 60;
    this.currentSimSeconds = (percent - 0.5) * windowSeconds;
  }

  executeEvasiveBurn() {
    if (this.maneuverExecuted) return;
    this.isBurning = true;
    this.maneuverExecuted = true;
    // Add delta-radius to satellite orbit (expand by equivalent 4.2 km)
    this.satellite.maneuverDelta = 22; // pixels offset
    this.satellite.fuel = Math.max(0, this.satellite.fuel - 1.4);

    // Spawn thruster plume particles
    setTimeout(() => {
      this.isBurning = false;
    }, 1800);
  }

  // Calculate live separation distance in meters
  calculateLiveDistance() {
    // Miss distance at TCA plus hyperbolic divergence
    const timeFromTca = this.currentSimSeconds; // seconds from TCA
    const vRel = this.scenario.relativeVelocity * 1000; // m/s
    const baseMiss = this.maneuverExecuted 
      ? this.scenario.missDistance + 4500 
      : this.scenario.missDistance;

    // Hyperbolic encounter geometry: D(t) = sqrt(miss^2 + (v_rel * dt)^2)
    const distanceMeters = Math.sqrt(Math.pow(baseMiss, 2) + Math.pow(vRel * (timeFromTca / 80), 2));
    return Math.round(distanceMeters);
  }

  // Animation Loop
  animate(timestamp) {
    const dt = (timestamp - this.lastTimestamp) / 1000;
    this.lastTimestamp = timestamp;

    if (this.isPlaying) {
      this.currentSimSeconds += dt * this.speedMultiplier;
      this.earthAngle += dt * 0.04 * this.speedMultiplier;
    }

    this.render();

    // Telemetry updates
    if (this.onTelemetryUpdate) {
      const distance = this.calculateLiveDistance();
      const inCorridor = distance <= 2000;
      this.onTelemetryUpdate({
        distance,
        timeToTcaSeconds: -this.currentSimSeconds,
        inCorridor,
        simSpeed: this.speedMultiplier,
        currentSimSeconds: this.currentSimSeconds
      });
    }

    requestAnimationFrame(this.animate);
  }

  render() {
    const { ctx, width, height } = this;
    ctx.clearRect(0, 0, width, height);

    // Coordinate Center with Pan/Zoom
    const cx = width / 2 + this.panX;
    const cy = height / 2 + this.panY;

    ctx.save();
    ctx.translate(cx, cy);
    ctx.scale(this.zoom, this.zoom);

    if (this.viewMode === '2D') {
      this.render2DTactical(ctx);
    } else {
      this.render3DSpherical(ctx);
    }

    ctx.restore();
  }

  /* ================= 2D Tactical View Mode ================= */
  render2DTactical(ctx) {
    // 1. Grid Background
    this.drawGrid(ctx);

    // 2. Earth Center with Texture & Atmosphere
    this.drawEarth2D(ctx);

    // 3. Background Debris Particles
    if (this.showDebrisField) {
      this.drawDebrisParticles2D(ctx);
    }

    // 4. Primary Satellite Orbit Track & Safety Corridor
    const satR = this.satellite.radiusPx + this.satellite.maneuverDelta;
    const satAngle = (this.currentSimSeconds / this.satellite.period) * Math.PI * 2;
    const satX = Math.cos(satAngle) * satR;
    const satY = Math.sin(satAngle) * (satR * 0.42); // Oblique projection

    // Orbit ellipse
    ctx.save();
    ctx.rotate(-0.28); // Inclination rotation

    // Safety Corridor Tube (+/- 2.0 km envelope)
    if (this.showCorridor) {
      const dist = this.calculateLiveDistance();
      const isBreach = dist <= 2000;
      ctx.beginPath();
      ctx.ellipse(0, 0, satR + 12, (satR + 12) * 0.42, 0, 0, Math.PI * 2);
      ctx.strokeStyle = isBreach ? 'rgba(239, 68, 68, 0.45)' : 'rgba(16, 185, 129, 0.22)';
      ctx.lineWidth = 14;
      ctx.stroke();

      ctx.beginPath();
      ctx.ellipse(0, 0, satR - 12, (satR - 12) * 0.42, 0, 0, Math.PI * 2);
      ctx.strokeStyle = isBreach ? 'rgba(239, 68, 68, 0.3)' : 'rgba(16, 185, 129, 0.15)';
      ctx.lineWidth = 2;
      ctx.setLineDash([4, 6]);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // Primary Satellite Orbit Line
    ctx.beginPath();
    ctx.ellipse(0, 0, satR, satR * 0.42, 0, 0, Math.PI * 2);
    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 2;
    ctx.shadowColor = 'rgba(56, 189, 248, 0.8)';
    ctx.shadowBlur = 10;
    ctx.stroke();
    ctx.shadowBlur = 0;

    // Active Debris Orbit Track (Intersecting hyperbolic / elliptic track)
    ctx.beginPath();
    ctx.ellipse(20, -10, satR * 1.06, satR * 0.58, 0.65, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(245, 158, 11, 0.5)';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([6, 6]);
    ctx.stroke();
    ctx.setLineDash([]);

    // 5. Active Debris Position
    // Approaching conjunction point (located around angle = 0.85)
    const conjunctionAngle = 0.85;
    const progress = (this.currentSimSeconds / (60 * 60)) * 0.4;
    const debAngle = conjunctionAngle + progress;
    const debR = satR * 1.05;
    const debX = Math.cos(debAngle) * debR;
    const debY = Math.sin(debAngle) * (debR * 0.52);

    // Conjunction Marker & Radar Ping
    const dist = this.calculateLiveDistance();
    const isCritical = dist <= 2000;

    // Radar reticle at conjunction point
    ctx.beginPath();
    const conjX = Math.cos(conjunctionAngle) * satR;
    const conjY = Math.sin(conjunctionAngle) * (satR * 0.42);
    ctx.arc(conjX, conjY, 18, 0, Math.PI * 2);
    ctx.strokeStyle = isCritical ? '#ef4444' : 'rgba(245, 158, 11, 0.7)';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([3, 4]);
    ctx.stroke();
    ctx.setLineDash([]);

    // Distance vector line connecting Satellite and Debris
    ctx.beginPath();
    ctx.moveTo(satX, satY);
    ctx.lineTo(debX, debY);
    ctx.strokeStyle = isCritical ? 'rgba(239, 68, 68, 0.8)' : 'rgba(245, 158, 11, 0.45)';
    ctx.lineWidth = 1.2;
    ctx.setLineDash([2, 4]);
    ctx.stroke();
    ctx.setLineDash([]);

    // Label on distance vector
    const midX = (satX + debX) / 2;
    const midY = (satY + debY) / 2;
    ctx.fillStyle = isCritical ? '#fca5a5' : '#fde68a';
    ctx.font = '10px "IBM Plex Mono", monospace';
    ctx.fillText(`${dist} m`, midX + 6, midY - 6);

    // 6. Draw Active Debris Icon
    ctx.beginPath();
    ctx.arc(debX, debY, 4.5, 0, Math.PI * 2);
    ctx.fillStyle = '#f59e0b';
    ctx.shadowColor = '#f59e0b';
    ctx.shadowBlur = 12;
    ctx.fill();
    ctx.shadowBlur = 0;

    // Debris Label
    ctx.fillStyle = '#fde68a';
    ctx.font = '10.5px "IBM Plex Mono", monospace';
    ctx.fillText(this.scenario.id, debX + 10, debY - 4);
    ctx.font = '9px "IBM Plex Mono", monospace';
    ctx.fillStyle = 'rgba(253, 230, 138, 0.7)';
    ctx.fillText(`${this.scenario.type}`, debX + 10, debY + 8);

    // 7. Draw Satellite Icon
    this.drawSatelliteIcon(ctx, satX, satY, satAngle);

    // 8. Thruster Plume if Burning
    if (this.isBurning) {
      this.drawThrusterPlume(ctx, satX, satY, satAngle);
    }

    ctx.restore();
  }

  drawGrid(ctx) {
    ctx.save();
    ctx.strokeStyle = 'rgba(56, 189, 248, 0.05)';
    ctx.lineWidth = 1;
    const span = 450;
    const step = 45;
    for (let x = -span; x <= span; x += step) {
      ctx.beginPath();
      ctx.moveTo(x, -span);
      ctx.lineTo(x, span);
      ctx.stroke();
    }
    for (let y = -span; y <= span; y += step) {
      ctx.beginPath();
      ctx.moveTo(-span, y);
      ctx.lineTo(span, y);
      ctx.stroke();
    }
    ctx.restore();
  }

  drawEarth2D(ctx) {
    const r = this.earthRadiusPx;

    // Atmosphere Glow
    const gradient = ctx.createRadialGradient(0, 0, r * 0.8, 0, 0, r * 1.3);
    gradient.addColorStop(0, 'rgba(56, 189, 248, 0.28)');
    gradient.addColorStop(0.5, 'rgba(3, 105, 161, 0.12)');
    gradient.addColorStop(1, 'rgba(3, 105, 161, 0)');
    ctx.beginPath();
    ctx.arc(0, 0, r * 1.3, 0, Math.PI * 2);
    ctx.fillStyle = gradient;
    ctx.fill();

    // Clip circle for Earth
    ctx.save();
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.clip();

    // Earth Texture or Fallback Vector Earth
    if (this.earthImg.complete && this.earthImg.naturalWidth > 0) {
      ctx.drawImage(this.earthImg, -r, -r, r * 2, r * 2);
    } else {
      // High-tech vector globe fallback
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(-r, -r, r * 2, r * 2);
      ctx.strokeStyle = 'rgba(56, 189, 248, 0.25)';
      ctx.lineWidth = 1.5;
      for (let lat = -60; lat <= 60; lat += 30) {
        ctx.beginPath();
        const y = Math.sin((lat * Math.PI) / 180) * r;
        const w = Math.cos((lat * Math.PI) / 180) * r;
        ctx.ellipse(0, y, w, w * 0.25, 0, 0, Math.PI * 2);
        ctx.stroke();
      }
    }

    // Shadow Terminator (Day/Night transition)
    const shadowGrad = ctx.createLinearGradient(-r, -r, r, r);
    shadowGrad.addColorStop(0, 'rgba(0, 0, 0, 0)');
    shadowGrad.addColorStop(0.55, 'rgba(5, 10, 20, 0.35)');
    shadowGrad.addColorStop(1, 'rgba(2, 6, 15, 0.85)');
    ctx.fillStyle = shadowGrad;
    ctx.fillRect(-r, -r, r * 2, r * 2);

    ctx.restore();

    // Earth Border Ring
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(56, 189, 248, 0.6)';
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }

  drawDebrisParticles2D(ctx) {
    ctx.save();
    for (const p of this.debrisParticles) {
      p.angle += p.speed * this.speedMultiplier;
      const x = Math.cos(p.angle) * p.radius;
      const y = Math.sin(p.angle) * (p.radius * 0.42) + Math.sin(p.angle * 2) * (p.tilt * 18);

      ctx.beginPath();
      ctx.arc(x, y, p.size, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(148, 163, 184, 0.45)';
      ctx.fill();
    }
    ctx.restore();
  }

  drawSatelliteIcon(ctx, x, y, angle) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle + Math.PI / 2);

    // Communications beam / Telemetry Cone
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(-14, 32);
    ctx.lineTo(14, 32);
    ctx.closePath();
    ctx.fillStyle = 'rgba(56, 189, 248, 0.08)';
    ctx.fill();

    // Velocity Vector Arrow
    if (this.showVectors) {
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(0, -28);
      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 1.5;
      ctx.stroke();
      // Arrowhead
      ctx.beginPath();
      ctx.moveTo(-3, -24);
      ctx.lineTo(0, -30);
      ctx.lineTo(3, -24);
      ctx.fillStyle = '#38bdf8';
      ctx.fill();
    }

    // Solar Panels
    ctx.fillStyle = '#0284c7';
    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 1;
    // Left Wing
    ctx.fillRect(-16, -4, 9, 8);
    ctx.strokeRect(-16, -4, 9, 8);
    // Right Wing
    ctx.fillRect(7, -4, 9, 8);
    ctx.strokeRect(7, -4, 9, 8);

    // Satellite Bus (Body)
    ctx.fillStyle = '#f8fafc';
    ctx.fillRect(-5, -6, 10, 12);

    // Gold thermal foil accent
    ctx.fillStyle = '#fbbf24';
    ctx.fillRect(-3, -4, 6, 8);

    // Center telemetry beacon
    ctx.beginPath();
    ctx.arc(0, 0, 3, 0, Math.PI * 2);
    ctx.fillStyle = '#38bdf8';
    ctx.shadowColor = '#38bdf8';
    ctx.shadowBlur = 8;
    ctx.fill();
    ctx.shadowBlur = 0;

    // Label
    ctx.rotate(-(angle + Math.PI / 2));
    ctx.fillStyle = '#38bdf8';
    ctx.font = '10.5px "IBM Plex Mono", monospace';
    ctx.fillText(this.satellite.id, 14, 4);

    ctx.restore();
  }

  drawThrusterPlume(ctx, x, y, angle) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);

    for (let i = 0; i < 12; i++) {
      const len = 12 + Math.random() * 24;
      const spread = (Math.random() - 0.5) * 8;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(-len, spread);
      ctx.strokeStyle = Math.random() > 0.4 ? 'rgba(239, 68, 68, 0.8)' : 'rgba(251, 191, 36, 0.9)';
      ctx.lineWidth = 2;
      ctx.stroke();
    }
    ctx.restore();
  }

  /* ================= 3D Spherical Orbit View Mode ================= */
  render3DSpherical(ctx) {
    const cosY = Math.cos(this.rotY);
    const sinY = Math.sin(this.rotY);
    const cosX = Math.cos(this.rotX);
    const sinX = Math.sin(this.rotX);

    // Helper 3D projection
    const project = (x, y, z) => {
      // Rotate around Y
      const x1 = x * cosY + z * sinY;
      const z1 = -x * sinY + z * cosY;
      // Rotate around X
      const y2 = y * cosX - z1 * sinX;
      const z2 = y * sinX + z1 * cosX;
      return { px: x1, py: y2, pz: z2 };
    };

    // 1. Draw 3D Globe Sphere
    const r = this.earthRadiusPx;
    const grad = ctx.createRadialGradient(r * 0.2, -r * 0.2, r * 0.2, 0, 0, r * 1.1);
    grad.addColorStop(0, '#1e293b');
    grad.addColorStop(0.6, '#0f172a');
    grad.addColorStop(1, '#020617');

    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.fillStyle = grad;
    ctx.fill();

    // 3D Atmosphere Ring
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(56, 189, 248, 0.5)';
    ctx.lineWidth = 2;
    ctx.stroke();

    // 3D Latitude/Longitude Grid on Globe
    ctx.save();
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.clip();

    ctx.strokeStyle = 'rgba(56, 189, 248, 0.15)';
    ctx.lineWidth = 1;
    for (let lat = -60; lat <= 60; lat += 30) {
      ctx.beginPath();
      const zPlane = Math.sin((lat * Math.PI) / 180) * r;
      const radPlane = Math.cos((lat * Math.PI) / 180) * r;
      let first = true;
      for (let lon = 0; lon <= 360; lon += 10) {
        const radLon = ((lon + this.earthAngle * 20) * Math.PI) / 180;
        const x = Math.cos(radLon) * radPlane;
        const y = Math.sin(radLon) * radPlane;
        const p = project(x, y, zPlane);
        if (p.pz > -r * 0.1) {
          if (first) { ctx.moveTo(p.px, p.py); first = false; }
          else { ctx.lineTo(p.px, p.py); }
        } else {
          first = true;
        }
      }
      ctx.stroke();
    }
    ctx.restore();

    // 2. Draw 3D Satellite Orbit Ring
    const satR = this.satellite.radiusPx + this.satellite.maneuverDelta;
    ctx.beginPath();
    for (let a = 0; a <= Math.PI * 2 + 0.1; a += 0.1) {
      // 97.6 deg inclination tilted in 3D
      const x = Math.cos(a) * satR;
      const y = Math.sin(a) * satR * Math.cos((97.6 * Math.PI) / 180);
      const z = Math.sin(a) * satR * Math.sin((97.6 * Math.PI) / 180);
      const p = project(x, y, z);
      if (a === 0) ctx.moveTo(p.px, p.py);
      else ctx.lineTo(p.px, p.py);
    }
    ctx.strokeStyle = 'rgba(56, 189, 248, 0.85)';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Satellite 3D Position
    const satAngle = (this.currentSimSeconds / this.satellite.period) * Math.PI * 2;
    const sx = Math.cos(satAngle) * satR;
    const sy = Math.sin(satAngle) * satR * Math.cos((97.6 * Math.PI) / 180);
    const sz = Math.sin(satAngle) * satR * Math.sin((97.6 * Math.PI) / 180);
    const satP = project(sx, sy, sz);

    ctx.beginPath();
    ctx.arc(satP.px, satP.py, 5, 0, Math.PI * 2);
    ctx.fillStyle = '#38bdf8';
    ctx.shadowColor = '#38bdf8';
    ctx.shadowBlur = 10;
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.fillText(this.satellite.id, satP.px + 10, satP.py - 6);

    // 3. Draw 3D Debris Orbit
    const debR = satR * 1.05;
    ctx.beginPath();
    for (let a = 0; a <= Math.PI * 2 + 0.1; a += 0.1) {
      const x = Math.cos(a) * debR;
      const y = Math.sin(a) * debR * Math.cos((65 * Math.PI) / 180);
      const z = Math.sin(a) * debR * Math.sin((65 * Math.PI) / 180);
      const p = project(x, y, z);
      if (a === 0) ctx.moveTo(p.px, p.py);
      else ctx.lineTo(p.px, p.py);
    }
    ctx.strokeStyle = 'rgba(245, 158, 11, 0.6)';
    ctx.setLineDash([4, 4]);
    ctx.stroke();
    ctx.setLineDash([]);

    // Debris 3D Position
    const progress = (this.currentSimSeconds / (60 * 60)) * 0.4;
    const debAngle = 0.85 + progress;
    const dx = Math.cos(debAngle) * debR;
    const dy = Math.sin(debAngle) * debR * Math.cos((65 * Math.PI) / 180);
    const dz = Math.sin(debAngle) * debR * Math.sin((65 * Math.PI) / 180);
    const debP = project(dx, dy, dz);

    ctx.beginPath();
    ctx.arc(debP.px, debP.py, 4.5, 0, Math.PI * 2);
    ctx.fillStyle = '#f59e0b';
    ctx.fill();
    ctx.fillText(this.scenario.id, debP.px + 8, debP.py - 4);
  }
}

window.OrbitSimulation = OrbitSimulation;
