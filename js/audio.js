/**
 * Vellia Audio Engine — Sintetizador Web Audio API Nativo
 * Sons de interface elegantes, zero dependência de arquivos externos MP3
 */

export const AudioEngine = {
    audioCtx: null,
    enabled: true,

    init() {
        const saved = localStorage.getItem("vellia_audio_enabled");
        if (saved !== null) {
            this.enabled = saved === "true";
        }
    },

    isEnabled() {
        return this.enabled;
    },

    toggle() {
        this.enabled = !this.enabled;
        localStorage.setItem("vellia_audio_enabled", this.enabled);
        if (this.enabled) {
            this.playLeadChime();
        }
        return this.enabled;
    },

    getAudioContext() {
        if (!this.audioCtx) {
            const AudioCtxClass = window.AudioContext || window.webkitAudioContext;
            if (AudioCtxClass) {
                this.audioCtx = new AudioCtxClass();
            }
        }
        if (this.audioCtx && this.audioCtx.state === "suspended") {
            this.audioCtx.resume();
        }
        return this.audioCtx;
    },

    // 🎵 Chime de Novo Lead (Dual-Tone Harmônico E5 -> B5)
    playLeadChime() {
        if (!this.enabled) return;
        try {
            const ctx = this.getAudioContext();
            if (!ctx) return;

            const now = ctx.currentTime;
            
            // Nota 1: E5 (659.25 Hz)
            const osc1 = ctx.createOscillator();
            const gain1 = ctx.createGain();
            osc1.type = "sine";
            osc1.frequency.setValueAtTime(659.25, now);
            gain1.gain.setValueAtTime(0.15, now);
            gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
            osc1.connect(gain1);
            gain1.connect(ctx.destination);
            osc1.start(now);
            osc1.stop(now + 0.35);

            // Nota 2: B5 (987.77 Hz) com atraso de 80ms
            const osc2 = ctx.createOscillator();
            const gain2 = ctx.createGain();
            osc2.type = "sine";
            osc2.frequency.setValueAtTime(987.77, now + 0.08);
            gain2.gain.setValueAtTime(0.2, now + 0.08);
            gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.5);
            osc2.connect(gain2);
            gain2.connect(ctx.destination);
            osc2.start(now + 0.08);
            osc2.stop(now + 0.5);
        } catch (e) {
            console.warn("[AudioEngine] Erro ao reproduzir som de lead:", e.message);
        }
    },

    // 🎉 Chime de Sucesso / Venda Fechada (Triplo Acorde C5 -> E5 -> G5)
    playSuccessChime() {
        if (!this.enabled) return;
        try {
            const ctx = this.getAudioContext();
            if (!ctx) return;

            const now = ctx.currentTime;
            const notes = [523.25, 659.25, 783.99, 1046.50]; // C5, E5, G5, C6
            
            notes.forEach((freq, idx) => {
                const startTime = now + (idx * 0.07);
                const osc = ctx.createOscillator();
                const gain = ctx.createGain();
                
                osc.type = idx === 3 ? "triangle" : "sine";
                osc.frequency.setValueAtTime(freq, startTime);
                
                gain.gain.setValueAtTime(0.18, startTime);
                gain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.45);
                
                osc.connect(gain);
                gain.connect(ctx.destination);
                
                osc.start(startTime);
                osc.stop(startTime + 0.45);
            });
        } catch (e) {
            console.warn("[AudioEngine] Erro ao reproduzir som de sucesso:", e.message);
        }
    },

    // ⚠️ Chime de Alerta / Atenção (A4 -> F4)
    playWarningChime() {
        if (!this.enabled) return;
        try {
            const ctx = this.getAudioContext();
            if (!ctx) return;

            const now = ctx.currentTime;
            
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = "sine";
            osc.frequency.setValueAtTime(440, now); // A4
            osc.frequency.exponentialRampToValueAtTime(349.23, now + 0.25); // F4
            
            gain.gain.setValueAtTime(0.15, now);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
            
            osc.connect(gain);
            gain.connect(ctx.destination);
            
            osc.start(now);
            osc.stop(now + 0.35);
        } catch (e) {
            console.warn("[AudioEngine] Erro ao reproduzir som de alerta:", e.message);
        }
    }
};

AudioEngine.init();
window.AudioEngine = AudioEngine;
