async function loadSplashes() {
  try {
    const response = await fetch("/api/photo");
    if (!response.ok) throw new Error("Network response was not ok");
    const photos = await response.json();
    return photos; // ✅ Now returns the JSON
  } catch (error) {
    console.error("Error loading splashes:", error);
    return null;
  }
}

(async () => {
  const data = await loadSplashes();
  if (!data || !Array.isArray(data.photos) || data.photos.length === 0) {
    console.warn("No photos available to display");
    return;
  }

  const simplifiedPhotos = data.photos.map(photo => ({
    avg_color: photo.avg_color || "#000",
    landscape: photo.src?.landscape || "",
    alt: photo.alt || "",
    photographer: photo.photographer || "Unknown",
    photographer_url: photo.photographer_url || "#"
  }));

  function updateDOM(photoIndex) {
    const photo = simplifiedPhotos[photoIndex];
    if (!photo) return;
    const imgEl = document.getElementById('photo');
    if (imgEl) {
      imgEl.src = photo.landscape;
      imgEl.alt = photo.alt;
    }
    const creditEl = document.getElementById('credit');
    if (creditEl) {
      creditEl.innerHTML = `Photo by <a href="${photo.photographer_url}" target="_blank">${photo.photographer}</a> on Pexels`;
    }
  }

  updateDOM(0);
})();
