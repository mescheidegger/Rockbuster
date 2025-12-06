🎮 Rockbuster.io

A Modern Asteroids-Style Shooter (HTML5 Canvas + Vite)

👉 Play it here: https://rockbuster.io

Rockbuster.io is a fast, responsive Asteroids-inspired shooter built with vanilla JavaScript and HTML5 Canvas. The project focuses on clean structure, fixed-step updates, simple physics, and a lightweight rendering pipeline using ES modules and atlas sprites.

🚀 Features

1. Smooth Asteroids-style movement (thrust, rotation, wrap-around)
2. Multiple asteroid tiers that split dynamically
3. A UFO enemy with timed spawns and simple AI
4. Power-ups: Triple Shot, Shield, Speed Boost, Extra Life
5. Shield and weapon leveling tied into gameplay flow
6. Fixed-step physics running at 120 FPS
7. High-DPI aware rendering for crisp visuals
8. Mobile-friendly virtual joystick + fire button
9. Local high-score saving
10. Built and served using Vite

🗂️ Tech Overview

The game runs on a small set of focused modules:

1. Game.js - main loop, state machine, physics ticking, collision routing
2. Renderer.js - world rendering and atlas sprite handling
3. HudRenderer.js / HUD.js - score, waves, lives, mute UI
4. Collision.js - optimized circle-based collision helpers
5. Physics.js - movement integration + toroidal space wrapping
6. Spawner.js - wave logic and power-up drops
7. VirtualControls.js - mobile input (joystick + fire button)
8. AtlasCache.js - loader for TexturePacker sprite atlases
9. Sprites and metadata are standard PNG + JSON atlases.

📦 Running the Game (Vite)

1. npm install
2. npm run dev

🕹️ Controls

Keyboard
1. Arrow Keys - rotate & thrust
2. Space / J - fire
3. Enter - start or restart

Touch
1. Left joystick - movement + thrust
2. Right button - fire