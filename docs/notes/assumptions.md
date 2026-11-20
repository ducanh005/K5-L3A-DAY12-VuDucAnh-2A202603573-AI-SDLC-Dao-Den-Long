# Sổ Giả Định, Tiêu Chí Nghiệm Thu & Truy Vết Thay Đổi

## Checkpoint 0 (Khung chuẩn bị trước PRD-0)

### Kiến trúc & Tính tất định
- **Giả định CP0-1:** Chế độ headless chạy trên Node.js (`tsx src/headless/cli.ts`) mà không cần GPU/trình duyệt; toàn bộ logic game nằm trong `src/core/` và không phụ thuộc DOM.
- **Giả định CP0-2:** Các thông số ban đầu ở CP0 (`mapRadius = 24`, `fireflyCount = 9`, `lanternCount = 3`, `shadowCount = 2`, `PLAYER_SPEED = 6.0`) chỉ là giá trị khởi tạo mẫu để chạy thử "hello 3D + headless" và sẽ được thay thế hoàn toàn theo PRD-0 ở Phase 1.

| ID | Hạng mục CP0 | Tiêu chí nghiệm thu | Bằng chứng |
|---|---|---|---|
| CP0-R1 | Tách Core / Render | `src/core/` compile độc lập, không import `three` hay `window` | `npx tsc --noEmit` & `docs/proof/cp0-verification.md` |
| CP0-R2 | Tính tất định | Chạy cùng `seed` & `cp0-smoke.json` 2 lần cho JSON đầu ra giống hệt | `npm run verify` & `tests/core.test.ts` |
| CP0-R3 | Bản 3D chơi được | `npm run build` đóng gói sạch `dist/` không lỗi TypeScript/Vite | `npm run build` |

---

## Phase 1 (PRD-0)
*(Sẽ cập nhật ngay khi nhận PRD-0 và Test Contract từ Lab Board)*

## Phase 2 (Ticket-02)
*(Chưa phát hành)*

## Phase 3 (Ticket-03)
*(Chưa phát hành)*

## Phase 4 (Ticket-04)
*(Chưa phát hành)*
