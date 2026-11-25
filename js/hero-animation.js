/**
 * Vellia CRM - Hero Card & Spinning Numbers Animation
 * Animação de roleta (slot machine / odometer) dos números no card de entrada
 * e efeito interativo de inclinação/giro 3D do card.
 */

(function () {
    const ROW_HEIGHT = 28;

    window.HeroAnimation = {
        initialized: false,
        timer: null,
        cycleCount: 1,

        init() {
            const card = document.getElementById("hero-live-card");
            if (!card) return;
            if (this.initialized) return;
            this.initialized = true;

            // 1. Popula as tiras numéricas com múltiplos ciclos (0-9) para permitir giros longos
            this.buildStrip("reel-conv-tens", 3);
            this.buildStrip("reel-conv-units", 8);
            this.buildStrip("reel-conv-dec", 4);
            this.buildStrip("reel-resp-val", 2);

            // 2. Dispara a rotação inicial de boas-vindas
            setTimeout(() => {
                this.spinTo(3, 8, 4, 2, true);
            }, 250);

            // 3. Efeito 3D Parallax com o movimento do mouse
            this.setup3DParallax();

            // 4. Giro contínuo periódico de telemetria a cada 4.5 segundos
            if (this.timer) clearInterval(this.timer);
            this.timer = setInterval(() => {
                const decVariants = [4, 5, 2, 7, 4, 8, 4];
                const nextDec = decVariants[Math.floor(Math.random() * decVariants.length)];
                this.spinTelemetry(nextDec);
            }, 4500);

            // 5. Clique no card ativa um giro emocionante
            card.style.cursor = "pointer";
            card.addEventListener("click", () => {
                const randomDec = Math.floor(Math.random() * 10);
                const randomResp = Math.floor(Math.random() * 2) + 1;
                this.spinTo(3, 8, randomDec, randomResp, false);
                this.pulseEffect();
            });
        },

        buildStrip(reelId, initialDigit) {
            const reel = document.getElementById(reelId);
            if (!reel) return;
            const strip = reel.querySelector(".hero-reel-strip");
            if (!strip) return;

            // Gera 6 ciclos de 0 a 9 (60 dígitos)
            let html = "";
            for (let c = 0; c < 6; c++) {
                for (let d = 0; d <= 9; d++) {
                    html += `<div class="hero-reel-num">${d}</div>`;
                }
            }
            strip.innerHTML = html;
            // Posição inicial no ciclo 0
            strip.style.transition = "none";
            strip.style.transform = `translateY(-${initialDigit * ROW_HEIGHT}px)`;
        },

        setReel(reelId, digit, cycleOffset, duration, delay) {
            const reel = document.getElementById(reelId);
            if (!reel) return;
            const strip = reel.querySelector(".hero-reel-strip");
            if (!strip) return;

            const targetIndex = (cycleOffset * 10) + digit;
            const targetY = targetIndex * ROW_HEIGHT;

            strip.style.transition = `transform ${duration}s cubic-bezier(0.12, 0.95, 0.28, 1) ${delay}s`;
            strip.style.transform = `translateY(-${targetY}px)`;
        },

        spinTo(tens, units, dec, resp, isInitial = false) {
            this.cycleCount += 1;
            const cycle = this.cycleCount;

            this.setReel("reel-conv-tens", tens, cycle, 2.2, 0.0);
            this.setReel("reel-conv-units", units, cycle, 2.4, 0.1);
            this.setReel("reel-conv-dec", dec, cycle, 2.6, 0.2);
            this.setReel("reel-resp-val", resp, cycle, 2.3, 0.15);

            if (isInitial) {
                const growthBadge = document.getElementById("hero-conversion-growth");
                if (growthBadge) {
                    this.animateCount(growthBadge, 0, 14, 2200);
                }
            }
        },

        spinTelemetry(newDec) {
            this.cycleCount += 1;
            // Gira o decimal para simular nova leitura em tempo real
            this.setReel("reel-conv-dec", newDec, this.cycleCount, 1.8, 0.0);
            this.pulseEffect();
        },

        pulseEffect() {
            const subtitle = document.getElementById("hero-live-subtitle");
            const pulseRing = document.querySelector(".hero-pulse-ring");

            if (subtitle) {
                subtitle.style.color = "#34d399";
                setTimeout(() => {
                    subtitle.style.color = "rgba(255,255,255,0.65)";
                }, 1300);
            }

            if (pulseRing) {
                pulseRing.style.animation = "none";
                void pulseRing.offsetWidth;
                pulseRing.style.animation = "heroRingPulse 2.5s cubic-bezier(0.2, 0.8, 0.2, 1) infinite";
            }
        },

        animateCount(el, start, end, duration) {
            let startTs = null;
            const step = (ts) => {
                if (!startTs) startTs = ts;
                const progress = Math.min((ts - startTs) / duration, 1);
                const eased = 1 - Math.pow(1 - progress, 3);
                const val = Math.floor(start + (end - start) * eased);
                el.textContent = `+${val}%`;
                if (progress < 1) requestAnimationFrame(step);
                else el.textContent = `+${end}%`;
            };
            requestAnimationFrame(step);
        },

        setup3DParallax() {
            const heroSide = document.querySelector(".login-hero-side");
            const card = document.getElementById("hero-live-card");
            if (!heroSide || !card) return;

            heroSide.addEventListener("mousemove", (e) => {
                const rect = heroSide.getBoundingClientRect();
                const x = e.clientX - rect.left - rect.width / 2;
                const y = e.clientY - rect.top - rect.height / 2;

                const rotX = -(y / (rect.height / 2)) * 12;
                const rotY = (x / (rect.width / 2)) * 14;

                card.style.animation = "none";
                card.style.transform = `perspective(1000px) rotateX(${rotX.toFixed(2)}deg) rotateY(${rotY.toFixed(2)}deg) translateY(-4px)`;
            });

            heroSide.addEventListener("mouseleave", () => {
                card.style.transform = "";
                card.style.animation = "heroCardFloat 7s ease-in-out infinite";
            });
        }
    };

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", () => window.HeroAnimation.init());
    } else {
        window.HeroAnimation.init();
    }
})();
