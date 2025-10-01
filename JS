const apiKey = "77b60d473c011bcd5964a25c2237f8b9"; 
const apiUrl = "https://api.openweathermap.org/data/2.5/weather?q=";

let lastRequest = { city: "", units: "", timestamp: 0, data: null };
const CACHE_DURATION = 60 * 1000; // 1 minute cache
const AUTO_UPDATE_INTERVAL = 5 * 60 * 1000; // 5 minutes

document.addEventListener("DOMContentLoaded", () => {
    const elements = {
        searchBox: document.querySelector("#cityInput"),
        searchBtn: document.querySelector("#searchBtn"),
        refreshBtn: document.querySelector("#refreshBtn"),
        locationBtn: document.querySelector("#locationBtn"),
        weatherIcon: document.querySelector("#weather-icon"),
        unitSelect: document.querySelector("#unitSelect"),
        errorMessage: document.querySelector("#error-message"),
        loadingIndicator: document.querySelector("#loading"),
        weatherDescription: document.querySelector("#weather-description"),
        conditionSummary: document.querySelector("#condition-summary"),
        cityName: document.querySelector("#city-name"),
        temperature: document.querySelector("#temperature"),
        humidity: document.querySelector("#humidity"),
        wind: document.querySelector("#wind"),
        weatherInfo: document.querySelector(".weather-info"),
        body: document.body
    };

    // Error if elements are missing
    if (Object.values(elements).some(el => !el)) {
        console.error("Missing elements:", Object.entries(elements).filter(([_,v]) => !v).map(([k]) => k));
        return;
    }

    let autoUpdateInterval = null;

    // Debounce function implementation
    function debounce(func, wait) {
        let timeout;
        return function(...args) {
            clearTimeout(timeout);
            timeout = setTimeout(() => func.apply(this, args), wait);
        };
    }

    async function checkWeather(city, units = "metric", isAutoUpdate = false) {
        const now = Date.now();
        if (lastRequest.city === city && 
            lastRequest.units === units && 
            now - lastRequest.timestamp < CACHE_DURATION) {
            updateWeatherUI(lastRequest.data, units);
            return;
        }

        elements.errorMessage.textContent = "";
        elements.loadingIndicator.style.display = "block";

        try {
            const response = await fetch(`${apiUrl}${encodeURIComponent(city)}&units=${units}&appid=${apiKey}`);
            
            if (!response.ok) {
                throw new Error(response.status === 404 ? "City not found!" : 
                              response.status === 401 ? "Invalid API key" : 
                              `HTTP error! Status: ${response.status}`);
            }

            const data = await response.json();
            lastRequest = { city, units, timestamp: now, data };
            updateWeatherUI(data, units);
            setWeatherTheme(data.weather[0].main);

            if (!isAutoUpdate) startAutoUpdates(city, units);
            
        } catch (error) {
            elements.errorMessage.textContent = error.message;
            console.error("Fetch error:", error);
        } finally {
            elements.loadingIndicator.style.display = "none";
        }
    }

    function updateWeatherUI(data, units) {
        const tempUnit = units === "metric" ? "C" : "F";
        const speedUnit = units === "metric" ? "km/h" : "mph";
        const description = data.weather[0].description.replace(/\b\w/g, c => c.toUpperCase());

        elements.cityName.textContent = data.name;
        elements.temperature.textContent = `${Math.round(data.main.temp)}°${tempUnit}`;
        elements.humidity.textContent = `Humidity: ${data.main.humidity}%`;
        elements.wind.textContent = `Wind: ${data.wind.speed} ${speedUnit}`;
        elements.weatherDescription.textContent = `Condition: ${description}`;
        elements.conditionSummary.textContent = 
            `It's currently ${Math.round(data.main.temp)}°${tempUnit} with ${description.toLowerCase()} in ${data.name}.`;

        const iconCode = data.weather[0].icon;
        elements.weatherIcon.innerHTML = `<img src="https://openweathermap.org/img/wn/${iconCode}@2x.png" alt="${description}">`;
    }

    function getLocation() {
        elements.loadingIndicator.style.display = "block";
        elements.errorMessage.textContent = "";
        
        if (!navigator.geolocation) {
            elements.errorMessage.textContent = "Geolocation is not supported by your browser.";
            elements.loadingIndicator.style.display = "none";
            return;
        }
    
        navigator.geolocation.getCurrentPosition(
            (position) => {
                const { latitude: lat, longitude: lon } = position.coords;
                fetchWeatherByCoords(lat, lon);
            },
            (error) => {
                elements.loadingIndicator.style.display = "none";
                handleGeolocationError(error);
            },
            { timeout: 10000 } 
        );
    }
    
    function handleGeolocationError(error) {
        let message = "";
        switch(error.code) {
            case error.PERMISSION_DENIED:
                message = "Location access was denied. Please search manually.";
                break;
            case error.POSITION_UNAVAILABLE:
                message = "Location information is unavailable.";
                break;
            case error.TIMEOUT:
                message = "Location request timed out. Please try again.";
                break;
            default:
                message = "An unknown error occurred.";
        }
        elements.errorMessage.textContent = message;
        console.error("Geolocation error:", error);
    }
    
    async function fetchWeatherByCoords(lat, lon) {
        try {
            const units = elements.unitSelect.value;
            const response = await fetch(
                `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&units=${units}&appid=${apiKey}`
            );
            
            if (!response.ok) throw new Error(`HTTP error! Status: ${response.status}`);
            
            const data = await response.json();
            elements.searchBox.value = ""; // Clear manual search input
            lastRequest = {
                city: data.name,
                units,
                timestamp: Date.now(),
                data
            };
            updateWeatherUI(data, units);
        } catch (error) {
            elements.errorMessage.textContent = "Failed to fetch weather for your location.";
            console.error("Fetch error:", error);
        } finally {
            elements.loadingIndicator.style.display = "none";
        }
    }

    function setWeatherTheme(weatherCondition) {
        const themes = {
            "Clear": "linear-gradient(135deg, #56CCF2, #2F80ED)",
            "Clouds": "linear-gradient(135deg, #BDC3C7, #2C3E50)",
            "Rain": "linear-gradient(135deg, #4B79CF, #283E51)",
            "Snow": "linear-gradient(135deg, #E0EAFC, #CFDEF3)",
            "Thunderstorm": "linear-gradient(135deg, #0F2027, #203A43, #2C5364)"
        };
        elements.body.style.background = themes[weatherCondition] || "linear-gradient(135deg, #F0F8FF, #B9D9EB)";
    }

    function startAutoUpdates(city, units) {
        if (autoUpdateInterval) clearInterval(autoUpdateInterval);
        autoUpdateInterval = setInterval(() => checkWeather(city, units, true), AUTO_UPDATE_INTERVAL);
    }
    const debouncedSearch = debounce(() => {
        const city = elements.searchBox.value.trim();
        if (city) checkWeather(city, elements.unitSelect.value);
        else elements.errorMessage.textContent = "Please enter a city name.";
    }, 300);

    elements.searchBtn.addEventListener("click", debouncedSearch);
    elements.searchBox.addEventListener("keypress", (e) => e.key === "Enter" && debouncedSearch());

    elements.refreshBtn.addEventListener("click", () => {
        const city = elements.searchBox.value.trim() || elements.cityName.textContent;
        if (city && city !== "City Name") checkWeather(city, elements.unitSelect.value);
        else elements.errorMessage.textContent = "No city to refresh.";
    });

    elements.unitSelect.addEventListener("change", () => {
        const city = elements.searchBox.value.trim() || elements.cityName.textContent;
        if (city && city !== "City Name") checkWeather(city, elements.unitSelect.value);
    });
    
    elements.locationBtn.addEventListener("click", getLocation);
});
