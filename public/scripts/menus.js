import { mouseCoords } from './canvas.js';
import { rect, text, inShape } from './utils.js';
import * as Audio from './audio.js';
import { State, Timer, Shapes } from './states.js';

export let mouseTarget, animTarget, mainMenuVisited = false;

// Creates a button component, with a given shape, clickable interactivity, and animation.
export function button(x=0, y=0, shape, text, id, squareSize) {
    this.x = x;
    this.y = y;
    this.shape = shape;
    this.text = text;
    this.offsetX = this.text.x;
    this.offsetY = this.text.y - 0.125;
    this.text.x = x + this.offsetX * this.text.size;
    this.text.y = y + this.offsetY * this.text.size;
    this.shape.x = x;
    this.shape.y = y;
    this.id = id;
    // Squares that appear behind the button for decorative purposes.
    this.squares = [new rect(squareSize, squareSize, 0.5 * Math.random() + 0.25,
                        x + this.offsetX * this.text.size, y + this.offsetY * this.text.size, Math.random() * 360),
                    new rect(squareSize, squareSize, -0.5 * Math.random() - 0.25,
                        x + this.offsetX * this.text.size, y + this.offsetY * this.text.size, Math.random() * 360)];
    this.animating = false;
    this.animStart = 0;
    this.offset = 2 * Math.PI * Math.random();
    this.status = "";
    this.update = function() {
        this.shape.angle = 3 * Math.cos(Timer.time * Math.PI / 2 + this.offset) * Math.PI / 180;
        if (this.status === "white") this.shape.angle /= 2;
        this.squares[0].color = this.squares[1].color = (() => {
            switch (this.status) {
                case "cyan": return "#00ffff20";
                case "white": return "#ffffff00";
                default: return "#ff000020";
            }
        })();

        if (State.gameSettings.shapes) {
            this.squares[0].update();
            this.squares[1].update();
        }

        this.shape.update();
        this.text.update();
    }
    this.check = function() {
        // Check the button's status and if the mouse is hovering over it.
        if (this.status === "disabled") {
            this.shape.color = "#ff000020";
            return;
        }

        const mousedOver = mouseTarget !== -2 && inShape(mouseCoords, this.shape);

        if (mousedOver) mouseTarget = this.id;
        this.text.color = mousedOver ? "#000000c0" : "black";
        this.shape.color = (() => {
            switch (this.status) {
                case "cyan": return mousedOver ? "#80ffff" : "cyan";
                case "white": return mousedOver ? "#ffffffdf" : "#ffffffbf";
                default: return mousedOver ? "#ff4040" : "red";
            }
        })();
    }
    this.animate = (duration) => {
        // Animate a button fading out as it is clicked.
        const elapsedAmount = (Timer.time - this.animStart) / duration;

        // Return false when animation is over.
        if (elapsedAmount > 1) return false;
        this.animating = true;

        // The button only animates if fades are enabled to begin with.
        if (State.gameSettings.fades) {
            this.scale = Math.max(0, 1 - elapsedAmount * elapsedAmount * 0.25);
            const alpha = 1 - elapsedAmount * elapsedAmount, colorVal = 255 * alpha;

            // This prevents the decorative squares from being drawn twice on the same frame.
            if (elapsedAmount === 0) return true;
            
            // Fade by controlling color directly.
            this.shape.color = (() => {
                switch (this.status) {
                    case "cyan": return `rgba(${colorVal}, 255, 255, ${alpha})`;
                    case "white": return `rgba(255, 255, 255, ${alpha})`;
                    default: return `rgba(255, ${colorVal}, ${colorVal}, ${alpha})`;
                }
            })();
            this.text.color = `rgba(0, 0, 0, ${alpha})`;

            // Update button visuals to match scale property.
            this.setScale();
        }

        return true;
    }
    this.toggle = function() {
        // For setting toggle buttons, controls settings.
        switch (this.id) {
            case 0:
                if (!State.gameSettings.allAudio) {
                    State.gameSettings.allAudio = true;
                    State.gameSettings.sound = false;
                }
                State.gameSettings.music = !State.gameSettings.music;
                localStorage.setItem("music", String(State.gameSettings.music));
                updateMute();
                break;
            case 1:
                // Because the sound setting itself is already changed in gameArea.setupMouse(),
                // it only needs to be saved and the button state updated.
                localStorage.setItem("sound", String(State.gameSettings.sound));
                updateMute();
                break;  
            case 2:
                State.gameSettings.shapes = !State.gameSettings.shapes;
                localStorage.setItem("shapes", String(State.gameSettings.shapes));
                updateSettings(State.gameSettings.shapes, 2);
                break;
            case 3:
                State.gameSettings.fades = !State.gameSettings.fades;
                localStorage.setItem("fades", String(State.gameSettings.fades));
                updateSettings(State.gameSettings.fades, 3);
                break;  
        }
    }
    this.reappear = (duration) => {
        // For setting toggle buttons, fades button back into visibility.
        const elapsedAmount = (Timer.time - this.animStart) / duration;

        // Reset states and return when animation is over.
        if (elapsedAmount > 1) {
            this.animating = false;
            this.animStart = 0;
            this.toggled = false;
            mouseTarget = -1;
            animTarget = -1;
            return;
        }

        this.scale = Math.min(elapsedAmount * elapsedAmount * 0.25 + 0.75, 1);
        const colorVal = 255 * elapsedAmount * elapsedAmount;
        
        // Fade by controlling color directly.
        if (this.status === "cyan") 
            this.shape.color = `rgba(${colorVal}, 255, 255, ${colorVal / 255})`;
        else
            this.shape.color = `rgba(255, ${colorVal}, ${colorVal}, ${colorVal / 255})`;
        this.text.color = `rgba(0, 0, 0, ${colorVal / 255})`;

        // Update button visuals to match scale property.
        this.setScale()
        return true;
    }
    this.setScale = function() {
        // Multiply by scale, visually.
        if (!this.shape?.radius) {
        this.shape.width *= this.scale;
        this.shape.height *= this.scale;
        } else this.shape.radius *= this.scale;
        this.text.x -= this.offsetX * this.text.size;
        this.text.y -= this.offsetY * this.text.size;
        this.text.size *= this.scale;
        this.text.x += this.offsetX * this.text.size;
        this.text.y += this.offsetY * this.text.size;

        this.update();

        // Undo internally by dividing by scale.
        if (this.scale > 0) {
            if (!this.shape?.radius) {
                this.shape.width /= this.scale;
                this.shape.height /= this.scale;
            } else this.shape.radius /= this.scale;
            this.text.x -= this.offsetX * this.text.size;
            this.text.y -= this.offsetY * this.text.size;
            this.text.size /= this.scale;
            this.text.x += this.offsetX * this.text.size;
            this.text.y += this.offsetY * this.text.size;
        }
    }
}

// Sets a target to animate while blocking mouse target.
export function setTargets(target) {
    animTarget = target;
    mouseTarget = -2;
}

// Disables buttons by blocking targets.
export function blockTargets() {
    mouseTarget = animTarget = -2;
}

// Re-enables buttons by clearing targets.
export function clearTargets() {
    mouseTarget = animTarget = -1;
}

// Animates the FG fade.
export function animateFG(animStart, duration) {
    const elapsedTime = Timer.time - animStart;

    // Return false when animation is over.
    if (elapsedTime >= duration) return false;

    Shapes.FGShapes[Shapes.FGShapes.length - 1].animStart = animStart;
    Shapes.FGShapes[Shapes.FGShapes.length - 1].duration = duration;

    return true;
}

// Setup BG shapes for menu screens.
export function setupBGShapes(centerFocus) {
    let s1, s2, a, x1, x2, x3, y1, y2, y3;
    if (centerFocus) {
        s1 = 480, s2 = 300, a = 0.50;
        x1 = 440, x2 = 480, x3 = 160;
        y1 = 320, y2 = 360, y3 = 160;
    } else {
        s1 = 300, s2 = 180, a = 0.25;
        x1 = 480, x2 = 520, x3 = 240;
        y1 = 360, y2 = 400, y3 = 120;
    }

    Shapes.BGShapes = [
        new rect(s1, s1, 0.5, -x1, y1, Math.random() * 360),
        new rect(s1, s1, -0.5, x1, y1, Math.random() * 360),
        new rect(s1, s1, -0.5, -x1, -y1, Math.random() * 360),
        new rect(s1, s1, 0.5, x1, -y1, Math.random() * 360),
        new rect(s2, s2, 0.5, -x2, y3, Math.random() * 360),
        new rect(s2, s2, -0.5, x2, y3, Math.random() * 360),
        new rect(s2, s2, -0.5, x3, y2, Math.random() * 360),
        new rect(s2, s2, 0.5, x3, -y2, Math.random() * 360),
        new rect(s2, s2, -0.5, -x2, -y3, Math.random() * 360),
        new rect(s2, s2, 0.5, x2, -y3, Math.random() * 360),
        new rect(s2, s2, 0.5, -x3, y2, Math.random() * 360),
        new rect(s2, s2, -0.5, -x3, -y2, Math.random() * 360)
    ];

    for (let i = 0; i < Shapes.BGShapes.length; i++) {
        const alpha = (i < 4) ? a : a / 2;
        Shapes.BGShapes[i].speed *= Math.random() + 0.5;
        Shapes.BGShapes[i].color = `rgba(255, 0, 0, ${alpha})`;
    }
}

// Setup FG shapes (i.e. logo) for menu screens.
export function setupFGShapes() {
    const flash = Shapes.FGShapes[Shapes.FGShapes.length - 1];
    Shapes.FGShapes = [
        new text("Spınners", 0, 200, 150, "red", "center", "Paytone One"),
        new text("by ArrQue", 327.5, 130, 30, "red", "right", "Paytone One"),
        new rect(31, 31, 1, -121.5, 254.5),
        flash
    ];
}

// Loads in the main menu.
export function setupMainMenu(notLoaded) {
    // Reset button-related variables and Timer.time.
    mainMenuVisited = true;
    mouseTarget = animTarget = -2;
    setTimeout(clearTargets, State.gameSettings.fades ? 250 : 0);
    Timer.reset();

    // Setup background shapes if not loaded.
    if (notLoaded) setupBGShapes(false);

    // Setup menu UI.
    Shapes.menuUI = [
        new button(-200, -30, new rect(320, 150), new text("Levels", 0, 0, 60), 0, 180),
        new button(200, -30, new rect(320, 150), new text("Settings", 0, 0, 60), 1, 180),
        new button(0, -225, new rect(320, 150), new text("Credits", 0, 0, 60), 2, 180),
    ];

    // Setup foreground flash if enabled, along with logo if not loaded.
    if (notLoaded) setupFGShapes();
    Shapes.FGShapes[Shapes.FGShapes.length - 1].animStart = 0;
    Shapes.FGShapes[Shapes.FGShapes.length - 1].duration = State.gameSettings.fades ? 0.25 : 0;

    State.gameState = "menu";
}

// Loads in the level select.
export function setupLevelSelect(notLoaded) {
    // Calculate total score.
    let totalScore = 0;
    for (let i = 1; i <= State.lastLevel; i++) {
        totalScore += Number(localStorage.getItem("score" + i));
    }

    // Reset button-related variables and Timer.time.
    State.levelState = "none";
    mouseTarget = animTarget = -2;
    setTimeout(clearTargets, State.gameSettings.fades ? 250 : 0);
    Timer.reset();

    // Setup background shapes if not loaded.
    if (notLoaded) setupBGShapes(false);

    // Setup menu UI.
    Shapes.menuUI = new Array(35);
    for (let i = 0; i < 3; i++) {
        for (let j = 0; j < 10; j++) {
            const num = j + i * 10;
            Shapes.menuUI[num] = new button(j * 70 - (70 * 9 / 2), i * -70 - 10, new rect(55, 55), new text(String(num + 1), 0, 0, 30), num, 55);
            if (num + 1 < State.maxLevel) {
                Shapes.menuUI[num].status = "cyan";
            }
            if (num + 1 > State.maxLevel || num + 1 > State.lastLevel) {
                Shapes.menuUI[num].status = "disabled";
                Shapes.menuUI[num].text.lines = [""];
            }
            Shapes.menuUI[num].check();
        }
    }
    Shapes.menuUI[30] = new button(0, -300, new rect(200, 75), new text("Menu", 0, 0, 30), 30, 100);
    Shapes.menuUI[31] = new text("", 0, 87.5, 30, "red", "center", "Paytone One");
    Shapes.menuUI[32] = new text("", 0, 60, 18, "red", "center", "Paytone One");
    Shapes.menuUI[33] = new text("Total Score: " + totalScore, 0, -225, 24, "red", "center", "Paytone One");
    Shapes.menuUI[34] = new text("Coming soon!", 210, -152.5, 30, "red", "center", "Paytone One");

    // Setup foreground flash if enabled, along with logo if not loaded.
    if (notLoaded) setupFGShapes();
    Shapes.FGShapes[Shapes.FGShapes.length - 1].animStart = 0;
    Shapes.FGShapes[Shapes.FGShapes.length - 1].duration = State.gameSettings.fades ? 0.5 : 0;

    State.gameState = "select";
}

// Loads in the settings menu.
export function setupSettings(notLoaded) {
    // Reset button-related variables and Timer.time.
    mouseTarget = animTarget = -2;
    setTimeout(clearTargets, State.gameSettings.fades ? 250 : 0);
    Timer.reset();

    // Setup background shapes if not loaded.
    if (notLoaded) setupBGShapes(false);

    // Setup menu buttons.
    Shapes.menuUI = [
        new button(-75, 30, new rect(60, 60), new text("Off", 0, 0, 30), 0, 60),
        new button(-75, -50, new rect(60, 60), new text("Off", 0, 0, 30), 1, 60),
        new button(-75, -130, new rect(60, 60), new text("Off", 0, 0, 30), 2, 60),
        new button(325, 30, new rect(60, 60), new text("Off", 0, 0, 30), 3, 60),
        new button(202.5, -90, new rect(300, 137.5), new text("Reset Data", 0, 0, 56), 4, 200),
        new button(0, -300, new rect(200, 75), new text("Menu", 0, 0, 30), 5, 100),
        new text("Game Music", -125, 30, 36, "red", "right", "Paytone One"),
        new text("Game Sound", -125, -50, 36, "red", "right", "Paytone One"),
        new text("BG Shapes", -125, -130, 36, "red", "right", "Paytone One"),
        new text("Screen Fades", 275, 30, 36, "red", "right", "Paytone One"),
        new text("v1.0", -475, -345, 24, "red", "left", "Paytone One")
    ];

    // Update button states.
    updateSettings(State.gameSettings.allAudio && State.gameSettings.music, 0);
    updateSettings(State.gameSettings.allAudio && State.gameSettings.sound, 1);
    updateSettings(State.gameSettings.shapes, 2);
    updateSettings(State.gameSettings.fades, 3);

    for (let i = 0; i < 5; i++) {
        Shapes.menuUI[i].check();
    }

    // Setup foreground flash if enabled, along with logo if not loaded.
    if (notLoaded) setupFGShapes();
    Shapes.FGShapes[Shapes.FGShapes.length - 1].animStart = 0;
    Shapes.FGShapes[Shapes.FGShapes.length - 1].duration = State.gameSettings.fades ? 0.5 : 0;

    State.gameState = "settings";
}

// Sets status of buttons in settings menu.
export function updateSettings(condition, id) {
    if (condition) {
        Shapes.menuUI[id].status = "cyan";
        Shapes.menuUI[id].text.lines = ["On"];
    } else {
        Shapes.menuUI[id].status = "none";
        Shapes.menuUI[id].text.lines = ["Off"];
    }
}

// The M key acts as a "mute all" keybind. This allows for audio settings to persist when unmuting.
// (e.g. If music is on and sound is off, muting and unmuting all should keep music on and sound off.)
export function updateMute() {
    if (!State.gameSettings.allAudio && State.gameSettings.music && State.gameSettings.sound) {
        State.gameSettings.music = State.gameSettings.sound = false;
        State.gameSettings.allAudio = true;
    }

    if (!State.gameSettings.allAudio && !State.gameSettings.music &&! State.gameSettings.sound) {
        State.gameSettings.music = State.gameSettings.sound = State.gameSettings.allAudio = true;
    }

    // This reflects the update in button status if on the settings menu.
    if (State.gameState === "settings") {
        updateSettings(State.gameSettings.allAudio && State.gameSettings.music, 0);
        updateSettings(State.gameSettings.allAudio && State.gameSettings.sound, 1);
    }
}


// Loads in the credits screen.
export function setupCredits() {
    // Reset button-related variables and Timer.time.
    mouseTarget = animTarget = -2;
    setTimeout(clearTargets, State.gameSettings.fades ? 250 : 0);
    Timer.reset();

    // Setup menu button.
    Shapes.menuUI = [
        new button(0, -300, new rect(200, 75), new text("Menu", 0, 0, 30), 0, 100),
        new text("A game by ArrQue (RayRay)", 0, 62.5, 30, "red", "center", "Paytone One"),
        new text("Gameplay inspired by The World's Hardest Game", 0, -15, 30, "red", "center", "Paytone One"),
        new text("UI inspired by games created by Gaz Thomas", 0, -60, 30, "red", "center", "Paytone One"),
        new text("Music composed in Ableton Live", 0, -142.5, 30, "red", "center", "Paytone One"),
        new text("SFX sourced from Uni Anims", 0, -187.5, 30, "red", "center", "Paytone One")
    ];

    // Setup foreground flash if enabled.
    Shapes.FGShapes[Shapes.FGShapes.length - 1].animStart = 0;
    Shapes.FGShapes[Shapes.FGShapes.length - 1].duration = State.gameSettings.fades ? 0.5 : 0;

    State.gameState = "credits";
}

// Loads in the game completion screen.
export function setupCompletion() {
    // Reset button-related variables and Timer.time.
    State.levelState = "none";
    mouseTarget = animTarget = -2;
    setTimeout(clearTargets, State.gameSettings.fades ? 250 : 0);
    Timer.reset();

    // Setup BG shapes and restart music; it is stopped before loading this screen.
    setupBGShapes(false);
    Audio.gameMusic.play();

    // Setup menu button.
    Shapes.menuUI = [
        new button(0, -300, new rect(200, 75), new text("Menu", 0, 0, 30), 0, 100),
        new text("Congratulations on beating the last level of Spinners!", 0, 62.5, 30, "red", "center", "Paytone One"),
        new text("From a Scratch project in 2017, to a 2026 game coded in\nJavaScript for a college assignment. It's been a long\njourney, and it's been  fun seeing it come together.", 0, -45, 30, "red", "center", "Paytone One"),
        new text("Overall, I enjoyed making this game, and I hope\nyou enjoyed playing it too! More levels coming soon...", 0, -175, 30, "red", "center", "Paytone One"),
    ];

    // Setup foreground flash if enabled along with logo.
    setupFGShapes();
    Shapes.FGShapes[Shapes.FGShapes.length - 1].animStart = 0;
    Shapes.FGShapes[Shapes.FGShapes.length - 1].duration = State.gameSettings.fades ? 0.25 : 0;

    State.gameState = "complete";
}
