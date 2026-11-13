# Gaegu 글꼴(OFL)을 자주 쓰는 한글 2350자 + 영문·숫자·기호만 남겨 woff2로 줄인다.
# 사용: python3 tools/subset_font.py <Gaegu-Regular.ttf> <Gaegu-Bold.ttf>   (fonttools, brotli 필요)
import sys
from fontTools import subset
hangul = ''.join(bytes([a, b]).decode('euc-kr') for a in range(0xB0, 0xC9) for b in range(0xA1, 0xFF))
text = hangul + ''.join(chr(c) for c in range(0x20, 0x7F)) + '·…—–‘’“”←→↑↓◀▶★☆♥○●×÷%℃'
for src, out in zip(sys.argv[1:3], ['assets/gaegu-regular.woff2', 'assets/gaegu-bold.woff2']):
    opt = subset.Options(); opt.flavor = 'woff2'; opt.layout_features = ['*']; opt.desubroutinize = True
    font = subset.load_font(src, opt)
    s = subset.Subsetter(opt); s.populate(text=text); s.subset(font)
    subset.save_font(font, out, opt)
    print(out)
