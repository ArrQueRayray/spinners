// I'm much more used to working with a coordinate system where the middle of the canvas is the origin. For all
// intents and purposes, the top-left corner in all user-defined functions is (-480, 360) rather than (0, 0).
"use strict";

// Declare and/or initialize context, shape arrays, and levels and mouse coordinates objects.
var ctx, BGShapes = [], FGShapes = [], menuButtons = [];
var mainPlayer, mainGoal, safeArea, obstacles;
var levels = {}, mouseCoords = {x: -999, y: -999};
var currentLevel = 1;
fetchLevels();

// Declare and/or initialize audio-related components.
var gameMusic = new Audio("assets/audio/spinners.ogg");
gameMusic.preload = true;
gameMusic.loop = true;
gameMusic.volume = 0.2;
let soundEffects = {
    click: new Audio("assets/audio/click.wav"),
    enter: new Audio("assets/audio/enter.wav"),
    hit: new Audio("assets/audio/hit.wav"),
    ouch: new Audio("assets/audio/ouch.wav"),
    wink: new Audio("assets/audio/wink.wav")
};

// Declare and/or initialize other gameplay states and properties.
var muted = false, clickable = "none";
let gameState = "none", levelState = "none";
let timerStart = Date.now() / 1000, timer = 0, animStartTime = 0;
let hDist, hDiag, gameScale;

// Setup font to be used in-game.
const mainFont = new FontFace("Fredoka", 'url(assets/misc/Fredoka.ttf)');
mainFont.load().then((font) => {document.fonts.add(font)});

// Starts game by setting up BG/FG shapes, play button, and game area.
function startGame() {
    BGShapes = [
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
        new rect(300, 300, -0.5, -160, -360, Math.random() * 360),
        new rect(240, 240, 0.5, 0, 0, Math.random() * 360),
        new rect(240, 240, -0.5, 0, 0, Math.random() * 360)
    ];
    for (let i = 0; i < BGShapes.length; i++) {
        const alpha = (i < 4) ? 0.5 : (i < 12) ? 0.25 : 0.125;
        BGShapes[i].speed *= Math.random() + 0.5;
        BGShapes[i].color = "rgba(255, 0, 0, " + alpha + ")";
    }

    FGShapes = [new rect(960, 720)];
    FGShapes[FGShapes.length - 1].color = "rgba(0, 0, 0, 0)";
    FGShapes[FGShapes.length - 1].duration = 1;
    FGShapes[FGShapes.length - 1].transition = true;

    menuButtons = [new button(0, 0, new rect(360, 200), new text("Play", 0, 0, 120), "play")];

    gameArea.start();
}

// Sets levels to levels.json.
async function fetchLevels() {
    try {
        levels = await fetch("assets/levels.json").then((lv) => {return lv.json();});
    } catch (error) {
        console.error("Levels not found");
    }
}

// Loads objects separately from starting game, allowing for reload without reloading page.
function loadLevel(level) {
    // Setup timer and states
    timerStart = Date.now() / 1000, timer = 0, animStartTime = 0;
    gameState = "level";
    levelState = "none";
    FGShapes[FGShapes.length - 1].animStart = 0;
    FGShapes[FGShapes.length - 1].duration = 1;

    // Get desired level from levels.json if possible.
    try {
        let loadedLevel = {"name": "Dummy level",
            "text": [{"x": 0, "y": 100, "string": "Invalid level loaded."}],
            "player": {"x": -240, "y": 0}, "goal": {"x": 240, "y": 0},
            "safeArea": [{"type": "rect", "x": 0, "y": 0, "width": 600, "height": 120}],
            "obstacles": [{"type": "rect", "x": 0, "y": 0, "width": 122, "height": 24, "speed": 24}]};

        if (Object.hasOwn(levels, level)) {
             loadedLevel = levels[level];
        }

        // Scale determines player and goal size.
        gameScale = Object.hasOwn(loadedLevel, "scale") ? loadedLevel.scale: 1;

        // All planned levels have a solid red background, and some may have text which goes on the foreground.
        const flash = FGShapes[FGShapes.length - 1];
        if (Object.hasOwn(loadedLevel, "text")) {
            FGShapes = new Array(2 + loadedLevel.text.length);

            let iter = 0;
            loadedLevel.text.forEach((obj) => {
                iter++;
                const size = Object.hasOwn(obj, "size") ? obj.size : 36;
                const color = Object.hasOwn(obj, "color") ? obj.color : "black";
                const align = Object.hasOwn(obj, "align") ? obj.align : "center";
                FGShapes[iter] = new text(obj.string, obj.x, obj.y, size, color, align);
            });
        } else FGShapes = new Array(2);

        BGShapes = new Array(17);
        BGShapes[0] = new rect(960, 720);
        BGShapes[0].color = "red";
        BGShapes[0].main = true;
        for (let i = 1; i <= 16; i++) {
            BGShapes[i] = new rect(60 + Math.random() * 400);
            BGShapes[i].height = BGShapes[i].width;
            BGShapes[i].x = Math.random() * 320 - 160;
            BGShapes[i].y = Math.random() * 240 - 120;
            BGShapes[i].x += (i % 4 * (640 / 3)) - 320;
            BGShapes[i].y += (Math.ceil(i / 4 - 1) * 160) - 240;
            BGShapes[i].angle = Math.random() * 360;
            BGShapes[i].speed = (Math.random() + 0.5) * (Math.round(Math.random()) - 0.5);
            BGShapes[i].color = "rgba(255, 0, 0, " + (Math.ceil(Math.random() * 3) / 32) + ")";
        }

        FGShapes[FGShapes.length - 1] = flash;
        FGShapes[0] = new text(level + ": " + loadedLevel.name, -475, -345, 24, "black", "left");

        // Player and goal are stored as variables, given defined coordinates
        mainPlayer = new player(loadedLevel.player.x, loadedLevel.player.y);
        mainGoal = new goal(loadedLevel.goal.x, loadedLevel.goal.y);

        // Obstacles and safe areas are stored in arrays to allow for drawing and checking multiple shapes at once.

        safeArea = new Array(loadedLevel.safeArea.length);
        for (let i = 0; i < loadedLevel.safeArea.length; i++) {
            const obj = loadedLevel.safeArea[i];
            const color = Object.hasOwn(obj, "color") ? obj.color : "black";
            if (obj.type == "rect") {
                const speed = Object.hasOwn(obj, "speed") ? obj.speed : 0;
                const angle = Object.hasOwn(obj, "angle") ? obj.angle : 0;
                const offset = Object.hasOwn(obj, "offset") ? obj.offset : {"x": 0, "y": 0};
                safeArea[i] = new rect(obj.width, obj.height, speed, obj.x, obj.y, angle, color, offset.x, offset.y);
            } else safeArea[i] = new circ(obj.radius, obj.x, obj.y, color);
        }

        obstacles = new Array(loadedLevel.obstacles.length);
        for (let i = 0; i < loadedLevel.obstacles.length; i++) {
            const obj = loadedLevel.obstacles[i];
            const color = Object.hasOwn(obj, "color") ? obj.color : "red";
            if (obj.type == "rect") {
                const speed = Object.hasOwn(obj, "speed") ? obj.speed : 0;
                const angle = Object.hasOwn(obj, "angle") ? obj.angle : 0;
                const offset = Object.hasOwn(obj, "offset") ? obj.offset : {"x": 0, "y": 0};
                obstacles[i] = new rect(obj.width, obj.height, speed, obj.x, obj.y, angle, color, offset.x, offset.y);
            } else {
                obstacles[i] = new circ(obj.radius, obj.x, obj.y, color);
            }
        }
    } catch (error) {
        console.error("JSON parsing error: " + error);
    }
}

// Setup game area.
var gameArea = {
    canvas: document.createElement("canvas"),
    start: function() {
        this.canvas.width = 960;
        this.canvas.height = 720;
        this.canvas.style = "position: absolute; top: 0px; left: 0px; right: 0px; bottom: 0px; margin: auto;";
        ctx = this.canvas.getContext("2d");
        document.body.insertBefore(this.canvas, document.body.childNodes[0]);

        this.scaleCanvas();
        this.setupMouse();
        this.setupKeys();
        
        this.interval = setInterval(updateGameArea, 16.6667);
    },
    scaleCanvas: function() {
        const scale = Math.min(Math.max(this.canvas.getBoundingClientRect().height / 720 * 1.5, 1), 2);
        this.canvas.width = 960 * scale;
        this.canvas.height = 720 * scale;
        ctx.scale(scale, scale);
    },
    setupMouse: function() {
        // The mouse is used to guarantee focus on the window, allowing for sound playback, and
        // eventually interacting with menu buttons.
        window.addEventListener('mousedown', function (e) {
            if (clickable != "none") {
                playSound("click", 0.4);
                clickable = "none";
                if (gameState == "none") {
                    menuButtons[0].animStart = timer;
                    menuButtons[0].animate(0.25);
                }
            }
        });

        // The coordinates are constantly updated.
        this.canvas.addEventListener("pointermove", (e) => {
            const bounds = this.canvas.getBoundingClientRect();
            mouseCoords =  {x: ((e.clientX - bounds.left) * 960) / bounds.width - 480,
                            y: 360 - ((e.clientY - bounds.top) * 960) / bounds.width};
        });
    },
    setupKeys: function() {
        // An integer array is used for checking key presses to allow for WASD or arrow keys. Key
        // codes are used in case someone uses a different keyboard layout (i.e. ZQSD can work for
        // someone with an AZERTY keyboard layout).
        gameArea.keys = [0, 0, 0, 0];
        window.addEventListener('keydown', function (e) {
            if (e.repeat) return;
            switch (e.code) {
                case "KeyW":
                case "ArrowUp":
                    gameArea.keys[0]++;
                    break;
                case "KeyA":
                case "ArrowLeft":
                    gameArea.keys[1]++;
                    break;
                case "KeyS":
                case "ArrowDown":
                    gameArea.keys[2]++;
                    break;
                case "KeyD":
                case "ArrowRight":
                    gameArea.keys[3]++;
                    break;
                case "KeyM":
                    muted = !muted;
                    break;
                case "Backquote":
                    // For ease of level creation, prints mouse coordinates and re-fetches levels.
                    console.log("mouseCoords: " + mouseCoords.x + " " + mouseCoords.y);
                    fetchLevels();
                    break;
            }
        })
        window.addEventListener('keyup', function (e) {
            switch (e.code) {
                case "KeyW":
                case "ArrowUp":
                    gameArea.keys[0]--;
                    break;
                case "KeyA":
                case "ArrowLeft":
                    gameArea.keys[1]--;
                    break;
                case "KeyS":
                case "ArrowDown":
                    gameArea.keys[2]--;
                    break;
                case "KeyD":
                case "ArrowRight":
                    gameArea.keys[3]--;
                    break;
            }
        })
        window.addEventListener("blur", () => {
            gameArea.keys = [0, 0, 0, 0];
        });
    },
    clear: function() {
        ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    }
}

// Plays sound, looking up string in soundEffects and setting volume
function playSound(key, volume=1) {
    if (muted) return;
    try {
        const soundCheck = soundEffects[key];
        soundEffects[key].currentTime = 0;
        soundEffects[key].volume = volume;
        soundEffects[key].play();
    } catch (error) {
        console.error("Sound not found");
    }
}

// Creates a rectangle component with x and y referring to center in preferred coordinate system.
function rect(width=100, height=100, speed=0, x=0, y=0, angle=0, color="red", offsetX=0, offsetY=0) {
    this.shape = "rect";
    this.width = width;
    this.height = height;
    this.speed = speed;
    this.angle = angle * Math.PI / 180;
    this.x = x;
    this.y = y; 
    this.color = color;
    this.offsetX = offsetX;
    this.offsetY = offsetY;
    this.update = function() {
        this.angle += this.speed * Math.PI / 180; 
        ctx.save();
        ctx.translate(this.x + 480, 360 - this.y);      
        ctx.rotate(this.angle);
        ctx.beginPath();
        ctx.fillStyle = this.color;
        ctx.fillRect(this.width / -2 + offsetX, this.height / -2 - offsetY, this.width, this.height);
        ctx.restore();    
    }
}

// Creates a circle component with x and y referring to center in preferred coordinate system.
function circ(radius=40, x=0, y=0, color="black") {
    this.shape = "circ";
    this.radius = radius;
    this.x = x;
    this.y = y;    
    this.color = color;
    this.update = function() {
        ctx.beginPath();
        ctx.fillStyle = this.color;
        centerFillCirc(this.x, this.y, this.radius);
    }
}

// Creates a text component based on preferred coordinate system.
function text(string="Hello!", x=0, y=0, size=36, color="black", align="center") {
    this.lines = string.split("\n");
    this.x = x;
    this.y = y; 
    this.size = size;
    this.color = color; 
    this.align = align; 
    this.update = function() {
        ctx.beginPath();
        ctx.fillStyle = this.color;
        ctx.font = this.size + "px Fredoka, Tahoma, sans-serif";
        ctx.textBaseline = "middle";
        ctx.textAlign = this.align;
        let offset = (this.lines.length - 1) * size / 2;
        this.lines.forEach((line) => {
            ctx.fillText(line, this.x + 480, 360 - this.y - offset);
            offset -= size;
        });
    }
}

// Creates a player component, with circle and additional features such as movement and animation.
function player(x=0, y=0) {
    this.circ = new circ(16 * gameScale, x, y, "cyan");
    this.playerScale = 1;
    this.hitboxScale = 0.75; // Smaller hitboxes feel fairer; this specifies hitbox scale compared to player size.
    this.speedX = 0;
    this.speedY = 0;
    this.controllable = true;
    this.blink = 3 + 2 * Math.random(); // Blink timer to control how long between each blink.
    this.setup = function() {
        // Sets up distance from center to edge of the hitbox, and resulting x/y difference at 45-degree angle.
        hDist = this.hitboxScale * this.circ.radius;
        hDiag = hDist * Math.SQRT1_2;
    }
    this.update = function() {
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
        } else if (!this.controllable) {
            gameArea.keys = [0, 0, 0, 0];
        }

        // If no keys are held or all held keys cancel out each other, this brings the player to a stop.
        function limit(val) {
            let v = val;
            if (v) {
                if (Math.abs(v) <= accel) return 0;
                if (v > 0) v -= accel; else v += accel;
            }
            return v;
        }

        // If max speed is exceeded, this clamps the speed and keeps it in range.
        if (!!gameArea.keys[1] == !!gameArea.keys[3]) this.speedX = limit(this.speedX);
        if (!!gameArea.keys[0] == !!gameArea.keys[2]) this.speedY = limit(this.speedY);
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
    this.drawEyes = function() {
        ctx.beginPath(); 
        ctx.fillStyle = "black";
        const fullScale = gameScale * this.playerScale;

        // The coordinates of the midpoint of the eyes is calculated along with a nod animation.
        const middle = mainPlayer.circ.x + mainPlayer.speedX * 1.333;
        const nod = (levelState != "failed") * 2 * fullScale * Math.sin(timer * Math.PI * 1.5);
        const height = mainPlayer.circ.y + (3 * fullScale) + nod + mainPlayer.speedY * 1.333;

        // A blink timer is used to either draw eyes where they are located.
        const notBlinking = timer < mainPlayer.blink || timer > mainPlayer.blink + 0.06;
        const levelCompleteStart = levelState == "complete" && timer - animStartTime < 0.25;

        // Eye shapes are prepared.
        const circleEye = (offset) => {centerFillCirc(middle + offset * fullScale, height, 3.2 * fullScale);};
        const lineEye = (offset, angle) => {centerFillRect(middle + offset * fullScale, height, 9.6 * fullScale, 2 * fullScale, angle);};
        const arcEye = function(offset) {
            ctx.beginPath();
            ctx.arc((middle + offset * fullScale) + 480, 360 - height - 1.6 * fullScale, 3.2 * fullScale, 0, Math.PI);
            ctx.lineWidth = 2 * fullScale;
            ctx.strokeStyle = "black";
            ctx.stroke();
        }

        if (notBlinking && (levelState == "none" || levelCompleteStart)) {
            // After a blink, the blink timer is reset, with circle eyes drawn.
            if (timer > mainPlayer.blink) mainPlayer.blink += 3.1 + 2 * Math.random();
            circleEye(-5.6);
            circleEye(5.6);
        } else {
            if (levelState == "failed") {
                // Draw X-shaped eyes.
                lineEye(-5.6, -45);
                lineEye(-5.6, 45);
                lineEye(5.6, -45);
                lineEye(5.6, 45);
            } else if (levelState == "complete") {
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

// Creates a goal component, with a "pulsing" animation created with a timer and sine/cosine functions.
function goal(x=0, y=0){
    this.rects = new Array(3);
    this.goalScale = 1;
    for (let i = 0; i < 3; i++) {
        this.rects[i] = new rect(36 * gameScale * this.goalScale, 36 * gameScale * this.goalScale, 2, x, y, i * 30 - 15, "rgba(255, 255, 255, 0.5)");
    }
    this.update = function() {
        ctx.beginPath();
        for (let i = 0; i < 3; i++) {
            this.rects[i].width = 36 + (12 - 3 * i) * Math.sin(timer * Math.PI * 2 + (i * 3 * Math.PI / 4));
            this.rects[i].width *= gameScale * this.goalScale;
            this.rects[i].height = this.rects[i].width;
            this.rects[i].update();
        }
    };
}

function button(x=0, y=0, shape, text, id) {
    this.x = x;
    this.y = y;
    this.shape = shape;
    this.text = text;
    this.text.x = x;
    this.text.y = y;
    this.shape.x = x;
    this.shape.y = y;
    this.id = id;
    this.animating = false;
    this.animStart = 0;
    this.update = function() {
        this.shape.update();
        this.text.update();
    }
    this.check = function() {
        if (inShape(mouseCoords, menuButtons[0].shape)){
            clickable = menuButtons[0].id;
            this.shape.color = "rgba(255, 64, 64, 1)";
            this.text.color = "rgba(0, 0, 0, 0.75)";
        } else {
            this.shape.color = "red";
            this.text.color = "black";
        }
    }
    this.animate = function(duration) {
        // Animate a button fading out as it is clicked
        const elapsedAmount = (timer - this.animStart) / duration;

        // Return false when animation is over.
        if (elapsedAmount > 1) return false;

        this.animating = true;
        this.scale = Math.max(0, 1 - elapsedAmount * elapsedAmount * 0.25);
        const colorVal = 255 * (1 - elapsedAmount * elapsedAmount);
        
        // Fade by controlling color directly; all buttons are red and 100% opacity.
        this.shape.color = "rgba(255, " + colorVal + ", " + colorVal + ", " + (colorVal / 127) + ")";
        this.text.color = "rgba(0, 0, 0, " + (colorVal / 127 / 2) + ")";

        // Update button visuals to match scale property.
        if (!this.shape?.radius) {
            this.shape.width *= this.scale;
            this.shape.height *= this.scale;
        } else this.shape.radius *= this.scale;
        this.text.size *= this.scale;

        this.update();

        if (this.scale > 0) {
            if (!this.shape?.radius) {
                this.shape.width /= this.scale;
                this.shape.height /= this.scale;
            } else this.shape.radius /= this.scale;
            this.text.size /= this.scale;
        }

        return true;
    }
}

// Fills a rectangle based on preferred coordinate system, and optional angle.
function centerFillRect(x, y, width, height, angle = 0) {
    ctx.beginPath();
    if (angle != 0) {
        ctx.save();
        ctx.translate(x + 480, 360 - y);        
        ctx.rotate(angle * Math.PI / 180);
        ctx.fillRect(width / -2, height / -2, width, height);
        ctx.restore();  
    } else ctx.fillRect(x + 480 + width / -2, 360 - y + height / -2, width, height);
}

// Fills a circle based on preferred coordinate system.
function centerFillCirc(x, y, radius) {
    ctx.beginPath();
    ctx.arc(x + 480, 360 - y, radius, 0, 2 * Math.PI);
    ctx.fill();
}

// Returns the distance between two points, squared to prevent square root computation.
function sqDist(x1, y1, x2, y2) {
    const dx = x2 - x1;
    const dy = y2 - y1;
    return dx * dx + dy * dy;
}

// Returns true if mainPoint is inside mainRect.
function inRect(mainPoint, mainRect) {
    // Unrotate circle by negative angle of rectangle.
    const dx = mainPoint.x - mainRect.x ;
    const dy = mainPoint.y - mainRect.y;
    const sin = Math.sin(mainRect.angle);
    const cos = Math.cos(mainRect.angle);
    const localX = cos * dx - sin * dy;
    const localY = sin * dx + cos * dy;
    const halfWidth = mainRect.width / 2;
    const halfHeight = mainRect.height / 2;

    // Find closest point on rectangle to mainPoint.
    const closeX = Math.max(-halfWidth + mainRect.offsetX, Math.min(halfWidth + mainRect.offsetX, localX));
    const closeY = Math.max(-halfHeight - mainRect.offsetY, Math.min(halfHeight - mainRect.offsetY, localY));

    // Check if closest point is equal to mainPoint.
    return localX == closeX && localY == closeY;
}

// Returns true if mainPoint is inside mainCirc.
function inCirc(mainPoint, mainCirc) {
    // Compare distance to radius.
    return sqDist(mainPoint.x, mainPoint.y, mainCirc.x, mainCirc.y) <= mainCirc.radius * mainCirc.radius;;
}

// Returns true if mainPoint is in mainShape (rect or circ).
function inShape(mainPoint, mainShape) {
    return (mainShape.shape == "circ") ? inCirc(mainPoint, mainShape) : inRect(mainPoint, mainShape);
}

// Handles logic for start screen.
function startScreen() {
    // Background shapes, if any, are always drawn first.
    BGShapes.forEach(element => {element.update()});

    // The menu consists of only a single play button.
    if (!menuButtons || !menuButtons[0]?.animating) {;
        menuButtons[0].shape.angle = 3 * Math.cos(timer * Math.PI) * Math.PI / 180;
        menuButtons[0].update();

        // Check if mouse is hovering over button.
        clickable = "none";
        menuButtons[0].check();
    } else {
        if (!menuButtons[0].animate(0.25) && !fadeOutBG(menuButtons[0].animStart + 0.25)) {
            BGShapes = [];
            gameMusic.play();
            FGShapes[FGShapes.length - 1].color = "black";
            loadLevel("Level " + currentLevel)
            // setupMainMenu();
        }
    }
}

// Animates BG fading out.
function fadeOutBG(animStart) {
    const elapsedTime = timer - animStart;
    gameArea.clear();

    // Return false when animation is over.
    if (elapsedTime >= 0.5) return false;

    // Fade by setting global alpha and redrawing; BG is always drawn first.
    const opacity = Math.max(0, (2 * elapsedTime - 1) * (2 * elapsedTime - 1));
    BGShapes.forEach((shape) => {
        let temp;
        if (shape?.speed) temp = shape.speed;
        ctx.globalAlpha = opacity;
        if (shape?.speed) shape.speed = 0;
        shape.update();
        if (typeof temp !== 'undefined') shape.speed = temp;
        ctx.globalAlpha = 1;
    });
    return true;
}

function setupMainMenu() {
    BGShapes = [
        new rect(300, 300, 0.5, -480, 360, Math.random() * 360),
        new rect(300, 300, -0.5, 480, 360, Math.random() * 360),
        new rect(300, 300, -0.5, -480, -360, Math.random() * 360),
        new rect(300, 300, 0.5, 480, -360, Math.random() * 360),
        new rect(180, 180, 0.5, -520, 120, Math.random() * 360),
        new rect(180, 180, -0.5, 520, 120, Math.random() * 360),
        new rect(180, 180, -0.5, 240, 400, Math.random() * 360),
        new rect(180, 180, 0.5, 240, -400, Math.random() * 360),
        new rect(180, 180, -0.5, -520, -120, Math.random() * 360),
        new rect(180, 180, 0.5, 520, -120, Math.random() * 360),
        new rect(180, 180, 0.5, -240, 400, Math.random() * 360),
        new rect(180, 180, -0.5, -240, -400, Math.random() * 360)
    ];
    for (let i = 0; i < BGShapes.length; i++) {
        const alpha = (i < 4) ? 0.25 : 0.125;
        BGShapes[i].speed *= Math.random() + 0.5;
        BGShapes[i].color = "rgba(255, 0, 0, " + alpha + ")";
    }

    menuButtons = [
        new button(0, 0, new rect(360, 200), new text("Level Select", 0, 0, 120), "play"),
        new button(0, 0, new rect(360, 200), new text("Clear Progress", 0, 0, 120), "clear"),
        new button(0, 0, new rect(360, 200), new text("Credits", 0, 0, 120), "about"),
    ];

    // loadLevel("Level " + currentLevel);
    gameState = "menu";
}

// Updates the canvas every frame.
function updateGameArea() {
    gameArea.clear();
    gameArea.scaleCanvas();
    timer = Date.now() / 1000 - timerStart;
    gameMusic.volume = muted ? 0 : 0.2;

    // Gameplay logic will only run during a level.
    switch (gameState) {
        case "none":
            startScreen();
            break;
        case "menu":
            menuLogic();
            break;
        case "level":
            levelLogic();
            break;
    }

    // Foreground shapes, if any, are always drawn last. The first shape is delegated to fades.
    FGShapes.forEach(element => {
        if (element?.transition) {
            if (timer < element.animStart + element.duration) {
                const elapsedAmount = (timer - element.animStart) / element.duration;
                ctx.globalAlpha = (element.animStart == 0) ? 1 - elapsedAmount : elapsedAmount;
                element.update();
                ctx.globalAlpha = 1;
            }
        } else element.update();
    });
}

// Handles logic for menu beyond start screen.
function menuLogic() {
    // Background shapes, if any, are always drawn first.
    BGShapes.forEach(element => {element.update()});

    // Each element, including in arrays, is drawn.
    menuButtons.forEach(element => {element.update()});
}

// Handles logic for gameplay.
function levelLogic() {
    // Only the first shape is drawn first.
    BGShapes[0].update();

    // This clamps each value in the keys array between 0 and 2.
    for (let i = 0; i < 4; i++) {
        gameArea.keys[i] = Math.min(Math.max(gameArea.keys[i], 0), 2);
    }

    // Each element, including in arrays, is drawn.
    safeArea.forEach(element => {element.update();});

    // The rest of the background shapes are drawn.
    BGShapes.forEach(element => {if (!element?.main) element.update();});

    obstacles.forEach(element => {element.update();});

    // Goal and player are drawn last.
    mainGoal.update();
    mainPlayer.update();

    // If player is no longer alive, the level is failed.
    if (!playerIsAlive() && levelState == "none") {
        mainPlayer.controllable = false; 
        levelState = "failed";
        animStartTime = timer;
        playSound("hit");
        playSound("ouch");
    }

    // If player is close enough to the goal, the level is officially completed.
    const sqGoalDist = sqDist(mainPlayer.circ.x, mainPlayer.circ.y, mainGoal.rects[0].x, mainGoal.rects[0].y);
    if (sqGoalDist < 1296 * gameScale * gameScale && levelState == "none") {
        mainPlayer.controllable = false; 
        levelState = "complete";
        animStartTime = timer;
        setTimeout(playSound, 250, "wink");
        playSound("enter");
    }

    // When the level is over, an animation is played before the level is reloaded.
    switch (levelState) {
        case "complete":
            if (levelCompleteAnimation()) loadLevel("Level " + ++currentLevel);
            break;
        case "failed":
            if (levelFailedAnimation()) loadLevel("Level " + currentLevel);
            break;
        
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
    const elapsedTime = timer - animStartTime;
    if (elapsedTime < 0.75) {
        mainPlayer.circ.x += dx * elapsedTime * 0.3;
        mainPlayer.circ.y += dy * elapsedTime * 0.3;
        mainPlayer.playerScale = 7.7 * Math.sin((elapsedTime / 0.75) + 1.2) - 6.2;
        mainGoal.goalScale = 2 * Math.sin((elapsedTime / 0.75) * 5 * Math.PI / 6 + Math.PI / 6);
        return false;
    } else {
        if (FGShapes[FGShapes.length - 1].animStart == 0) {
            FGShapes[FGShapes.length - 1].animStart = timer;
            FGShapes[FGShapes.length - 1].duration = 0.5;
            FGShapes[FGShapes.length - 1].color = "white";
        }
        gameScale = 0;
        mainGoal.goalScale = 0;
        return elapsedTime >= 1.25;
    }
}

// Animate player dying, returning true 0.5 seconds after animation is complete.
function levelFailedAnimation() {
    const elapsedTime = timer - animStartTime;
    mainPlayer.circ.color = "rgba(0, 255, 255, " + (1 - elapsedTime / 0.5) + ")";
    if (elapsedTime < 0.5) {
        mainPlayer.playerScale = 7.7 * Math.sin((elapsedTime / 0.5) + 1.2) - 6.2;
        return false;
    } else {
        if (FGShapes[FGShapes.length - 1].animStart == 0) {
            FGShapes[FGShapes.length - 1].animStart = timer;
            FGShapes[FGShapes.length - 1].duration = 0.25;
            FGShapes[FGShapes.length - 1].color = "red";
        }
        mainPlayer.playerScale = 0;
        return elapsedTime >= 0.75;
    }
}