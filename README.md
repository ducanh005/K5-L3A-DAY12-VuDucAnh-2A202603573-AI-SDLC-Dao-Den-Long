# Đảo Đèn Lồng (Lantern Island) — Day 12 AI SDLC

> **Demo Video:** *(Sẽ cập nhật link Release `v1.0.0` / `docs/demo/demo.mp4` tại Phase 4)*

Game 3D góc nhìn thứ ba qua **3 Đêm (Đảo Bến – Đảo Cau – Đảo Chuông)**: **Mây** (đội nón lá có treo chiếc đèn lồng nhỏ) thu thập đom đóm để thắp sáng các Đèn Lồng Lớn, tránh Bóng Mực và Gió Lạc, tận dụng Bùa Gió, Bục Nhảy và Tỏa Sáng để mang bình minh trở lại.

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
- **Lướt (Dash):** `Shift` (`14 m/s` trong `0.2s`, hồi `1.5s`, giữ độ cao trên không)
- **Xoay Camera 3D:** Kéo chuột trái hoặc nhấn `Q` / `C`
- **Nạp ánh sáng vào Đèn Lồng Lớn:** `E` hoặc `F` (bán kính `2.0m`)
- **Tỏa sáng (Pulse):** `X` hoặc Click chuột phải (tốn `3` đom đóm, bán kính 3D `5m`, hồi `3s`)
- **Tạm dừng:** `Esc` hoặc `P`
- **Chơi lại Đêm:** `R` · **Bật / Tắt âm thanh:** `M`

## Ba hòn đảo, Luật chuẩn & Cách tính điểm (`Contract v1.1`)

Mọi thông số chuẩn được khai báo đồng bộ trong [`game.contract.json`](game.contract.json):
- **Đêm 1 — Đảo Bến (`300s`, 5 đèn):** Đảo tròn bán kính `40m`, Bóng Mực `4.0 m/s` (tối đa 6).
- **Đêm 2 — Đảo Cau (`330s`, 6 đèn):** Hai đảo `28m` nối bằng cầu tre, 2 Bục Nhảy phóng qua đảo đối diện, Bùa Gió ở giữa cầu, Gió Lạc cướp tối đa 3 đom đóm khi mang `>= 5`.
- **Đêm 3 — Đảo Chuông (`360s`, 7 đèn):** Đảo 3 tầng (`Y=0/3/6`) kèm 2 dốc nghiêng, Bục Nhảy tầng 1→2, Tháp Chuông giữa đảo, 2 Bùa Gió, và Gió mạnh mỗi `30s`.
- **Mạng & Rơi:** `3` Ngọn Lửa đầu mỗi Đêm. Rơi `Y < -10` mất `1` Ngọn Lửa (bỏ qua bất tử) + toàn bộ đom đóm, hồi sinh sau `60` tick.
- **Bảng điểm chuẩn hóa (`score`):**
  - Nạp 1 đom đóm vào đèn (`per_mote`): `+10`
  - Thắp sáng 1 Đèn Lồng Lớn (`per_lantern`): `+100`
  - Tỏa Sáng trúng 1 Bóng Mực (`per_stun`): `+5`
  - Thưởng khi thắng Đêm (`per_second_left`, `per_flame_left`): `+2 × floor(giây còn lại) + 50 × Ngọn Lửa còn lại`

## Chạy Test & Chế độ Headless (Test Contract v1.1)

- Chạy unit tests, kiểm tra đồng bộ contract và đo hiệu năng 21.600 tick:
  ```bash
  npm test
  ```
- Chạy chế độ headless (`--night 1 | 2 | 3`):
  ```bash
  node dist-headless/cli.js --seed 2026 --night 3 --scenario tests/scenarios/p2-night3-tiers-wind-pause.scenario.json --inputs tests/scenarios/p2-night3-tiers-wind-pause.inputs.json --ticks 1900 --out out.jsonl --snapshot-every 10
  ```
- Chạy toàn bộ bộ kiểm chứng (typecheck + headless build + unit tests + kiểm tra tất định 6 scenarios + benchmark 21.600 tick):
  ```bash
  npm run verify
  ```

## Sáng tạo của tôi

- **Hoàn toàn tách biệt ở tầng hiển thị 3D (`src/render/`), không đổi số liệu chuẩn, bản đồ chuẩn và đầu ra headless:**
  - **Mô hình 3D & Texture CC0/MIT (`public/assets/`, `src/render/scene.ts`):** Mây (`RobotExpressive.glb`) mặc áo kem `#E8E2D0`, khăn đỏ `#C8102E`, nón lá treo đèn lồng; Đèn Lồng Lớn (`Lantern.glb`) kèm vòng an toàn `6m`; Bóng Mực (`Fox.glb`) tím đen `#120A1A / #7A3CFF`; Gió Lạc dải lụa `#8FA3B8`; địa hình 3 tầng + cầu tre + Tháp Chuông + hiệu ứng lá bay cảnh báo gió Đêm 3.
  - **Âm thanh WebAudio tổng hợp (`src/render/audio.ts`) & Lưu cài đặt (`src/render/settings.ts`):** Nhạc nền đêm êm dịu, hiệu ứng âm thanh cho mọi sự kiện (nhặt, nạp, thắp đèn, lướt, nhảy, tỏa sáng, Gió Lạc cướp/thả, Bóng Mực xuất hiện, đếm ngược 10s cuối) cùng cài đặt âm lượng & độ nhạy chuột lưu vào `localStorage`.
  - **Chiến dịch & HUD (`src/render/hud.ts`):** Menu chính, lời dẫn Ông Đăng trước từng Đêm, thanh 10 ô đom đóm, mũi tên chỉ đèn ngoài màn hình, và màn hình Bình Minh tổng kết 3 Đêm.
- **Bằng chứng phần lõi không bị ảnh hưởng:** Mọi kiểm tra trong `npm run verify` chạy `node dist-headless/cli.js` tách biệt hoàn toàn khỏi `src/render/` và đạt chuẩn Test Contract v1.1 (chi tiết tại `docs/proof/phase-2-verification.md`).
