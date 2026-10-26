"""Generate expressive pet voice clips locally with Qwen3-TTS and a CUDA GPU.

Install qwen-tts and a CUDA PyTorch build in an isolated Python environment.
Download Qwen/Qwen3-TTS-12Hz-1.7B-CustomVoice (including speech_tokenizer) once.
No network requests or paid API calls are made by this script.
"""
import argparse
import json
import os
from pathlib import Path
import time

os.environ['HF_HUB_OFFLINE'] = '1'
os.environ['TOKENIZERS_PARALLELISM'] = 'false'

COMMON = ('用成年女性甜软、娇滴滴的声音说话，像对熟悉的人撒娇。'
          '情绪丰富，带着笑意，声音轻柔但吐字清楚，语调有明显的轻重起伏。'
          '不要平淡朗读，不要机械地拉长每个字，不要气喘、呻吟或耳语。')
CLIPS = {
    'interact': ('啊，不要啦。', COMMON +
        '害羞又有一点点娇嗔。开头的啊是轻快的小惊讶，短暂停顿，然后不要啦说得软糯、俏皮，啦字稍稍拖长并轻轻上扬。'),
    'celebrate': ('终于做完啦，快来看看吧～', COMMON +
        '刚刚完成了一件了不起的事情，特别开心，得意又骄傲地向喜欢的人邀功。'
        '终于做完啦带着雀跃和满足，啦字轻快上扬，停顿一下。快来看看吧像撒娇邀请对方欣赏成果，吧字甜甜地拖一点尾音。'),
    'bored': ('快来陪我玩玩吧。', COMMON +
        '有点无聊，软软地向熟悉的人撒娇求陪伴，有一点点委屈又充满期待。'
        '快来轻柔地呼唤，陪我玩玩重音鲜明、娇俏可爱，吧字稍稍拖长、尾音上扬，像带着笑在央求。'),
}


LOOPY_COMMON = ('用软萌可爱的卡通小动物女声说普通话，声音圆润、明亮、轻盈，音调偏高，带一点鼻音和笑意。'
                '像活泼的小海狸和朋友玩耍，自然口语，吐字清楚，有灵动的轻重和高低变化。'
                '保持同一个角色的音色，不要播音腔，不要成人妩媚气声，不要耳语，不要尖叫。')
LOOPY_CLIPS = {
    'interact': ('嘿嘿，好痒呀！', LOOPY_COMMON +
        '被朋友轻轻摸了摸，忍不住开心地笑。嘿嘿轻快，停一下，好痒呀俏皮上扬，像笑着躲开。'),
    'drag': ('哎呀，我飞起来啦！', LOOPY_COMMON +
        '突然被拎起来，小小惊讶后变得兴奋。哎呀短促圆润，我飞起来啦带着淘气的笑，尾音轻快上扬。'),
    'bored': ('唔，好无聊呀，陪我玩一会儿嘛！', LOOPY_COMMON +
        '趴着等朋友，开头唔轻轻嘟囔，好无聊呀有一点小委屈，后半句马上变得期待，像歪头邀请朋友玩。'),
    'celebrate': ('耶，做好啦！快来看看，我厉害吧！', LOOPY_COMMON +
        '开心地蹦起来庆祝，耶清脆短促，做好啦充满成就感。停一下，快来看看热情邀请，我厉害吧得意又可爱，尾音上扬。'),
}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--model', required=True, type=Path)
    parser.add_argument('--output', required=True, type=Path)
    parser.add_argument('--speakers', nargs='+', default=['Vivian'], choices=['Vivian', 'Serena'])
    parser.add_argument('--pet', choices=['companion', 'loopy'], default='companion')
    parser.add_argument('--clips', nargs='+', choices=list(LOOPY_CLIPS))
    parser.add_argument('--force', action='store_true')
    args = parser.parse_args()
    clips = LOOPY_CLIPS if args.pet == 'loopy' else CLIPS
    if args.clips and any(name not in clips for name in args.clips):
        parser.error('The selected pet does not have all requested clips')
    import torch
    import soundfile as sf
    from qwen_tts import Qwen3TTSModel
    args.output.mkdir(parents=True, exist_ok=True)
    torch.set_num_threads(6)
    torch.manual_seed(42)
    print('Loading local Qwen3-TTS on GPU', flush=True)
    model = Qwen3TTSModel.from_pretrained(str(args.model.resolve()), device_map='cuda:0',
        dtype=torch.bfloat16, attn_implementation='sdpa')
    for speaker in args.speakers:
        for name in args.clips or clips:
            output = args.output / f'{name}-{speaker.lower()}.wav'
            if output.exists() and not args.force:
                continue
            text, instruct = clips[name]
            start = time.time()
            print(f'Generating {speaker}: {name}', flush=True)
            wavs, sr = model.generate_custom_voice(text=text, language='Chinese', speaker=speaker,
                instruct=instruct, max_new_tokens=180, do_sample=True, top_p=0.9, temperature=0.85)
            sf.write(output, wavs[0], sr)
            output.with_suffix('.json').write_text(json.dumps({
                'model': 'Qwen/Qwen3-TTS-12Hz-1.7B-CustomVoice', 'speaker': speaker,
                'text': text, 'instruct': instruct, 'sampleRate': sr, 'duration': len(wavs[0]) / sr,
            }, ensure_ascii=False, indent=2), encoding='utf-8')
            print(f'Saved {output.name}: {len(wavs[0])/sr:.2f}s, generated in {time.time()-start:.1f}s', flush=True)


if __name__ == '__main__':
    main()
