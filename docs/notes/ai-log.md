# Nhật Ký Dùng AI, Token & Harness

## Nguyên tắc tiết kiệm Token & Kiểm soát AI
1. Giữ `AGENTS.md` ngắn gọn (< 40 dòng) để giảm chi phí context ở mọi lượt gọi.
2. Viết tiêu chí nghiệm thu + scenario kiểm chứng trước khi code để agent không phải sửa đi sửa lại.
3. Chốt chặn tự động qua `npm run verify` + `.githooks/pre-commit` thay vì nhắc bằng lời nhiều lần.

## Theo dõi theo từng Phase

| Phase | Công cụ / Model | Việc đã giao cho AI | Token / Chi phí ước tính | Cách tiết kiệm token | Lỗi AI gặp & Cách chỉnh Harness |
|---|---|---|---|---|---|
| **CP0 (Chuẩn bị)** | Antigravity | Khởi tạo khung repo, tách `src/core/` + `src/render/`, tạo `AGENTS.md`, skills, hooks, CI và script `verify.mjs` | ~18k input / ~6k output tokens | Chốt cấu trúc & stack ngay từ đầu qua `/grill-me`, viết file song song theo batch | Chưa phát sinh lỗi lớn; đã thêm rule cấm dùng `npm run headless` kèm banner khi so JSON tự động (dùng `--silent` hoặc `npx tsx`) |
| **Phase 1 (PRD-0)** | *(Đang chờ đề)* | | | | |
| **Phase 2 (Ticket-02)** | *(Đang chờ đề)* | | | | |
| **Phase 3 (Ticket-03)** | *(Đang chờ đề)* | | | | |
| **Phase 4 (Ticket-04)** | *(Đang chờ đề)* | | | | |
