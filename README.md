🎮 Rockbuster.io
A Modern Asteroids-Style Shooter (HTML5 Canvas + Vite)

👉 Play the game here: https://rockbuster.io

Rockbuster.io is a polished, fast arcade shooter built with vanilla JavaScript, HTML5 Canvas, and a lightweight custom engine.
It’s designed as a clean, modern example of structuring a browser-based action game using ES modules, fixed-step updates, sprite atlases, and responsive high-DPI rendering.

🚀 Features

Smooth Asteroids-style controls (thrust, rotate, wrap-around)

Multiple asteroid tiers with dynamic splitting

UFO enemy with smart timing, AI, and precision shots

Power-ups: Triple Shot, Shield, Speed, Extra Life

Shield & weapon tier progression

True fixed-step physics (120 FPS simulation)

Pixel-sharp rendering with device-pixel-ratio awareness

Touch controls (virtual joystick + fire button)

Local high-score storage

Project built & served with Vite

🗂️ Tech Overview

Rockbuster uses a compact but well-structured engine:

Game.js — main loop, state machine, physics tick, collision flow

Renderer.js — world rendering + atlas sprite drawing

HudRenderer.js / HUD.js — score, wave, lives, mute UI

Collision.js — fast circle-based collision helpers

Physics.js — integration + toroidal world wrapping

Spawner.js — wave progression + power-up drops

VirtualControls.js — mobile joystick + fire button

AtlasCache.js — TexturePacker atlas loader

All sprites are standard PNG atlases with JSON metadata.

📦 Running the Game (Vite)
Install dependencies
npm install

Start dev server
npm run dev


Vite serves index.html from the project root.

Build for production
npm run build


Output is written to dist/ (ideal for DigitalOcean, Netlify, Vercel, etc.).

🕹️ Controls
Keyboard

Arrow Keys — rotate & thrust

Space / J — fire

Enter — start / restart

Touch

Left joystick — movement + thrust

Right button — fire

📁 Project Structure (Condensed)
src/
  core/             ← Game engine
  systems/          ← Rendering, collision, physics, atlases
  entities/         ← Ship, Asteroids, Bullets, UFO
  ui/               ← Menus, overlays, virtual controls
  audio/            ← Audio manager + unlock flow
assets/
public/
index.html
vite.config.js