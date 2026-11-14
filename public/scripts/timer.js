export const Timer = {
    start: Date.now() / 1000,
    time: 0,
    animStart: 0,
    reset: () => {
        Timer.start = Date.now() / 1000
        Timer.time = Timer.animStart = 0;
    }
};