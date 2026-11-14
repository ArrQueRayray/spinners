// Note: The top-left corner in the preferred coordinate system is (-480, 360).
"use strict";

// Import variables and functions from JS files.
import { gameArea, ctx } from './scripts/canvas.js';
import { rect, circ, text, drawRect, drawCirc, sqDist, inShape } from './scripts/utils.js';
import * as Audio from './scripts/audio.js';
import * as Menus from './scripts/menus.js';
import { State } from './scripts/states.js';
import { Timer } from './scripts/timer.js';
import { Shapes } from './scripts/entities.js';

// Declare and/or initialize context, shape arrays, and fetch levels.
let mainPlayer, mainGoal, safeArea, obstacles, coins;
let levels = {}, loadedLevel;
fetchLevels();

// Declare audio refresh interval and fetch audio.
Audio.fetchAudio();

// Declare and/or initialize other gameplay states and properties.
let hDist, hDiag, gameScale;

// Setup fonts to be used in-game.
new FontFace("Francois One", 'url(assets/misc/FrancoisOne.ttf)').load().then((font) => {document.fonts.add(font)});
new FontFace("Paytone One", 'url(assets/misc/PaytoneOne.ttf)').load().then((font) => {document.fonts.add(font)});

// Retrieve save data from local storage if available.
State.maxLevel = Number(localStorage.getItem("maxLevel"));
if (Number.isNaN(State.maxLevel) || State.maxLevel < 1 || State.maxLevel > State.lastLevel + 1) State.maxLevel = 1;

// Retrieve settings data.
["music", "sound", "shapes", "fades"].forEach(setting => {
    if (localStorage.getItem(setting))
        State.gameSettings[setting] = localStorage.getItem(setting) == "true";
});

startGame(true);

// Starts game by setting up shapes, play button, and game area.
function startGame(firstLoad) {
    State.gameState = "none";
    State.levelState = "none";
    Menus.clearTargets();
    Timer.start = Date.now() / 1000, Timer.time = 0;
    
    Shapes.BGShapes = [
        new rect(480, 480, 0.5, -440, 320, Math.random() * 360),
        new rect(480, 480, -0.5, 440, 320, Math.random() * 360),
        new rect(480, 480, -0.5, -440, -320, Math.random() * 360),
        new rect(480, 480, 0.5, 440, -320, Math.random() * 360),
        new rect(300, 300, 0.5, -480, 160, Math.random() * 360),
        new rect(300, 300, -0.5, 480, 160, Math.random() * 360),
        new rect(300, 300, -0.5, 160, 360, Math.random() * 360),
        new rect(300, 300, 0.5, 160, -360, Math.random() * 360),
        new rect(300, 300, -0.5, -480, -160, Math.random() * 360),
        new rect(300, 300, 0.5, 480, -160, Math.random() * 360),
        new rect(300, 300, 0.5, -160, 360, Math.random() * 360),
        new rect(300, 300, -0.5, -160, -360, Math.random() * 360)
    ];
    for (let i = 0; i < Shapes.BGShapes.length; i++) {
        const alpha = (i < 4) ? 0.5 : 0.25;
        Shapes.BGShapes[i].speed *= Math.random() + 0.5;
        Shapes.BGShapes[i].color = `rgba(255, 0, 0, ${alpha})`;
    }

    Shapes.FGShapes = [new rect(960, 720, 0, 0, 0, 0, "black")];
    Shapes.FGShapes[0].transition = true;

    Shapes.menuUI = [new Menus.button(0, 0, new rect(360, 200), new text("Play", 0, 0, 84), 0, 240)];

    if (firstLoad) {
        Menus.setupMouse();
        setupKeys();
        gameArea.start();
    }
}

// Sets levels to levels.json.
async function fetchLevels() {
    try {
        levels = await fetch("assets/levels.json").then((lv) => {return lv.json();});
    } catch (error) {
        console.error("Levels not found");
    }
}

// Loads objects and sets variables required for playing through a new level.
function loadLevel(level, firstLoad) {
    // Setup Timer.time and states.
    Timer.reset();
    State.gameState = "level", State.levelState = "none", State.score = 1000;
    Shapes.FGShapes[Shapes.FGShapes.length - 1].animStart = 0;
    Shapes.FGShapes[Shapes.FGShapes.length - 1].duration = State.gameSettings.fades ? 0.5 : 0;
    Menus.blockTargets();
    setTimeout(Menus.clearTargets, State.gameSettings.fades ? 250 : 0);

    // If a first level load, setup the menu button.
    if (firstLoad) {
        if (State.currentLevel == -1) Shapes.menuUI = [new Menus.button(480, -360, new rect(375, 80), new text("No, take me back", -3.875, 0.8, 24), 0, 80)];
        else {
            Shapes.menuUI = [new Menus.button(480, -360, new rect(275, 80), new text("Level Select", -2.75, 0.8, 24), 0, 80),
                new Menus.button(-480, 360, new rect(245, 140), new text("Score: 999\nBest: N/A", 0.25, -1.4, 24), 1, 80)];
            Shapes.menuUI[1].status = "white";
            Shapes.menuUI[1].text.align = "left";
            Shapes.menuUI[1].check();
        }
        Shapes.menuUI[0].status = "white";
    }

    // Retrieve and update high State.score.
    State.highScore = Number(localStorage.getItem("score" + State.currentLevel));
    if (State.currentLevel != -1) Shapes.menuUI[1].text.lines[1] = "Best: " + State.highScore;

    // Get desired level from levels.json if possible.
    try {
        // Load placeholder level in case level doesn't exist.
        loadedLevel = {"name": "Oh noes!",
            "text": [{"x": 0, "y": 100, "string": "Error! Please contact ArrQue about this."}],
            "player": {"x": -240, "y": 0}, "goal": {"x": 240, "y": 0},
            "safeArea": [{"type": "rect", "x": 0, "y": 0, "width": 600, "height": 120}],
            "obstacles": [{"type": "rect", "x": 0, "y": 0, "width": 122, "height": 24, "speed": 24}]};

        if (Object.hasOwn(levels, level)) {
            loadedLevel = levels[level];
        }

        // Scale determines player and goal size.
        gameScale = Object.hasOwn(loadedLevel, "scale") ? loadedLevel.scale: 1;

        // All planned levels have a solid red background, and some may have text which goes on the foreground.
        const flash = Shapes.FGShapes[Shapes.FGShapes.length - 1];
        const levelTitle = new text(`${level}: ${loadedLevel.name}`, -475, -345, 24, "black", "left");
        const levelText = (loadedLevel.text ?? []).map((obj) => {
            const { string, x, y, size = 36, color = "black", align = "center" } = obj;
            return new text(string, x, y, size, color, align);
        });

        Shapes.FGShapes = [levelTitle, ...levelText, flash];

        const redBG = Object.assign(new rect(960, 720), { main: true });
        const BGSquares = Array.from({ length: 16 }, (_, i) => {
            const size = 60 + Math.random() * 400;
            const speed = (Math.random() + 0.5) * (Math.round(Math.random()) - 0.5);
            const x = (Math.random() * 320 - 160) + ((i % 4) * (640 / 3) - 320);
            const y = (Math.random() * 240 - 120) + (Math.ceil(i / 4) * 160 - 240);
            const angle = Math.random() * 360;
            const alpha = Math.ceil(Math.random() * 3) / 32;

            return new rect(size, size, speed, x, y, angle, `rgba(255, 0, 0, ${alpha})`);
        });

        Shapes.BGShapes = [redBG, ...BGSquares];

        // Obstacles and safe areas are stored in arrays to allow for drawing and checking multiple shapes at once.

        const shapeSetter = function(obj, mainColor) {
            if (obj.type == "rect") {
                const { width = 100, height = 100, speed = 0, x = 0, y = 0, angle = 0, color = mainColor,
                    offset: { x: offsetX = 0, y: offsetY = 0 } = {}, range = 0, time = 1, delay = 0 } = obj;
                return new rect(width, height, speed, x, y, angle, color,
                    offsetX, offsetY, range, time, delay);
            } else {
                const { radius = 100, x = 0, y = 0, color = mainColor } = obj;
                return new circ(radius, x, y, color);
            }
        };

        safeArea = (loadedLevel.safeArea ?? []).map((obj) => shapeSetter(obj, "black"));
        obstacles = (loadedLevel.obstacles ?? []).map((obj) => shapeSetter(obj, "red"));

        // Coins are stored similarly, but with less customization.

        coins = (loadedLevel.coins ?? []).map((obj) => new coin(obj.x, obj.y));
        State.coinCount = coins.length;


        // Player and goal are stored as variables, given defined coordinates
        mainPlayer = new player(loadedLevel.player.x, loadedLevel.player.y);
        mainGoal = new goal(loadedLevel.goal.x, loadedLevel.goal.y);

    } catch (error) {
        console.error("JSON parsing error: " + error);
    }
}

// Setup keyboard control functionality for moving player alongside other tasks.
function setupKeys() {
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
                /*
                console.log("mouseCoords: " + mouseCoords.x + " " + mouseCoords.y);
                return fetchLevels();
                */
            case "Backslash":
                // For debugging purposes only, auto-completes the current level.
                /*
                if (State.gameState == "level" && State.levelState == "none") {
                    mainPlayer.circ.x = mainGoal.x;
                    mainPlayer.circ.y = mainGoal.y;
                    coins.forEach(coin => {
                        coin.animate();
                    });
                }
                */
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

// Creates a player component, with circle and additional features such as movement and animation.
function player(x=0, y=0) {
    this.circ = new circ(16 * gameScale, x, y, "cyan");
    this.playerScale = 1;
    this.hitboxScale = 0.75; // Smaller hitboxes feel fairer; this specifies hitbox scale compared to player size.
    this.speedX = 0;
    this.speedY = 0;
    this.controllable = true;
    this.blink = 3 + 2 * Math.random(); // Blink Timer.time to control how long between each blink.
    this.setup = () => {
        // Sets up distance from center to edge of the hitbox, and resulting x/y difference at 45-degree angle.
        hDist = this.hitboxScale * this.circ.radius;
        hDiag = hDist * Math.SQRT1_2;
    }
    this.update = () => {
        this.circ.radius = Math.max(0, 16 * gameScale * this.playerScale);
        const accel = 0.5 * gameScale; // How fast the player reaches max speed.
        const maxSpeed = 3.6 * gameScale; // The fastest the player can travel.
        const moving = (!!gameArea.keys[1] !== !!gameArea.keys[3]) || (!!gameArea.keys[0] !== !!gameArea.keys[2]);

        // Change speed variables based on pressed keys.

        if (this.controllable && moving) {
            if (!!gameArea.keys[1] && !gameArea.keys[3]) this.speedX -= accel;
            if (!gameArea.keys[1] && !!gameArea.keys[3]) this.speedX += accel;
            if (!!gameArea.keys[0] && !gameArea.keys[2]) this.speedY += accel;
            if (!gameArea.keys[0] && !!gameArea.keys[2]) this.speedY -= accel;
        }

        // If no keys are held or all held keys cancel out each other, this brings the player to a stop.
        const limit = function (val) {
            let v = val;
            if (v) {
                if (Math.abs(v) <= accel) return 0;
                if (v > 0) v -= accel; else v += accel;
            }
            return v;
        }

        // If max speed is exceeded, this clamps the speed and keeps it in range.
        if (!this.controllable || !!gameArea.keys[1] == !!gameArea.keys[3]) this.speedX = limit(this.speedX);
        if (!this.controllable || !!gameArea.keys[0] == !!gameArea.keys[2]) this.speedY = limit(this.speedY);
        this.speedX = Math.min(Math.max(this.speedX, -1 * maxSpeed), maxSpeed);
        this.speedY = Math.min(Math.max(this.speedY, -1 * maxSpeed), maxSpeed);

        // The player could go faster than max speed by moving diagonally; trigonometry
        // is needed to clamp the speed in diagonal movement as well.
        if (this.speedX ** 2 + this.speedY ** 2 > maxSpeed ** 2) {
            const atan = Math.atan(this.speedY / this.speedX);
            this.circ.x += this.speedX * Math.abs(Math.cos(atan));
            this.circ.y += this.speedY * Math.abs(Math.sin(atan));
        } else {
            this.circ.x += this.speedX;
            this.circ.y += this.speedY;
        }

        this.circ.update();
        this.drawEyes();
    }
    this.drawEyes = () => {
        ctx.beginPath(); 
        ctx.fillStyle = "black";
        const fullScale = gameScale * this.playerScale;

        // The coordinates of the midpoint of the eyes is calculated along with a nod animation.
        const middle = mainPlayer.circ.x + mainPlayer.speedX * 1.333;
        const nod = Number(State.levelState != "failed") * 2 * fullScale * Math.sin(Timer.time * Math.PI * 1.5);
        const height = mainPlayer.circ.y + (3 * fullScale) + nod + mainPlayer.speedY * 1.333;

        // A blink Timer.time is used to either draw eyes where they are located.
        const notBlinking = Timer.time < mainPlayer.blink || Timer.time > mainPlayer.blink + 0.06;
        const levelCompleteStart = State.levelState == "complete" && Timer.time - Timer.animStart < 0.25;

        // Eye shapes are prepared.
        const circleEye = (offset) => drawCirc(middle + offset * fullScale, height, 3.2 * fullScale);
        const lineEye = (offset, angle) => drawRect(middle + offset * fullScale, height, 9.6 * fullScale, 2 * fullScale, angle);
        const arcEye = (offset) => {
            ctx.beginPath();
            ctx.arc((middle + offset * fullScale) + 480, 360 - height - 1.6 * fullScale, 3.2 * fullScale, 0, Math.PI);
            ctx.lineWidth = 2 * fullScale;
            ctx.strokeStyle = "black";
            ctx.stroke();
        }

        if (notBlinking && (State.levelState == "none" || levelCompleteStart)) {
            // After a blink, the blink Timer.time is reset, with circle eyes drawn.
            if (Timer.time > mainPlayer.blink) mainPlayer.blink += 3.1 + 2 * Math.random();
            circleEye(-5.6);
            circleEye(5.6);
        } else {
            if (State.levelState == "failed") {
                // Draw X-shaped eyes.
                lineEye(-5.6, -45);
                lineEye(-5.6, 45);
                lineEye(5.6, -45);
                lineEye(5.6, 45);
            } else if (State.levelState == "complete") {
                // Draw one eye winking.
                circleEye(-5.6);
                arcEye(5.6);
            } else {
                arcEye(-5.6);
                arcEye(5.6);
            }
        }
    } 
    this.setup();
}

// Creates a goal component, with a "pulsing" animation created with a Timer.time and sine/cosine functions.
function goal(x=0, y=0) {
    this.x = x;
    this.y = y;
    this.rects = new Array(3);
    this.goalScale = State.coinCount > 0 ? 0.001 : 1;
    this.animating = false;
    this.animStart = 0;
    for (let i = 0; i < 3; i++) {
        this.rects[i] = new rect(36 * gameScale * this.goalScale, 36 * gameScale * this.goalScale, 2, x, y, i * 30 - 15, "#ffffff80");
    }
    this.update = () => {
        if (State.coinCount > 0) return; // If there are uncollected coins, don't appear.

        // If a last coin is collected, play a sound and appear by enlarging.
        if (State.levelState != "complete") {
            if (this.goalScale == 0.001) {
                this.animating = true;
                this.animStart = Timer.time;
                Audio.playSound("appear", 0.5);
            }
            if (this.animating && (Timer.time - this.animStart) < 0.789) {
                const t = Timer.time - this.animStart;
                this.goalScale = -6 * t * t + 6 * t;
            } else {
                this.goalScale = 1;
            }
        }

        ctx.beginPath();
        for (let i = 0; i < 3; i++) {
            this.rects[i].width = 36 + (12 - 3 * i) * Math.sin(Timer.time * Math.PI * 2 + (i * 3 * Math.PI / 4));
            this.rects[i].width *= gameScale * this.goalScale;
            this.rects[i].height = this.rects[i].width;
            this.rects[i].update();
        }
    };
    this.isClose = function() {
        // Check if goal is within 36 pixels (adjusted to game scale).
        const sqGoalDist = sqDist(mainPlayer.circ.x, mainPlayer.circ.y, this.x, this.y);
        const range = 36 * gameScale;
        return sqGoalDist < range * range;
    };
}

// Creates a coin component, collectible
function coin(x=0, y=0) {
    this.x = x;
    this.y = y;
    this.rects = [new rect(30 * gameScale, 30 * gameScale, 1, x, y, 30, "rgba(255, 255, 255, 0.13)"),
                  new rect(45 * gameScale, 45 * gameScale, -1, x, y, -30, "#ffff0010")];
    this.coinScale = 1;
    this.offset = Math.random() * 2 * Math.PI;
    this.animating = false;
    this.animStart = 0;
    this.update = function() {
        const size = 12 * this.coinScale * gameScale;
        const spin = Math.sin(Timer.time * Math.PI / 2 + this.offset);
        const hover = 4 * Math.sin(Timer.time * Math.PI + this.offset) * gameScale;
        let shine = Math.abs(Math.cos(Timer.time * Math.PI / 2 + this.offset));
        shine = 255 * shine * shine * shine;
        this.rects[0].update();
        this.rects[1].update();
        ctx.beginPath();
        ctx.fillStyle = `rgb(255, 255, ${shine})`;
        ctx.moveTo(x + 480, 360 - (y + size) - hover);
        ctx.lineTo(x + 480 - (size * spin), 360 - y - hover);
        ctx.lineTo(x + 480, 360 - (y - size) - hover);
        ctx.lineTo(x + 480 + (size * spin), 360 - y - hover);
        ctx.fill();
    };
    this.animate = () => {
        // Decrement coin count upon collection.
        if (!this.animating) {
            State.coinCount--;
            this.animating = true;
            this.animStart = Timer.time;
            Audio.playSound("coin", 0.3);
        }

        // Animate a coin disappearing as it is collected.
        const elapsedAmount = (Timer.time - this.animStart) / 0.5;

        // Return when animation is over.
        if (elapsedAmount > 1) return;

        const colorVal = 255 * (1 - elapsedAmount * elapsedAmount);
        const animScale = -3 * elapsedAmount * elapsedAmount + 2 * elapsedAmount + 1;
        this.rects[0].color = `rgba(255, 255, ${colorVal}, ${colorVal / 255})`;
        this.rects[1].color = `rgba(255, 255, ${colorVal}, ${colorVal / 255 / 2})`;
        this.rects[0].width = this.rects[0].height = 30 * gameScale * animScale;
        this.rects[1].width = this.rects[1].height = 45 * gameScale * animScale;
        this.rects[0].speed = colorVal / 255 * 3;
        this.rects[1].speed = -colorVal / 255 * 3;
        this.rects[0].update();
        this.rects[1].update();
    }
    this.isClose = function() {
        // Check if coin is within 32 pixels (adjusted to game scale).
        const sqGoalDist = sqDist(mainPlayer.circ.x, mainPlayer.circ.y, this.x, this.y);
        const range = 32 * gameScale;
        return sqGoalDist < range * range;
    };
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
                ctx.globalAlpha = (element.animStart == 0) ? 1 - elapsedAmount : elapsedAmount;
                element.update();
                ctx.globalAlpha = 1;
            }
        }
    });

    if (State.gameState == "none" && Timer.time < 0.2) {
        ctx.beginPath();
        ctx.fillStyle = "black";
        drawRect(0, 0, 960, 720);
    }
}


// Handles logic for single-buttoned screens such as the start or levels.
export function oneButtonLogic() {
    // Background shapes, if enabled, are always drawn first on the start screen.
    if (State.gameState == "none") {
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
            if (State.gameState == "none") {
                Audio.gameMusic.play();
                Menus.setupMainMenu(true);
            }
            else if (State.currentLevel == -1) Menus.setupSettings(true);
            else Menus.setupLevelSelect(true);
        }
    } else {
        if (Menus.mouseTarget != -2) Menus.clearTargets();
        if (typeof Shapes.menuUI[0].update === "function") {
            if (Menus.mainMenuVisited || State.gameState != "none" || Timer.time > 1) {
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
    if (State.gameState == "level" && State.currentLevel != -1) {
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
    if (Menus.mouseTarget != -2) {
        Menus.clearTargets();
        Shapes.menuUI.forEach(element => { 
            element.update();

            // If it is a button, check if mouse is hovering over button.
            if (typeof element.check === "function") element.check();
        });
        // On the level select, hovering over an unlocked level brings up its name.
        if (State.gameState == "select") {
            Shapes.menuUI[31].lines = Shapes.menuUI[32].lines = [""];
            if (Menus.mouseTarget > -1 && Menus.mouseTarget != 30) {
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
            if (element.id == Menus.animTarget) {
                Shapes.FGShapes[Shapes.FGShapes.length - 1].color = "black";
                // This handles button animations. Most buttons occur with a screen transition, with the
                // exception of some buttons in the settings menu, which also have no fadeout.
                const settingsToggle = State.gameState == "settings" && Menus.animTarget < 4;
                const buttonAnimDone = !element.animate(settingsToggle ? 0 : 0.25);
                const FGAnimDone = !settingsToggle && !Menus.animateFG(element.animStart, 0.5);

                // Setting toggle buttons should only run toggle() once.
                if (settingsToggle && !element?.toggled) {
                    element.toggled = true;
                    element.toggle();
                }

                // Checks are performed to ensure the animations have completed.
                if (!State.gameSettings.fades || ( buttonAnimDone && (settingsToggle || FGAnimDone))) {
                    if (State.gameState == "menu") {
                        // The buttons on the main menu correspond to level select, settings, and credits.
                        (() => {
                            switch (element.id) {
                                case 0: return Menus.setupLevelSelect(false);
                                case 1: return Menus.setupSettings(false);
                                case 2: return Menus.setupCredits();
                            }
                        })();
                    } else if (State.gameState == "select") {
                        // The buttons on the level select correspond to levels and the main menu.
                        (() => {
                            switch (element.id) {
                                case 30: return Menus.setupMainMenu(false);
                                default: 
                                    State.currentLevel = element.id + 1;
                                    return loadLevel("Level " + State.currentLevel, true);
                            }
                        })();
                    } else if (State.gameState == "settings") {
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
                if (element.id != Menus.animTarget) element.update();
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
    safeArea.forEach(element => {element.update();});
    if (State.gameSettings.shapes) Shapes.BGShapes.forEach(element => {if (!element?.main) element.update();}); // Other BG shapes are drawn if enabled.
    obstacles.forEach(element => {element.update();});
    coins.forEach(element => { // element.update();
        if (element.animating || element.isClose())
            element.animate();
        else
            element.update();
    });

    // Goal and player are drawn last.
    mainGoal.update();
    mainPlayer.update();

    // If all coins are collected and player is close enough to the goal, the level is officially completed.
    if (State.coinCount == 0 && mainGoal.isClose() && State.levelState == "none") {
        mainPlayer.controllable = false; 
        Menus.blockTargets();
        State.levelState = "complete";
        Timer.animStart = Timer.time;
        Audio.playSound("enter");
        setTimeout(Audio.playSound, 250, "wink");
    }

    // If player is no longer alive, the level is failed.
    if (!playerIsAlive() && State.levelState == "none") {
        mainPlayer.controllable = false; 
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
            if (State.currentLevel == -1 || State.currentLevel == State.lastLevel) {
                // For the "reset data" level or last level, remove button and stop music.
                Shapes.menuUI[0] = [new circ(0)];
                Audio.gameMusic.pause();
                Audio.gameMusic.currentTime = 0;
            }
            // If applicable, save State.score, or update if it's higher.
            if (State.currentLevel != -1 && (!State.highScore || Number(State.highScore) < State.score)) {
                Shapes.menuUI[1].text.lines[1] = ["Best: " + State.score];
                localStorage.setItem("score" + State.currentLevel, String(State.score));
            }
            if (levelCompleteAnimation()) {
                if (State.currentLevel == -1) {
                    // For the "reset data" level, reset progression and State.scores, save to local storage, and restart game.
                    if (State.gameState != "reset") {
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
                    if (State.currentLevel == State.maxLevel) {
                        State.maxLevel++;
                        localStorage.setItem("maxLevel", State.maxLevel);
                    }
                    if (State.currentLevel == State.lastLevel) {
                        State.gameState = "complete";
                        Shapes.FGShapes = [Shapes.FGShapes[Shapes.FGShapes.length - 1]];
                        if (State.gameSettings.fades) Shapes.FGShapes[0].update();
                        Menus.setupCompletion(); 
                    } else loadLevel("Level " + ++State.currentLevel, false);
                }
            }
            break;
        case "failed":
            if (levelFailedAnimation()) loadLevel("Level " + State.currentLevel, false);
            break;
        default:
            if (State.currentLevel != -1) {
                State.score = Math.max(0, Math.floor(1000 - Timer.time * 10));
                Shapes.menuUI[1].text.lines[0] = ["Score: " + State.score];
            }
    }
}

// Check if player is alive through collisions between shapes in game area.
function playerIsAlive() {
    // Formerly, this performed a check with the full bounding boxes and circle. However, this proved
    // problematic with cases where the player doesn't fully intersect any safe area shape but visually
    // is fully contained in the safe area as a whole. This incorrectly deemed the player dead, and is
    // resolved by approximating the hitbox with individual points and checking them.

    // Create hitbox points.
    const cx = mainPlayer.circ.x
    const cy = mainPlayer.circ.y;
    let hitboxPoints = [{x: cx + hDist, y: cy, alive: false},
                        {x: cx - hDist, y: cy, alive: false},
                        {x: cx, y: cy + hDist, alive: false},
                        {x: cx, y: cy - hDist, alive: false},
                        {x: cx - hDiag, y: cy + hDiag, alive: false},
                        {x: cx + hDiag, y: cy + hDiag, alive: false},
                        {x: cx - hDiag, y: cy - hDiag, alive: false},
                        {x: cx + hDiag, y: cy - hDiag, alive: false}];

    // Check if each point is alive, i.e. in a safeArea shape and not in an obstacles shape.
    for (let i = 0; i < hitboxPoints.length; i++) {
        for (let j = 0; j < safeArea.length; j++) {
            if (inShape(hitboxPoints[i], safeArea[j])) {
                hitboxPoints[i].alive = true;
                break;
            }
        }

        // This is skipped if the point wasn't in a safe area to begin with.
        if (hitboxPoints[i].alive) {
            for (let j = 0; j < obstacles.length; j++) {
                if (inShape(hitboxPoints[i], obstacles[j])) {
                    hitboxPoints[i].alive = false;
                    break;
                }
            }
        }

        // Once a single point is guaranteed dead, the player is also guaranteed dead.
        if (!hitboxPoints[i].alive) {
            return false;
        }
    }
    return true;
}

// Animate player being sucked into goal, returning true 0.5 seconds after animation is complete.
function levelCompleteAnimation() {
    const dx = mainGoal.rects[0].x - mainPlayer.circ.x;
    const dy = mainGoal.rects[0].y - mainPlayer.circ.y;
    const elapsedTime = Timer.time - Timer.animStart;
    if (elapsedTime < 0.75) {
        mainPlayer.circ.x += dx * elapsedTime * 0.3;
        mainPlayer.circ.y += dy * elapsedTime * 0.3;
        mainPlayer.playerScale = 7.7 * Math.sin((elapsedTime / 0.75) + 1.2) - 6.2;
        mainGoal.goalScale = 2 * Math.sin((elapsedTime / 0.75) * 5 * Math.PI / 6 + Math.PI / 6);
        return false;
    } else {
        if (Shapes.FGShapes[Shapes.FGShapes.length - 1].animStart == 0) {
            Shapes.FGShapes[Shapes.FGShapes.length - 1].animStart = Timer.time;
            Shapes.FGShapes[Shapes.FGShapes.length - 1].duration = State.gameSettings.fades ? 0.5 : 0;
            Shapes.FGShapes[Shapes.FGShapes.length - 1].color = State.currentLevel == -1 ? "black" : "white";
        }
        gameScale = 0;
        mainGoal.goalScale = 0;
        return elapsedTime >= (State.gameSettings.fades ? 1.25 : 0.75);
    }
}

// Animate player dying, returning true 0.5 seconds after animation is complete.
function levelFailedAnimation() {
    const elapsedTime = Timer.time - Timer.animStart;
    if (elapsedTime < 0.5) {
        mainPlayer.circ.color = `rgba(0, 255, 255, ${1 - elapsedTime / 0.5})`;
        mainPlayer.playerScale = 7.7 * Math.sin((elapsedTime / 0.5) + 1.2) - 6.2;
        return false;
    } else {
        if (Shapes.FGShapes[Shapes.FGShapes.length - 1].animStart == 0) {
            Shapes.FGShapes[Shapes.FGShapes.length - 1].animStart = Timer.time;
            Shapes.FGShapes[Shapes.FGShapes.length - 1].duration = State.gameSettings.fades ? 0.25 : 0;
            Shapes.FGShapes[Shapes.FGShapes.length - 1].color = "red";
        }
        mainPlayer.playerScale = 0;
        return elapsedTime >= (State.gameSettings.fades ? 0.75 : 0.5);
    }
}