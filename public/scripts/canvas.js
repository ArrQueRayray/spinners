import { fetchLevels, updateGameArea } from '../script.js';
import * as Audio from './audio.js';
import * as Menus from './menus.js';
import { State, Timer, Shapes } from './states.js';

// Setup game area and canvas scaling.
export let mouseCoords = {x: 999, y: 999}, ctx;
let refreshInterval;

export let gameArea = {
    canvas: document.createElement("canvas"),
    start: function() {
        this.canvas.width = 960;
        this.canvas.height = 720;
        ctx = gameArea.canvas.getContext("2d");
        this.canvas.style = "position: absolute; top: 0px; left: 0px; right: 0px; bottom: 0px; margin: auto;";
        document.body.insertBefore(this.canvas, document.body.childNodes[0]);
        this.scaleCanvas();
        this.interval = setInterval(updateGameArea, 16.6667);
    },
    scaleCanvas: function() {
        const scale = Math.min(Math.max(this.canvas.getBoundingClientRect().height / 720 * 1.5, 1), 2);
        if (this.canvas.width !== 960 * scale || this.canvas.height !== 720 * scale) {
            this.canvas.width = 960 * scale;
            this.canvas.height = 720 * scale;
            ctx.scale(scale, scale);
        }
    },
    clear: function() {
        ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    }
}

// Setup mouse control functionality for clicking on buttons.
export function setupMouse() {
    // The mouse is used to guarantee focus on the window, allowing for sound playback, and
    // eventually interacting with menu buttons.
    window.addEventListener('mousedown', function (e) {
        if (!refreshInterval) {
            refreshInterval = setInterval(Audio.refreshSounds, 10000);
        }

        if (Menus.mouseTarget > -1) {
            // If interacting with the sound button, the setting must be immediately updated.
            if (State.gameState === "settings" && Menus.mouseTarget === 1) {
                if (!State.gameSettings.allAudio) {
                    State.gameSettings.allAudio = true;
                    State.gameSettings.music = false;
                }
                State.gameSettings.sound = !State.gameSettings.sound;
            }
            Audio.playSound("click", 0.4);

            Menus.setTargets(Menus.mouseTarget);
            Shapes.menuUI[Menus.animTarget].animStart = Timer.time;
            Shapes.menuUI[Menus.animTarget].animate(0.25);
        }
    });

    // The coordinates are constantly updated.
    gameArea.canvas.addEventListener("pointermove", (e) => {
        const bounds = gameArea.canvas.getBoundingClientRect();
        mouseCoords =  {x: ((e.clientX - bounds.left) * 960) / bounds.width - 480,
                        y: 360 - ((e.clientY - bounds.top) * 960) / bounds.width};
    });
}

// Setup keyboard control functionality for moving player alongside other tasks.
export function setupKeys() {
    // An integer array is used for checking key presses to allow for WASD or arrow keys. Key
    // codes are used in case someone uses a different keyboard layout (i.e. ZQSD can work for
    // someone with an AZERTY keyboard layout).
    gameArea.keys = [0, 0, 0, 0];
    window.addEventListener('keydown', function (e) {
        if (e.repeat) return;
        switch (e.code) {
            case "KeyW": case "ArrowUp": return gameArea.keys[0]++;
            case "KeyA": case "ArrowLeft": return gameArea.keys[1]++;
            case "KeyS": case "ArrowDown": return gameArea.keys[2]++;
            case "KeyD": case "ArrowRight": return gameArea.keys[3]++;
            case "KeyM":
                State.gameSettings.allAudio = !State.gameSettings.allAudio;
                return Menus.updateMute();
            case "Backquote":
                // For ease of level creation, prints mouse coordinates and re-fetches levels.
                // console.log("mouseCoords: " + mouseCoords.x + " " + mouseCoords.y);
                // return fetchLevels();
            case "Backslash":
                // For debugging purposes only, auto-completes the current level.
                // if (State.gameState === "level" && State.levelState === "none") {
                //     State.mainPlayer.circ.x = State.mainGoal.x;
                //     State.mainPlayer.circ.y = State.mainGoal.y;
                //     State.coins.forEach(coin => {
                //         coin.animate();
                //     });
                // }
                return;
        }
    })
    window.addEventListener('keyup', function (e) {
        switch (e.code) {
            case "KeyW": case "ArrowUp": return gameArea.keys[0]--;
            case "KeyA": case "ArrowLeft": return gameArea.keys[1]--;
            case "KeyS": case "ArrowDown": return gameArea.keys[2]--;
            case "KeyD": case "ArrowRight": return gameArea.keys[3]--;
        }
    })
    window.addEventListener("blur", () => {
        gameArea.keys = [0, 0, 0, 0];
    });
}