import { State } from './states.js';

export let gameMusic;
// Sets up files to fetch from.
let musicList = ["spinners"], soundList = ["appear", "click", "coin", "enter", "hit", "ouch", "wink"];
let audioList = [...musicList, ...soundList], soundEffects = {}; 

// Fetches audio files to allow them to encode.
export async function fetchAudio() {
    try {
        let audioData = [];
        for (let i = 0; i < audioList.length; i++) {
            const response = await fetch(`assets/audio/${audioList[i]}.txt`);
            
            if (!response.ok) {
              throw new Error(`Error: ${response.status}`);
            }
        
            audioData.push(await response.text()); 
        }
        
        gameMusic = new Audio(`data:audio/ogg;base64,${audioData[0]}`);
        gameMusic.preload = true;
        gameMusic.loop = true;
        gameMusic.volume = 0.2;
        for (let i = musicList.length; i < audioList.length; i++) {
            soundEffects[audioList[i]] = new Audio(`data:audio/ogg;base64,${audioData[i]}`)
        }
        
    } catch (error) {
        console.error("Audio not found");
    }
}

// Plays sound, looking up string in soundEffects and setting volume.
export function playSound(key, volume=1, interruptable=true) {
    if (!State.gameSettings.allAudio || !State.gameSettings.sound) volume = 0;
    try {
        const soundCheck = soundEffects[key];
        if (interruptable || (soundCheck.paused || soundCheck.ended || soundEffects[key].currentTime === 0)) {
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

// Plays all audio at 0 volume to keep them loaded and ensure reduced latency from loading time.
export function refreshSounds() {
    soundList.forEach((key) => playSound(key, 0, false));
}