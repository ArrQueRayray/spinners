import { gameArea, ctx } from './canvas.js';
import { rect, circ, drawRect, drawCirc, sqDist, inShape } from './utils.js';
import * as Audio from './audio.js';
import { State, Timer, Shapes } from './states.js';

// Creates a player component, with circle and additional features such as movement and animation.
export function player(x=0, y=0) {
    this.circ = new circ(16 * State.gameScale, x, y, "cyan");
    this.playerScale = 1;
    this.hitboxScale = 0.75; // Smaller hitboxes feel fairer; this specifies hitbox scale compared to player size.
    this.speedX = 0;
    this.speedY = 0;
    this.controllable = true;
    this.blink = 3 + 2 * Math.random(); // Blink time to control how long between each blink.

    // Sets up distance from center to edge of the hitbox, and resulting x/y difference at 45-degree angle.
    const d1 = this.hitboxScale * this.circ.radius;
    const d2 = d1 * Math.SQRT1_2;

    this.update = () => {
        this.circ.radius = Math.max(0, 16 * State.gameScale * this.playerScale);
        const accel = 0.5 * State.gameScale; // How fast the player reaches max speed.
        const maxSpeed = 3.6 * State.gameScale; // The fastest the player can travel.
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
        if (!this.controllable || !!gameArea.keys[1] === !!gameArea.keys[3]) this.speedX = limit(this.speedX);
        if (!this.controllable || !!gameArea.keys[0] === !!gameArea.keys[2]) this.speedY = limit(this.speedY);
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
        const fullScale = State.gameScale * this.playerScale;

        // The coordinates of the midpoint of the eyes is calculated along with a nod animation.
        const middle = State.mainPlayer.circ.x + State.mainPlayer.speedX * 1.333;
        const nod = Number(State.levelState !== "failed") * 2 * fullScale * Math.sin(Timer.time * Math.PI * 1.5);
        const height = State.mainPlayer.circ.y + (3 * fullScale) + nod + State.mainPlayer.speedY * 1.333;

        // A blink timer is used to either draw eyes where they are located.
        const notBlinking = Timer.time < State.mainPlayer.blink || Timer.time > State.mainPlayer.blink + 0.06;
        const levelCompleteStart = State.levelState === "complete" && Timer.time - Timer.animStart < 0.25;

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

        if (notBlinking && (State.levelState === "none" || levelCompleteStart)) {
            // After a blink, the blink time is reset, with circle eyes drawn.
            if (Timer.time > State.mainPlayer.blink) State.mainPlayer.blink += 3.1 + 2 * Math.random();
            circleEye(-5.6);
            circleEye(5.6);
        } else {
            if (State.levelState === "failed") {
                // Draw X-shaped eyes.
                lineEye(-5.6, -45);
                lineEye(-5.6, 45);
                lineEye(5.6, -45);
                lineEye(5.6, 45);
            } else if (State.levelState === "complete") {
                // Draw one eye winking.
                circleEye(-5.6);
                arcEye(5.6);
            } else {
                arcEye(-5.6);
                arcEye(5.6);
            }
        }
    } 
    this.setupHitbox = () => {
        const cx = this.circ.x
        const cy = this.circ.y;
        // The hitbox is approximated with 8 individual points.
        this.hitbox =  [{x: cx + d1, y: cy, alive: false},
                        {x: cx - d1, y: cy, alive: false},
                        {x: cx, y: cy + d1, alive: false},
                        {x: cx, y: cy - d1, alive: false},
                        {x: cx - d2, y: cy + d2, alive: false},
                        {x: cx + d2, y: cy + d2, alive: false},
                        {x: cx - d2, y: cy - d2, alive: false},
                        {x: cx + d2, y: cy - d2, alive: false}];
    }
    this.isAlive = () => {
        this.setupHitbox();

        // Check if each point is alive, i.e. in a safeArea shape and not in an obstacles shape.
        for (let i = 0; i < this.hitbox.length; i++) {
            for (let j = 0; j < Shapes.safeArea.length; j++) {
                if (inShape(this.hitbox[i], Shapes.safeArea[j])) {
                    this.hitbox[i].alive = true;
                    break;
                }
            }

            // This is skipped if the point wasn't in a safe area to begin with.
            if (this.hitbox[i].alive) {
                for (let j = 0; j < Shapes.obstacles.length; j++) {
                    if (inShape(this.hitbox[i], Shapes.obstacles[j])) {
                        this.hitbox[i].alive = false;
                        break;
                    }
                }
            }

            // Once a single point is guaranteed dead, the player is also guaranteed dead.
            if (!this.hitbox[i].alive) {
                return false;
            }
        }
        return true;
    }
}

// Creates a goal component, with a "pulsing" animation created with a timer and sine/cosine functions.
export function goal(x=0, y=0) {
    this.x = x;
    this.y = y;
    this.rects = new Array(3);
    this.goalScale = State.coinCount > 0 ? 0.001 : 1;
    this.animating = false;
    this.animStart = 0;
    for (let i = 0; i < 3; i++) {
        this.rects[i] = new rect(36 * State.gameScale * this.goalScale, 36 * State.gameScale * this.goalScale, 2, x, y, i * 30 - 15, "#ffffff80");
    }
    this.update = () => {
        if (State.coinCount > 0) return; // If there are uncollected coins, don't appear.

        // If a last coin is collected, play a sound and appear by enlarging.
        if (State.levelState !== "complete") {
            if (this.goalScale === 0.001) {
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
            this.rects[i].width *= State.gameScale * this.goalScale;
            this.rects[i].height = this.rects[i].width;
            this.rects[i].update();
        }
    };
    this.isClose = function() {
        // Check if goal is within 36 pixels (adjusted to game scale).
        const sqGoalDist = sqDist(State.mainPlayer.circ.x, State.mainPlayer.circ.y, this.x, this.y);
        const range = 36 * State.gameScale;
        return sqGoalDist < range * range;
    };
}

// Creates a coin component, collectible
export function coin(x=0, y=0) {
    this.x = x;
    this.y = y;
    this.rects = [new rect(30 * State.gameScale, 30 * State.gameScale, 1, x, y, 30, "rgba(255, 255, 255, 0.13)"),
                  new rect(45 * State.gameScale, 45 * State.gameScale, -1, x, y, -30, "#ffff0010")];
    this.coinScale = 1;
    this.offset = Math.random() * 2 * Math.PI;
    this.animating = false;
    this.animStart = 0;
    this.update = function() {
        const size = 12 * this.coinScale * State.gameScale;
        const spin = Math.sin(Timer.time * Math.PI / 2 + this.offset);
        const hover = 4 * Math.sin(Timer.time * Math.PI + this.offset) * State.gameScale;
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
        this.rects[0].width = this.rects[0].height = 30 * State.gameScale * animScale;
        this.rects[1].width = this.rects[1].height = 45 * State.gameScale * animScale;
        this.rects[0].speed = colorVal / 255 * 3;
        this.rects[1].speed = -colorVal / 255 * 3;
        this.rects[0].update();
        this.rects[1].update();
    }
    this.isClose = function() {
        // Check if coin is within 32 pixels (adjusted to game scale).
        const sqGoalDist = sqDist(State.mainPlayer.circ.x, State.mainPlayer.circ.y, this.x, this.y);
        const range = 32 * State.gameScale;
        return sqGoalDist < range * range;
    };
}

// Animate player being sucked into goal, returning true 0.5 seconds after animation is complete.
export function winAnim() {
    const dx = State.mainGoal.rects[0].x - State.mainPlayer.circ.x;
    const dy = State.mainGoal.rects[0].y - State.mainPlayer.circ.y;
    const elapsedTime = Timer.time - Timer.animStart;
    if (elapsedTime < 0.75) {
        State.mainPlayer.circ.x += dx * elapsedTime * 0.3;
        State.mainPlayer.circ.y += dy * elapsedTime * 0.3;
        State.mainPlayer.playerScale = 7.7 * Math.sin((elapsedTime / 0.75) + 1.2) - 6.2;
        State.mainGoal.goalScale = 2 * Math.sin((elapsedTime / 0.75) * 5 * Math.PI / 6 + Math.PI / 6);
        return false;
    } else {
        if (Shapes.FGShapes[Shapes.FGShapes.length - 1].animStart === 0) {
            Shapes.FGShapes[Shapes.FGShapes.length - 1].animStart = Timer.time;
            Shapes.FGShapes[Shapes.FGShapes.length - 1].duration = State.gameSettings.fades ? 0.5 : 0;
            Shapes.FGShapes[Shapes.FGShapes.length - 1].color = State.currentLevel === -1 ? "black" : "white";
        }
        State.gameScale = 0;
        State.mainGoal.goalScale = 0;
        return elapsedTime >= (State.gameSettings.fades ? 1.25 : 0.75);
    }
}

// Animate player dying, returning true 0.5 seconds after animation is complete.
export function loseAnim() {
    const elapsedTime = Timer.time - Timer.animStart;
    if (elapsedTime < 0.5) {
        State.mainPlayer.circ.color = `rgba(0, 255, 255, ${1 - elapsedTime / 0.5})`;
        State.mainPlayer.playerScale = 7.7 * Math.sin((elapsedTime / 0.5) + 1.2) - 6.2;
        return false;
    } else {
        if (Shapes.FGShapes[Shapes.FGShapes.length - 1].animStart === 0) {
            Shapes.FGShapes[Shapes.FGShapes.length - 1].animStart = Timer.time;
            Shapes.FGShapes[Shapes.FGShapes.length - 1].duration = State.gameSettings.fades ? 0.25 : 0;
            Shapes.FGShapes[Shapes.FGShapes.length - 1].color = "red";
        }
        State.mainPlayer.playerScale = 0;
        return elapsedTime >= (State.gameSettings.fades ? 0.75 : 0.5);
    }
}