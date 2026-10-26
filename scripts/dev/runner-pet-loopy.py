"""Package the subscription-generated Loopy pose sheet into transparent WebP clips.

Requires Pillow, numpy, opencv-python-headless. No generation/API requests.
Default source: output/imagegen/loopy-pet-v1.png (4x4 transparent pose sheet).
"""
from pathlib import Path
import importlib.util
import json
import math
import argparse
import cv2
import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parents[2]
SOURCE = ROOT / 'output/imagegen/loopy-pet-v1.png'
DEST = ROOT / 'web/public/pets/loopy-v1'
spec = importlib.util.spec_from_file_location('smooth', Path(__file__).with_name('runner-pet-smooth.py'))
smooth = importlib.util.module_from_spec(spec)
spec.loader.exec_module(smooth)
CLIPS = {
    'idle': ([0], 2000),
    'tap': ([0, 12, 12, 3, 0], 2000),
    'happy': ([3, 14, 3, 14], 2000),
    'bored': ([13], 2000),
    'celebrate': ([3, 14, 9, 14, 3], 2000),
    'working': ([2], 2000),
    'waiting': ([2], 2000),
    'offline': ([13], 2000),
    'drag': ([15], 2000),
    'walk': ([4, 5, 6, 7], 1400),
    'jump': ([8, 9, 10], 1000),
    'land': ([11, 0], 320),
    'fall': ([10], 1000),
}


def coherent_sway(premultiplied, phase, amplitude):
    # Transform the entire character with one affine matrix. Dense optical flow
    # between differently turned faces can pin/duplicate the eyes and nose.
    angle = math.sin(phase) * amplitude
    breath = 1 + .008 * math.sin(phase)
    matrix = cv2.getRotationMatrix2D((96, 180), angle, breath)
    rgba = cv2.warpAffine(premultiplied, matrix, (192, 192), flags=cv2.INTER_CUBIC,
                          borderMode=cv2.BORDER_CONSTANT)
    rgba = np.clip(rgba, 0, 1)
    alpha = rgba[:, :, 3:4]
    rgba[:, :, :3] = np.divide(rgba[:, :, :3], alpha, out=np.zeros_like(rgba[:, :, :3]), where=alpha > .005)
    rgba[alpha[:, :, 0] < .03] = 0
    return Image.fromarray(np.clip(rgba * 255, 0, 255).astype(np.uint8))


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--only', choices=list(CLIPS))
    args = parser.parse_args()
    DEST.mkdir(parents=True, exist_ok=True)
    (DEST / 'static').mkdir(exist_ok=True)
    source = np.array(Image.open(SOURCE).convert('RGBA'))
    # Discard nearly invisible background pixels, preserving real antialiased alpha.
    source[source[:, :, 3] < 16] = 0
    source[:, :, 3][source[:, :, 3] >= 245] = 255
    count, labels, stats, centers = cv2.connectedComponentsWithStats((source[:, :, 3] >= 16).astype('uint8'))
    objects = [i for i in range(1, count) if stats[i, 4] > 10000]
    assert len(objects) == 16, f'Expected 16 isolated poses, got {len(objects)}'
    cell_w, cell_h = source.shape[1] / 4, source.shape[0] / 4
    poses = {}
    scale = .54
    for label in objects:
        cx, cy = centers[label]
        col, row = int(cx / cell_w), int(cy / cell_h)
        index = row * 4 + col
        assert index not in poses
        x, y, w, h, _ = stats[label]
        isolated = source[y:y+h, x:x+w].copy()
        isolated[labels[y:y+h, x:x+w] != label] = 0
        crop = Image.fromarray(isolated).resize((round(w*scale), round(h*scale)), Image.Resampling.LANCZOS)
        frame = Image.new('RGBA', (192, 192))
        frame.alpha_composite(crop, (round(96 + (x-(col+.5)*cell_w)*scale), round(182 + (y-(row+1)*cell_h+6)*scale)))
        poses[index] = frame
    prepared = {i: smooth.prepare(frame) for i, frame in poses.items()}
    flow = cv2.DISOpticalFlow_create(cv2.DISOPTICAL_FLOW_PRESET_MEDIUM)
    cache = {}
    manifest = {'character': 'Loopy', 'source': 'Subscription built-in image_gen; 16 poses, optical-flow inbetweens', 'animations': {}}
    if args.only and (DEST / 'manifest.json').exists():
        manifest = json.loads((DEST / 'manifest.json').read_text(encoding='utf-8'))
    for name, (sequence, duration) in CLIPS.items():
        if args.only and name != args.only: continue
        frames = []
        total = max(8, round(duration / 1000 * 24))
        looping = name not in ('jump', 'land')
        for frame_index in range(total):
            pos = frame_index / (total if looping else total-1) * (len(sequence) if looping else len(sequence)-1)
            index = min(len(sequence)-1, int(pos))
            a, b = sequence[index], sequence[(index+1) % len(sequence)] if looping else sequence[min(index+1, len(sequence)-1)]
            t = pos - index
            if a == b:
                frame = poses[a].copy()
            else:
                pair = (a, b)
                if pair not in cache:
                    cache[pair] = (flow.calc(prepared[a][1], prepared[b][1], None), flow.calc(prepared[b][1], prepared[a][1], None))
                frame = smooth.tween(prepared[a][0], prepared[b][0], *cache[pair], t)
            if name in ('idle', 'working'):
                frame = coherent_sway(prepared[sequence[0]][0], frame_index / total * 2 * math.pi,
                                      1.4 if name == 'idle' else .8)
            elif len(sequence) == 1:
                phase = frame_index / total * 2 * math.pi
                if name == 'drag':
                    frame = frame.rotate(math.sin(phase)*4, Image.Resampling.BICUBIC, center=(96, 45))
                else:
                    amount = 1 + math.sin(phase)*.012
                    resized = frame.resize((192, round(192*amount)), Image.Resampling.LANCZOS)
                    frame = Image.new('RGBA', (192, 192))
                    frame.alpha_composite(resized, (0, 192-resized.height))
            frames.append(frame)
        timings = [round((i+1)*duration/total)-round(i*duration/total) for i in range(total)]
        output = DEST / f'{name}.webp'
        frames[0].save(output, save_all=True, append_images=frames[1:], duration=timings, loop=0 if looping else 1, quality=90, method=6)
        if name in ('idle', 'working'):
            # New URLs bypass previously precached distorted clips. Keep the old
            # URL updated too for clients still running the preceding bundle.
            (DEST / f'{name}-stable.webp').write_bytes(output.read_bytes())
        poses[sequence[0]].save(DEST / 'static' / f'{name}.webp', quality=95, method=6)
        manifest['animations'][name] = {'durationMs': duration, 'playbackFrames': total, 'sourcePoses': len(set(sequence)), 'bytes': output.stat().st_size}
        if name in ('idle', 'working'):
            manifest['animations'][name]['method'] = 'Single coherent pose; whole-character affine breathing and sway; no face interpolation'
            manifest['animations'][name]['file'] = f'{name}-stable.webp'
        print(name, duration, total, output.stat().st_size, flush=True)
    (DEST / 'manifest.json').write_text(json.dumps(manifest, indent=2) + '\n', encoding='utf-8', newline='\n')
    # A clean contact sheet for review; original generation remains untouched.
    board = Image.new('RGBA', (768, 768), '#eceff6')
    for i, pose in poses.items(): board.alpha_composite(pose, (i % 4 * 192, i // 4 * 192))
    board.convert('RGB').save(ROOT / 'output/imagegen/loopy-pet-v1-preview.jpg')


if __name__ == '__main__':
    main()
