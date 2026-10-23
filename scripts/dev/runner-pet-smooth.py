"""Interpolate existing generated artwork, without image API calls.

Requires Pillow, numpy, opencv-python-headless. Each loop is 48 frames / 2s.
Original six-frame atlases stay intact. Outputs native animated WebP + posters.
"""
from pathlib import Path
import json
import cv2
import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parents[2]
SOURCE = ROOT / 'web/public/pets/runner-v1'
DEST = ROOT / 'web/public/pets/runner-v2'
STATES = ['idle', 'tap', 'happy', 'bored', 'celebrate', 'working', 'waiting', 'offline', 'drag']
SIZE = (192, 288)


def prepare(image):
    rgba = np.asarray(image, dtype=np.float32) / 255
    rgba[:, :, :3] *= rgba[:, :, 3:4]
    composite = np.clip((rgba[:, :, :3] + 1 - rgba[:, :, 3:4]) * 255, 0, 255).astype(np.uint8)
    return rgba, cv2.cvtColor(composite, cv2.COLOR_RGB2GRAY)


def tween(a, b, forward, backward, t):
    h, w = a.shape[:2]
    x, y = np.meshgrid(np.arange(w, dtype=np.float32), np.arange(h, dtype=np.float32))
    # Bidirectional optical flow moves matching contours before blending.
    wa = cv2.remap(a, x - t * forward[:, :, 0], y - t * forward[:, :, 1], cv2.INTER_LINEAR,
                   borderMode=cv2.BORDER_CONSTANT)
    wb = cv2.remap(b, x - (1 - t) * backward[:, :, 0], y - (1 - t) * backward[:, :, 1], cv2.INTER_LINEAR,
                   borderMode=cv2.BORDER_CONSTANT)
    # Where flow cannot match an occluded hand/edge, do not blend two distinct
    # silhouettes into a translucent duplicate. Prefer the nearer key pose.
    mismatch = np.max(np.abs(wa - wb), axis=2, keepdims=True) > .12
    weight = np.where(mismatch, float(t >= .5), t)
    rgba = wa * (1 - weight) + wb * weight
    alpha = rgba[:, :, 3:4]
    rgba[:, :, :3] = np.divide(rgba[:, :, :3], alpha, out=np.zeros_like(rgba[:, :, :3]), where=alpha > .005)
    rgba[alpha[:, :, 0] < .03] = 0
    return Image.fromarray(np.clip(rgba * 255, 0, 255).astype(np.uint8))


def main():
    DEST.mkdir(parents=True, exist_ok=True)
    (DEST / 'static').mkdir(exist_ok=True)
    report = {}
    for state in STATES:
        path = SOURCE / f'{state}.webp'
        if not path.exists():
            continue
        atlas = Image.open(path).convert('RGBA')
        frames = [atlas.crop((i * 256, 0, (i + 1) * 256, 384)).resize(SIZE, Image.Resampling.LANCZOS) for i in range(6)]
        if state == 'tap':
            # The original bow jumps abruptly away from the cheek-touch pose.
            # Return through an existing matching pose instead of accelerating it.
            frames = [frames[i] for i in [0, 1, 2, 3, 2, 5]]
        prepared = [prepare(frame) for frame in frames]
        flow = cv2.DISOpticalFlow_create(cv2.DISOPTICAL_FLOW_PRESET_MEDIUM)
        output = []
        for i in range(6):
            a, ga = prepared[i]
            b, gb = prepared[(i + 1) % 6]
            forward = flow.calc(ga, gb, None)
            backward = flow.calc(gb, ga, None)
            for step in range(8):
                # Gentle easing through each pose rather than a six-pose snap.
                t = step / 8
                t = t * t * (3 - 2 * t)
                output.append(frames[i] if step == 0 else tween(a, b, forward, backward, t))
        durations = [round((i + 1) * 2000 / 48) - round(i * 2000 / 48) for i in range(48)]
        frames[0].save(DEST / 'static' / f'{state}.webp', lossless=True)
        pending = DEST / f'{state}.pending.webp'
        output[0].save(pending, save_all=True, append_images=output[1:],
                       duration=durations, loop=0, quality=88, method=4)
        pending.replace(DEST / f'{state}.webp')
        report[state] = {'frames': 48, 'durationMs': 2000, 'fps': 24, 'bytes': (DEST / f'{state}.webp').stat().st_size}
        print(state, report[state], flush=True)
    (DEST / 'manifest.json').write_text(json.dumps({'source': 'Original native-generated art with optical-flow interpolation', 'animations': report}, indent=2) + '\n')


if __name__ == '__main__':
    main()
