function CO2Calculator() {
    this.defaultCO2Footprint = {
        'biomass': 900,
        'coal': 930,
        'gas': 500,
        'hydro': 0,
        'nuclear': 0,
        'oil': 650,
        'solar': 0,
        'wind': 0,
    };

    this.countryCO2Footprint = {
        'DE': function (productionMode) {
            return productionMode == 'other' ? 600 : null;
        },
        'DK': function (productionMode) {
            return productionMode == 'other' ? 600 : null;
        },
        'NO': function (productionMode) {
            return productionMode == 'other' ? 600 : null;
        },
        'SE': function (productionMode) {
            return productionMode == 'other' ? 600 : null;
        }
    };
}

CO2Calculator.prototype.footprintOf = function(productionMode, countryKey) {
    var defaultFootprint = this.defaultCO2Footprint[productionMode];
    var countryFootprint = this.countryCO2Footprint[countryKey] || function () { };
    return countryFootprint(productionMode) || defaultFootprint;
};

CO2Calculator.prototype.compute = function(countries) {
    // Only consider countries which have a co2 rating
    var validCountries = d3.entries(countries)
        .map(function(d) { return d.value.data })
        .filter(function (d) {
            return d.countryCode !== undefined;
        });
    var validCountryKeys = validCountries.map(function (d) { return d.countryCode });

    // x_i: unknown co2 (consumption) footprint of i-th country
    // f_ij: known co2 footprint of j-th system of i-th country
    // v_ij: power volume of j-th system of i-th country
    // CO2 mass flow balance equation for each country i:
    // x_i * (sum_j_intern(v_ij) + sum_j_import(v_ij) - sum_j_export(v_ij)) = 
    //     sum_j_intern(f_ij * v_ij)
    //   + sum_j_import(x_j * v_ij)
    //   - x_i * sum_j_export(v_ij)
    
    // We wish to solve Ax = b
    var n = validCountries.length;
    var A = math.sparse().resize([n, n]);
    var b = math.zeros(n);

    var that = this;

    validCountries.forEach(function (country, i) {
        A.set([i, i], -country.totalProduction - country.totalNetExchange);
        // Intern
        d3.entries(country.production).forEach(function (production) {
            var footprint = that.footprintOf(production.key, country.countryCode);
            if (footprint === undefined) {
                console.warn(country.countryCode + ' CO2 footprint of ' + production.key + ' is unknown.');
                return;
            }
            // Accumulate
            b.set([i], b.get([i]) - footprint * production.value);
        });
        // Exchanges
        d3.entries(country.exchange).forEach(function (exchange) {
            var j = validCountryKeys.indexOf(exchange.key);
            if (j < 0) {
                console.warn(country.countryCode + ' neighbor ' + exchange.key + ' has not data.');
                return;
            }
            // Accumulate
            if (exchange.value > 0) {
                // Import
                A.set([i, j], exchange.value);
            } else {
                // Export
                A.set([i, i], A.get([i, i]) - Math.abs(exchange.value));
            }
        });
    });

    // Solve
    var x = math.lusolve(A, b);
    this.assignments = {};
    x.toArray().forEach(function (x, i) {
        console.log(validCountries[i].countryCode, x, validCountries[i].co2);
        // console.log(A.toArray()[i], b.toArray()[i]);
        that.assignments[validCountries[i].countryCode] = x[0];
    });

    return this;
}
