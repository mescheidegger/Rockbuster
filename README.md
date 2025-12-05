Rockbuster.io
A Modern Asteroids-Style Shooter (HTML5 Canvas + Vite)

Rockbuster.io is a polished, fast arcade shooter built with vanilla JavaScript, HTML5 Canvas, and a light custom engine. It serves as a clean, modern example of how to structure a browser-based action game using ES modules, fixed-step updates, sprite atlases, and responsive rendering.

🚀 Features

Smooth Asteroids-style controls with thrust, rotation, and wrap-around world

Multiple asteroid sizes with splitting

UFO enemy with spawn timing, AI, and precision shooting

Power-ups (Triple Shot, Shield, Speed, Extra Life)

Shield & weapon tier progression

Fixed-step physics (120 FPS sim)

Device-pixel-ratio aware rendering for sharp graphics

Touch controls (virtual joystick + fire button)

Local high-score persistence

Built & served with Vite

🗂️ Tech Overview

Rockbuster uses a small but organized engine:

Game.js — core loop, state machine, physics step, collisions

Renderer.js — all world drawing + atlas sprite rendering

HudRenderer.js / HUD.js — score, wave, lives, and mute UI

Collision.js — optimized circle-based collision helpers

Physics.js — movement integration + toroidal wrapping

Spawner.js — wave logic and power-up drops

VirtualControls.js — mobile joystick and fire button

AtlasCache.js — loads TexturePacker atlases for sprites

All assets are standard .png sheets with .json atlas metadata.

📦 Running the Game (Vite)
Install dependencies
npm install

Start dev server
npm run dev


Vite serves index.html from the project root.

Build for production
npm run build


Output is written to dist/ (ideal for hosting on DigitalOcean, Netlify, Vercel, etc.).

🕹️ Controls

Keyboard

Arrow Keys — rotate & thrust

Space / J — fire

Enter — start game / restart

Touch

Left joystick — move + thrust

Right button — fire

📁 Project Structure (condensed)
src/
  core/             ← Game engine
  systems/          ← Rendering, collision, physics, atlases
  entities/         ← Ship, Asteroids, Bullets, UFO
  ui/               ← Menu overlays, game over, virtual controls
  audio/            ← Audio manager + unlock flow
assets/
public/
index.html
vite.config.js
