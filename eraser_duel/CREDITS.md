# 쓴 외부 자료

| 자료 | 쓴 부분 | 만든 이 · 출처 | 라이선스 |
|---|---|---|---|
| Stationery Supplies (3D 모델) | 지우개 하나의 모양(정점 76개, UV)과 그 부분 노멀맵(2K에서 잘라 냄) → `assets/models/eraser_mesh.json`, `assets/models/eraser_normal.jpg` | Mateusz Sadek, Poly Haven — https://polyhaven.com/a/stationery_supplies | CC0 1.0 (퍼블릭 도메인) |
| Gaegu (Regular, Bold) | 손글씨풍 글꼴 | The Gaegu Project Authors — https://github.com/google/fonts/tree/main/ofl/gaegu | SIL OFL 1.1 (`assets/gaegu-OFL.txt`) |

## 지우개 모델을 어떻게 썼나

- 원본 묶음에서 지우개(`stationery_supplies_eraser`)만 뽑았다: `python3 tools/import_eraser_model.py <glTF 폴더> <2K 노멀맵>`.
- 원본의 색 지도와 거칠기 지도에는 가상의 상표 글자가 찍혀 있어 쓰지 않았다. 색·때·연필 자국은 게임이 모델 UV 위에 직접 그린다.
- 직육면체 지우개 11종이 이 모양을 쓴다. 종류마다 충돌 상자 크기에 맞춰 늘리되 모서리 폭은 원본 비율을 지키고(모서리가 각진 새것은 좁게, 닳은 것은 넓게), 종이 띠 밖으로 나온 끝을 더 둥글게 닳게 했다.
- 띠지 그림, 모양 지우개 7종(곰·토끼·거북이·레슬러·덩치·육각·삼각)의 곡면과 무늬, 고무 잔 패임 노멀맵은 코드로 만든 것이다.

## 받으려 했지만 쓰지 못한 곳

이 작업 환경의 네트워크에서 Kenney, Quaternius, Sketchfab, Poly Pizza는 접속이 막혔고, ambientCG는 목록은 보이지만 내려받기 서버가 막혔다. 그래서 동물·레슬링 모양 지우개는 외부 모델 없이 만들었다. 납작한 실루엣 지우개라 입체 동물 모델은 충돌 모양과 맞지 않기도 하다.

실제 상표·브랜드·캐릭터는 쓰지 않았다.
