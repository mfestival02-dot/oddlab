"""Poly Haven의 CC0 문구 모델(stationery_supplies)에서 지우개 하나만 뽑아 작은 파일로 만든다.

  python3 tools/import_eraser_model.py <모델.gltf가 있는 폴더> <2k 노멀맵 jpg>

내려받기(1k glTF, 2k 노멀맵):
  https://polyhaven.com/a/stationery_supplies  (CC0)

결과:
  assets/models/eraser_mesh.json  위치(단위: 게임 단위=10cm), 노멀, UV(잘라 낸 노멀맵 기준 0~1), 삼각형
  assets/models/eraser_normal.jpg 지우개 부분만 잘라 낸 노멀맵(색 지도와 거칠기 지도는 원본에 글자가 찍혀 있어 쓰지 않는다)
"""
import json, struct, sys, os
from PIL import Image

src, normal_jpg = sys.argv[1], sys.argv[2]
gl = json.load(open(os.path.join(src, [f for f in os.listdir(src) if f.endswith('.gltf')][0])))
binf = open(os.path.join(src, gl['buffers'][0]['uri'].split('/')[-1]), 'rb').read()
node = next(n for n in gl['nodes'] if n.get('name', '').endswith('_eraser'))
prim = gl['meshes'][node['mesh']]['primitives'][0]

def acc(i):
    a = gl['accessors'][i]; bv = gl['bufferViews'][a['bufferView']]
    o = bv.get('byteOffset', 0) + a.get('byteOffset', 0)
    n = {'SCALAR': 1, 'VEC2': 2, 'VEC3': 3}[a['type']]; f = {5126: 'f', 5123: 'H', 5125: 'I'}[a['componentType']]
    st = bv.get('byteStride', n * struct.calcsize(f))
    return [struct.unpack_from('<' + f * n, binf, o + k * st) for k in range(a['count'])]

P = acc(prim['attributes']['POSITION']); N = acc(prim['attributes']['NORMAL']); UV = acc(prim['attributes']['TEXCOORD_0'])
I = [i[0] for i in acc(prim['indices'])]
us = [u for u, v in UV]; vs = [v for u, v in UV]
img = Image.open(normal_jpg); W, H = img.size
pad = 3
box = (int(min(us) * W) - pad, int(min(vs) * H) - pad, int(max(us) * W) + pad + 1, int(max(vs) * H) + pad + 1)
img.crop(box).save('assets/models/eraser_normal.jpg', quality=88)
bw, bh = box[2] - box[0], box[3] - box[1]
out = {
    'source': 'Poly Haven, Stationery Supplies (CC0), eraser part',
    'pos': [round(c * 10, 5) for v in P for c in v],           # 미터 → 게임 단위(10cm)
    'nrm': [round(c, 4) for v in N for c in v],
    'uv': [round(x, 5) for u, v in UV for x in ((u * W - box[0]) / bw, (v * H - box[1]) / bh)],
    'idx': I,
}
os.makedirs('assets/models', exist_ok=True)
json.dump(out, open('assets/models/eraser_mesh.json', 'w'), separators=(',', ':'))
print(len(P), 'vertices', len(I) // 3, 'triangles', 'normal crop', box)
