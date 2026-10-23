"""Generate the three bundled Mandarin clips once; requires pip install edge-tts.

Uses Microsoft's online Edge speech service (no paid API key). The deployed pet
plays the bundled MP3 files locally and never calls that service at runtime.
"""
import asyncio
from pathlib import Path
import edge_tts

OUTPUT = Path(__file__).resolve().parents[2] / 'web/public/pets/voice-v1'
CLIPS = [
    ('interact', '啊，不要啦。', '-12%', '+8Hz'),
    ('celebrate', '终于做完啦，快来看看吧～', '+3%', '+10Hz'),
    ('bored', '快来陪我玩玩吧。', '-8%', '+8Hz'),
]


async def main():
    OUTPUT.mkdir(parents=True, exist_ok=True)
    for name, text, rate, pitch in CLIPS:
        await edge_tts.Communicate(text, 'zh-CN-XiaoxiaoNeural', rate=rate, pitch=pitch).save(str(OUTPUT / f'{name}.mp3'))


if __name__ == '__main__':
    asyncio.run(main())
