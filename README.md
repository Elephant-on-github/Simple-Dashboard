# Simple container that runs a music player

Mount folder containing mp3 to /app/music/ e.g -v /media/:/app/music/

Expose ports to 3000 e.g -p 3000:3000

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
networks: {}
```
