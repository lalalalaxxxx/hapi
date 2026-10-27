"""Package subscription-generated Bobo dance poses into 24 fps / 10 s atlases.

Requires Pillow, numpy, OpenCV and imageio-ffmpeg. No image or music generation API.
Local reference clips are used only for the two requested 10-second BGM excerpts.
"""
from pathlib import Path
import importlib.util
import json
import subprocess
import cv2
import numpy as np
from PIL import Image, ImageDraw
import imageio_ffmpeg

ROOT = Path(__file__).resolve().parents[2]
SOURCE = ROOT / 'output/imagegen/bobo-dances-v1'
DEST = ROOT / 'web/public/pets/bobo-dance-v1'
SIZE = (160, 240)
FPS = 24
FRAMES = 240
CLIPS = {
    'pendulum': {'title': '2 Phút Hơn (KAIZ Remix)', 'start': 52.0, 'beat': .46875,
                 'reference': 'https://www.bilibili.com/video/BV1sq4y1k7PD/'},
    'bounce': {'title': 'We Are Perfect', 'start': 3.2, 'beat': .5,
               'reference': 'https://www.bilibili.com/video/BV1HK4y1R7km/'},
}
spec = importlib.util.spec_from_file_location('smooth', Path(__file__).with_name('runner-pet-smooth.py'))
smooth = importlib.util.module_from_spec(spec)
spec.loader.exec_module(smooth)


def poses(path):
    source = np.asarray(Image.open(path).convert('RGBA')).copy()
    source[source[:, :, 3] < 16] = 0
    source[:, :, 3][source[:, :, 3] > 245] = 255
    count, labels, stats, centers = cv2.connectedComponentsWithStats((source[:, :, 3] >= 16).astype('uint8'))
    objects = [i for i in range(1, count) if stats[i, 4] > 4000]
    assert len(objects) == 16, f'{path}: expected 16 poses, got {len(objects)}'
    scale = min(224 / max(stats[i, 3] for i in objects), 150 / max(stats[i, 2] for i in objects))
    output = {}
    for label in objects:
        cx, cy = centers[label]
        col, row = int(cx / (source.shape[1] / 4)), int(cy / (source.shape[0] / 4))
        index = row * 4 + col
        assert index not in output
        x, y, w, h, _ = stats[label]
        crop = source[y:y+h, x:x+w].copy()
        crop[labels[y:y+h, x:x+w] != label] = 0
        resized = Image.fromarray(crop).resize((round(w*scale), round(h*scale)), Image.Resampling.LANCZOS)
        frame = Image.new('RGBA', SIZE)
        frame.alpha_composite(resized, (round(80 + (x - (col+.5)*source.shape[1]/4)*scale), round(232 - h*scale)))
        output[index] = frame
    return [output[i] for i in range(16)]


def render(keys, beat):
    prepared = [smooth.prepare(frame) for frame in keys]
    flow = cv2.DISOpticalFlow_create(cv2.DISOPTICAL_FLOW_PRESET_MEDIUM)
    flows = [(flow.calc(prepared[i][1], prepared[(i+1)%16][1], None),
              flow.calc(prepared[(i+1)%16][1], prepared[i][1], None)) for i in range(16)]
    output = []
    for tick in range(FRAMES):
        position = tick / FPS / (beat / 2)
        index = int(position) % 16
        fraction = position % 1
        a, b = prepared[index][0], prepared[(index+1)%16][0]
        frame = smooth.tween(a, b, *flows[index], fraction)
        output.append(frame)
    # Finish at a stable pose rather than cutting mid-gesture.
    tail = smooth.prepare(output[-13])
    final = prepared[0]
    forward = flow.calc(tail[1], final[1], None)
    backward = flow.calc(final[1], tail[1], None)
    for i in range(12):
        t = (i+1)/12
        output[-12+i] = smooth.tween(tail[0], final[0], forward, backward, t*t*(3-2*t))
    return output


def main():
    DEST.mkdir(parents=True, exist_ok=True)
    ffmpeg = imageio_ffmpeg.get_ffmpeg_exe()
    report = {}
    for name, config in CLIPS.items():
        keys = poses(SOURCE / f'{name}.png')
        contact = Image.new('RGBA', (SIZE[0]*4, SIZE[1]*4))
        for i, frame in enumerate(keys): contact.alpha_composite(frame, (i%4*SIZE[0], i//4*SIZE[1]))
        contact.save(SOURCE / f'{name}-cutouts.png')
        frames = render(keys, config['beat'])
        atlas = Image.new('RGBA', (SIZE[0]*16, SIZE[1]*15))
        for i, frame in enumerate(frames): atlas.alpha_composite(frame, (i%16*SIZE[0], i//16*SIZE[1]))
        atlas.save(DEST / f'{name}.webp', quality=90, method=6)
        assert (DEST / f'{name}.webp').stat().st_size < 3*1024*1024
        pcm = subprocess.check_output([ffmpeg, '-v', 'error', '-ss', str(config['start']), '-i', str(SOURCE / f'{name}-reference.mp4'),
            '-t', '10', '-vn', '-af', 'loudnorm=I=-20:TP=-2:LRA=11,afade=t=in:d=0.08,afade=t=out:st=9.65:d=0.35',
            '-ar', '24000', '-ac', '1', '-f', 'f32le', '-'])
        samples = np.frombuffer(pcm, dtype=np.float32)[:240000]
        samples = np.pad(samples, (0, 240000-len(samples)))
        # Raw PCM removes input-container timestamps and pins gapless MP3 length to 10 s.
        subprocess.run([ffmpeg, '-y', '-v', 'error', '-f', 'f32le', '-ar', '24000', '-ac', '1', '-i', '-',
                        '-b:a', '96k', str(DEST / f'{name}.mp3')], input=samples.tobytes(), check=True)
        # Preview uses the exact same frames and music as the application.
        command = [ffmpeg, '-y', '-v', 'error', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-s', '480x720', '-r', str(FPS),
            '-i', '-', '-i', str(DEST / f'{name}.mp3'), '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-c:a', 'aac',
            '-t', '10', '-movflags', '+faststart', str(SOURCE / f'{name}-preview.mp4')]
        with subprocess.Popen(command, stdin=subprocess.PIPE) as process:
            for frame in frames:
                canvas = Image.new('RGB', (480,720), '#f2efeb')
                resized = frame.resize((400,600), Image.Resampling.LANCZOS)
                canvas.paste(resized, (40,60), resized)
                process.stdin.write(canvas.tobytes())
            process.stdin.close()
            assert process.wait() == 0
        report[name] = {**config, 'durationMs': 10000, 'fps': FPS, 'frames': FRAMES,
                        'keyframes': 16, 'atlasBytes': (DEST/f'{name}.webp').stat().st_size}
        print(name, json.dumps(report[name], ensure_ascii=True), flush=True)
    (DEST / 'manifest.json').write_text(json.dumps({'source': 'Subscription built-in image_gen keyframes; optical-flow inbetweens',
        'frameSize': SIZE, 'columns': 16, 'animations': report}, indent=2, ensure_ascii=False)+'\n', encoding='utf-8', newline='\n')


if __name__ == '__main__':
    main()
