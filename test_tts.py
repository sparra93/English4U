from kokoro import KPipeline
import soundfile as sf

pipeline = KPipeline(lang_code='a')

text = """
Hi! It's great to meet you.
Today we're going to practice your English together.
Tell me something interesting about your day.
"""

generator = pipeline(
    text,
    voice='af_heart',
    speed=1.0
)

audio_chunks = []

for _, _, audio in generator:
    audio_chunks.append(audio)

if not audio_chunks:
    raise RuntimeError("No audio was generated.")

import numpy as np

audio = np.concatenate(audio_chunks)

sf.write(
    "/home/soulblue/english-tutor/tts_test.wav",
    audio,
    24000
)

print("Audio generated: tts_test.wav")
