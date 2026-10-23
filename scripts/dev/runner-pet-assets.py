"""Package native-generated 3x2 sheets. Requires Pillow; video needs imageio-ffmpeg.

Run from the repository root: python scripts/dev/runner-pet-assets.py
This only crops/aligns existing art; it never generates or draws character frames.
"""
from pathlib import Path
import json
import math
import subprocess

from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[2]
SOURCE = ROOT / "output/imagegen/runner-pet-animation-v1"
DEST = ROOT / "web/public/pets/runner-v1"
TIMINGS = {"idle": 3000, "tap": 1200, "happy": 1800, "bored": 3600,
           "celebrate": 1800, "working": 3000, "waiting": 2400, "offline": 4800, "drag": 2000}
LABELS = {"idle": "待机", "tap": "点击互动", "happy": "开心", "bored": "无聊",
          "celebrate": "完成欢呼", "working": "工作中", "waiting": "等待回应", "offline": "离线休息", "drag": "拖动"}
SIZE = (256, 384)


def split_sheet(path):
    sheet = Image.open(path).convert("RGBA")
    frames = []
    for row in range(2):
        for col in range(3):
            frame = sheet.crop((round(col * sheet.width / 3), round(row * sheet.height / 2),
                                round((col + 1) * sheet.width / 3), round((row + 1) * sheet.height / 2)))
            alpha = frame.getchannel("A").point(lambda a: 0 if a < 16 else a)
            frame.putalpha(alpha)
            bounds = alpha.point(lambda a: 255 if a >= 128 else 0).getbbox()
            if not bounds:
                raise ValueError(f"Empty frame in {path}")
            frames.append((frame, bounds))
    return frames


def main():
    DEST.mkdir(parents=True, exist_ok=True)
    sheets = {state: split_sheet(SOURCE / "raw" / f"{state}.png")
              for state in TIMINGS if (SOURCE / "raw" / f"{state}.png").exists()}
    if not sheets:
        raise ValueError("No generated sheets found")
    # One scale per sheet, not per pose: nodding must not enlarge the character.
    normalized = {}
    for state, frames in sheets.items():
        scale = min(340 / max(b[3] - b[1] for _, b in frames),
                    220 / max(b[2] - b[0] for _, b in frames))
        result = []
        for frame, bounds in frames:
            # Grounded motions: align feet, leaving headroom. Airborne animations
            # need a shared floor anchor rather than this per-frame foot anchor.
            feet = frame.getchannel("A").point(lambda a: 255 if a >= 128 else 0)
            foot_bounds = feet.crop((0, bounds[3] - 40, frame.width, bounds[3])).getbbox()
            center = (foot_bounds[0] + foot_bounds[2]) / 2
            resized = frame.resize((round(frame.width * scale), round(frame.height * scale)), Image.Resampling.LANCZOS)
            canvas = Image.new("RGBA", SIZE)
            canvas.alpha_composite(resized, (round(SIZE[0] / 2 - center * scale), round(366 - bounds[3] * scale)))
            result.append(canvas)
        normalized[state] = result
        atlas = Image.new("RGBA", (SIZE[0] * 6, SIZE[1]))
        for i, frame in enumerate(result):
            atlas.alpha_composite(frame, (i * SIZE[0], 0))
        atlas.save(DEST / f"{state}.webp", lossless=True, method=6)
        result[0].save(SOURCE / f"{state}-preview.webp", save_all=True, append_images=result[1:],
                       duration=TIMINGS[state] // 6, loop=0, lossless=True)
    (SOURCE / "manifest.json").write_text(json.dumps({
        "source": "ChatGPT subscription native image generation",
        "frameSize": SIZE, "frameCount": 6, "available": list(sheets),
        "missing": [state for state in TIMINGS if state not in sheets],
        "durationMs": {state: TIMINGS[state] for state in sheets},
    }, indent=2) + "\n", encoding="utf-8")
    try:
        import imageio_ffmpeg
    except ImportError:
        print("Atlases and animated WebP previews saved; install imageio-ffmpeg for MP4.")
        return
    chinese_font = Path("C:/Windows/Fonts/msyh.ttc")
    font = ImageFont.truetype(str(chinese_font), 22) if chinese_font.exists() else ImageFont.load_default(size=22)
    columns = min(4, len(sheets))
    width, height = 320 * columns, 480 * math.ceil(len(sheets) / columns)
    command = [imageio_ffmpeg.get_ffmpeg_exe(), "-y", "-loglevel", "error", "-f", "rawvideo",
               "-vcodec", "rawvideo", "-pix_fmt", "rgb24", "-s", f"{width}x{height}", "-r", "30",
               "-i", "-", "-an", "-vcodec", "libx264", "-pix_fmt", "yuv420p", "-movflags", "+faststart",
               str(SOURCE / "available-animations.mp4")]
    with subprocess.Popen(command, stdin=subprocess.PIPE) as process:
        for tick in range(180):
            preview = Image.new("RGB", (width, height), "#f5f2ee")
            draw = ImageDraw.Draw(preview)
            for i, (state, frames) in enumerate(normalized.items()):
                x, y = (i % columns) * 320, (i // columns) * 480
                index = int((tick * 1000 / 30) % TIMINGS[state] * 6 / TIMINGS[state])
                frame = frames[index]
                preview.paste(frame, (x + 32, y + 60), frame)
                draw.text((x + 32, y + 20), LABELS[state] if chinese_font.exists() else state.upper(), fill="#453e3c", font=font)
            if tick == 27:
                preview.save(SOURCE / "all-states-preview.jpg", quality=95)
            process.stdin.write(preview.tobytes())
        process.stdin.close()
        if process.wait():
            raise RuntimeError("Preview encoding failed")
    print(json.dumps({state: (DEST / f"{state}.webp").stat().st_size for state in sheets}))


if __name__ == "__main__":
    main()
