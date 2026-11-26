// Boot and the one loop: input is read every frame, the world advances in
// fixed 1/60 s steps (several in a slow frame, none in a fast one), and the
// renderer paints what is there. The game moves between five screens: title,
// play, paused, game over and sortie complete.
//
// ?seed=N fixes the canyon and the rings. ?shot=start|play|rings|landing
// (with &seed=N) stages that scene instead of running the loop, paints it
// twice and sets window.__shotReady for a screenshot.
import { BEST_KEY, STEP } from './config.js';
import { createRandom } from './random.js';
import { createAudio } from './audio.js';
import { createWorld } from './world.js';
import { ACTION_CONFIRM, ACTION_MUTE, ACTION_PAUSE, ACTION_RESTART, createInput } from './input.js';
import { createRenderer, SCREEN_COMPLETE, SCREEN_OVER, SCREEN_PAUSED, SCREEN_PLAY, SCREEN_TITLE } from './render.js';
import { stageShot } from './shots.js';

/** The longest frame the loop catches up on; a longer stall (a hidden tab) is dropped, not replayed. */
const MAX_FRAME = 0.25;

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : Math.floor(Math.random() * 4294967296);

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const random = createRandom(seed);
const audio = createAudio();
const world = createWorld(random, audio);
const renderer = createRenderer(canvas);

function readBest() {
  try {
    return Number.parseInt(window.localStorage.getItem(BEST_KEY) ?? '0', 10) || 0;
  } catch {
    return 0;
  }
}

function saveBest(value) {
  try {
    window.localStorage.setItem(BEST_KEY, String(value));
  } catch {
    // Storage can be off (private windows): the best score then lasts this visit only.
  }
}

function runShot(name) {
  const scene = stageShot(name, world, random);
  world.setBest(scene.best);
  let painted = 0;
  function paint() {
    const view = world.view();
    view.screen = scene.screen;
    renderer.draw(view);
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
}

function runGame() {
  const input = createInput(canvas);
  world.reset(seed);
  world.setBest(readBest());
  let best = readBest();
  let accumulator = 0;
  let last = performance.now();

  // Screen readers (and anyone watching the page's text) hear the screen changes.
  function announce(message) {
    status.textContent = message;
  }

  function confirm() {
    const screen = world.screen;
    if (screen === SCREEN_TITLE) {
      audio.unlock();
      world.startGame();
      announce('Flying. Thread the rings, mind the fuel.');
    } else if (screen === SCREEN_OVER) {
      if (world.state.lives > 0) {
        world.startGame();
        announce('Flying again.');
      } else {
        world.reset(seed);
        world.setBest(best);
        world.startGame();
        announce('Flying. Thread the rings, mind the fuel.');
      }
    } else if (screen === SCREEN_COMPLETE) {
      world.nextMission();
      announce('Next sortie.');
    } else if (screen === SCREEN_PAUSED) {
      world.state.screen = SCREEN_PLAY;
      announce('Flying.');
    }
  }

  function handleActions() {
    const actions = input.takeActions();
    if (actions & ACTION_MUTE) {
      const muted = audio.toggleMute();
      announce(muted ? 'Muted.' : 'Sound on.');
    }
    if (actions & ACTION_RESTART && world.screen !== SCREEN_TITLE) {
      world.reset(seed);
      world.setBest(best);
      world.startGame();
      announce('Restarted.');
      return;
    }
    if (actions & ACTION_CONFIRM) confirm();
    else if (actions & ACTION_PAUSE && world.screen === SCREEN_PLAY) {
      world.state.screen = SCREEN_PAUSED;
      announce('Paused.');
    } else if (actions & ACTION_PAUSE && world.screen === SCREEN_PAUSED) {
      world.state.screen = SCREEN_PLAY;
      announce('Flying.');
    }
  }

  function frame(now) {
    requestAnimationFrame(frame);
    accumulator += Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    handleActions();
    while (accumulator >= STEP) {
      world.step(STEP, input);
      accumulator -= STEP;
      if (world.state.score > best) {
        best = world.state.score;
        saveBest(best);
        world.setBest(best);
      }
    }
    renderer.draw(world.view());
  }

  requestAnimationFrame(frame);
}

if (shot) runShot(shot);
else runGame();
