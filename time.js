function updateTime() {
  const humantimenodate = new Date().toLocaleTimeString(); // Get only the time
  const time = document.querySelector(".clock");
  if (time) time.textContent = humantimenodate; // Update the text content
}
updateTime();
setInterval(updateTime, 1000); // Update every second

