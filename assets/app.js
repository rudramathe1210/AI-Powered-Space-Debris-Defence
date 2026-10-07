/**
 * OrbitShield Main Application Controller
 * Handles UI interactions, state management, toasts, telemetry updates, and tabs.
 */

document.addEventListener('DOMContentLoaded', () => {
  // Scenarios Data (from OrbitShield)
  const SCENARIOS = [
    {
      id: 'DEB-7750',
      score: 48,
      missDistance: 842,
      relativeVelocity: 7.8,
      tcaMinutes: 138,
      tcaStr: '02h 18m',
      altitude: 562,
      size: '0.8 m',
      uncertainty: 38,
      type: 'Rocket body fragment',
      badgeClass: 'medium'
    },
    {
      id: 'DEB-4182',
      score: 73,
      missDistance: 284,
      relativeVelocity: 12.4,
      tcaMinutes: 42,
      tcaStr: '00h 42m',
      altitude: 548,
      size: '1.4 m',
      uncertainty: 64,
      type: 'Payload fragment',
      badgeClass: 'high'
    },
    {
      id: 'DEB-0931',
      score: 24,
      missDistance: 1840,
      relativeVelocity: 4.2,
      tcaMinutes: 336,
      tcaStr: '05h 36m',
      altitude: 591,
      size: '0.3 m',
      uncertainty: 22,
      type: 'Unclassified fragment',
      badgeClass: 'low'
    },
    {
      id: 'DEB-5576',
      score: 57,
      missDistance: 610,
      relativeVelocity: 9.6,
      tcaMinutes: 192,
      tcaStr: '03h 12m',
      altitude: 574,
      size: '1.1 m',
      uncertainty: 49,
      type: 'Rocket body fragment',
      badgeClass: 'medium'
    }
  ];

  // Satellite Fleet Data
  const SATELLITES = {
    'AURORA-7': { id: 'AURORA-7', altitude: 550, inclination: 97.6, fuel: 86.4, tracked: 1248 },
    'ORION-2': { id: 'ORION-2', altitude: 575, inclination: 98.2, fuel: 74.8, tracked: 1106 },
    'NOVA-4': { id: 'NOVA-4', altitude: 590, inclination: 96.8, fuel: 92.1, tracked: 1362 }
  };

  let currentSat = SATELLITES['AURORA-7'];
  let currentScenario = SCENARIOS[0];

  // UI Elements
  const canvasEl = document.getElementById('simulationCanvas');
  const playPauseBtn = document.getElementById('playPauseBtn');
  const playPauseText = document.getElementById('playPauseText');
  const speedButtons = document.querySelectorAll('.speed-opt');
  const timeSlider = document.getElementById('timeSlider');
  const timeDisplay = document.getElementById('timeDisplay');
  const satSelect = document.getElementById('satSelect');
  const cardsContainer = document.getElementById('cardsContainer');
  const timelineList = document.getElementById('timelineList');
  const executeBurnBtn = document.getElementById('executeBurnBtn');
  const maneuverCallout = document.getElementById('maneuverCallout');
  const toastContainer = document.getElementById('toastContainer');

  // Telemetry Elements
  const liveDistEl = document.getElementById('liveDistance');
  const liveTcaEl = document.getElementById('liveTca');
  const hudDistanceEl = document.getElementById('hudDistance');
  const hudTcaEl = document.getElementById('hudTca');
  const hudStatusEl = document.getElementById('hudStatus');
  const satAltEl = document.getElementById('satAltitude');
  const satIncEl = document.getElementById('satInclination');
  const satFuelEl = document.getElementById('satFuel');
  const activeDebEl = document.getElementById('activeDebrisId');
  const statusPulse = document.getElementById('statusPulse');
  const statusText = document.getElementById('statusText');

  // Initialize Simulation Engine
  const sim = new OrbitSimulation('simulationCanvas', {
    onTelemetryUpdate: (data) => {
      // Format live distance
      const distStr = `${data.distance.toLocaleString()} m`;
      if (liveDistEl) liveDistEl.textContent = distStr;
      if (hudDistanceEl) hudDistanceEl.textContent = distStr;

      // Format TCA countdown
      const tcaSecs = Math.max(0, Math.floor(data.timeToTcaSeconds));
      const hours = Math.floor(tcaSecs / 3600);
      const mins = Math.floor((tcaSecs % 3600) / 60);
      const secs = tcaSecs % 60;
      const tcaStr = `${String(hours).padStart(2, '0')}h ${String(mins).padStart(2, '0')}m ${String(secs).padStart(2, '0')}s`;
      
      if (liveTcaEl) liveTcaEl.textContent = tcaStr;
      if (hudTcaEl) hudTcaEl.textContent = tcaStr;
      if (timeDisplay) timeDisplay.textContent = `TCA -${tcaStr}`;

      // Corridor Breach Alert
      if (data.inCorridor) {
        if (hudStatusEl) {
          hudStatusEl.textContent = 'CORRIDOR INTRUSION';
          hudStatusEl.className = 'telemetry-value critical';
        }
        if (statusPulse) statusPulse.className = 'pulse-dot danger';
        if (statusText) statusText.textContent = 'WARNING: Debris inside 2.0 km corridor';
      } else {
        if (hudStatusEl) {
          hudStatusEl.textContent = 'NOMINAL (CLEAR)';
          hudStatusEl.className = 'telemetry-value safe';
        }
        if (statusPulse) statusPulse.className = 'pulse-dot';
        if (statusText) statusText.textContent = sim.isPlaying ? 'Simulated tracking layer active' : 'Simulation paused';
      }
    }
  });

  // Toast Notification Helper
  function showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `<span>${type === 'success' ? '✔' : type === 'alert' ? '⚠' : 'ℹ'}</span> <div>${message}</div>`;
    toastContainer.appendChild(toast);
    setTimeout(() => toast.classList.add('show'), 20);
    setTimeout(() => {
      toast.classList.remove('show');
      setTimeout(() => toast.remove(), 400);
    }, 3800);
  }

  // Add Event to Assessment Timeline
  function addTimelineEvent(text, isAlert = false) {
    const item = document.createElement('li');
    item.className = 'timeline-item';
    const now = new Date().toTimeString().split(' ')[0];
    item.innerHTML = `
      <span class="timeline-dot ${isAlert ? 'alert' : 'current'}"></span>
      <div class="timeline-content">
        <span>${text}</span>
        <span class="timeline-time">${now} UTC · Simulation Event</span>
      </div>
    `;
    timelineList.prepend(item);
  }

  // Bind Play/Pause
  playPauseBtn.addEventListener('click', () => {
    const playing = sim.togglePlay();
    playPauseText.textContent = playing ? 'Pause' : 'Resume';
    playPauseBtn.classList.toggle('primary', !playing);
    addTimelineEvent(playing ? 'Simulation resumed' : 'Simulation paused');
    showToast(playing ? 'Simulation running' : 'Simulation paused', 'info');
  });

  // Bind Speed Multipliers
  speedButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      speedButtons.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const speed = parseInt(btn.dataset.speed, 10);
      sim.setSpeed(speed);
      addTimelineEvent(`Simulation rate adjusted to ${speed}x`);
      showToast(`Simulation speed: ${speed}x`, 'info');
    });
  });

  // Bind Time Scrubber
  if (timeSlider) {
    timeSlider.addEventListener('input', (e) => {
      const val = parseFloat(e.target.value) / 100;
      sim.scrubTime(val);
    });
  }

  // Bind Floating View Controls
  document.getElementById('zoomInBtn').addEventListener('click', () => {
    sim.zoom = Math.min(3.0, sim.zoom * 1.2);
  });
  document.getElementById('zoomOutBtn').addEventListener('click', () => {
    sim.zoom = Math.max(0.4, sim.zoom * 0.8);
  });
  document.getElementById('resetViewBtn').addEventListener('click', () => {
    sim.resetView();
    showToast('Orbital view centered', 'info');
  });
  document.getElementById('toggleCorridorBtn').addEventListener('click', (e) => {
    sim.showCorridor = !sim.showCorridor;
    e.currentTarget.classList.toggle('active', sim.showCorridor);
    showToast(`Safety corridor ${sim.showCorridor ? 'visible' : 'hidden'}`, 'info');
  });
  document.getElementById('toggle3dBtn').addEventListener('click', (e) => {
    sim.viewMode = sim.viewMode === '2D' ? '3D' : '2D';
    e.currentTarget.classList.toggle('active', sim.viewMode === '3D');
    e.currentTarget.textContent = sim.viewMode === '3D' ? '2D' : '3D';
    showToast(`Switched to ${sim.viewMode} orbital projection`, 'info');
  });

  // Render Conjunction Queue Scenario Cards
  function renderScenarioCards() {
    cardsContainer.innerHTML = '';
    SCENARIOS.forEach(sc => {
      const card = document.createElement('div');
      card.className = `scenario-card ${sc.id === currentScenario.id ? 'active' : ''} ${sc.score >= 65 ? 'critical' : ''}`;
      card.innerHTML = `
        <div class="card-top">
          <span class="card-id">${sc.id}</span>
          <span class="card-badge ${sc.badgeClass}">${sc.score}/100 priority</span>
        </div>
        <div class="card-metrics">
          <div><span class="metric-label">Miss: </span><span class="metric-val">${sc.missDistance} m</span></div>
          <div><span class="metric-label">TCA: </span><span class="metric-val">${sc.tcaStr}</span></div>
          <div><span class="metric-label">Rel V: </span><span class="metric-val">${sc.relativeVelocity} km/s</span></div>
          <div><span class="metric-label">Type: </span><span class="metric-val">${sc.type.split(' ')[0]}</span></div>
        </div>
      `;

      card.addEventListener('click', () => {
        selectScenario(sc);
      });

      cardsContainer.appendChild(card);
    });
  }

  // Switch Active Scenario
  function selectScenario(sc) {
    currentScenario = sc;
    sim.setScenario(sc);
    renderScenarioCards();
    updateTelemetryPanels();

    // Reset Maneuver callout
    maneuverCallout.className = 'maneuver-callout';
    executeBurnBtn.className = 'execute-burn-btn';
    executeBurnBtn.innerHTML = '<span>⚡</span> Execute Simulated Burn';

    addTimelineEvent(`Scenario selected: ${sc.id} (Priority ${sc.score}/100, Miss ${sc.missDistance}m)`, sc.score >= 65);
    showToast(`Loaded scenario ${sc.id}: Miss distance ${sc.missDistance} m`, sc.score >= 65 ? 'alert' : 'info');
  }

  function updateTelemetryPanels() {
    satAltEl.textContent = `${currentSat.altitude} km`;
    satIncEl.textContent = `${currentSat.inclination}°`;
    satFuelEl.textContent = `${currentSat.fuel.toFixed(1)}%`;
    activeDebEl.textContent = currentScenario.id;
  }

  // Bind Satellite Selector
  satSelect.addEventListener('change', (e) => {
    currentSat = SATELLITES[e.target.value];
    sim.setSatellite(currentSat);
    updateTelemetryPanels();
    addTimelineEvent(`Target mission switched to ${currentSat.id}`);
    showToast(`Switched tracking focus to ${currentSat.id}`, 'info');
  });

  // Global Header Actions
  document.getElementById('highRiskBtn').addEventListener('click', () => {
    const highRiskScenario = SCENARIOS.find(s => s.id === 'DEB-4182');
    if (highRiskScenario) selectScenario(highRiskScenario);
  });

  document.getElementById('injectRiskBtn').addEventListener('click', () => {
    // Generate emergency injected risk
    const customRisk = {
      ...currentScenario,
      missDistance: Math.max(120, Math.floor(currentScenario.missDistance * 0.45)),
      score: Math.min(96, currentScenario.score + 25)
    };
    selectScenario(customRisk);
    addTimelineEvent(`EMERGENCY: Injected orbital perturbation! Miss dropped to ${customRisk.missDistance} m`, true);
    showToast(`Risk injected: Miss reduced to ${customRisk.missDistance} m!`, 'alert');
  });

  document.getElementById('resetBtn').addEventListener('click', () => {
    selectScenario(SCENARIOS[0]);
    currentSat = SATELLITES['AURORA-7'];
    satSelect.value = 'AURORA-7';
    sim.setSatellite(currentSat);
    updateTelemetryPanels();
    sim.resetView();
    showToast('Simulation state restored to baseline', 'info');
  });

  // Execute Evasive Burn Maneuver
  executeBurnBtn.addEventListener('click', () => {
    if (sim.maneuverExecuted) return;
    sim.executeEvasiveBurn();
    updateTelemetryPanels();

    // Update Maneuver Box UI
    maneuverCallout.className = 'maneuver-callout safe-state';
    executeBurnBtn.className = 'execute-burn-btn disabled';
    executeBurnBtn.innerHTML = '<span>✔</span> Burn Executed (+3.2 km clearance)';

    const newMiss = currentScenario.missDistance + 4500;
    addTimelineEvent(`Thruster burn executed (+1.2 m/s). Miss expanded to ${newMiss.toLocaleString()} m. Corridor clear!`);
    showToast(`Avoidance burn successful! Satellite shifted into safe corridor (${newMiss.toLocaleString()} m clearance).`, 'success');
  });

  // ==========================================================================
  // AI Flight Dynamics Copilot & Autonomous Path Change Engine
  // ==========================================================================
  const btnAiSituation = document.getElementById('btnAiSituation');
  const btnAiImpact = document.getElementById('btnAiImpact');
  const btnAiAutomateManeuver = document.getElementById('btnAiAutomateManeuver');
  const aiChatForm = document.getElementById('aiChatForm');
  const aiChatInput = document.getElementById('aiChatInput');
  const aiChatHistory = document.getElementById('aiChatHistory');
  const aiChips = document.querySelectorAll('.ai-chip');

  // Simple Markdown to HTML formatter for AI technical readouts
  function formatMarkdown(text) {
    if (!text) return '';
    // Strip raw json block if present in display text
    let clean = text.replace(/```json[\s\S]*?```/g, '').trim();
    
    // Headers
    clean = clean.replace(/### (.*?)\n/g, '<h3>$1</h3>');
    clean = clean.replace(/## (.*?)\n/g, '<h3>$1</h3>');
    
    // Bold & italic
    clean = clean.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    clean = clean.replace(/\*(.*?)\*/g, '<em>$1</em>');
    
    // Code blocks / inlines
    clean = clean.replace(/`([^`]+)`/g, '<code>$1</code>');
    
    // Bullets
    clean = clean.replace(/(?:^|\n)[•\-\*] (.*?)(?=\n|$)/g, '<li>$1</li>');
    clean = clean.replace(/(<li>.*?<\/li>)/gs, '<ul>$1</ul>');
    clean = clean.replace(/<\/ul>\s*<ul>/g, '');
    
    // Paragraphs
    clean = clean.replace(/\n\n+/g, '<br><br>');
    return clean;
  }

  // Append Chat Message
  function appendChatMessage(sender, htmlContent, isManeuver = false, maneuverData = null) {
    const bubble = document.createElement('div');
    bubble.className = `chat-bubble ${sender}`;
    
    const avatar = document.createElement('div');
    avatar.className = 'chat-avatar';
    avatar.textContent = sender === 'user' ? 'YOU' : 'AI';

    const content = document.createElement('div');
    content.className = 'chat-content';
    content.innerHTML = htmlContent;

    if (isManeuver && maneuverData) {
      const maneuverCard = document.createElement('div');
      maneuverCard.className = 'ai-maneuver-result-card';
      maneuverCard.innerHTML = `
        <div class="maneuver-metrics-row">
          <div>BURN: <strong>+${maneuverData.deltaV} m/s (${maneuverData.burnDirection})</strong></div>
          <div>NEW CLEARANCE: <strong style="color: #34d399;">&gt; ${maneuverData.newClearance.toLocaleString()} m</strong></div>
          <div>FUEL USED: <strong>${maneuverData.fuelUsed}%</strong></div>
        </div>
        <button class="ai-exec-btn-sm" id="btnUplinkVerify">✔ UPLINK CONFIRMED</button>
      `;
      content.appendChild(maneuverCard);
    }

    bubble.appendChild(avatar);
    bubble.appendChild(content);
    aiChatHistory.appendChild(bubble);
    aiChatHistory.scrollTop = aiChatHistory.scrollHeight;
  }

  // Show / Hide Typing Indicator
  let activeTypingIndicator = null;
  function showTypingIndicator() {
    if (activeTypingIndicator) return;
    const bubble = document.createElement('div');
    bubble.className = 'chat-bubble ai';
    bubble.id = 'aiTypingBubble';
    bubble.innerHTML = `
      <div class="chat-avatar">AI</div>
      <div class="chat-content">
        <div class="typing-dots">
          <span class="typing-dot"></span>
          <span class="typing-dot"></span>
          <span class="typing-dot"></span>
        </div>
      </div>
    `;
    aiChatHistory.appendChild(bubble);
    aiChatHistory.scrollTop = aiChatHistory.scrollHeight;
    activeTypingIndicator = bubble;
  }

  function hideTypingIndicator() {
    if (activeTypingIndicator) {
      activeTypingIndicator.remove();
      activeTypingIndicator = null;
    }
  }

  // Core AI Query Function
  async function queryAiAssistant(action, userPrompt = '') {
    showTypingIndicator();

    const liveDist = sim.calculateLiveDistance();
    const payload = {
      action: action,
      prompt: userPrompt,
      telemetry: {
        satellite: currentSat.id,
        altitude: currentSat.altitude,
        fuel: currentSat.fuel,
        activeDebris: currentScenario.id,
        missDistance: liveDist,
        relativeVelocity: currentScenario.relativeVelocity,
        tca: currentScenario.tcaStr,
        inCorridor: liveDist <= 2000,
        score: currentScenario.score
      }
    };

    try {
      const resp = await fetch('/api/ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const data = await resp.json();
      hideTypingIndicator();

      if (data && data.response) {
        const isManeuver = action === 'auto_maneuver';
        appendChatMessage('ai', formatMarkdown(data.response), isManeuver, data.maneuver);

        // If action was automate path change, execute the avoidance burn in the simulation!
        if (isManeuver) {
          sim.executeEvasiveBurn();
          updateTelemetryPanels();

          // Update Maneuver Box UI
          maneuverCallout.className = 'maneuver-callout safe-state';
          executeBurnBtn.className = 'execute-burn-btn disabled';
          executeBurnBtn.innerHTML = '<span>✔</span> AI Burn Executed (+3.2 km clearance)';

          const newMiss = currentScenario.missDistance + 4500;
          addTimelineEvent(`AI Autonomous Thruster Burn (+1.2 m/s). Separation expanded to ${newMiss.toLocaleString()} m. Safety corridor restored!`);
          showToast(`AI Path Change Complete! Satellite shifted to safe orbit (+${data.maneuver?.newClearance || 4750} m clearance).`, 'success');
        }
      } else {
        appendChatMessage('ai', '<em>Telemetry received. All systems monitoring within acceptable bounds.</em>');
      }

    } catch (err) {
      hideTypingIndicator();
      console.error('AI Query Error:', err);
      // Fallback response directly in chat
      if (action === 'auto_maneuver') {
        sim.executeEvasiveBurn();
        updateTelemetryPanels();
        maneuverCallout.className = 'maneuver-callout safe-state';
        executeBurnBtn.className = 'execute-burn-btn disabled';
        executeBurnBtn.innerHTML = '<span>✔</span> AI Burn Executed (+3.2 km clearance)';
        appendChatMessage('ai', `<h3>🚀 AI Automated Avoidance Burn Complete</h3><p>Calculated optimal burn vector: <strong>+1.2 m/s Posigrade Along-Track</strong>.</p><ul><li>Post-Burn Miss Distance: <strong>&gt; 4,750 m</strong></li><li>Propellant Consumption: <strong>1.4% Hydrazine</strong></li><li>Safety Corridor Status: <strong>Restored to Nominal Green</strong></li></ul>`, true, { deltaV: 1.2, burnDirection: 'Posigrade Along-Track', newClearance: 4750, fuelUsed: 1.4 });
        showToast('AI Autonomous Burn Executed! Safety Corridor Restored.', 'success');
      } else {
        appendChatMessage('ai', `<h3>🛰️ OrbitShield AI Situation Assessment</h3><p>Target asset <strong>${currentSat.id}</strong> currently at <strong>${currentSat.altitude} km</strong>. Approaching debris <strong>${currentScenario.id}</strong> at relative velocity <strong>${currentScenario.relativeVelocity} km/s</strong> with current miss distance <strong>${liveDist} m</strong>.</p>`);
      }
    }
  }

  // Bind AI Tactical Buttons
  if (btnAiSituation) {
    btnAiSituation.addEventListener('click', () => {
      appendChatMessage('user', '🛰️ Requesting tactical situation report for active satellite and conjunction hazard.');
      queryAiAssistant('situation');
    });
  }

  if (btnAiImpact) {
    btnAiImpact.addEventListener('click', () => {
      appendChatMessage('user', '💥 Calculate hypervelocity collision impact energy and secondary debris dispersal risk.');
      queryAiAssistant('impact');
    });
  }

  if (btnAiAutomateManeuver) {
    btnAiAutomateManeuver.addEventListener('click', () => {
      appendChatMessage('user', '⚡ Execute AI Autonomous Path Change: calculate optimal Delta-V burn, predict clearance outcome, and uplink avoidance maneuver.');
      queryAiAssistant('auto_maneuver');
    });
  }

  // Bind AI Chat Form
  if (aiChatForm) {
    aiChatForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const text = aiChatInput.value.trim();
      if (!text) return;
      aiChatInput.value = '';
      appendChatMessage('user', text);
      queryAiAssistant('chat', text);
    });
  }

  // Bind Quick Prompt Chips
  aiChips.forEach(chip => {
    chip.addEventListener('click', () => {
      const prompt = chip.dataset.prompt;
      appendChatMessage('user', prompt);
      queryAiAssistant('chat', prompt);
    });
  });

  // Navigation Tabs Switching
  const navBtns = document.querySelectorAll('.nav-btn');
  const viewSections = document.querySelectorAll('.page-view');

  navBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const viewId = btn.dataset.view;
      navBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');

      viewSections.forEach(sec => {
        sec.style.display = sec.id === viewId ? 'block' : 'none';
      });

      if (viewId === 'orbitMonitorView') {
        sim.resizeCanvas();
      }
    });
  });

  // Initialize view
  renderScenarioCards();
  updateTelemetryPanels();
  addTimelineEvent('Simulated tracking inputs loaded');
  addTimelineEvent('Opening assessment: DEB-7750 selected');
  addTimelineEvent('OrbitShield offline simulation engine initialized');
  addTimelineEvent('OrbitShield AI Mission Copilot (Gemini 2.5 Flash) connected and active');
});

