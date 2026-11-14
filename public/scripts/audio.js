import { gameSettings } from "../script.js";

export let gameMusic;
let soundEffects; 

// Fetches audio files to allow them to encode.
export async function fetchAudio() {
    try {
        // Sets up text files to fetch from.
        let files = [
            "assets/misc/spinners.txt",
            "assets/misc/appear.txt",
            "assets/misc/click.txt",
            "assets/misc/coin.txt",
            "assets/misc/enter.txt",
            "assets/misc/hit.txt",
            "assets/misc/ouch.txt",
            "assets/misc/wink.txt"
        ];
        
        for (let i = 0; i < files.length; i++) {
            const response = await fetch(files[i]);
            
            if (!response.ok) {
              throw new Error(`Error: ${response.status}`);
            }
        
            files[i] = await response.text(); 
        }
        
        gameMusic = new Audio(`data:audio/ogg;base64,${files[0]}`);
        gameMusic.preload = true;
        gameMusic.loop = true;
        gameMusic.volume = 0.2;
        soundEffects = {
            appear: new Audio(`data:audio/ogg;base64,${files[1]}`),
            click: new Audio(`data:audio/ogg;base64,${files[2]}`),
            coin: new Audio(`data:audio/ogg;base64,${files[3]}`),
            enter: new Audio(`data:audio/ogg;base64,${files[4]}`),
            hit: new Audio(`data:audio/ogg;base64,${files[5]}`),
            ouch: new Audio(`data:audio/ogg;base64,${files[6]}`),
            wink: new Audio(`data:audio/ogg;base64,${files[7]}`)
        };
    } catch (error) {
        console.error("Levels not found");
    }
}

// Plays sound, looking up string in soundEffects and setting volume.
export function playSound(key, volume=1, interruptable=true) {
    if (!gameSettings.allAudio || !gameSettings.sound) volume = 0;
    try {
        const soundCheck = soundEffects[key];
        if (interruptable || (soundCheck.paused || soundCheck.ended || soundEffects[key].currentTime == 0)) {
            soundEffects[key].currentTime = 0;
            soundEffects[key].volume = volume;
            soundEffects[key].play();
        } else {
            console.warn("Attempted to interrupt " + key);
        }
    } catch (error) {
        console.error("Sound not found");
    }
}

// Plays all sounds at 0 volume to keep them loaded and ensure reduced latency from loading time.
export function refreshSounds() {
    const soundList = ["appear", "click", "coin", "enter", "hit", "ouch", "wink"];
    soundList.forEach((key) => playSound(key, 0, false));
}