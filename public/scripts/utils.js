import { ctx } from './canvas.js';

// Creates a rectangle component with x and y referring to center in preferred coordinate system.
export function rect(width=100, height=100, speed=0, x=0, y=0, angle=0, color="red", offsetX=0, offsetY=0, range=0, time=2, delay=0) {
    this.shape = "rect";
    this.width = width;
    this.height = height;
    this.speed = speed;
    this.angle = angle * Math.PI / 180;
    this.range = range;
    this.time = time;
    this.delay = delay;
    this.x = x;
    this.y = y; 
    this.color = color;
    this.offsetX = offsetX;
    this.offsetY = offsetY;
    this.initialAngle = this.angle;
    this.update = function() {
        if (this.speed != 0) {
            this.angle += this.speed * Math.PI / 180; 
        } else if (this.range != 0) {
            this.angle = this.initialAngle + this.range * Math.sin(
                timer / this.time * Math.PI + (delay * 2 * Math.PI)) * Math.PI / 360;
        }
        this.angle = this.angle % (2 * Math.PI);
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
export function circ(radius=40, x=0, y=0, color="black") {
    this.shape = "circ";
    this.radius = radius;
    this.x = x;
    this.y = y;    
    this.color = color;
    this.update = function() {
        ctx.beginPath();
        ctx.fillStyle = this.color;
        drawCirc(this.x, this.y, this.radius);
    }
}

// Creates a text component based on preferred coordinate system.
export function text(string="Hello!", x=0, y=0, size=36, color="black", align="center", font="Francois One") {
    this.lines = string.split("\n");
    this.x = x;
    this.y = y; 
    this.size = size;
    this.color = color; 
    this.align = align; 
    this.font = font;
    this.update = function() {
        ctx.beginPath();
        ctx.fillStyle = this.color;
        ctx.font = this.size + "px " + font + ", Tahoma, sans-serif";
        ctx.textBaseline = "middle";
        ctx.textAlign = this.align;
        let offset = (this.lines.length - 1) * (size * 1.25) / 2;
        this.lines.forEach((line) => {
            ctx.fillText(line, this.x + 480, 360 - this.y - offset);
            offset -= (size * 1.25);
        });
    }
}

// Fills a rectangle based on preferred coordinate system, and optional angle.
export function drawRect(x, y, width, height, angle = 0) {
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
export function drawCirc(x, y, radius) {
    ctx.beginPath();
    ctx.arc(x + 480, 360 - y, radius, 0, 2 * Math.PI);
    ctx.fill();
}

// Returns the distance between two points, squared to prevent square root computation.
export function sqDist(x1, y1, x2, y2) {
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
    const closeY = Math.max(-halfHeight + mainRect.offsetY, Math.min(halfHeight + mainRect.offsetY, localY));

    // Check if closest point is equal to mainPoint.
    return localX == closeX && localY == closeY;
}

// Returns true if mainPoint is inside mainCirc.
function inCirc(mainPoint, mainCirc) {
    // Compare distance to radius.
    return sqDist(mainPoint.x, mainPoint.y, mainCirc.x, mainCirc.y) <= mainCirc.radius * mainCirc.radius;;
}

// Returns true if mainPoint is in mainShape (rect or circ).
export function inShape(mainPoint, mainShape) {
    return (mainShape.shape == "circ") ? inCirc(mainPoint, mainShape) : inRect(mainPoint, mainShape);
}