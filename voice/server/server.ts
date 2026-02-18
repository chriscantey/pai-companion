#!/usr/bin/env bun
// PAI Voice Server - Kokoro TTS notification and streaming server
// Drop-in replacement for upstream PAI VoiceServer (http://localhost:8888)
// Accepts POST /notify with { message, title, voice_enabled, voice_name }
// Streams audio to connected WebSocket clients

import { homedir } from "os";
import { join } from "path";
import { existsSync } from "fs";

// Load .env from PAI directory
const paiDir = process.env.PAI_DIR || join(homedir(), '.claude');
const envPath = join(paiDir, '.env');
if (existsSync(envPath)) {
  const envContent = await Bun.file(envPath).text();
  envContent.split('\n').forEach(line => {
    const eqIdx = line.indexOf('=');
    if (eqIdx === -1) return;
    const key = line.substring(0, eqIdx).trim();
    const value = line.substring(eqIdx + 1).trim();
    if (key && !key.startsWith('#')) {
      process.env[key] = value;
    }
  });
}

const PORT = parseInt(process.env.PAI_VOICE_STREAM_PORT || "8888");
const WSS_PORT = parseInt(process.env.PAI_VOICE_WSS_PORT || "8889");

// TLS for remote WebSocket streaming (optional - WSS listener only starts if certs found)
const certsDir = process.env.CERTS_DIR || join(homedir(), 'certs');
const certFile = join(certsDir, 'fullchain.pem');
const keyFile = join(certsDir, 'privkey.pem');
const tlsAvailable = existsSync(certFile) && existsSync(keyFile);
const KOKORO_URL = process.env.KOKORO_URL || "http://kokoro-tts:7880";
const KOKORO_VOICE = process.env.KOKORO_VOICE || "af_heart";

// Track connected WebSocket clients and their last pong time
const wsClients = new Set<any>();
const clientLastPong = new Map<any, number>();

// Heartbeat interval (ms)
const WS_PING_INTERVAL = 30_000;
const WS_STALE_TIMEOUT = 90_000;

// Generate speech using Kokoro local TTS sidecar
async function generateSpeech(text: string, voiceName?: string): Promise<ArrayBuffer> {
  const voice = voiceName || KOKORO_VOICE;
  const url = `${KOKORO_URL}/tts`;

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text, voice }),
    signal: AbortSignal.timeout(15_000),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Kokoro TTS error: ${response.status} - ${errorText}`);
  }

  return await response.arrayBuffer();
}

// Sanitize input for TTS
function sanitizeForSpeech(input: string): string {
  return input
    .replace(/\[[^\]]*\]/g, '')   // Strip bracketed prosody/style hints (e.g. [🎯 focused])
    .replace(/<script/gi, '')
    .replace(/\.\.\//g, '')
    .replace(/[;&|><`$\\]/g, '')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/#{1,6}\s+/g, '')
    .trim()
    .substring(0, 500);
}

const server = Bun.serve({
  port: PORT,
  hostname: '0.0.0.0',

  async fetch(req: Request) {
    const url = new URL(req.url);

    const headers = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    };

    if (req.method === 'OPTIONS') {
      return new Response(null, { headers });
    }

    // WebSocket upgrade for audio streaming
    if (url.pathname === '/stream') {
      const success = server.upgrade(req);
      if (success) {
        return undefined;
      }
    }

    // POST /notify - Voice notification API (upstream-compatible)
    if (url.pathname === '/notify' && req.method === 'POST') {
      try {
        const data = await req.json();
        const title = data.title || "PAI Notification";
        const message = data.message;
        const voiceEnabled = data.voice_enabled !== false;
        const voiceOverride = data.voice_name || data.voice_id || null;

        if (!message || typeof message !== 'string' || message.trim().length === 0) {
          return new Response(
            JSON.stringify({ status: 'error', message: 'No message provided' }),
            { headers: { ...headers, 'Content-Type': 'application/json' }, status: 400 }
          );
        }

        console.log(`Notification: "${title}" - "${message.substring(0, 50)}..."`);

        const cleanedMessage = sanitizeForSpeech(message);

        if (!cleanedMessage) {
          return new Response(
            JSON.stringify({ status: 'error', message: 'Message invalid after sanitization' }),
            { headers: { ...headers, 'Content-Type': 'application/json' }, status: 400 }
          );
        }

        // Determine Kokoro voice (accept override if valid Kokoro format)
        let voice = KOKORO_VOICE;
        if (voiceOverride && /^[a-z]{2}_[a-z]+$/.test(voiceOverride)) {
          voice = voiceOverride;
        }

        // Generate speech if voice enabled
        if (voiceEnabled) {
          console.log(`Generating speech (Kokoro, voice: ${voice})`);

          const audioBuffer = await generateSpeech(cleanedMessage, voice);

          // Broadcast to WebSocket clients with notification metadata
          const wsMessage = JSON.stringify({
            type: 'notification',
            title: title,
            message: cleanedMessage,
            size: audioBuffer.byteLength
          });

          wsClients.forEach(client => {
            try {
              client.send(wsMessage);
              client.send(audioBuffer);
            } catch (err) {
              console.error('Failed to send to client:', err);
              wsClients.delete(client);
            }
          });

          console.log(`Streamed ${audioBuffer.byteLength} bytes to ${wsClients.size} client(s)`);
        } else {
          console.log('Voice disabled, skipping TTS generation');
        }

        return new Response(
          JSON.stringify({ status: 'success', message: 'Notification sent' }),
          { headers: { ...headers, 'Content-Type': 'application/json' }, status: 200 }
        );
      } catch (error: any) {
        console.error('Notification error:', error);
        return new Response(
          JSON.stringify({ status: 'error', message: error.message || 'Internal server error' }),
          { headers: { ...headers, 'Content-Type': 'application/json' }, status: 500 }
        );
      }
    }

    // GET /voices - List available voices (proxied from Kokoro sidecar)
    if (url.pathname === '/voices' && req.method === 'GET') {
      try {
        const response = await fetch(`${KOKORO_URL}/voices`, {
          signal: AbortSignal.timeout(5_000),
        });
        const data = await response.json();
        return new Response(JSON.stringify(data), {
          headers: { ...headers, 'Content-Type': 'application/json' }
        });
      } catch (error: any) {
        return new Response(
          JSON.stringify({ error: 'Could not reach Kokoro sidecar' }),
          { headers: { ...headers, 'Content-Type': 'application/json' }, status: 502 }
        );
      }
    }

    // POST /tts - Direct TTS generation (returns audio)
    if (url.pathname === '/tts' && req.method === 'POST') {
      try {
        const data = await req.json();
        const text = sanitizeForSpeech(data.text || '');
        const voice = data.voice || KOKORO_VOICE;
        if (!text) {
          return new Response(
            JSON.stringify({ error: 'No text provided' }),
            { headers: { ...headers, 'Content-Type': 'application/json' }, status: 400 }
          );
        }
        const audioBuffer = await generateSpeech(text, voice);
        return new Response(audioBuffer, {
          headers: { ...headers, 'Content-Type': 'audio/mpeg' }
        });
      } catch (error: any) {
        return new Response(
          JSON.stringify({ error: error.message }),
          { headers: { ...headers, 'Content-Type': 'application/json' }, status: 500 }
        );
      }
    }

    // Health check
    if (url.pathname === '/health') {
      return new Response(
        JSON.stringify({
          status: 'ok',
          port: PORT,
          clients: wsClients.size,
          tts_provider: 'Kokoro',
          default_voice: KOKORO_VOICE,
          kokoro_status: 'local'
        }),
        { headers: { ...headers, 'Content-Type': 'application/json' } }
      );
    }

    return new Response('PAI Voice Server - POST /notify, GET /health, GET /voices, WS /stream', {
      headers: { ...headers, 'Content-Type': 'text/plain' }
    });
  },

  websocket: {
    open(ws) {
      console.log('WebSocket client connected');
      wsClients.add(ws);
      clientLastPong.set(ws, Date.now());
      ws.send(JSON.stringify({ type: 'connected', clients: wsClients.size }));
    },

    message(ws, message) {
      console.log('Received message from client:', message);
    },

    close(ws) {
      console.log('WebSocket client disconnected');
      wsClients.delete(ws);
      clientLastPong.delete(ws);
    },

    error(ws, error) {
      console.error('WebSocket error:', error);
      wsClients.delete(ws);
      clientLastPong.delete(ws);
    },

    pong(ws) {
      clientLastPong.set(ws, Date.now());
    }
  }
});

// HTTPS/WSS server for remote clients (optional - only starts if certs exist)
let wssServer: any = null;
if (tlsAvailable) {
  wssServer = Bun.serve({
    port: WSS_PORT,
    hostname: '0.0.0.0',
    tls: {
      key: Bun.file(keyFile),
      cert: Bun.file(certFile),
    },

    async fetch(req: Request) {
      const url = new URL(req.url);

      const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
      };

      if (req.method === 'OPTIONS') {
        return new Response(null, { headers });
      }

      if (url.pathname === '/stream') {
        const success = wssServer.upgrade(req);
        if (success) return undefined;
      }

      if (url.pathname === '/health') {
        return new Response(
          JSON.stringify({ status: 'ok', port: WSS_PORT, tls: true, clients: wsClients.size }),
          { headers: { ...headers, 'Content-Type': 'application/json' } }
        );
      }

      return new Response('PAI Voice Server (WSS) - /stream or /health', {
        headers: { ...headers, 'Content-Type': 'text/plain' }
      });
    },

    websocket: {
      open(ws) {
        console.log('WSS client connected (remote)');
        wsClients.add(ws);
        clientLastPong.set(ws, Date.now());
        ws.send(JSON.stringify({ type: 'connected', clients: wsClients.size }));
      },
      message(ws, message) {
        console.log('WSS received message:', message);
      },
      close(ws) {
        console.log('WSS client disconnected');
        wsClients.delete(ws);
        clientLastPong.delete(ws);
      },
      error(ws, error) {
        console.error('WSS error:', error);
        wsClients.delete(ws);
        clientLastPong.delete(ws);
      },
      pong(ws) {
        clientLastPong.set(ws, Date.now());
      }
    }
  });
}

console.log(`PAI Voice Server running on http://0.0.0.0:${PORT}`);
console.log(`TTS Provider: Kokoro (${KOKORO_URL})`);
console.log(`Default voice: ${KOKORO_VOICE}`);
console.log(`POST to http://localhost:${PORT}/notify`);

if (wssServer) {
  console.log(`WSS listener on https://0.0.0.0:${WSS_PORT} (remote streaming)`);
} else {
  console.log(`WSS listener disabled (no certs found)`);
}

// Heartbeat: ping all clients periodically, remove stale connections
setInterval(() => {
  const now = Date.now();
  for (const client of wsClients) {
    const lastPong = clientLastPong.get(client) ?? 0;
    if (now - lastPong > WS_STALE_TIMEOUT) {
      console.log('Removing stale WebSocket client (no pong in 90s)');
      try { client.close(); } catch {}
      wsClients.delete(client);
      clientLastPong.delete(client);
    } else {
      try {
        client.ping();
      } catch {
        console.log('Ping failed, removing client');
        wsClients.delete(client);
        clientLastPong.delete(client);
      }
    }
  }
}, WS_PING_INTERVAL);
