from __future__ import annotations

from pathlib import Path

from app.services.tts_service import TTSService
from app.services.tutor_service import TutorService
from app.services.whisper_service import WhisperService


INPUT_AUDIO = Path("/home/soulblue/english-tutor/test.wav")
OUTPUT_AUDIO = Path("/home/soulblue/english-tutor/tutor_response.wav")


def main() -> None:
    print("Loading Whisper...")
    whisper = WhisperService()

    print("Loading Kokoro...")
    tts = TTSService()
    tutor = TutorService()

    whisper_result = whisper.transcribe_file(INPUT_AUDIO)

    print("\nYOU SAID:")
    print(whisper_result.transcription)
    print(f"\nWhisper time: {whisper_result.elapsed_seconds:.2f}s")

    print("\nAsking English Tutor...\n")
    tutor_result = tutor.ask(whisper_result.transcription)

    print("\nRAW OLLAMA ANSWER:")
    print(repr(tutor_result.raw_answer))

    print("\nTUTOR RESPONSE:\n")
    print(tutor_result.raw_answer)

    print("\nVOICE RESPONSE:")
    print(tutor_result.voice_response)

    tts_result = tts.synthesize_to_file(
        tutor_result.voice_response,
        OUTPUT_AUDIO,
    )

    total_time = (
        whisper_result.elapsed_seconds
        + tutor_result.elapsed_seconds
        + tts_result.elapsed_seconds
    )

    print("\n========================================")
    print("PERFORMANCE")
    print("========================================")
    print(f"Whisper time: {whisper_result.elapsed_seconds:.2f}s")
    print(f"Ollama time:  {tutor_result.elapsed_seconds:.2f}s")
    print(f"TTS time:     {tts_result.elapsed_seconds:.2f}s")
    print(f"Total time:   {total_time:.2f}s")
    print("\nAudio generated:")
    print(OUTPUT_AUDIO)
    print("========================================")


if __name__ == "__main__":
    main()
