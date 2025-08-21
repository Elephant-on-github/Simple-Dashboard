async function fetchLocation() {
  try {
    const response = await fetch("api/location");
    if (!response.ok) {
      throw new Error('Failed to fetch location');
    }
    const data = await response.json();
    return { lat: data.lat, long: data.long };
  } catch (error) {
    console.error('Error fetching location:', error);
    throw error; // Re-throw to handle it in the calling function
  }
}

async function fetchWeather(latitude, longitude) {
  const weatherApiUrl = `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&models=ukmo_seamless&current=temperature_2m,apparent_temperature,weather_code,wind_speed_10m`;

  try {
    const response = await fetch(weatherApiUrl);
    if (!response.ok) {
      throw new Error('Network response was not ok');
    }
    return await response.json();
  } catch (error) {
    console.error('Error fetching weather data:', error);
    throw error; // Re-throw to handle it in the calling function
  }
}

async function updateWeather() {
  try {
    const { lat, long } = await fetchLocation();
    const data = await fetchWeather(lat, long);

    const temperature = data.current.temperature_2m;
    const apparentTemperature = data.current.apparent_temperature;
    const weatherCode = data.current.weather_code;
    const windSpeed = data.current.wind_speed_10m;

    const temperatureEl = document.querySelector(".temperature");
    const weatherEl = document.querySelector(".weather");
    const windEl = document.querySelector(".wind");
    const apparentEl = document.querySelector(".apparent");

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

    if (temperatureEl) temperatureEl.textContent = `Temperature: ${temperature} °C`;
    if (apparentEl) apparentEl.textContent = `Apparent Temperature: ${apparentTemperature} °C`;
    if (weatherEl) weatherEl.textContent = `Weather: ${weatherDescriptions[weatherCode] || "Unknown"}`;
    if (windEl) windEl.textContent = `Wind Speed: ${windSpeed} m/s`;

    console.log(`Weather updated: ${temperature}°C, ${weatherDescriptions[weatherCode] || "Unknown"}`);
  } catch (error) {
    console.error("Error updating weather data:", error);
  }
}

// Initial weather fetch
updateWeather();

// Auto-update every 30 minutes
setInterval(updateWeather, 1800000);
