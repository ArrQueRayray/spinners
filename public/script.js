"use strict";

// Import variables and functions from JS files; a lot.
import { gameArea, ctx, setupMouse, setupKeys } from './scripts/canvas.js';
import { rect, circ, text, drawRect } from './scripts/utils.js';
import * as Audio from './scripts/audio.js';
import * as Menus from './scripts/menus.js';
import { State, Timer, Shapes } from './scripts/states.js';
import { player, goal, coin, winAnim, loseAnim } from './scripts/entities.js';

// Fetch levels and audio.
export let version = "1.0.1", levels = await fetchLevels();
Audio.fetchAudio();

// Retrieve save data from local storage if available.
State.maxLevel = Number(localStorage.getItem("maxLevel"));
if (Number.isNaN(State.maxLevel) || State.maxLevel < 1 || State.maxLevel > State.lastLevel + 1) State.maxLevel = 1;
["music", "sound", "shapes", "fades"].forEach(setting => {
    if (localStorage.getItem(setting)) State.gameSettings[setting] = localStorage.getItem(setting) === "true";
});

startGame(true);

// Starts game by setting up shapes, play button, and game area.
function startGame(firstLoad) {
    State.gameState = "none", State.levelState = "none";
    Timer.reset();
    Menus.clearTargets();
    Menus.setupBGShapes(true);

    Shapes.FGShapes = [new rect(960, 720, 0, 0, 0, 0, "black")];
    Shapes.FGShapes[0].transition = true;
    Shapes.FGShapes[0].animStart = 0;
    Shapes.FGShapes[0].duration = 1;
    Shapes.menuUI = [new Menus.button(0, 0, new rect(360, 200), new text("Play", 0, 0, 84), 0, 240)];

    if (firstLoad) {
        setupMouse();
        setupKeys();
        gameArea.start();
    }

    gameArea.canvas.style["transition"] = `border-color ${Number(State.gameSettings.fades) / 4}s`;
    gameArea.canvas.style["border-color"] = "#800"; 
}

// Returns levels.json.
export async function fetchLevels() {
    try {
        return await fetch("assets/levels.json").then((lv) => lv.json());
    } catch (error) {
        return console.error("Levels not found");
    }
}

// Loads objects and sets everything required for playing through a new level.
function loadLevel(level, firstLoad) {
    // Setup timer and states unless level is null.
    if (level != null) {
        State.gameState = "level", State.levelState = "none", State.score = 1000;
        Shapes.FGShapes[Shapes.FGShapes.length - 1].animStart = 0;
        Shapes.FGShapes[Shapes.FGShapes.length - 1].duration = State.gameSettings.fades ? 0.5 : 0;

        Menus.blockTargets();
        setTimeout(Menus.clearTargets, State.gameSettings.fades ? 500 : 0);
        Timer.reset();

        // If a first level load, setup the menu button.
        if (firstLoad) {
            if (State.currentLevel === -1) Shapes.menuUI = [new Menus.button(480, -360, new rect(375, 80), new text("No, take me back", -3.875, 0.8, 24), 0, 80)];
            else {
                Shapes.menuUI = [new Menus.button(480, -360, new rect(275, 80), new text("Level Select", -2.75, 0.8, 24), 0, 80),
                    new Menus.button(-480, 360, new rect(245, 140), new text("Score: 999\nBest: N/A", 0.25, -1.4, 24), 1, 80)];
                Shapes.menuUI[1].status = "white";
                Shapes.menuUI[1].text.align = "left";
                Shapes.menuUI[1].check();
            }
            Shapes.menuUI[0].status = "white";
        }
    }

    // Retrieve and update high State.score.
    State.highScore = Number(localStorage.getItem("score" + State.currentLevel));
    if (State.currentLevel !== -1) Shapes.menuUI[1].text.lines[1] = "Best: " + State.highScore;

    // Get desired level from levels.json if possible.
    try {
        // Load placeholder level in case level doesn't exist.
        let loadedLevel = levels[level] ?? {"name": level == null ? "Oh noes! Invalid level!" : "Oh noes! Missing level!",
            "text": [{"x": 0, "y": 100, "string": "Error! Please contact ArrQue about this."}],
            "player": {"x": -240, "y": 0}, "goal": {"x": 240, "y": 0},
            "safeArea": [{"type": "rect", "x": 0, "y": 0, "width": 600, "height": 120}],
            "obstacles": [{"type": "rect", "x": 0, "y": 0, "width": 122, "height": 24, "speed": 24}]};

        // Scale determines player and goal size.
        State.gameScale = loadedLevel.scale ?? 1;

        // All planned levels have a solid red background, and some may have text which goes on the foreground.
        const flash = Shapes.FGShapes[Shapes.FGShapes.length - 1];
        const levelString = level !== null ? `${level}: ${loadedLevel.name}` : loadedLevel.name;
        const levelTitle = new text(levelString, -475, -345, 24, "black", "left");
        const levelText = (loadedLevel.text ?? []).map((obj) => {
            const { string, x, y, size = 36, color = "black", align = "center" } = obj;
            return new text(string, x, y, size, color, align);
        });
        Shapes.FGShapes = [levelTitle, ...levelText, flash];

        Shapes.mainColor = "red";
        gameArea.canvas.style["border-color"] = `color-mix(in srgb, ${Shapes.mainColor}, black)`;

        const mainBG = Object.assign(new rect(960, 720), { color: Shapes.mainColor, main: true });
        const BGSquares = Array.from({ length: 16 }, (_, i) => {
            const size = 60 + Math.random() * 400;
            const speed = (Math.random() + 0.5) * (Math.round(Math.random()) - 0.5);
            const x = (Math.random() * 320 - 160) + ((i % 4) * (640 / 3) - 320);
            const y = (Math.random() * 240 - 120) + (Math.ceil(i / 4) * 160 - 240);
            const angle = Math.random() * 360;
            const alpha = Math.ceil(Math.random() * 3) / 32;

            return new rect(size, size, speed, x, y, angle, `rgb(from ${Shapes.mainColor} r g b / ${alpha * 100}%)`);
        });

        Shapes.BGShapes = [mainBG, ...BGSquares];

        // Obstacles and safe areas are stored in arrays to allow for drawing and checking multiple shapes at once.

        const shapeSetter = function(obj, col) {
            if (obj.type === "rect") {
                const { width = 100, height = 100, speed = 0, x = 0, y = 0, angle = 0, color = col,
                    offset: { x: offsetX = 0, y: offsetY = 0 } = {}, range = 0, time = 1, delay = 0 } = obj;
                return new rect(width, height, speed, x, y, angle, color,
                    offsetX, offsetY, range, time, delay);
            } else {
                const { radius = 100, x = 0, y = 0, color = col } = obj;
                return new circ(radius, x, y, color);
            }
        };

        Shapes.safeArea = (loadedLevel.safeArea ?? []).map((obj) => shapeSetter(obj, "black"));
        Shapes.obstacles = (loadedLevel.obstacles ?? []).map((obj) => shapeSetter(obj, Shapes.mainColor));

        // Coins are stored similarly, but with less customization.

        State.coins = (loadedLevel.coins ?? []).map((obj) => new coin(obj.x, obj.y));
        State.coinCount = State.coins.length;

        // Player and goal are stored as variables, given defined coordinates
        State.mainPlayer = new player(loadedLevel.player.x, loadedLevel.player.y);
        State.mainGoal = new goal(loadedLevel.goal.x, loadedLevel.goal.y);

    } catch (error) {
        console.error("JSON parsing error: " + error);
        loadLevel(null, firstLoad);
    }
}

// Updates the canvas every frame.
export function updateGameArea() {
    gameArea.clear();
    gameArea.scaleCanvas();
    Timer.time = Date.now() / 1000 - Timer.start;
    if (Audio.gameMusic) Audio.gameMusic.volume = (!State.gameSettings.allAudio || !State.gameSettings.music) ? 0 : 0.2;

    // Gameplay logic will only run during a level.
    switch (State.gameState) {
        case "level":
            levelLogic();
            // fall through
        case "none":
            oneButtonLogic();
            break;
        default:
            menuLogic();
    }

    // Foreground shapes, if any, are always drawn last. The last shape is delegated to fades.
    Shapes.FGShapes.forEach(element => {
        if (!element?.transition) element.update();
        if (element?.transition) {
            if (Timer.time < element.animStart + element.duration) {
                const elapsedAmount = (Timer.time - element.animStart) / element.duration;
                ctx.globalAlpha = (element.animStart === 0) ? 1 - elapsedAmount : elapsedAmount;
                if (State.gameSettings.fades) element.update();
                ctx.globalAlpha = 1;

                if (State.gameSettings.fades) gameArea.canvas.style["transition"] = `border-color ${element.duration * 2}s`;
                gameArea.canvas.style["border-color"] = (element.animStart === 0) ?
                    `color-mix(in srgb, ${Shapes.mainColor}, black)` : element.color;
            }

            gameArea.canvas.style["border-color"] = (element.animStart === 0) ?
                `color-mix(in srgb, ${Shapes.mainColor}, black)` : element.color;
        }
    });

    if (State.gameState === "none" && Timer.time < 0.2 && State.gameSettings.fades) {
        ctx.beginPath();
        ctx.fillStyle = "black";
        drawRect(0, 0, 960, 720);
    }
}

// Handles logic for single-buttoned screens such as the start or levels.
function oneButtonLogic() {
    // Background shapes, if enabled, are always drawn first on the start screen.
    if (State.gameState === "none") {
        if (State.gameSettings.shapes) Shapes.BGShapes.forEach(element => {element.update()});
    }

    // The start and level screens consists of only a single true button.
    if (Menus.animTarget > -1) {
        // Play button and fade animations until done.
        Shapes.FGShapes[Shapes.FGShapes.length - 1].color = "black";
        const buttonAnimDone = !Shapes.menuUI[0].animate(0.25);
        const FGAnimDone = !Menus.animateFG(Shapes.menuUI[0].animStart, 0.5);
        if (!State.gameSettings.fades || (buttonAnimDone && FGAnimDone)) {
            // Start music and switch to main menu.
            Shapes.BGShapes = [];
            if (State.gameState === "none") {
                Audio.gameMusic.play();
                Menus.setupMainMenu(true);
            }
            else if (State.currentLevel === -1) Menus.setupSettings(true);
            else Menus.setupLevelSelect(true);
        }
    } else {
        if (Menus.mouseTarget !== -2) Menus.clearTargets();
        if (typeof Shapes.menuUI[0].update === "function") {
            if (Menus.mainMenuVisited || State.gameState !== "none" || Timer.time > 1) {
                Shapes.menuUI[0].update();
                
                // Check if mouse is hovering over button.
                Shapes.menuUI[0].check();
            } else {
                const loadString = ["Loading.", "Loading..", "Loading..."];
                const t = Math.floor((Timer.time * 6) % 3);
                const loadText = new text(loadString[t], 0, 0, 60, "red", "center", "Paytone One");
                loadText.update();
            }
        }
    }

    // On normal levels, update score visually.
    if (State.gameState === "level" && State.currentLevel !== -1) {
        Shapes.menuUI[1].update();
    }

    // Fade in if enabled.
    if (State.gameSettings.fades) Menus.animateFG(0, Menus.mainMenuVisited ? 0.5 : 1);
}

// Handles logic for menu beyond start screen.
function menuLogic() {
    // Background shapes, if enabled, are always drawn first.
    if (State.gameSettings.shapes) Shapes.BGShapes.forEach(element => {element.update()});

    // Menu buttons are drawn, only allowing for clicks if Menus.mouseTarget is above -2.
    if (Menus.mouseTarget !== -2) {
        Menus.clearTargets();
        Shapes.menuUI.forEach(element => { 
            element.update();

            // If it is a button, check if mouse is hovering over button.
            if (typeof element.check === "function") element.check();
        });
        // On the level select, hovering over an unlocked level brings up its name.
        if (State.gameState === "select") {
            Shapes.menuUI[31].lines = Shapes.menuUI[32].lines = [""];
            if (Menus.mouseTarget > -1 && Menus.mouseTarget !== 30) {
                const levelString = "Level " + (Menus.mouseTarget + 1);
                if (Object.hasOwn(levels, levelString) && Object.hasOwn(levels[levelString], "name")) {
                    Shapes.menuUI[31].lines = [levels[levelString].name];
                    State.highScore = Number(localStorage.getItem("score" + (Menus.mouseTarget + 1)));
                    if (State.highScore) Shapes.menuUI[32].lines = ["Score: " + State.highScore];
                }
            }
        }
    } else {
        // Once a button is clicked, the buttons continue to update as normal except for the clicked button,
        // which animates alongside a fade before performng the button behavior.
        Shapes.menuUI.forEach(element => { 
            if (element.id === Menus.animTarget) {
                Shapes.FGShapes[Shapes.FGShapes.length - 1].color = "black";
                // This handles button animations. Most buttons occur with a screen transition, with the
                // exception of some buttons in the settings menu, which also have no fadeout.
                const settingsToggle = State.gameState === "settings" && Menus.animTarget < 4;
                const buttonAnimDone = !element.animate(settingsToggle ? 0 : 0.25);
                const FGAnimDone = !settingsToggle && !Menus.animateFG(element.animStart, 0.5);

                // Setting toggle buttons should only run toggle() once.
                if (settingsToggle && !element?.toggled) {
                    element.toggled = true;
                    element.toggle();
                }

                // Checks are performed to ensure the animations have completed.
                if (!State.gameSettings.fades || ( buttonAnimDone && (settingsToggle || FGAnimDone))) {
                    if (State.gameState === "menu") {
                        // The buttons on the main menu correspond to level select, settings, and credits.
                        (() => {
                            switch (element.id) {
                                case 0: return Menus.setupLevelSelect(false);
                                case 1: return Menus.setupSettings(false);
                                case 2: return Menus.setupCredits();
                            }
                        })();
                    } else if (State.gameState === "select") {
                        // The buttons on the level select correspond to levels and the main menu.
                        (() => {
                            switch (element.id) {
                                case 30: return Menus.setupMainMenu(false);
                                default: 
                                    State.currentLevel = element.id + 1;
                                    return loadLevel("Level " + State.currentLevel, true);
                            }
                        })();
                    } else if (State.gameState === "settings") {
                        // The buttons on the settings menu largely correspond to toggle-able settings.
                        // The reset data button directs to a special level acting as a confirmation
                        // screen, and the menu buttton is self-explanatory.
                        (() => {
                            switch (element.id) {
                                case 4: 
                                    State.currentLevel = -1;
                                    return loadLevel("Reset Data", true);
                                case 5: return Menus.setupMainMenu(false);
                                default: return element.reappear(0.125);
                            }
                        })();
                    } else Menus.setupMainMenu(false);
                }
            } else {
                if (element.id !== Menus.animTarget) element.update();
            }
        });
    }
}

// Handles logic for gameplay.
function levelLogic() {
    // Only the first shape is drawn first.
    Shapes.BGShapes[0].update();

    // This clamps each value in the keys array between 0 and 2.
    for (let i = 0; i < 4; i++) {
        gameArea.keys[i] = Math.min(Math.max(gameArea.keys[i], 0), 2);
    }

    // Each element, including in arrays, is drawn.
    Shapes.safeArea.forEach(element => element.update());
    if (State.gameSettings.shapes) Shapes.BGShapes.forEach(element => {if (!element?.main) element.update();}); // Other BG shapes are drawn if enabled.

    Shapes.obstacles.forEach(element => element.update());
    State.coins.forEach(element => {
        if (element.animating || element.isClose())
            element.animate();
        else
            element.update();
    });

    // Goal and player are drawn last.
    State.mainGoal.update();
    State.mainPlayer.update();

    // If all coins are collected and player is close enough to the goal, the level is officially completed.
    if (State.coinCount === 0 && State.mainGoal.isClose() && State.levelState === "none") {
        State.mainPlayer.controllable = false; 
        Menus.blockTargets();
        State.levelState = "complete";
        Timer.animStart = Timer.time;
        Audio.playSound("enter");
        setTimeout(Audio.playSound, 250, "wink");
    }

    // If player is no longer alive, the level is failed.
    if (!State.mainPlayer.isAlive() && State.levelState === "none") {
        State.mainPlayer.controllable = false; 
        Menus.blockTargets();
        State.levelState = "failed";
        Timer.animStart = Timer.time;
        Audio.playSound("hit");
        Audio.playSound("ouch");
    }

    // When the level is over, an animation is played before the level is either reloaded
    // or the next level is loaded. Score is updated otherwise.
    switch (State.levelState) {
        case "complete":
            if (State.currentLevel === -1 || State.currentLevel === State.lastLevel) {
                // For the "reset data" level or last level, remove button and stop music.
                Shapes.menuUI[0] = [new circ(0)];
                Audio.gameMusic.pause();
                Audio.gameMusic.currentTime = 0;
            }
            // If applicable, save State.score, or update if it's higher.
            if (State.currentLevel !== -1 && (!State.highScore || Number(State.highScore) < State.score)) {
                Shapes.menuUI[1].text.lines[1] = ["Best: " + State.score];
                localStorage.setItem("score" + State.currentLevel, String(State.score));
            }
            if (winAnim()) {
                if (State.currentLevel === -1) {
                    // For the "reset data" level, reset progression and State.scores, save to local storage, and restart game.
                    if (State.gameState !== "reset") {
                        State.maxLevel = 1;
                        localStorage.setItem("maxLevel", State.maxLevel);
                        for (let i = 1; i <= State.lastLevel; i++) {
                            localStorage.removeItem("score" + i);
                        }
                        State.gameState = "reset";
                        Shapes.FGShapes = [Shapes.FGShapes[Shapes.FGShapes.length - 1]];
                        Shapes.FGShapes[0].update();
                        startGame(false);
                    }
                } else {
                    // If applicable, unlock next level and save to local storage.
                    if (State.currentLevel === State.maxLevel) {
                        State.maxLevel++;
                        localStorage.setItem("maxLevel", State.maxLevel);
                    }
                    if (State.currentLevel === State.lastLevel) {
                        State.gameState = "complete";
                        Shapes.FGShapes = [Shapes.FGShapes[Shapes.FGShapes.length - 1]];
                        if (State.gameSettings.fades) Shapes.FGShapes[0].update();
                        Menus.setupCompletion(); 
                    } else loadLevel("Level " + ++State.currentLevel, false);
                }
            }
            break;
        case "failed":
            if (loseAnim()) {
                const levelString = (State.currentLevel === -1) ? "Reset Data" : "Level " + State.currentLevel;
                loadLevel(levelString, false)
            };
            break;
        default:
            if (State.currentLevel !== -1) {
                State.score = Math.max(0, Math.floor(1000 - Timer.time * 10));
                Shapes.menuUI[1].text.lines[0] = ["Score: " + State.score];
            }
    }
}