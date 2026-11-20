# Đảo Đèn Lồng (Lantern Island) — Day 12 AI SDLC

> **Demo Video:** *(Sẽ cập nhật link Release `v1.0.0` / `docs/demo/demo.mp4` tại Phase 4)*

Game 3D góc nhìn thứ ba qua **3 Đêm (Đảo Bến – Đảo Cau – Đảo Chuông)** theo luật **"Đèn cạn dầu"**: **Mây** (đội nón lá có treo chiếc đèn lồng nhỏ) gom đom đóm, thắp sáng và châm dầu giữ các Đèn Lồng Lớn sáng tới bình minh, đồng thời đối phó Bóng Mực hút dầu và Gió Lạc.

## Cài đặt & Chạy nhanh (tối đa 3 lệnh)

Yêu cầu: Node.js `>= 20` và `npm`.

```bash
npm install
npm run build
npm run dev
```

*(Hoặc chạy bản web tĩnh sau `npm run build`: `npm run preview`)*

## Điều khiển trong game

- **Di chuyển:** `WASD` hoặc phím mũi tên · **Nhảy:** `Space`
- **Lướt (Dash):** `Shift` (`14 m/s` trong `0.2s`, hồi `1.5s`, giữ độ cao trên không)
- **Xoay Camera 3D:** Kéo chuột trái hoặc nhấn `Q` / `C`
- **Thắp đèn / Thắp lại / Châm dầu:** `E` hoặc `F` (bán kính `2.0m`)
- **Tỏa sáng (Pulse):** `X` hoặc Click chuột phải (tốn `3` đom đóm, bán kính 3D `5m`, hồi `3s`)
- **Tạm dừng:** `Esc` hoặc `P` · **Chơi lại Đêm:** `R` · **Bật / Tắt âm thanh:** `M`

## Luật Đèn Cạn Dầu, Giữ Đèn Tới Bình Minh & Điểm (`Contract v1.2`)

Mọi thông số chuẩn được khai báo đồng bộ trong [`game.contract.json`](game.contract.json) và quyết định thiết kế tại [`docs/notes/adr-001-phase3-lantern-fuel-and-dawn.md`](docs/notes/adr-001-phase3-lantern-fuel-and-dawn.md):
- **Nhiên liệu đèn (`fuel` `0..100`):** Đèn vừa thắp có `fuel = 100`, tự hao `1.0/s`. Bấm `E`/`F` ở đèn đang sáng sẽ châm `min(đang mang, ceil((100 - fuel)/10))` đom đóm (`+10` fuel mỗi con). Hết dầu đèn tắt (`lantern_out`), lần thắp lại chỉ tốn **`5`** đom đóm (đèn chưa từng sáng tốn `10`).
- **Bóng Mực hút dầu (`drain`):** Đèn có `fuel < 30` mất vùng an toàn `6m` và nhấp nháy `1 Hz`; Bóng Mực ở `wander` tìm tới đèn yếu gần nhất và hút `5 fuel/s` (`fuel_drain` mỗi `60` tick). Châm dầu lên `>= 30` sẽ đẩy Bóng Mực ra mép `6m`.
- **Sức chứa tăng dần:** Sức chứa túi = `10 + 2 × successful_lights` (tối đa **`20`**).
- **Điều kiện thắng mới:** Sống sót tới bình minh (`240s` / `270s` / `300s`) và giữ sáng ít nhất `ceil(0.6 × tổng đèn)` (**Đêm 1: `3/5`**, **Đêm 2: `4/6`**, **Đêm 3: `5/7`**).
- **Bảng điểm (`Contract v1.2`):** `+5` mỗi đom đóm nạp/châm dầu · `+100` thắp lần đầu · `+40` thắp lại · `+5` Tỏa Sáng trúng Bóng Mực (`+15` nếu đang `drain`) · Bình minh (khi thắng): `+50 + floor(fuel)` mỗi đèn sáng + `50 × Ngọn Lửa còn lại` (bỏ thưởng thời gian).
- **Trợ năng (Chế độ mù màu):** Bật *"Bảng màu dễ phân biệt"* trong Cài đặt đổi viền Bóng Mực sang `#00B3FF`, cảnh báo sang `#FFFFFF` kèm `⚠`; đèn tắt xẹp `20%` kèm vết rách để phân biệt không cần màu.

## Chạy Test & Chế độ Headless (Test Contract v1.2)

- Chạy unit & contract tests:
  ```bash
  npm test
  ```
- Chạy chế độ headless (`--night 1 | 2 | 3`):
  ```bash
  node dist-headless/cli.js --seed 2026 --night 1 --scenario tests/scenarios/p3-fuel-refuel-relight.scenario.json --inputs tests/scenarios/p3-fuel-refuel-relight.inputs.json --ticks 200 --out out.jsonl --snapshot-every 10
  ```
- Chạy toàn bộ bộ kiểm chứng (typecheck + headless build + unit tests + kiểm tra tất định 8 scenarios + benchmark Đêm 3):
  ```bash
  npm run verify
  ```

## Sáng tạo của tôi

- **Hoàn toàn tách biệt ở tầng hiển thị 3D (`src/render/`), không làm đổi đầu ra headless:**
  - **Trực quan hóa Đèn cạn dầu & Hút dầu (`src/render/scene.ts`, `src/render/hud.ts`):** Đèn tắt xẹp `20%` kèm dải vết rách tối màu; đèn sáng có thanh dầu 3D nổi và nhấp nháy `1 Hz` khi `< 30%`, kết nối sợi tia hút năng lượng + rung nhẹ khi Bóng Mực đang `drain`; thanh nhiên liệu từng đèn và mũi tên đổi màu cảnh báo trên HUD.
  - **Âm thanh WebAudio & Lưu cài đặt (`src/render/audio.ts`, `src/render/settings.ts`):** Bổ sung âm báo châm dầu (`refuel`), tắt đèn (`lantern_out`), hút dầu (`fuel_drain`), cùng lưu tùy chọn **"Bảng màu dễ phân biệt"** vào `localStorage`.
- **Bằng chứng phần lõi không bị ảnh hưởng:** Toàn bộ kiểm tra `npm run verify` chạy trực tiếp `node dist-headless/cli.js` (tách biệt khỏi `src/render/`) và đạt Test Contract v1.2 tại `docs/proof/phase-3-verification.md`.
