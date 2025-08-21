function getGreeting(name) {
  const now = new Date();
  const hours = now.getHours();
  const minutes = now.getMinutes();
  let greeting;

  if (hours < 12) {
    greeting = "Good morning";
  } else if (hours < 19 || (hours === 19 && minutes < 30)) {
    greeting = "Good afternoon";
  } else {
    greeting = "Good evening";
  }

  // Add some fun alternatives with bias towards the greeting
  const alternatives = ["Bonjour", "Hi", "Hello", `${greeting}`, `${greeting}` , `${greeting}`,  `${greeting}`]; // Duplicated greeting
  const randomAlternative =
    alternatives[Math.floor(Math.random() * alternatives.length)];

  return `${randomAlternative}, ${name}.`;
}


function updateTime() {
  const humantimenodate = new Date().toLocaleTimeString(); // Get only the time
  const time = document.querySelector(".clock");
  if (time) time.textContent = humantimenodate; // Update the text content
}
updateTime();
setInterval(updateTime, 1000); // Update every second

function updateGreeting() {
  const greeting = document.querySelector(".greeting");
  //fetch from server
  fetch("/api/name")
    .then((response) => response.json())
    .then((data) => {
      if (greeting) greeting.textContent = getGreeting(data.name);
    })
    .catch((error) => {
      console.error("Error fetching name:", error);
    });
}

updateGreeting();
setInterval(updateGreeting, 1000 * 60); // Update every minute
