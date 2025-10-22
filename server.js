import { readdir, readFile } from "node:fs/promises";
import { existsSync, statSync, readFileSync } from "node:fs";
import { extname } from "node:path";
import { createHash } from "node:crypto";
import { createClient } from "pexels";
import { configDotenv } from "dotenv";

configDotenv({ path: ".env" });

if (process.env.PEXELS_API_KEY) {
  global.client = createClient(process.env.PEXELS_API_KEY);
  //request splashes from Pexels API
  client.photos
    .search({ query: "Mountains", per_page: 10 })
    .then((photos) => {
      // console.log("Pexels Photos:", photos);
      console.log("Photos loaded successfully");
    })
    .catch((error) => {
      console.error("Error fetching Pexels photos:", error);
    });
} else {
  console.error("PEXELS_API_KEY is not defined");
}

// Simple ID3v2 tag parser
class ID3Parser {
  static parseBuffer(buffer) {
    const metadata = {
      title: null,
      artist: null,
      album: null,
      year: null,
      genre: null,
    };

    try {
      // Check for ID3v2 header
      if (buffer.length < 10 || buffer.toString("ascii", 0, 3) !== "ID3") {
        return metadata;
      }

      const version = buffer[3];
      const flags = buffer[5];

      // Calculate tag size (synchsafe integer)
      const tagSize =
        (buffer[6] << 21) | (buffer[7] << 14) | (buffer[8] << 7) | buffer[9];

      let offset = 10;
      const tagEnd = Math.min(offset + tagSize, buffer.length);

      while (offset < tagEnd - 10) {
        // Read frame header
        const frameId = buffer.toString("ascii", offset, offset + 4);
        if (frameId === "\0\0\0\0") break;

        let frameSize;
        if (version === 4) {
          // ID3v2.4 uses synchsafe integers
          frameSize =
            (buffer[offset + 4] << 21) |
            (buffer[offset + 5] << 14) |
            (buffer[offset + 6] << 7) |
            buffer[offset + 7];
        } else {
          // ID3v2.3 uses regular integers
          frameSize =
            (buffer[offset + 4] << 24) |
            (buffer[offset + 5] << 16) |
            (buffer[offset + 6] << 8) |
            buffer[offset + 7];
        }

        const frameFlags = (buffer[offset + 8] << 8) | buffer[offset + 9];
        offset += 10;

        if (frameSize > tagEnd - offset) break;

        // Extract frame content
        let frameContent = buffer.slice(offset, offset + frameSize);

        // Handle text encoding (skip first byte which is encoding type)
        if (frameContent.length > 1) {
          const encoding = frameContent[0];
          let text = "";

          if (encoding === 0 || encoding === 3) {
            // ISO-8859-1 or UTF-8
            text = frameContent.slice(1).toString("utf8").replace(/\0/g, "");
          } else if (encoding === 1 || encoding === 2) {
            // UTF-16 with BOM or UTF-16 BE
            text = frameContent.slice(1).toString("utf16le").replace(/\0/g, "");
          }

          // Map frame IDs to metadata
          switch (frameId) {
            case "TIT2": // Title
              metadata.title = text;
              break;
            case "TPE1": // Artist
              metadata.artist = text;
              break;
            case "TALB": // Album
              metadata.album = text;
              break;
            case "TYER": // Year (ID3v2.3)
            case "TDRC": // Recording time (ID3v2.4)
              metadata.year = text;
              break;
            case "TCON": // Genre
              metadata.genre = text;
              break;
          }
        }

        offset += frameSize;
      }
    } catch (error) {
      console.warn("Error parsing ID3 tags:", error);
    }

    return metadata;
  }

  static async parseFile(filePath) {
    try {
      // Read first 64KB which should contain ID3v2 tags
      const buffer = await readFile(filePath, { start: 0, end: 65536 });
      return this.parseBuffer(buffer);
    } catch (error) {
      console.warn(`Error reading file ${filePath}:`, error);
      return {
        title: null,
        artist: null,
        album: null,
        year: null,
        genre: null,
      };
    }
  }
}

function getContentType(filePath) {
  const ext = extname(filePath).toLowerCase();
  switch (ext) {
    case ".mp3":
      return "audio/mpeg";
    case ".wav":
      return "audio/wav";
    case ".ogg":
      return "audio/ogg";
    case ".opus":
      return "audio/opus";
    case ".m4a":
      return "audio/mp4";
    case ".flac":
      return "audio/flac";
    case ".aac":
      return "audio/aac";
    default:
      return "application/octet-stream";
  }
}

// Generate ETag for files to improve caching
function generateETag(stats) {
  return `"${stats.size}-${stats.mtime.getTime()}"`;
}

function shuffle(array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}

// Parse filename for metadata fallback
function parseFilenameMetadata(filename) {
  const nameWithoutExt = filename.replace(/\.[^/.]+$/, "");

  // Try to parse "Artist - Title" format
  const dashSplit = nameWithoutExt.split(" - ");
  if (dashSplit.length >= 2) {
    return {
      title: dashSplit.slice(1).join(" - ").trim(),
      artist: dashSplit[0].trim(),
      album: "Unknown Album",
    };
  }

  // Try to parse "Artist_Title" format
  const underscoreSplit = nameWithoutExt.split("_");
  if (underscoreSplit.length >= 2) {
    return {
      title: underscoreSplit.slice(1).join("_").replace(/_/g, " ").trim(),
      artist: underscoreSplit[0].replace(/_/g, " ").trim(),
      album: "Unknown Album",
    };
  }

  // Try to parse numbers and clean up
  const cleanTitle = nameWithoutExt
    .replace(/^\d+[\s\-\.]*/, "") // Remove leading track numbers
    .replace(/[\(\[].*?[\)\]]/g, "") // Remove content in brackets/parentheses
    .trim();

  return {
    title: cleanTitle || nameWithoutExt,
    artist: "Unknown Artist",
    album: "Unknown Album",
  };
}

// Add Opus (Ogg) tags parser (OpusTags)
// Reads up to first 256KB of the file and parses "OpusTags" comment headers.
async function parseOpusFile(filePath) {
  try {
    const buffer = await readFile(filePath, { start: 0, end: 262144 });
    const parsed = parseOpusTagsBuffer(buffer);
    return parsed || { title: null, artist: null, album: null, year: null, genre: null };
  } catch (err) {
    console.warn(`Error reading opus file ${filePath}:`, err);
    return { title: null, artist: null, album: null, year: null, genre: null };
  }
}

function parseOpusTagsBuffer(buffer) {
  const sig = Buffer.from("OpusTags");
  const pos = buffer.indexOf(sig);
  if (pos === -1) return null;

  let offset = pos + sig.length;

  // Need at least vendor length (4) and comment count (4)
  if (offset + 8 > buffer.length) return null;

  try {
    // vendor string length (32-bit little endian)
    const vendorLen = buffer.readUInt32LE(offset);
    offset += 4;
    offset += vendorLen; // skip vendor string

    if (offset + 4 > buffer.length) return null;
    const userComments = buffer.readUInt32LE(offset);
    offset += 4;

    const meta = {};
    for (let i = 0; i < userComments; i++) {
      if (offset + 4 > buffer.length) break;
      const len = buffer.readUInt32LE(offset);
      offset += 4;
      if (offset + len > buffer.length) break;
      const comment = buffer.slice(offset, offset + len).toString("utf8");
      offset += len;

      const eq = comment.indexOf("=");
      if (eq !== -1) {
        const key = comment.slice(0, eq).toUpperCase();
        const value = comment.slice(eq + 1);
        meta[key] = value;
      }
    }

    return {
      title: meta["TITLE"] || null,
      artist: meta["ARTIST"] || null,
      album: meta["ALBUM"] || null,
      year: meta["DATE"] || meta["YEAR"] || null,
      genre: meta["GENRE"] || null,
    };
  } catch (e) {
    console.warn("Failed parsing OpusTags:", e);
    return null;
  }
}

// --- new: compute duration for Ogg/Opus by reading last Ogg page granule position ---
async function getOpusDuration(filePath) {
  try {
    const stats = statSync(filePath);
    const readSize = Math.min(262144, stats.size); // read up to last 256KB
    const start = Math.max(0, stats.size - readSize);
    const buf = await readFile(filePath, { start, end: stats.size }); // Bun/node supports start/end here

    // Find last OggS page
    const lastOgg = buf.lastIndexOf("OggS");
    if (lastOgg === -1) return null;

    const granuleOffset = lastOgg + 6; // granule position starts 6 bytes after "OggS"
    // Ensure we have 8 bytes for granule position
    if (granuleOffset + 8 > buf.length) return null;

    // readBigUInt64LE is used because granule pos can be large
    const granule = buf.readBigUInt64LE(granuleOffset);
    // Opus/ogg granule is PCM sample count at 48kHz
    const samples = Number(granule > BigInt(Number.MAX_SAFE_INTEGER) ? BigInt(Number.MAX_SAFE_INTEGER) : granule);
    const durationSeconds = samples / 48000;
    return durationSeconds;
  } catch (e) {
    console.warn("Failed to determine opus duration:", e);
    return null;
  }
}
// --- end new ---

const server = Bun.serve({
  port: 3000,
  async fetch(req) {
    const url = new URL(req.url);

    if (url.pathname.startsWith("/api/photo")) {
      const query = url.searchParams.get("query") || "mountains";
      const perPage = parseInt(url.searchParams.get("per_page")) || 10;

      try {
        const result = await client.photos.search({ query, per_page: perPage });
        return new Response(
          JSON.stringify({
            photos: Array.isArray(result.photos) ? result.photos : [],
            total_results: result.total_results || 0,
          }),
          {
            headers: {
              "Content-Type": "application/json",
              "Cache-Control": "public, max-age=300",
            },
          }
        );
      } catch (error) {
        console.error("Error fetching Pexels photos:", error);
        return new Response(JSON.stringify({ photos: [], total_results: 0 }), {
          headers: { "Content-Type": "application/json" },
          status: 200, // ✅ Return success so frontend still runs
        });
      }
    }
    // Handle API endpoint for music files
    if (url.pathname === "/api/music") {
      let files = await readdir("music/", { recursive: true });
      // Filter to only include mp3 files
      files = files.filter((file) =>
        /\.(mp3|wav|ogg|opus|m4a|flac|aac)$/i.test(file)
      );
      files = shuffle(files); // Shuffle the files for variety
      return new Response(JSON.stringify(files), {
        headers: {
          "Content-Type": "application/json",
          "Cache-Control": "public, max-age=300", // Cache API response for 5 minutes
        },
      });
    }

    // Handle metadata extraction endpoint
    if (url.pathname.startsWith("/api/metadata/")) {
      const filename = decodeURIComponent(url.pathname.slice(14)); // Remove "/api/metadata/"
      const filePath = `music/${filename}`;

      if (!existsSync(filePath)) {
        return new Response("File not found", { status: 404 });
      }

      try {
        // Choose appropriate metadata extractor by extension
        const ext = extname(filePath).toLowerCase();
        let extracted = { title: null, artist: null, album: null, year: null, genre: null };

        if (ext === ".opus") {
          extracted = await parseOpusFile(filePath);
        } else {
          // fallback to ID3 parser for mp3 and others that may have ID3
          extracted = await ID3Parser.parseFile(filePath);
        }

        // Try to extract duration for opus files (granule-based)
        let duration = null;
        if (ext === ".opus") {
          duration = await getOpusDuration(filePath);
        }

        // Use filename parsing as fallback
        const filenameMetadata = parseFilenameMetadata(filename);

        // Combine metadata, prioritizing parsed tags over filename parsing
        const metadata = {
          title: extracted.title || filenameMetadata.title,
          artist: extracted.artist || filenameMetadata.artist,
          album: extracted.album || filenameMetadata.album,
          year: extracted.year,
          genre: extracted.genre,
          filename: filename,
          duration: duration !== null ? duration : undefined, // duration in seconds when available
        };

        return new Response(JSON.stringify(metadata), {
          headers: {
            "Content-Type": "application/json",
            "Cache-Control": "public, max-age=3600", // Cache metadata for 1 hour
          },
        });
      } catch (error) {
        console.error(`Error extracting metadata for ${filename}:`, error);

        // Return filename-based metadata as fallback
        const fallbackMetadata = parseFilenameMetadata(filename);
        return new Response(
          JSON.stringify({
            ...fallbackMetadata,
            filename: filename,
          }),
          {
            headers: {
              "Content-Type": "application/json",
              "Cache-Control": "public, max-age=3600",
            },
          }
        );
      }
    }

    // Serve music files with enhanced caching and range request support
    if (url.pathname.startsWith("/music/")) {
      const filePath = decodeURIComponent(url.pathname.slice(1));

      if (!existsSync(filePath)) {
        return new Response("File not found", { status: 404 });
      }

      const stats = statSync(filePath);
      const etag = generateETag(stats);
      const range = req.headers.get("range");
      const ifNoneMatch = req.headers.get("if-none-match");
      // include .opus in audio detection
      const isAudioFile = /\.(mp3|wav|ogg|opus|m4a|flac|aac)$/i.test(filePath);

      // Check if client has cached version
      if (ifNoneMatch === etag) {
        return new Response(null, {
          status: 304,
          headers: {
            ETag: etag,
            "Cache-Control": "public, max-age=31536000, immutable",
          },
        });
      }

      if (range && isAudioFile) {
        // Debug log for range requests
        console.log('Range request for', filePath, 'Range header:', range);

        const bytesPrefix = 'bytes=';
        const rangeStr = range.startsWith(bytesPrefix) ? range.slice(bytesPrefix.length) : range;
        const [startStr, endStr] = rangeStr.split('-');
        let start = startStr === '' ? null : parseInt(startStr, 10);
        let end = endStr === '' ? null : parseInt(endStr, 10);

        // Handle suffix ranges like "bytes=-500" (last 500 bytes)
        if (start === null && end !== null) {
          start = Math.max(stats.size - end, 0);
          end = stats.size - 1;
        } else {
          if (isNaN(start) || start < 0) start = 0;
          if (end === null || isNaN(end) || end >= stats.size) end = stats.size - 1;
        }

        if (start > end || start >= stats.size) {
          return new Response("Range not satisfiable", {
            status: 416,
            headers: {
              "Content-Range": `bytes */${stats.size}`,
            },
          });
        }

        const chunksize = end - start + 1;
        const fileBuf = readFileSync(filePath);
        const chunk = fileBuf.slice(start, end + 1);

        return new Response(chunk, {
          status: 206,
          headers: {
            "Content-Range": `bytes ${start}-${end}/${stats.size}`,
            "Accept-Ranges": "bytes",
            "Content-Length": chunksize.toString(),
            "Content-Type": getContentType(filePath),
            ETag: etag,
            "Cache-Control": "public, max-age=31536000, immutable",
          },
        });
      } else if (isAudioFile) {
        // Regular audio file request with strong caching
        const file = Bun.file(filePath);
        console.log('Serving full audio', filePath, 'Content-Type:', getContentType(filePath), 'Size:', stats.size);
        return new Response(file, {
          headers: {
            "Accept-Ranges": "bytes",
            "Content-Type": getContentType(filePath),
            "Content-Length": stats.size.toString(),
            ETag: etag,
            "Cache-Control": "public, max-age=31536000, immutable", // Cache for 1 year
            Expires: new Date(Date.now() + 31536000000).toUTCString(), // 1 year from now
          },
        });
      } else {
        // Non-audio files
        const file = Bun.file(filePath);
        return new Response(file, {
          headers: {
            ETag: etag,
            "Cache-Control": "public, max-age=3600",
          },
        });
      }
    }

    //serve name
    if (url.pathname === "/api/name") {
      return new Response(
        JSON.stringify({ name: process.env.Name || "Admin" }),
        {
          headers: {
            "Content-Type": "application/json",
            "Cache-Control": "public, max-age=3600",
          },
        }
      );
    }
    //server long lat
    if (url.pathname === "/api/location") {
      return new Response(
        JSON.stringify({
          lat: process.env.LAT || "0",
          long: process.env.LONG || "0",
        }),
        {
          headers: {
            "Content-Type": "application/json",
            "Cache-Control": "public, max-age=3600",
          },
        }
      );
    }

    // Serve index.html with caching enabled
    if (url.pathname === "/") {
      const html = Bun.file("index.html");
      return new Response(html, {
        headers: {
          "Cache-Control": "public, max-age=3600",
          "Accept-Encoding": "gzip, deflate, br",
        },
      });
    }

    // Serve other static files with caching enabled
    const filePath = url.pathname.slice(1);
    if (existsSync(filePath)) {
      const stats = statSync(filePath);
      const etag = generateETag(stats);
      const ifNoneMatch = req.headers.get("if-none-match");

      if (ifNoneMatch === etag) {
        return new Response(null, { status: 304 });
      }

      const file = Bun.file(filePath);
      return new Response(file, {
        headers: {
          "Cache-Control": "public, max-age=3600",
          ETag: etag,
        },
      });
    }
    return new Response("Not found", { status: 404 });
  },
});

console.log(`Server running at http://localhost:${server.port}`);
let files = await readdir("music/", { recursive: true });
// Filter to only include files matching specified audio formats
files = files.filter((file) =>
  /\.(mp3|wav|ogg|opus|m4a|flac|aac)$/i.test(file)
);
console.log("Serving music files:", files);
