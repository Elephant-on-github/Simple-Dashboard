# Simple container that runs a Simple Dashboard with Weather, Music and Time

Mount a folder containing `.mp3` or `.opus` to `/app/music/` e.g `-v /media/:/app/music/`

Expose ports to `3000` e.g `-p 3000:3000`

## Example compose.yaml
```yaml
services:
  music:
    image: ghcr.io/elephant-on-github/simplemusic:latest
    restart: unless-stopped
    ports:
      - 3000:3000
    volumes:
      - /DATA/Media/Music:/app/music
      - ./.env:/app/.env
networks: {}
```

You will also need to add a `.env` with your personal information in the following format. 
Don't worry this is only used for local settings. 

```env
PEXELS_API_KEY = Your_API_Key_Here
Name = Your_Name_Here
LAT = 40 #Latitude for weather
LONG = 30 #Longitude for weather
PEXELS_SEARCH = Rolling hills # Your preferred search term for background images
```
