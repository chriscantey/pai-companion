#!/usr/bin/env python3
"""Minimal Kokoro TTS HTTP server using KPipeline directly."""

import io
import json
import os
import re
import subprocess
import sys
import numpy as np
import soundfile as sf
from http.server import HTTPServer, BaseHTTPRequestHandler
from kokoro import KPipeline

MODEL = '/app/api/src/models/v1_0/kokoro-v1_0.pth'
VDIR = '/app/api/src/voices/v1_0'
PORT = 7880
MAX_TEXT_LENGTH = 10000
MAX_BODY_SIZE = 1_000_000
VOICE_PATTERN = re.compile(r'^[a-z]{2}_[a-z0-9_]+$')

pipelines = {}
nan_recoveries = 0


def get_pipeline(lang_code):
    """Get or create a pipeline for a language code, with warmup to avoid NaN bug."""
    if lang_code not in pipelines:
        sys.stdout.write(f"Loading pipeline lang='{lang_code}'...\n")
        sys.stdout.flush()
        pipe = KPipeline(lang_code=lang_code, model=MODEL)
        # Warmup: first generation can produce NaN, run a throwaway pass
        warmup_voices = {
            'a': 'af_alloy',   # American
            'b': 'bf_emma',    # British
            'j': 'jf_alpha',   # Japanese
        }
        warmup_voice = warmup_voices.get(lang_code, 'af_alloy')
        try:
            voice = pipe.load_voice(warmup_voice, VDIR)
            for r in pipe("warmup", voice=voice):
                pass
        except Exception:
            pass
        pipelines[lang_code] = pipe
        sys.stdout.write(f"Pipeline '{lang_code}' ready\n")
        sys.stdout.flush()
    return pipelines[lang_code]


def _run_inference(pipe, text, voice):
    """Run TTS inference and return concatenated audio numpy array."""
    chunks = []
    for r in pipe(text, voice=voice):
        chunks.append(r.audio.numpy())
    if not chunks:
        raise RuntimeError("No audio generated")
    return np.concatenate(chunks)


def _audio_to_mp3(audio):
    """Convert numpy audio array to MP3 bytes via WAV + ffmpeg."""
    wav_buf = io.BytesIO()
    sf.write(wav_buf, audio, 24000, format='WAV')
    proc = subprocess.run(
        ['ffmpeg', '-i', 'pipe:0', '-f', 'mp3', '-ab', '128k', '-v', 'quiet', 'pipe:1'],
        input=wav_buf.getvalue(), capture_output=True
    )
    if proc.returncode != 0:
        raise RuntimeError(f"ffmpeg error: {proc.stderr.decode()[:200]}")
    return proc.stdout


def generate_mp3(text, voice_name):
    """Generate MP3 audio bytes. Auto-recovers from NaN by reloading the pipeline."""
    lang_code = voice_name[0]
    pipe = get_pipeline(lang_code)
    voice = pipe.load_voice(voice_name, VDIR)

    audio = _run_inference(pipe, text, voice)

    if not np.isnan(audio).any():
        return _audio_to_mp3(audio)

    # NaN detected: reload pipeline and retry once
    sys.stdout.write(f"NaN detected, reloading pipeline '{lang_code}'...\n")
    sys.stdout.flush()
    pipelines.pop(lang_code, None)
    pipe = get_pipeline(lang_code)
    voice = pipe.load_voice(voice_name, VDIR)

    audio = _run_inference(pipe, text, voice)
    if np.isnan(audio).any():
        raise RuntimeError("NaN in audio output after pipeline reload")

    global nan_recoveries
    nan_recoveries += 1
    sys.stdout.write(f"Pipeline reload fixed NaN (recovery #{nan_recoveries})\n")
    sys.stdout.flush()
    return _audio_to_mp3(audio)


class TTSHandler(BaseHTTPRequestHandler):
    def do_POST(self):
        if self.path == '/tts':
            try:
                try:
                    length = int(self.headers.get('Content-Length', 0))
                except (TypeError, ValueError):
                    self._json(400, {'error': 'Invalid Content-Length'})
                    return
                if length > MAX_BODY_SIZE:
                    self._json(413, {'error': 'Request too large'})
                    return
                try:
                    body = json.loads(self.rfile.read(length))
                except json.JSONDecodeError:
                    self._json(400, {'error': 'Invalid JSON'})
                    return

                text = body.get('text', '')
                voice = body.get('voice', 'af_heart')

                if not text:
                    self._json(400, {'error': 'No text provided'})
                    return
                if len(text) > MAX_TEXT_LENGTH:
                    self._json(400, {'error': f'Text too long (max {MAX_TEXT_LENGTH} chars)'})
                    return
                if not VOICE_PATTERN.match(voice):
                    self._json(400, {'error': f'Invalid voice name: {voice}'})
                    return

                sys.stdout.write(f"TTS: voice={voice} text=\"{text[:60]}...\"\n")
                sys.stdout.flush()

                mp3_bytes = generate_mp3(text, voice)

                self.send_response(200)
                self.send_header('Content-Type', 'audio/mpeg')
                self.send_header('Content-Length', len(mp3_bytes))
                self.end_headers()
                self.wfile.write(mp3_bytes)

                sys.stdout.write(f"  -> {len(mp3_bytes)} bytes MP3\n")
                sys.stdout.flush()

            except Exception as e:
                sys.stderr.write(f"TTS error: {e}\n")
                self._json(500, {'error': str(e)})
        elif self.path == '/voices':
            try:
                voices = sorted([
                    f.replace('.pt', '')
                    for f in os.listdir(VDIR)
                    if f.endswith('.pt') and not f.startswith('.')
                ])
                self._json(200, {'voices': voices})
            except Exception as e:
                self._json(500, {'error': str(e)})
        else:
            self._json(404, {'error': 'Not found'})

    def do_GET(self):
        if self.path == '/health':
            self._json(200, {
                'status': 'ok',
                'model': 'kokoro-v1_0',
                'pipelines_loaded': list(pipelines.keys()),
                'nan_recoveries': nan_recoveries,
                'port': PORT
            })
        elif self.path == '/voices':
            voices = sorted([
                f.replace('.pt', '')
                for f in os.listdir(VDIR)
                if f.endswith('.pt') and not f.startswith('.')
            ])
            self._json(200, {'voices': voices})
        else:
            self._json(404, {'error': 'Not found'})

    def _json(self, status, data):
        body = json.dumps(data).encode()
        self.send_response(status)
        self.send_header('Content-Type', 'application/json')
        self.send_header('Content-Length', len(body))
        self.send_header('Access-Control-Allow-Origin', '*')
        self.end_headers()
        self.wfile.write(body)

    def log_message(self, format, *args):
        pass


if __name__ == '__main__':
    sys.stdout.write(f"Kokoro TTS server starting on port {PORT}\n")
    sys.stdout.flush()
    get_pipeline('a')

    server = HTTPServer(('0.0.0.0', PORT), TTSHandler)
    sys.stdout.write(f"Kokoro TTS server ready on port {PORT}\n")
    sys.stdout.flush()
    server.serve_forever()
