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

## Phase 2 (Ticket-02)
*(Chưa phát hành)*

## Phase 3 (Ticket-03)
*(Chưa phát hành)*

## Phase 4 (Ticket-04)
*(Chưa phát hành)*
