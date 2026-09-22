# Super Cub 110 - 360도 프레임 자리

실제 각도별 사진이 준비되면 여기에 `01.png`, `02.png`, ... 순서로 넣으세요
(0도부터 시계 방향으로, 8장 기준 45도 간격 - 12/16/24/36장으로 늘려도 됩니다).

넣은 뒤에는 `frontend/src/constants/vehicle360.js`의
`VEHICLE_360_FRAMES['/assets/vehicles/super-cub-110.png']` 배열을
이 폴더의 파일 경로 목록으로 바꿔주면 Vehicle360Viewer가 그대로 인식합니다.

지금은 이 폴더가 비어 있습니다 - 기존 측면 사진(`/assets/vehicles/super-cub-110.png`) 한 장만
프레임 1장으로 등록되어 있고, 존재하지 않는 각도 사진을 복제/생성해서 채우지 않았습니다.
