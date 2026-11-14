import { player, goal, coin } from "./entities.js";
// Declare and/or initialize gameplay states and properties.

export const State = {
    gameState: "none", levelState: "none", gameScale: 1,
    gameSettings: {
        music: true,
        sound: true,
        allAudio: true,
        shapes: true,
        fades: true
    },
    currentLevel: 0, lastLevel: 20
};

State.mainPlayer = new player();
State.mainGoal = new goal();
State.coins = [new coin()];

export const Timer = {
    start: Date.now() / 1000,
    time: 0,
    animStart: 0,
    reset: () => {
        Timer.start = Date.now() / 1000
        Timer.time = Timer.animStart = 0;
    }
};

/** @type {any} */
export let Shapes = {
    mainColor: "red",
    safeArea: [],
    obstacles: [],
    BGShapes: [],
    FGShapes: [],
    menuUI: []
}