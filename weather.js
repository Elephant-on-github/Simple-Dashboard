var latitude = 0;
var longitude = 0;

const weatherApiUrl = `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&models=ukmo_seamless&current=temperature_2m,apparent_temperature,weather_code,wind_speed_10m`;

function go() {
  return fetch(weatherApiUrl)
    .then(response => {
      if (!response.ok) {
        throw new Error('Network response was not ok');
      }
      return response.json();
    })
    .then(data => {
      // Extract the relevant data from the response
      const temperature = data.current.temperature_2m;
      const apparentTemperature = data.current.apparent_temperature;
      const weatherCode = data.current.weather_code;
      const windSpeed = data.current.wind_speed_10m;

      // Update the DOM elements
      const temperatureEl = document.querySelector(".temperature");
      const weatherEl = document.querySelector(".weather");
      const windEl = document.querySelector(".wind");
      const apparentEl = document.querySelector(".apparent");

      // Expanded weather code mappings for better coverage
      const weatherDescriptions = {
        0: "Clear sky",
        1: "Mainly clear",
        2: "Partly cloudy",
        3: "Overcast",
        45: "Fog",
        48: "Depositing rime fog",
        51: "Light drizzle",
        53: "Moderate drizzle",
        55: "Dense drizzle",
        56: "Light freezing drizzle",
        57: "Dense freezing drizzle",
        61: "Slight rain",
        63: "Moderate rain",
        65: "Heavy rain",
        66: "Light freezing rain",
        67: "Heavy freezing rain",
        71: "Slight snow fall",
        73: "Moderate snow fall",
        75: "Heavy snow fall",
        77: "Snow grains",
        80: "Slight rain showers",
        81: "Moderate rain showers",
        82: "Violent rain showers",
        85: "Slight snow showers",
        86: "Heavy snow showers",
        95: "Thunderstorm",
        96: "Thunderstorm with slight hail",
        99: "Thunderstorm with heavy hail"
      };

      // Update the text content of the elements with error checking
      if (temperatureEl) temperatureEl.textContent = `Temperature: ${temperature} °C`;
      if (apparentEl) apparentEl.textContent = `Apparent Temperature: ${apparentTemperature} °C`;
      if (weatherEl) weatherEl.textContent = `Weather: ${weatherDescriptions[weatherCode] || "Unknown"}`;
      if (windEl) windEl.textContent = `Wind Speed: ${windSpeed} m/s`;

      console.log(`Weather updated: ${temperature}°C, ${weatherDescriptions[weatherCode] || "Unknown"}`);
    })
    .catch(error => {
      console.error('There was a problem with the fetch operation:', error);
      throw error; // Re-throw so calling code can handle it
    });
}

// Initial weather fetch
go().catch(error => {
  console.error("Error loading initial weather data:", error);
});

async function startAutoUpdate() {
  let lastUpdateTime = Date.now();

  while (true) {
    const now = Date.now();
    
    // Check if 30 minutes (1800000 ms) have passed
    if (now - lastUpdateTime >= 1800000) { // 30 minutes in milliseconds
      try {
        await go();
        lastUpdateTime = now;
        console.log("Weather auto-updated successfully");
      } catch (error) {
        console.error("Error in weather auto-update:", error);
      }
    }
    
    // Wait 1 minute before checking again to avoid excessive CPU usage
    await new Promise(resolve => setTimeout(resolve, 60000));
  }
}

startAutoUpdate().catch((error) => {
  console.error("Error in auto-update loop:", error);
});