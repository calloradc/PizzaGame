let prefs = {};
let ctx;
export function configureAudio(p) {
  prefs = p;
}
export function sound(freq, time, delay = 0) {
  if (!prefs.sound || prefs.volume === 0) return;
  try {
    ctx ??= new (window.AudioContext || window.webkitAudioContext)();
    if (ctx.state === "suspended") ctx.resume();
    let o = ctx.createOscillator(),
      g = ctx.createGain();
    o.type = "triangle";
    o.frequency.setValueAtTime(freq, ctx.currentTime + delay);
    o.frequency.exponentialRampToValueAtTime(
      Math.max(40, freq * 0.6),
      ctx.currentTime + delay + time,
    );
    g.gain.setValueAtTime(
      (0.035 * (prefs.volume ?? 60)) / 100,
      ctx.currentTime + delay,
    );
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + delay + time);
    o.connect(g);
    g.connect(ctx.destination);
    o.start(ctx.currentTime + delay);
    o.stop(ctx.currentTime + delay + time);
  } catch (e) {}
}
