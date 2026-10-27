"""Package subscription-generated Bobo dance poses into 24 fps / 10 s atlases.

Requires Pillow, numpy, OpenCV and imageio-ffmpeg. No image or music generation API.
Local reference clips provide the two requested 10-second BGM tracks.
"""
from pathlib import Path
import importlib.util
import argparse
import json
import subprocess
import cv2
import numpy as np
from PIL import Image
import imageio_ffmpeg

ROOT = Path(__file__).resolve().parents[2]
SOURCE = ROOT / 'output/imagegen/bobo-dances-v1'
PREVIEWS = ROOT / 'output/imagegen/bobo-pendulum-v4'
DEST = ROOT / 'web/public/pets/bobo-dance-v2'
SIZE = (160, 240)
FPS = 24
FRAMES = 240
CLIPS = {
    'pendulum': {'title': 'User-provided pendulum reference soundtrack', 'start': 2.9, 'beat': .46875,
                 # Generated cells are not chronological; order by the visible weight transfer.
                 'poseIndices': [7, 5, 6, 1, 0, 1, 2, 5], 'cycleBeats': 2, 'gridRows': 2,
                 'beatOffsetSeconds': .058, 'audioDurationSeconds': 10,
                 'audioSource': 'output/imagegen/bobo-pendulum-v3/reference.mp4',
                 'artSource': 'output/imagegen/bobo-pendulum-v3/pendulum.png',
                 'assetName': 'pendulum-v4', 'anchorFeet': True,
                 'motionReference': 'https://www.bilibili.com/video/BV147dYBLEqd/',
                 'reference': 'https://www.bilibili.com/video/BV147dYBLEqd/'},
    'bounce': {'title': 'We Are Perfect', 'start': 9.5, 'beat': .5,
               'hookBeats': 8, 'poseIndices': [6, 7, 8, 9],
               'reference': 'https://www.bilibili.com/video/BV1HK4y1R7km/'},
}
spec = importlib.util.spec_from_file_location('smooth', Path(__file__).with_name('runner-pet-smooth.py'))
smooth = importlib.util.module_from_spec(spec)
spec.loader.exec_module(smooth)


def poses(path, anchor_feet=False, rows=4):
    source = np.asarray(Image.open(path).convert('RGBA')).copy()
    source[source[:, :, 3] < 16] = 0
    source[:, :, 3][source[:, :, 3] > 245] = 255
    count, labels, stats, centers = cv2.connectedComponentsWithStats((source[:, :, 3] >= 16).astype('uint8'))
    objects = [i for i in range(1, count) if stats[i, 4] > 4000]
    expected = 4 * rows
    assert len(objects) == expected, f'{path}: expected {expected} poses, got {len(objects)}'
    scale = min(224 / max(stats[i, 3] for i in objects), 150 / max(stats[i, 2] for i in objects))
    output = {}
    for label in objects:
        cx, cy = centers[label]
        col, row = int(cx / (source.shape[1] / 4)), int(cy / (source.shape[0] / rows))
        index = row * 4 + col
        assert index not in output
        x, y, w, h, _ = stats[label]
        crop = source[y:y+h, x:x+w].copy()
        crop[labels[y:y+h, x:x+w] != label] = 0
        anchor_x = (col+.5)*source.shape[1]/4
        if anchor_feet:
            # Register the stance, not the pelvis: keep the generated thigh/hip travel.
            foot_x = np.where(crop[round(h*.93):, :, 3] >= 128)[1]
            assert len(foot_x), f'{path}: pose {index} has no visible feet'
            anchor_x = x + (foot_x.min() + foot_x.max()) / 2
        resized = Image.fromarray(crop).resize((round(w*scale), round(h*scale)), Image.Resampling.LANCZOS)
        frame = Image.new('RGBA', SIZE)
        frame.alpha_composite(resized, (round(80 + (x - anchor_x)*scale), round(232 - h*scale)))
        output[index] = frame
    return [output[i] for i in range(expected)]


def render(keys, beat, cycle_beats=None, beat_offset=0):
    count = len(keys)
    key_duration = beat * cycle_beats / count if cycle_beats else beat / 2
    prepared = [smooth.prepare(frame) for frame in keys]
    flow = cv2.DISOpticalFlow_create(cv2.DISOPTICAL_FLOW_PRESET_MEDIUM)
    flows = [(flow.calc(prepared[i][1], prepared[(i+1)%count][1], None),
              flow.calc(prepared[(i+1)%count][1], prepared[i][1], None)) for i in range(count)]
    output = []
    for tick in range(FRAMES):
        position = (tick / FPS - beat_offset) / key_duration
        index = int(np.floor(position)) % count
        fraction = position % 1
        a, b = prepared[index][0], prepared[(index+1)%count][0]
        frame = smooth.tween(a, b, *flows[index], fraction)
        output.append(frame)
    return output


def main(only=None):
    DEST.mkdir(parents=True, exist_ok=True)
    PREVIEWS.mkdir(parents=True, exist_ok=True)
    ffmpeg = imageio_ffmpeg.get_ffmpeg_exe()
    manifest = DEST / 'manifest.json'
    report = json.loads(manifest.read_text(encoding='utf-8'))['animations'] if manifest.exists() else {}
    for name, config in CLIPS.items():
        if only and name != only:
            continue
        asset = config.get('assetName', name)
        source_keys = poses(ROOT / config['artSource'] if 'artSource' in config else SOURCE / f'{name}.png',
                            config.get('anchorFeet', False), config.get('gridRows', 4))
        keys = [source_keys[i] for i in config['poseIndices']]
        contact = Image.new('RGBA', (SIZE[0]*4, SIZE[1]*int(np.ceil(len(keys)/4))))
        for i, frame in enumerate(keys): contact.alpha_composite(frame, (i%4*SIZE[0], i//4*SIZE[1]))
        contact.save(PREVIEWS / f'{name}-cutouts.png')
        frames = render(keys, config['beat'], config.get('cycleBeats'), config.get('beatOffsetSeconds', 0))
        atlas = Image.new('RGBA', (SIZE[0]*16, SIZE[1]*15))
        for i, frame in enumerate(frames): atlas.alpha_composite(frame, (i%16*SIZE[0], i//16*SIZE[1]))
        atlas.save(DEST / f'{asset}.webp', quality=90, method=4)
        assert (DEST / f'{asset}.webp').stat().st_size < 3*1024*1024
        # Decode before slicing: reference-container timestamps can shorten a seek.
        audio_source = ROOT / config['audioSource'] if 'audioSource' in config else SOURCE / f'{name}-reference.mp4'
        pcm = subprocess.check_output([ffmpeg, '-v', 'error', '-i', str(audio_source),
            '-vn', '-af', 'loudnorm=I=-20:TP=-2:LRA=11',
            '-ar', '24000', '-ac', '1', '-f', 'f32le', '-'])
        hook_seconds = config['audioDurationSeconds'] if 'audioDurationSeconds' in config else config['hookBeats'] * config['beat']
        hook_length = round(hook_seconds * 24000)
        start = round(config['start'] * 24000)
        hook = np.frombuffer(pcm, dtype=np.float32)[start:start+hook_length].copy()
        assert len(hook) == hook_length, f'{name}: reference hook is truncated'
        # 5 ms edge ramps prevent loop clicks without shortening the beat grid.
        edge = 120
        hook[:edge] *= np.linspace(0, 1, edge)
        hook[-edge:] *= np.linspace(1, 0, edge)
        samples = np.tile(hook, int(np.ceil(240000 / hook_length)))[:240000]
        samples[:1920] *= np.linspace(0, 1, 1920)
        samples[-8400:] *= np.linspace(1, 0, 8400)
        # Raw PCM removes input-container timestamps and pins gapless MP3 length to 10 s.
        subprocess.run([ffmpeg, '-y', '-v', 'error', '-f', 'f32le', '-ar', '24000', '-ac', '1', '-i', '-',
                        '-b:a', '96k', str(DEST / f'{asset}.mp3')], input=samples.tobytes(), check=True)
        # Preview uses the exact same frames and music as the application.
        command = [ffmpeg, '-y', '-v', 'error', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-s', '480x720', '-r', str(FPS),
            '-i', '-', '-i', str(DEST / f'{asset}.mp3'), '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-c:a', 'aac',
            '-t', '10', '-movflags', '+faststart', str(PREVIEWS / f'{name}-preview.mp4')]
        with subprocess.Popen(command, stdin=subprocess.PIPE) as process:
            for frame in frames:
                canvas = Image.new('RGB', (480,720), '#f2efeb')
                resized = frame.resize((400,600), Image.Resampling.LANCZOS)
                canvas.paste(resized, (40,60), resized)
                process.stdin.write(canvas.tobytes())
            process.stdin.close()
            assert process.wait() == 0
        report[name] = {**config, 'durationMs': 10000, 'fps': FPS, 'frames': FRAMES,
                        'keyframes': len(keys), 'hookDurationSeconds': hook_length / 24000,
                        'loopedHook': hook_length < 240000, 'atlasBytes': (DEST/f'{asset}.webp').stat().st_size}
        print(name, json.dumps(report[name], ensure_ascii=True), flush=True)
    (DEST / 'manifest.json').write_text(json.dumps({'source': 'Subscription built-in image_gen keyframes; optical-flow inbetweens',
        'frameSize': SIZE, 'columns': 16, 'animations': report}, indent=2, ensure_ascii=False)+'\n', encoding='utf-8', newline='\n')


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--only', choices=CLIPS, help='Rebuild one dance and preserve the other manifest entry')
    main(parser.parse_args().only)
