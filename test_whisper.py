from faster_whisper import WhisperModel

MODEL_NAME = "distil-large-v3"

model = WhisperModel(
    MODEL_NAME,
    device="cuda",
    compute_type="float16"
)

segments, info = model.transcribe(
    "test.wav",
    language="en",
    beam_size=5,
    vad_filter=True
)

print(f"Detected language: {info.language}")
print()

for segment in segments:
    print(f"[{segment.start:.2f}s -> {segment.end:.2f}s] {segment.text}")
