// Declare and/or initialize gameplay states and properties.
export const State = {
    currentLevel: 0, lastLevel: 26,
    gameState: "none", levelState: "none",
    gameSettings: { // Declare game settings
        music: true,
        sound: true,
        allAudio: true,
        shapes: true,
        fades: true
    },
    score: 0, highScore: 0,
    coinCount: 0
};