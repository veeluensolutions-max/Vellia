/**
 * Isocinética UI Controller
 * Gerencia a interação entre o formulário HTML e o IsocineticaCalculator
 */

document.addEventListener("DOMContentLoaded", () => {
    
    // Elementos da UI
    const viewIsocinetica = document.getElementById("view-isocinetica");
    const btnIsocineticaCard = document.getElementById("btn-isocinetica-card");
    
    if (!viewIsocinetica) return;

    const btnNew = document.getElementById("btn-isocinetica-new");
    const btnBack = document.getElementById("btn-isocinetica-back");
    const listView = document.getElementById("isocinetica-list-view");
    const formView = document.getElementById("isocinetica-form-view");
    
    // Botões de Deslocamento
    const travelModeBtns = document.querySelectorAll(".travel-mode-btn");
    const hiddenTravelMode = document.getElementById("iso-travel-mode");
    const groupOvernight = document.getElementById("iso-group-overnight");
    const groupNoOvernight = document.getElementById("iso-group-no-overnight");
    
    // Todos os inputs que afetam o cálculo
    const calcInputs = [
        "iso-distance", "iso-days", "iso-employees", "iso-stacks",
        "iso-hotel-rate", "iso-food-rate", "iso-meals-count", "iso-meal-price",
        "iso-consumption", "iso-fuel-price", "iso-stack-rate", "iso-maint-rate",
        "iso-admin-rate", "iso-tax-rate", "iso-profit-rate"
    ];

    // Listeners para abrir a tela a partir do Card em Propostas & Vendas
    if (btnIsocineticaCard) {
        btnIsocineticaCard.addEventListener("click", (e) => {
            // Garante o reset da view interna
            listView.classList.remove("isocinetica-hidden");
            formView.classList.add("isocinetica-hidden");
            // Navega para a view principal da Isocinética
            window.location.hash = "#isocinetica";
        });
    }

    btnNew.addEventListener("click", () => {
        listView.classList.add("isocinetica-hidden");
        formView.classList.remove("isocinetica-hidden");
        updateCalculations();
    });

    btnBack.addEventListener("click", () => {
        formView.classList.add("isocinetica-hidden");
        listView.classList.remove("isocinetica-hidden");
    });

    // Alternar Tipo de Deslocamento
    travelModeBtns.forEach(btn => {
        btn.addEventListener("click", (e) => {
            travelModeBtns.forEach(b => b.classList.remove("active"));
            e.target.classList.add("active");
            const mode = e.target.dataset.mode;
            hiddenTravelMode.value = mode;

            if (mode === "WITH_OVERNIGHT") {
                groupOvernight.style.display = "grid";
                groupNoOvernight.style.display = "none";
            } else {
                groupOvernight.style.display = "none";
                groupNoOvernight.style.display = "grid";
            }
            updateCalculations();
        });
    });

    // Adicionar listener de input em todos os campos numéricos
    calcInputs.forEach(id => {
        const el = document.getElementById(id);
        if(el) {
            el.addEventListener("input", updateCalculations);
        }
    });

    // Formatação de Moeda
    const formatBRL = (value) => {
        return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
    };

    // Função Principal de Atualização
    function updateCalculations() {
        if (typeof IsocineticaCalculator === "undefined") {
            console.error("IsocineticaCalculator não carregado!");
            return;
        }

        const getVal = (id) => parseFloat(document.getElementById(id).value) || 0;

        try {
            const inputData = {
                travelMode: hiddenTravelMode.value,
                roundTripDistanceKm: getVal("iso-distance"),
                numberOfDays: getVal("iso-days"),
                numberOfEmployees: getVal("iso-employees"),
                numberOfStacks: getVal("iso-stacks"),
                vehicleConsumptionKmPerLiter: getVal("iso-consumption"),
                fuelPricePerLiter: getVal("iso-fuel-price"),
                hotelDailyRatePerEmployee: getVal("iso-hotel-rate"),
                dailyFoodRatePerEmployee: getVal("iso-food-rate"),
                mealsPerEmployee: getVal("iso-meals-count"),
                mealUnitPrice: getVal("iso-meal-price"),
                stackAdditionalRate: getVal("iso-stack-rate") / 100, // converte de % para decimal
                vehicleMaintenanceRate: getVal("iso-maint-rate") / 100,
                administrativeCostRate: getVal("iso-admin-rate") / 100,
                taxRate: getVal("iso-tax-rate") / 100,
                profitRate: getVal("iso-profit-rate") / 100,
                commercialAdjustment: 0 // Sem ajuste via UI nesta versão base
            };

            const result = IsocineticaCalculator.calculateProposal(inputData);

            // Atualiza UI
            document.getElementById("res-liters").textContent = result.fuelLiters.toFixed(2);
            document.getElementById("res-fuel-cost").textContent = formatBRL(result.fuelCost);
            document.getElementById("res-hotel-cost").textContent = formatBRL(result.hotelCost);
            document.getElementById("res-food-cost").textContent = formatBRL(result.foodCost);
            document.getElementById("res-travel-subtotal").textContent = formatBRL(result.travelSubtotal);
            
            document.getElementById("res-stacks-add").textContent = formatBRL(result.stacksAdditional);
            document.getElementById("res-total-costs").textContent = formatBRL(result.totalCosts);
            
            document.getElementById("res-pricing-pct").textContent = (result.pricingRate * 100).toFixed(2);
            document.getElementById("res-pricing-inc").textContent = formatBRL(result.pricingIncrease);
            
            document.getElementById("res-final-price").textContent = formatBRL(result.finalCommercialPrice);

        } catch (error) {
            console.error("Erro no cálculo:", error.message);
        }
    }

    // Gerar PDF
    const btnGeneratePdf = document.getElementById("btn-iso-generate-pdf");
    if (btnGeneratePdf) {
        btnGeneratePdf.addEventListener("click", () => {
            if (typeof IsocineticaPDF !== "undefined") {
                const clientName = document.getElementById("iso-client").value || "Cliente Não Informado";
                const finalPrice = document.getElementById("res-final-price").textContent;
                IsocineticaPDF.generateProposal(clientName, finalPrice);
            } else {
                alert("Módulo PDF não carregado.");
            }
        });
    }
});
