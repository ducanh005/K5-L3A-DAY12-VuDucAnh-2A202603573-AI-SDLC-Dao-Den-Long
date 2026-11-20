# Đảo Đèn Lồng (Lantern Island) — Day 12 AI SDLC

> **Demo Video:** *(Sẽ cập nhật link Release `v1.0.0` / `docs/demo/demo.mp4` tại Phase 4)*

Game 3D góc nhìn thứ ba: **Mây**, người giữ đèn nhỏ tuổi, thu thập đom đóm để thắp sáng các Đèn Lồng Lớn và né tránh Bóng Mực trong sương đen.

## Cài đặt & Chạy nhanh (tối đa 3 lệnh)

Yêu cầu: Node.js `>= 20` và `npm`.

```bash
npm install
npm run dev
```

*(Để build và chạy bản web tĩnh: `npm run build && npm run preview`)*

## Điều khiển trong game

- **Di chuyển:** `WASD` hoặc các phím mũi tên
- **Chạy nhanh:** `Shift`
- **Thắp Đèn Lồng Lớn:** `E` hoặc `Space` (khi đứng gần Đèn Lồng Lớn và đủ đom đóm)
- **Chơi lại:** `R`
- **Bật / Tắt âm thanh:** `M`

## Chạy Test & Chế độ Headless

- Chạy unit tests: `npm test`
- Chạy chế độ headless với scenario mẫu:
  ```bash
  npm run --silent headless -- --scenario tests/scenarios/cp0-smoke.json --pretty
  ```
- Chạy toàn bộ bộ kiểm chứng (typecheck + unit tests + kiểm tra tính tất định 2 lần):
  ```bash
  npm run verify
  ```

## Kiến trúc & Quy trình SDLC

- `src/core/`: Logic game thuần TypeScript, tất định theo `seed` (`Mulberry32`), tách hoàn toàn khỏi WebGL/DOM.
- `src/headless/`: CLI chạy mô phỏng không giao diện.
- `src/render/`: Tầng hiển thị 3D Three.js, hạt sương/đom đóm, HUD và âm thanh WebAudio.
- `docs/notes/`: Giả định & tiêu chí nghiệm thu (`assumptions.md`), nhật ký dùng AI & token (`ai-log.md`), retro (`retro.md`).
- `docs/proof/`: Bằng chứng kiểm chứng thật khớp với từng git tag.

## Sáng tạo của tôi

- **Tách biệt hoàn toàn tại tầng hiển thị (`src/render/`):**
  - Hiệu ứng hạt đom đóm bay lơ lửng và mật độ sương đen giảm dần theo số Đèn Lồng Lớn đã thắp sáng (`src/render/effects.ts`, `src/render/scene.ts`).
  - Hệ thống âm thanh WebAudio tổng hợp trực tiếp (`src/render/audio.ts`) phản hồi theo sự kiện thu thập đom đóm, thắp đèn và va chạm Bóng Mực mà không cần asset ngoài.
  - HUD dẫn chuyện ngắn của Mây (`src/render/hud.ts`).
  - **Đảm bảo:** Toàn bộ logic sáng tạo đọc bất biến từ `WorldState`, không làm thay đổi đầu ra của chế độ headless.
