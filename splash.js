async function loadSplashes() {
  try {
    const response = await fetch("/api/photo");
    if (!response.ok) throw new Error("Network response was not ok");
    const photos = await response.json();
    return photos;
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

  const simplifiedPhotos = data.photos.map((photo) => ({
    avg_color: photo.avg_color || "#000",
    landscape: photo.src?.landscape || "",
    alt: photo.alt || "",
    photographer: photo.photographer || "Unknown",
    photographer_url: photo.photographer_url || "#",
  }));

  console.log(`Loaded ${simplifiedPhotos.length} photos for cycling`);

  function updateDOM(photoIndex) {
    // Ensure index is within bounds
    const safeIndex = photoIndex % simplifiedPhotos.length;
    const photo = simplifiedPhotos[safeIndex];
    
    if (!photo) {
      console.error(`No photo found at index ${safeIndex}`);
      return;
    }

    const imgEl = document.getElementById("photo");
    if (imgEl) {
      imgEl.src = photo.landscape;
      imgEl.alt = photo.alt;
    }

    const creditEl = document.getElementById("credit");
    if (creditEl) {
      creditEl.innerHTML = `Photo by <a href="${photo.photographer_url}" target="_blank">${photo.photographer}</a> on Pexels`;
    }

    console.log(`Updated to photo ${safeIndex + 1}/${simplifiedPhotos.length}: ${photo.alt}`);
  }

  // Display first photo immediately
  updateDOM(0);

  async function startAutoUpdate() {
    let currentPhotoIndex = 0;
    let lastUpdateTime = Date.now();

    while (true) {
      const now = Date.now();

      // Check if 1 minute (60000 ms) have passed
      if (now - lastUpdateTime >= 60000) { // 1 minute in milliseconds
        currentPhotoIndex = (currentPhotoIndex + 1) % simplifiedPhotos.length;
        
        try {
          updateDOM(currentPhotoIndex);
          lastUpdateTime = now;
          console.log(`Auto-updated to photo index: ${currentPhotoIndex}`);
        } catch (error) {
          console.error("Error updating photo:", error);
        }
      }
      
      // Wait 1 minute before checking again to avoid excessive CPU usage
      await new Promise(resolve => setTimeout(resolve, 60000));
    }
  }

  startAutoUpdate().catch((error) => {
    console.error("Error in auto-update:", error);
  });
})();