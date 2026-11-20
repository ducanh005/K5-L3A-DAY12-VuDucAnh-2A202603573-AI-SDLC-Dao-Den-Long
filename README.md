# Đảo Đèn Lồng (Lantern Island) — Day 12 AI SDLC

> **Demo Video:** *(Sẽ cập nhật link Release `v1.0.0` / `docs/demo/demo.mp4` tại Phase 4)*

Game 3D góc nhìn thứ ba: **Mây** (người giữ đèn đội nón lá có treo chiếc đèn lồng nhỏ) thu thập đom đóm trên **Đêm 1 – Đảo Bến** để thắp sáng **5 Đèn Lồng Lớn**, đồng thời né tránh và **Tỏa sáng (Pulse)** xua đuổi **Bóng Mực** trong sương tím đen.

## Cài đặt & Chạy nhanh (tối đa 3 lệnh)

Yêu cầu: Node.js `>= 20` và `npm`.

```bash
npm install
npm run build
npm run dev
```

*(Hoặc chạy bản web tĩnh sau `npm run build`: `npm run preview`)*

## Điều khiển trong game

- **Di chuyển:** `WASD` hoặc phím mũi tên
- **Nhảy:** `Space`
- **Xoay Camera 3D:** Kéo chuột trái hoặc nhấn `Q` / `C`
- **Nạp ánh sáng vào Đèn Lồng Lớn:** `E` hoặc `F` (khi đứng trong bán kính `2.5m` quanh đèn)
- **Tỏa sáng (Pulse) xua Bóng Mực:** `Shift`, `X`, hoặc Click chuột phải (tốn `1` đom đóm, hồi `1s`)
- **Chơi lại sau khi thắng / thua:** `R`
- **Bật / Tắt âm thanh:** `M`

## Cách tính điểm & Luật Đêm 1 – Đảo Bến

Mọi thông số chuẩn được khai báo đồng bộ trong [`game.contract.json`](game.contract.json):
- **Mạng (Flames):** Bắt đầu với `3` ngọn lửa; chạm Bóng Mực mất `1` ngọn lửa, rơi `50%` số đom đóm đang giữ (làm tròn xuống), bất tử `1.5s`.
- **Đom đóm & Đèn Lồng Lớn:** Giữ tối đa `5` đom đóm (`carry_capacity = 5`), cần `3` đom đóm để thắp sáng `1` Đèn Lồng Lớn (`lantern_cost = 3`). Đèn đã sáng tạo vùng an toàn bán kính `5m` (`safe_radius = 5`) mà Bóng Mực không thể đi vào.
- **Tỏa sáng (Pulse):** Tiêu hao `1` đom đóm, đẩy lùi `4m` và làm choáng (`stunned`) mọi Bóng Mực trong bán kính `6m` suốt `3s`.
- **Bảng điểm (`score`):**
  - Nhặt 1 đom đóm (`per_mote`): `+10`
  - Thắp sáng 1 Đèn Lồng Lớn (`per_lantern`): `+100`
  - Làm choáng 1 Bóng Mực bằng Pulse (`per_stun`): `+25`
  - Thưởng khi thắng (`per_flame_left`): `+50` cho mỗi ngọn lửa còn lại (`per_second_left = 0`)

## Chạy Test & Chế độ Headless (Test Contract v1.0)

- Chạy unit & contract tests:
  ```bash
  npm test
  ```
- Chạy chế độ headless chuẩn Test Contract v1.0:
  ```bash
  node dist-headless/cli.js --seed 2026 --night 1 --scenario tests/scenarios/p1-collect-and-light.scenario.json --inputs tests/scenarios/p1-collect-and-light.inputs.json --ticks 300 --out out.jsonl --snapshot-every 10
  ```
- Chạy toàn bộ bộ kiểm chứng (typecheck + headless build + unit tests + kiểm tra tính tất định JSONL x2 + kiểm tra mã thoát `2`):
  ```bash
  npm run verify
  ```

## Sáng tạo của tôi

- **Hoàn toàn tách biệt ở tầng hiển thị 3D (`src/render/`), không thay đổi bất kỳ giá trị nào của đầu ra headless:**
  - **Không khí cổ tích & chuyển sáng động (`src/render/scene.ts`, `src/render/effects.ts`):** Mây đội nón lá có treo đèn lồng nhỏ phát sáng vàng cam ấm; màu trời/sương tím đen chuyển ấm dần theo tỉ lệ số Đèn Lồng Lớn đã thắp (`0/5` → `5/5`), kèm vòng sáng vùng an toàn `5m` và sóng ánh sáng lan tỏa khi dùng Pulse.
  - **Âm thanh WebAudio tổng hợp trực tiếp (`src/render/audio.ts`):** Phát âm thanh chuông ấm khi nhặt đom đóm, hợp âm ngân vang khi thắp đèn, sóng âm khi tỏa sáng và cảnh báo trầm khi chạm Bóng Mực (không dùng file nhạc ngoài, 0 rủi ro bản quyền).
  - **HUD dẫn chuyện (`src/render/hud.ts`):** Hiển thị tiến độ Đêm 1, trạng thái Tỏa sáng, và lời dẫn ngắn theo tiến độ thắp đèn.
- **Bằng chứng phần lõi không bị ảnh hưởng:** Toàn bộ bài kiểm tra trong `npm run verify` chạy trực tiếp `node dist-headless/cli.js` (chỉ nạp `src/core/` và `src/headless/`, không chạm `src/render/`). Xem chi tiết tại `docs/proof/phase-1-verification.md`.
