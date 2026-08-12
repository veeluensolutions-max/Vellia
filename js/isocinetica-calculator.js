/**
 * Isocinetica Calculator
 * Centraliza toda a lógica matemática para precificação de propostas de Isocinética.
 * Funções puras e testáveis.
 */

const IsocineticaCalculator = {
    /**
     * Calcula todos os custos e preço final de uma proposta.
     * @param {Object} input Objeto com as entradas do usuário e percentuais padrão.
     * @returns {Object} Objeto com os resultados detalhados (memória de cálculo e preço final).
     */
    calculateProposal: function (input) {
        // Validação obrigatória
        if (input.vehicleConsumptionKmPerLiter <= 0) {
            throw new Error("O consumo do veículo deve ser maior que zero.");
        }

        // 1. Cálculos de Combustível
        const fuelLiters = input.roundTripDistanceKm / input.vehicleConsumptionKmPerLiter;
        const fuelCost = fuelLiters * input.fuelPricePerLiter;

        // 2. Cálculos de Hospedagem e Alimentação
        let hotelCost = 0;
        let foodCost = 0;

        if (input.travelMode === "WITH_OVERNIGHT") {
            hotelCost = input.numberOfDays * input.numberOfEmployees * (input.hotelDailyRatePerEmployee || 0);
            foodCost = input.numberOfDays * input.numberOfEmployees * (input.dailyFoodRatePerEmployee || 0);
        } else if (input.travelMode === "WITHOUT_OVERNIGHT") {
            foodCost = (input.mealsPerEmployee || 0) * input.numberOfEmployees * (input.mealUnitPrice || 0);
        }

        // 3. Subtotal de Deslocamento
        const travelSubtotal = fuelCost + hotelCost + foodCost;

        // 4. Adicional por Chaminés (calculado sobre o subtotal de deslocamento)
        const stacksAdditional = travelSubtotal * input.stackAdditionalRate * input.numberOfStacks;

        // 5. Total de Custos Base
        const totalCosts = travelSubtotal + stacksAdditional;

        // 6. Formação do Preço (Acréscimos sobre o custo)
        const pricingRate = 
            input.administrativeCostRate + 
            input.taxRate + 
            input.profitRate + 
            input.vehicleMaintenanceRate;

        const pricingIncrease = totalCosts * pricingRate;
        
        // 7. Preço Calculado
        const calculatedPrice = totalCosts + pricingIncrease;
        
        // 8. Preço Comercial Final (com ajuste)
        const commercialAdjustment = input.commercialAdjustment || 0;
        const finalCommercialPrice = calculatedPrice + commercialAdjustment;

        return {
            fuelLiters,
            fuelCost,
            hotelCost,
            foodCost,
            travelSubtotal,
            stacksAdditional,
            totalCosts,
            pricingRate,
            pricingIncrease,
            calculatedPrice,
            commercialAdjustment,
            finalCommercialPrice
        };
    },

    /**
     * Arredonda monetariamente para 2 casas decimais, evitando problemas de ponto flutuante.
     */
    roundMoney: function (value) {
        return Math.round(value * 100) / 100;
    },

    /**
     * Executa os testes automatizados descritos nos requisitos para os Exemplos A e B
     */
    runTests: function () {
        console.log("=== INICIANDO TESTES DA CALCULADORA DE ISOCINÉTICA ===");
        
        const exampleA = {
            travelMode: "WITH_OVERNIGHT",
            roundTripDistanceKm: 300,
            numberOfDays: 2,
            numberOfEmployees: 2,
            numberOfStacks: 3,
            vehicleConsumptionKmPerLiter: 8,
            fuelPricePerLiter: 5.90,
            hotelDailyRatePerEmployee: 100,
            dailyFoodRatePerEmployee: 100,
            stackAdditionalRate: 0.15,
            administrativeCostRate: 0.25,
            taxRate: 0.235,
            profitRate: 1.00,
            vehicleMaintenanceRate: 0.10,
            commercialAdjustment: 0
        };

        const resultA = this.calculateProposal(exampleA);
        
        // Validação A
        const passedA = (
            this.roundMoney(resultA.fuelLiters) === 37.50 &&
            this.roundMoney(resultA.fuelCost) === 221.25 &&
            this.roundMoney(resultA.hotelCost) === 400.00 &&
            this.roundMoney(resultA.foodCost) === 400.00 &&
            this.roundMoney(resultA.travelSubtotal) === 1021.25 &&
            this.roundMoney(resultA.totalCosts) === 1480.81 &&
            this.roundMoney(resultA.finalCommercialPrice) === 3827.90
        );
        
        console.log(`Exemplo A (Com pernoite): ${passedA ? '✅ PASSOU' : '❌ FALHOU'}`);
        if (!passedA) console.dir(resultA);

        const exampleB = {
            travelMode: "WITHOUT_OVERNIGHT",
            roundTripDistanceKm: 100,
            numberOfDays: 3,
            numberOfEmployees: 2,
            numberOfStacks: 3,
            vehicleConsumptionKmPerLiter: 8,
            fuelPricePerLiter: 5.90,
            mealsPerEmployee: 6,
            mealUnitPrice: 50.00,
            stackAdditionalRate: 0.15,
            administrativeCostRate: 0.25,
            taxRate: 0.235,
            profitRate: 1.00,
            vehicleMaintenanceRate: 0.10,
            commercialAdjustment: 0
        };

        const resultB = this.calculateProposal(exampleB);
        
        // Validação B
        const passedB = (
            this.roundMoney(resultB.fuelLiters) === 12.50 &&
            this.roundMoney(resultB.fuelCost) === 73.75 &&
            this.roundMoney(resultB.foodCost) === 600.00 &&
            this.roundMoney(resultB.travelSubtotal) === 673.75 &&
            this.roundMoney(resultB.totalCosts) === 976.94 &&
            this.roundMoney(resultB.finalCommercialPrice) === 2525.38
        );

        console.log(`Exemplo B (Sem pernoite): ${passedB ? '✅ PASSOU' : '❌ FALHOU'}`);
        if (!passedB) console.dir(resultB);
        
        console.log("=========================================================");
    }
};

// Se estiver no browser e para desenvolvimento, podemos rodar os testes
// IsocineticaCalculator.runTests();
