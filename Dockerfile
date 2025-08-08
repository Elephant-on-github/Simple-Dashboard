FROM oven/bun

# Set the working directory
WORKDIR /app

# Copy all project files into the container
COPY . .

# Expose the server port
EXPOSE 3000

# Declare a mountable volume for music files
VOLUME ["/app/music"]

# Install dependencies
RUN bun install

# Run the server
CMD ["bun", "run", "server.js"]
