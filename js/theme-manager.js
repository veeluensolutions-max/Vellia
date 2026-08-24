/**
 * ThemeManager — Customizador de Tema Glassmorphism & Paletas de Cores
 */
export const ThemeManager = {
    PALETTES: {
        indigo: {
            name: "Índigo Imperial",
            primary: "#4f46e5",
            primaryLight: "#818cf8",
            primaryDark: "#3730a3",
            glow: "rgba(79, 70, 229, 0.22)",
            gradient: "linear-gradient(135deg, #4f46e5 0%, #6366f1 50%, #818cf8 100%)"
        },
        emerald: {
            name: "Esmeralda Luxe",
            primary: "#10b981",
            primaryLight: "#34d399",
            primaryDark: "#047857",
            glow: "rgba(16, 185, 129, 0.22)",
            gradient: "linear-gradient(135deg, #10b981 0%, #059669 100%)"
        },
        ocean: {
            name: "Ocean Cyber",
            primary: "#0284c7",
            primaryLight: "#38bdf8",
            primaryDark: "#0369a1",
            glow: "rgba(2, 132, 199, 0.22)",
            gradient: "linear-gradient(135deg, #0284c7 0%, #0369a1 100%)"
        },
        crimson: {
            name: "Sunset Crimson",
            primary: "#e11d48",
            primaryLight: "#fb7185",
            primaryDark: "#be123c",
            glow: "rgba(225, 29, 72, 0.22)",
            gradient: "linear-gradient(135deg, #e11d48 0%, #f43f5e 100%)"
        },
        amber: {
            name: "Gold Amber",
            primary: "#d97706",
            primaryLight: "#fbbf24",
            primaryDark: "#b45309",
            glow: "rgba(217, 119, 6, 0.22)",
            gradient: "linear-gradient(135deg, #d97706 0%, #f59e0b 100%)"
        },
        purple: {
            name: "Violet Neon",
            primary: "#9333ea",
            primaryLight: "#c084fc",
            primaryDark: "#7e22ce",
            glow: "rgba(147, 51, 234, 0.22)",
            gradient: "linear-gradient(135deg, #9333ea 0%, #a855f7 100%)"
        }
    },

    init() {
        // Carregar preferências salvas ou padrão
        const savedMode = localStorage.getItem("vellia_theme_mode") || "light";
        const savedColor = localStorage.getItem("vellia_theme_color") || "indigo";

        this.setThemeMode(savedMode, false);
        this.setColorPalette(savedColor, false);

        this.bindEvents();
    },

    bindEvents() {
        const btnToggleModal = document.getElementById("btn-toggle-theme-modal");
        const modalOverlay = document.getElementById("theme-modal-overlay");
        const modal = document.getElementById("modal-theme-customizer");
        const btnClose = document.getElementById("btn-close-theme-modal");

        if (btnToggleModal) {
            btnToggleModal.addEventListener("click", () => {
                if (modalOverlay && modal) {
                    modalOverlay.style.display = "block";
                    modal.style.display = "block";
                }
            });
        }

        if (btnClose && modalOverlay && modal) {
            btnClose.addEventListener("click", () => {
                modalOverlay.style.display = "none";
                modal.style.display = "none";
            });
        }

        if (modalOverlay && modal) {
            modalOverlay.addEventListener("click", () => {
                modalOverlay.style.display = "none";
                modal.style.display = "none";
            });
        }
    },

    setThemeMode(mode, save = true) {
        document.documentElement.setAttribute("data-theme", mode);
        if (save) localStorage.setItem("vellia_theme_mode", mode);

        // Atualizar botões visuais no modal se existirem
        const btnLight = document.getElementById("theme-btn-light");
        const btnDark = document.getElementById("theme-btn-dark");

        if (btnLight && btnDark) {
            if (mode === "dark") {
                btnDark.classList.add("active");
                btnLight.classList.remove("active");
            } else {
                btnLight.classList.add("active");
                btnDark.classList.remove("active");
            }
        }
    },

    setColorPalette(key, save = true) {
        const pal = this.PALETTES[key] || this.PALETTES.indigo;
        const root = document.documentElement;

        root.style.setProperty("--primary", pal.primary);
        root.style.setProperty("--primary-light", pal.primaryLight);
        root.style.setProperty("--primary-dark", pal.primaryDark);
        root.style.setProperty("--primary-glow", pal.glow);
        root.style.setProperty("--primary-gradient", pal.gradient);

        if (save) localStorage.setItem("vellia_theme_color", key);

        // Atualizar destaque dos swatches no modal
        document.querySelectorAll(".color-swatch-btn").forEach(btn => {
            if (btn.getAttribute("data-color-key") === key) {
                btn.style.outline = "3px solid #fff";
                btn.style.boxShadow = `0 0 15px ${pal.primary}`;
            } else {
                btn.style.outline = "none";
                btn.style.boxShadow = "none";
            }
        });
    }
};

window.ThemeManager = ThemeManager;
