import { updateGameArea } from '../script.js';

// Setup game area and canvas scaling.
export let ctx;

export var gameArea = {
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