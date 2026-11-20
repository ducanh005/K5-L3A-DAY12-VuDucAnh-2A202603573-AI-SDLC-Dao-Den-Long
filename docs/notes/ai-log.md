# Nhật Ký Dùng AI, Token & Harness

## Nguyên tắc tiết kiệm Token & Kiểm soát AI
1. Giữ `AGENTS.md` ngắn gọn (< 30 dòng) để giảm chi phí context ở mọi lượt gọi.
2. Viết bảng tiêu chí nghiệm thu + scenario kiểm chứng trước khi code để agent làm đúng contract ngay lần đầu.
3. Dùng script `npm run verify` và hook `.githooks/pre-commit` tự động phát hiện sai lệch giữa `game.contract.json` và `src/core/world.ts`.

## Theo dõi theo từng Phase

| Phase | Công cụ / Model | Việc đã giao cho AI | Token / Chi phí ước tính | Cách tiết kiệm token | Lỗi AI gặp & Cách chỉnh Harness |
|---|---|---|---|---|---|
| **CP0 (Chuẩn bị)** | Antigravity | Khởi tạo khung repo, tách `src/core/` + `src/render/`, tạo `AGENTS.md`, skills, hooks, CI và `verify.mjs` | ~18k input / ~6k output tokens | Chốt cấu trúc & stack trước qua `/grill-me`, ghi file song song theo batch | Đã chỉnh `verify.mjs` tránh banner `npm run` khi so JSON tự động |
| **Phase 1 (PRD-0)** | Antigravity (Orchestrator + Subagents `browser`, `research`) | Đọc nguyên văn PRD-0 & Test Contract v1.0, triển khai `game.contract.json`, nâng cấp `src/core/`, `src/headless/cli.ts`, `src/render/` (tích hợp GLTF CC0/MIT + nón lá treo đèn), sửa lỗi biên đảo `39m` & tầm nhặt đom đóm, kiểm chứng & review độc lập | ~62k input / ~22k output tokens | Dùng subagent `browser` trích nguyên văn đề bài & chơi thử tìm lỗi trực tiếp; tải assets CC0/MIT offline vào `public/assets/` tránh phụ thuộc mạng khi chấm | Reviewer phát hiện sai số IEEE-754 trên bộ đếm tick; vòng chơi thử phát hiện lỗi `map_radius` mở rộng quá mặt đảo `40m` và thiếu cảnh báo đầy túi -> đã khóa `PLAYABLE_RADIUS = 39` kèm unit test chặn tái diễn |
| **Phase 2 (Ticket-02)** | *(Đang chờ đề)* | | | | |
| **Phase 3 (Ticket-03)** | *(Đang chờ đề)* | | | | |
| **Phase 4 (Ticket-04)** | *(Đang chờ đề)* | | | | |
