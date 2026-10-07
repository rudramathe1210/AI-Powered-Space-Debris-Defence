# OrbitShield — AI Space Debris Decision Support & Orbit Monitor

High-performance real-time orbital mechanics simulator with integrated Gemini AI Copilot for autonomous collision avoidance.

## 🚀 Ways to Run the Application

### Option 1: Double-Click Standalone File (Zero Installation)
Simply double-click:
`orbitshield_standalone.html`
This opens the entire mission control application and simulation in any web browser directly, with embedded styles, textures, simulation engine, and Gemini AI assistant.

### Option 2: Run Local Server (Recommended for Full Mission Control)
Run the included Python multi-threaded server:
```bash
python server.py
```
Then open:
👉 **http://localhost:3000** or **http://127.0.0.1:3000**

---

## 🛰️ Key Features

1. **Active 60 FPS Orbital Mechanics Engine**:
   - Real-time Keplerian orbital propagation for satellites & active debris.
   - Dual-mode visualization: **2D Tactical Oblique** and **3D Interactive Spherical View** (pitch/yaw drag, zoom).
   - Dynamic 2.0 km Safety Corridor that flashes alarm red when breached.
   - 50+ background orbiting debris particles in LEO.

2. **Simulation Controls**:
   - Play / Pause simulation.
   - Speed multipliers: `1x`, `5x`, `30x`, `120x`, `600x`.
   - Interactive Time Scrubber (scrub relative to Time of Closest Approach).
   - Live TCA countdown and real-time separation distance calculation.

3. **Gemini AI Mission Copilot (Powered by Google Gemini 2.5 Flash)**:
   - **🛰️ Calculate Satellite Situation**: Real-time telemetry report on orbit geometry, conjunction threat, and hazard level.
   - **💥 Calculate Collision Impact**: Hypervelocity kinetic energy ($E_k = \frac{1}{2} m v^2$), Whipple shield penetration, and Kessler cascade dispersal risk.
   - **⚡ AI Automate Path Change**: Calculates optimal Delta-V (+1.2 m/s Along-Track Posigrade), predicts clearance outcome (> 4,800 m), and automatically fires the satellite's thrusters to shift into a safe orbit in real time.
   - **💬 Interactive Mission Q&A**: Ask any orbital mechanics question in natural language.

---

## 📁 Project Structure

- `orbitshield_standalone.html` — All-in-one single-file version (ready to open anywhere).
- `index.html` — Clean modular HTML entry point.
- `server.py` — Multi-threaded local Python server with Gemini AI endpoint.
- `assets/orbit-simulation.js` — High-performance Canvas & physics simulation engine.
- `assets/app.js` — Mission control UI controller & AI copilot integration.
- `assets/app.css` — Modern dark space-mission theme styling.
- `assets/earth.jpg` — High-resolution Earth orbital texture.
