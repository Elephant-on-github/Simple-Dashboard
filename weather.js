var latitude = 0;
var longitude = 0;

const weatherApiUrl = `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&models=ukmo_seamless&current=temperature_2m,apparent_temperature,weather_code,wind_speed_10m`;

fetch(weatherApiUrl)
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

    // Assuming weather codes are mapped to human-readable strings
    const weatherDescriptions = {
      0: "Clear sky",
      1: "Mainly clear",
      2: "Partly cloudy",
      3: "Overcast",
      // Add more mappings as needed
    };

    // Update the text content of the elements
    temperatureEl.textContent = `Temperature: ${temperature} °C`;
    apparentEl.textContent = `Apparent Temperature: ${apparentTemperature} °C`;
    weatherEl.textContent = `Weather: ${weatherDescriptions[weatherCode] || "Unknown"}`;
    windEl.textContent = `Wind Speed: ${windSpeed} m/s`;
  })
  .catch(error => {
    console.error('There was a problem with the fetch operation:', error);
  });
