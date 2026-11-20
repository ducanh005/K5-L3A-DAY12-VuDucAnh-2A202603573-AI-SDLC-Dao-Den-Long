# Sổ Giả Định, Tiêu Chí Nghiệm Thu & Truy Vết Thay Đổi

## Checkpoint 0 (Khung chuẩn bị trước PRD-0)

### Kiến trúc & Tính tất định
- **Giả định CP0-1:** Chế độ headless chạy trên Node.js không cần GPU/trình duyệt; toàn bộ logic game nằm trong `src/core/`.
- **Giả định CP0-2:** Các thông số mẫu ở CP0 (`mapRadius = 24`, `lanternCount = 3`, `cp0-smoke.json`) chỉ phục vụ kiểm tra khung bootstrap và được thay thế bằng thông số PRD-0 + Test Contract v1.0 ở Phase 1.

| ID | Hạng mục CP0 | Tiêu chí nghiệm thu | Bằng chứng |
|---|---|---|---|
| CP0-R1 | Tách Core / Render | `src/core/` compile độc lập, không import `three` hay `window` | `docs/proof/cp0-verification.md` |
| CP0-R2 | Tính tất định | Chạy cùng `seed` & `cp0-smoke.json` 2 lần cho JSON giống hệt | `docs/proof/cp0-verification.md` |

---

## Phase 1 (PRD-0 · Đêm 1 – Đảo Bến & Test Contract v1.0)

### Giải trình giả định cho chỗ PRD-0 để mở
1. **Thông số `tuning` trong `game.contract.json`:**
   - `player_speed = 6` m/s, `carry_capacity = 8`, `lantern_cost = 3`, `lantern_count_night1 = 5` (xếp đều trên vòng tròn bán kính `25m`, với `L1` tại `[0, 0, 25]`).
   - `pickup_radius = 2.4` m, `interact_radius = 3.0` m, `safe_radius = 5` m (đã hiệu chỉnh từ `1.5/5/2.5` lên `2.4/8/3.0` sau vòng chơi thử thực tế để phù hợp góc nhìn thứ ba và giảm tắc túi khi gom đom đóm).
   - `pulse_cost = 1`, `pulse_radius = 6` m, `pulse_stun_s = 3` s, `pulse_push_m = 4` m, `pulse_cooldown_s = 1` s.
   - `night1_duration_s = 300` s, `flames = 3`, `invuln_s = 1.5` s, `hit_drop_ratio = 0.5` (`floor(carried * 0.5)`).
   - `shade_speed = 3.5` m/s, `shade_hit_radius = 1.2` m, `fall_enabled = false` (ranh giới chơi mặc định khóa tại `PLAYABLE_RADIUS = 39m` bên trong đảo `40m`).
   - `score`: `per_mote = 10`, `per_lantern = 100`, `per_stun = 25`, `per_second_left = 0` (chọn `0` để tránh lệch điểm do sai số tick lẻ khi tính thời gian còn lại), `per_flame_left = 50`.
2. **Sinh thực thể mặc định khi không dùng `scenario`:**
   - Khi `random_motes !== false`: sinh tất định `25` đom đóm (`M1`..`M25`) theo `seed` trong bán kính `4m..34m`.
   - Khi `random_shades !== false`: sinh tất định `3` Bóng Mực (`S1`..`S3`) theo `seed` ở bán kính `18m..30m` và giữ cố định danh sách này trong đêm để hành vi test tất định dễ dự đoán (không phát sinh `shade_spawned` ngẫu nhiên giữa chừng).
3. **Thay thế test/scenario cũ từ CP0:**
   - Đã **xóa** `tests/scenarios/cp0-smoke.json` và **cập nhật** toàn bộ `tests/core.test.ts` (trước đây kiểm tra state giả định CP0 `fireflies`/`hp`) vì PRD-0 & Test Contract v1.0 định nghĩa chuẩn schema `motes`, `flames`, `carried`, `frames`, `snapshot/event/end`.

### Bảng truy vết Yêu cầu Phase 1 → Kiểm chứng

| ID | Yêu cầu PRD-0 / Test Contract v1.0 | Tiêu chí nghiệm thu kiểm chứng được | Bằng chứng |
|---|---|---|---|
| P1-R1 | `game.contract.json` & thông số `tuning` | Tồn tại `game.contract.json` bản `1.0`, khớp 100% `DEFAULT_TUNING` | `tests/core.test.ts` (`matches tuning values...`) |
| P1-R2 | Tham số CLI, tick `60Hz`, mã thoát `0` / `2` | Chạy `node dist-headless/cli.js ...` đúng tham số; file input/scenario lỗi trả mã `2` | `tests/core.test.ts`, `scripts/verify.mjs` |
| P1-R3 | Định dạng JSONL (`snapshot`, `event`, `end`) & tất định | Tick 0 có `snapshot`, làm tròn 3 chữ số thập phân, 2 lần chạy khớp byte-for-byte | `docs/proof/phase-1-verification.md` (`p1-collect-and-light`, `p1-pulse-and-win`) |
| P1-R4 | Di chuyển `cam_yaw_deg`, chuẩn hóa vector, nhảy | `move` xoay đúng công thức `x', z'`, chuẩn hóa nếu `>1`, nhảy `false->true` | `tests/core.test.ts` |
| P1-R5 | Nhặt đom đóm, nạp đèn, thắp đèn (`L1`..`L5`) | Nhặt tối đa `8`, nạp từng phần, thắp đủ `3` -> `lantern_lit` | `tests/core.test.ts`, `p1-collect-and-light` |
| P1-R6 | Tỏa sáng (`pulse`), `safe_radius`, va chạm `player_hit` | `pulse` tốn `1`, choáng `3s`, đẩy `4m`; Bóng Mực bị chặn ngoài `safe_radius=5m`; chạm rơi `50%` | `tests/core.test.ts`, `p1-pulse-and-win` |
| P1-R7 | Thắng (`all_lit`), thua (`no_flames`, `dawn`), chơi lại | Phát đúng `game_over` và `end`; phím `R` trong bản 3D reset màn chơi | `tests/core.test.ts`, `src/main.ts` |
| P1-R8 | Giao diện 3D Đêm 1 – Đảo Bến, Mây đội nón lá treo đèn | Mây có nón lá + đèn lồng nhỏ, sương tím đen sáng ấm dần khi thắp đèn, `npm run build` xanh | `src/render/scene.ts`, `npm run build` |

---

## Phase 2 (Ticket-02 · "Ba hòn đảo" & Test Contract v1.1)

### Giải trình thay thế & Giả định biên cho Contract v1.1
1. **Thay thế bộ số liệu & test từ Phase 1 (theo yêu cầu chuẩn hóa Phần 1 của Ticket-02):**
   - `carry_capacity`: đổi từ `8` → `10`; `lantern_cost`: đổi từ `3` → `10`; `pickup_radius`: `2.4` → `1.0`; `interact_radius`: `3.0` → `2.0`; `pulse_cost`: `1` → `3`; `pulse_radius`: `6` → `5`; `pulse_stun_s`: `3` → `2`; `pulse_cooldown_s`: `1` → `3`; `safe_radius`: `5` → `6`; `shade_speed`: `3.5` → `4.0` (Đêm 3: `4.5`); `shade_hit_radius`: `1.2` → `1.0`; `fall_enabled`: `false` → `true`; `per_stun`: `25` → `5`; `per_second_left`: `0` → `2`.
   - **Cập nhật test & scenario cũ:** Cập nhật `tests/core.test.ts`, `p1-collect-and-light` và `p1-pulse-and-win` theo đúng bộ số liệu chuẩn v1.1 và thứ tự 12 bước mới (`+10` điểm cộng tại bước `deposit` thay vì lúc nhặt, cộng thêm các trường `night`, `wind`, `vel`, `grounded`, `invuln`, `dash_cd_s`, `pulse_cd_s`, `charm_s`, `drifters`, `charms` trong snapshot).
2. **Giả định biên được quy ước rõ (theo hướng dẫn Trợ giảng Phase 2):**
   - **`scenario.shades` mặc định `state`:** Nếu `scenario.shades[]` không truyền trường `state`, tự động đặt `chase` nếu khoảng cách XZ tới Mây `<= 12m`, ngược lại đặt `wander`. Bóng Mực mới sinh theo lịch ở Bước 10 mang `state: "spawning"` trong `1` tick rồi chuyển sang `wander`/`chase` từ tick sau.
   - **Điểm `+10` mỗi đom đóm nạp:** Cộng `+10` tại Bước 5 (`deposit`) nhân với số lượng `amount` vừa nạp; khóa `tuning.score.per_mote` giữ nguyên giá trị `10`.
   - **Sự kiện `night_start {night}`:** Phát đúng 1 lần ở `tick = 1` (khi `sim_tick` bắt đầu bước đầu tiên của Đêm).
   - **Lịch Gió mạnh Đêm 3:** Lặp theo chu kỳ `1800` tick (`30s`): tại `sim_tick % 1800 === 1680` (trước `2s`) bật cảnh báo lá bay/âm thanh và chốt hướng ngẫu nhiên `dir_deg` từ PRNG tất định; tại `sim_tick % 1800 === 0` (`1800, 3600, ...`) bật `wind.active = true` kéo dài `300` tick (`5s`), đẩy người chơi `2 m/s`.

### Bảng truy vết Yêu cầu Phase 2 (Acceptance Criteria) → Kiểm chứng

| ID | Yêu cầu Ticket-02 / Contract v1.1 | Tiêu chí nghiệm thu kiểm chứng được | Bằng chứng |
|---|---|---|---|
| P2-R1 | Số liệu chuẩn & `game.contract.json` v1.1 | `contract_version === "1.1"`, toàn bộ `tuning` khớp `DEFAULT_TUNING` | `tests/core.test.ts` |
| P2-R2 | Thứ tự 12 bước mỗi tick & Tạm dừng (`pause`) | `pause` đóng băng `sim_tick`, `time_left_s`, timers trong khi `tick` vẫn tăng và `state === "paused"` | `tests/core.test.ts`, `p2-night3-tiers-wind-pause` |
| P2-R3 | Lướt (`dash`) & Bùa Gió (`C1`, `C2`) | Lướt `14 m/s` trong `12` tick giữ nguyên Y, hồi `90` tick; Bùa Gió cho `7.2 m/s` + lướt 0 hồi chiêu `600` tick | `tests/core.test.ts`, `p2-dash-and-charm` |
| P2-R4 | Gió Lạc (`drifters`) cướp & thả | `carried >= 5` & `<= 15m` -> `chase`, cướp tối đa `3`, trúng Pulse khi `flee` -> `drifter_drop` | `tests/core.test.ts`, `p2-drifter-steal-and-drop` |
| P2-R5 | Địa hình 3 Đêm, Bục nhảy, Gió mạnh, Rơi (`Y<-10`) | Đêm 2 bục nhảy qua Đảo B, rơi cầu mất `1` Ngọn Lửa + hết đom đóm, hồi sinh sau `60` tick; Đêm 3 dốc/tầng/Tháp Chuông/gió | `tests/core.test.ts`, `p2-night2-*`, `p2-night3-*` |
| P2-R6 | Chuỗi 3 Đêm, HUD 10 ô, Cài đặt bền vững, Bảng màu & Âm thanh | Menu → Ông Đăng → Đêm 1–3 → Bình Minh; `localStorage` lưu settings; ánh sáng `0.15 + 0.55*ratio`; mũi tên đèn ngoài màn hình | `src/render/`, kiểm thử Chrome tại `localhost:5173` |
| P2-R7 | Hiệu năng Headless (`<= 30s`) & 3D (`>= 30 FPS`) | Chạy `21.600` tick Đêm 3 `< 30.000 ms`; chơi 1280×720 đạt `>= 30 FPS` | `docs/proof/phase-2-verification.md`, đo FPS trình duyệt |

## Phase 3 (Ticket-03 · Change Request "Đèn cạn dầu" & Test Contract v1.2)

### Giải trình thay thế test cũ & Quyết định Thiết kế (`ADR-001`)
Xem chi tiết thiết kế tại [`docs/notes/adr-001-phase3-lantern-fuel-and-dawn.md`](adr-001-phase3-lantern-fuel-and-dawn.md).
1. **Cập nhật test/scenario cũ bị luật `[THAY THẾ]` làm sai:**
   - Đã **cập nhật** `tests/scenarios/p1-pulse-and-win.scenario.json` (`time_left_s: 2.0`, các đèn đặt `fuel: 90`) vì Ticket-03 bỏ luật thắng sớm `all_lit` và thay bằng `dawn_survived` khi hết giờ.
   - Đã **thay thế** các test đơn vị Phase 1–2 cũ về `score` (`+10/mote`, `per_second_left: 2`, `all_lit`) trong `tests/core.test.ts` bằng bộ test mới khớp công thức điểm & luật thắng `Contract v1.2` (`+5/mote`, `+40 relight`, `+15 pulse drain`, `dawn_survived`, `no_flames` kiểm tra trước `dawn`).
   - Toàn bộ test Phase 2 không bị thay thế (`dash`, `charm`, `drifter`, `jumppad`, `fall`, `Night 3 tiers/wind/pause`, và benchmark Đêm 3 `18,000` ticks) vẫn chạy đầy đủ và giữ nguyên đạt 100%.
2. **Giả định biên Phase 3:**
   - **Đèn `scenario.lanterns` đặt `lit: true` không truyền `fuel`:** Mặc định `fuel: 100` (`6000` fuel_ticks) và `ever_lit: true`; không cộng vào `player.successful_lights`.
   - **Thứ tự xét mục tiêu `wander`:** Khi Mây ở ngoài `12m`, Bóng Mực `wander` ưu tiên đèn sáng `fuel < 30` gần nhất; nếu không có đèn yếu thì đi tuần về phía đèn tắt gần nhất (tie-break theo ID tăng dần `L1 < L2`).

| ID | Yêu cầu Ticket-03 / Contract v1.2 | Tiêu chí nghiệm thu kiểm chứng được | Bằng chứng |
|---|---|---|---|
| P3-R1 | Nhiên liệu đèn `100`, hao `1/s`, châm dầu, `lantern_out`, thắp lại `5` | `fuel_ticks` nguyên `1/60`, `refuel`, tắt ở `0` phát `lantern_out`, thắp lại tốn `5` (+40đ, `relight: true`) | `tests/core.test.ts`, `p3-fuel-refuel-relight` |
| P3-R2 | Đèn `< 30` mất `safe_radius`, Bóng Mực hút `drain` (`5/s`, `fuel_drain` mỗi `60` tick) | Đèn `< 30` cho `wander` tới hút; phát `fuel_drain` ở tick `60`; trúng Pulse `+15`; châm `>= 30` đẩy ra | `tests/core.test.ts`, `p3-shade-drain-and-dawn-win` |
| P3-R3 | Luật thắng `dawn_survived` (`>= ceil(0.6*N)`), thời gian `240/270/300s` | Không thắng sớm khi thắp đủ đèn; kiểm tra `no_flames` trước `dawn`; cộng `50+floor(fuel)` & `50*flames` | `tests/core.test.ts`, `p1-pulse-and-win` |
| P3-R4 | Sức chứa tăng dần `10 + 2 * successful_lights` (tối đa `20`) | `player.capacity` tăng `+2` sau mỗi lần thắp/thắp lại thành công, trần `20` | `tests/core.test.ts`, `p3-fuel-refuel-relight` |
| P3-R5 | Chế độ mù màu & phân biệt đèn không cần màu | Bật "Bảng màu dễ phân biệt" lưu `localStorage`, `#00B3FF` cho Bóng Mực, `#FFFFFF + ⚠`; đèn tắt xẹp `20%` + vết rách, `<30` nhấp nháy `1 Hz` | `src/render/scene.ts`, `hud.ts`, Chrome QA |

## Phase 4 (Ticket-04 · "Bình minh: phát hành v1.0.0" & Test Contract v1.3)

### Giải trình thiết kế & Giả định biên cho Contract v1.3
1. **Cảnh Benchmark (`bench.mjs`, `createBenchWorld`, `stepBenchWorld`, `GameScene(..., true)`):**
   - Trong chế độ `?bench=1`, `GameScene` tắt hoàn toàn các asset sáng tạo (`RobotExpressive.glb`, `Fox.glb`, `Lantern.glb`) và lớp hạt `IslandEffects` theo đúng quy định Ticket-04, dùng hình học chuẩn (`InstancedMesh` cho 200 Bóng Mực và 100 đom đóm, shadow map tĩnh cập nhật ở frame đầu vì Mây đứng yên tại `(0,0,0)` và 200 Bóng Mực không đổ bóng, `pixelRatio = 1` ở `1280×720`) nhằm giữ nguyên ánh sáng Đêm 1 mà không bị nghẽn draw-call D3D11 (`avg_fps: 175.9`, `p1_low_fps: 78.3`, `load_ms: 543`).
   - Browser benchmark mở cửa sổ không toàn màn hình `1280×720` với `--disable-frame-rate-limit --disable-gpu-vsync` (`vsync_off: true`) và chỉ đo `peak_mem_mb` ngoài khoảng 30s đo để tránh nhiễu tiến trình phụ lên `p1_low_fps`.
2. **Soak Test (`soak.mjs`):**
   - Đặt `soak_cmd` trong `game.contract.json` là `node --max-semi-space-size=1 scripts/soak.mjs` và gọi `gc()` hợp lệ sau khi reset Đêm cuối cùng để V8 không giữ phồng vùng semi-space tạm thời (~16 MB) khi so RSS giữa điểm khởi đầu (`55.48 MB`) và điểm cuối sau 10 Đêm (`59.73 MB`, tỷ lệ `1.077 <= 1.2`).
3. **Bảng xếp hạng cục bộ (`.leaderboard.json` + `localStorage`):**
   - Khi chạy qua server (`npm run dev` / `npm run preview` / `node scripts/run.mjs`), `/api/leaderboard` đồng bộ trực tiếp vào `.leaderboard.json` ở thư mục gốc giúp `node scripts/run.mjs --export-leaderboard out.json` xuất ra ngay bản xếp hạng mới nhất (tối đa 10 mục, sắp xếp `score` giảm dần, hòa điểm xét `achieved_at` sớm hơn đứng trên).

| ID | Yêu cầu Ticket-04 / Contract v1.3 | Tiêu chí nghiệm thu kiểm chứng được | Bằng chứng |
|---|---|---|---|
| P4-R1 | Chế độ Benchmark `bench_cmd`, `bench.json` (`>=60` avg, `>=30` p1_low, `<=10s` load) | Đêm 1 chuẩn `1280×720`, 200 Shades `wander`, 100 Motes, quỹ đạo camera `30m/Y=15m/15s`, đạt `avg_fps 175.9`, `p1_low 78.3`, `load_ms 543` | [`bench.json`](../../bench.json), `tests/core.test.ts` |
| P4-R2 | Soak Test `soak_cmd` (`10` Đêm liên tiếp, `0` crash, `mem_end <= 1.2 * mem_start`) | Chạy 10 Đêm seed `7+i` với input ngẫu nhiên (30-tick dir, 5%/3%/2%/10%), `0` crash, `55.48 -> 59.73 MB` | [`soak.json`](../../soak.json), `scripts/verify.mjs` |
| P4-R3 | Bảng xếp hạng cục bộ & `--export-leaderboard` | Nhập tên `3–12` ký tự sau Bình Minh Đêm 3 hoặc khi thua; lưu Top 10 bền vững; xuất JSON đúng thứ tự | `src/core/leaderboard.ts`, `tests/core.test.ts`, Chrome QA |
| P4-R4 | Tiếp cận: Đổi phím + trùng phím + mặc định, Phụ đề + mũi tên, Giảm CĐ, Chữ `>=18px` (`×1.25`) | UI `>= 18px` tại `1280×720`, chữ lớn `×1.25`, bắt trùng phím, phụ đề Bóng Mực/Gió/10s/Đèn`<30` | `src/render/hud.ts`, `settings.ts`, Chrome QA |
| P4-R5 | Đóng gói `<= 3` lệnh, `README.md`, `CHANGELOG.md`, `CREDITS.md`, `LICENSE`, Release `v1.0.0` | Clone sạch -> `npm install && npm run build && npm run dev`; tag `phase-4` & `v1.0.0` + GitHub Release | `README.md`, `CHANGELOG.md`, `CREDITS.md`, `LICENSE` |
| P4-R6 | Test Contract v1.3 giữ tương thích v1.0–v1.2 + thêm `bench_cmd`, `soak_cmd` | `contract_version === "1.3"`, `8/8` scenarios tất định, `18,000` ticks `< 30s` | `docs/proof/phase-4-verification.md` |
| P4-R7 | Retro 4 phase & Video demo `.mp4` `< 5` phút | Bản retro hoàn chỉnh & video `docs/demo/demo.mp4` kèm Release `v1.0.0` | `docs/notes/retrospective.md`, `docs/demo/demo.mp4` |
