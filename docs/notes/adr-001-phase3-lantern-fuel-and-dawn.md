# ADR-001: Mô hình Nhiên Liệu Đèn, Trạng Thái Hút Dầu & Luật Thắng Bình Minh (Phase 3)

- **Trạng thái:** Accepted (Phase 3 — TICKET-03 / Contract v1.2)
- **Ngày:** 2026-11-20
- **Bối cảnh:** Ticket-03 là một Change Request thay thế (`[THAY THẾ]`) các quy tắc cốt lõi từ Phase 1–2: đèn thắp rồi vẫn hao dầu theo thời gian và có thể tắt, Bóng Mực chuyển sang hút dầu các đèn yếu dưới `30`, sức chứa đom đóm tăng theo số lần thắp, và điều kiện thắng chuyển từ "thắp hết đèn sớm" sang "giữ đủ `ceil(0.6 * tổng đèn)` đèn sáng cho tới lúc bình minh".

## Quyết định Thiết kế

1. **Biểu diễn Nhiên liệu bằng Đơn vị Nguyên `fuel_ticks` (`1/60`):**
   - Thay vì lưu `fuel` dạng số thực (`float`) và trừ `1/60` hoặc `5/60` mỗi tick (dễ tích lũy sai số IEEE-754 tại các mốc `30.0`, `0.0` và phép `ceil((100 - fuel)/10)`), toàn bộ lõi lưu **`fuel_ticks` là số nguyên** (`fuel_max = 100` tương ứng `6000` ticks; ngưỡng mất vùng an toàn `30` tương ứng `1800` ticks; mỗi đom đóm châm thêm `600` ticks).
   - Khi xuất JSONL (`snapshot`, `refuel`, `fuel_drain`), quy đổi `Math.round((fuel_ticks / 60) * 10) / 10` (làm tròn 1 chữ số thập phân; đèn tắt luôn `fuel = 0`).

2. **Máy Trạng Thái Đèn (`unlit_fresh` → `lit` ↔ `unlit_ever_lit`):**
   - Mở rộng `LanternState` với `fuel_ticks`, `ever_lit`, và `relit_count`.
   - Đèn chưa từng sáng (`!ever_lit`) cần `10` đom đóm (`+100` điểm khi sáng); khi `fuel_ticks <= 0` sau Bước 2, đèn tắt (`lantern_out`), đặt `deposited = 0`, `ever_lit = true`, để lần thắp lại chỉ cần `5` đom đóm (`+40` điểm và `relight: true`).
   - Đèn sáng nhưng `fuel_ticks < 6000` được phép nhận thêm đom đóm ở Bước 5 (`refuel`); khi vừa được châm vượt ngưỡng `>= 1800` (`30` fuel) hoặc vừa thắp sáng, toàn bộ Bóng Mực bên trong `6m` bị đẩy ra mép trong tối đa `30` tick.

3. **Mở rộng Máy Trạng Thái Bóng Mực với `drain`:**
   - Trạng thái `wander` ưu tiên tìm đèn sáng có `fuel < 30` gần nhất (tie-break theo ID tăng dần), di chuyển tới `<= 2m` rồi chuyển sang `drain` (hút `5` fuel_ticks/tick, cộng dồn nếu nhiều Bóng Mực cùng hút, phát `fuel_drain` mỗi `60` tick).
   - Thứ tự 12 bước đảm bảo Pulse ở Bước 7 có thể đánh trúng Bóng Mực đang `drain` để nhận `+15` điểm trước khi Bước 8 chuyển trạng thái sang `chase` (nếu Mây vào trong `6m`).

4. **Luật Thắng Mới & Tương thích Hồi quy:**
   - Gỡ bỏ hoàn toàn điều kiện thắng sớm `all_lit`. Tại Bước 11, kiểm tra `flames <= 0` (`no_flames`) **trước** kiểm tra hết giờ (`dawn_survived` khi `lit >= ceil(0.6 * N)`, ngược lại `lanterns_short`), kể cả ở tick cuối cùng.
   - Đã cập nhật test & scenario cũ của Phase 1 (`p1-pulse-and-win`) để kiểm chứng điều kiện thắng `dawn_survived` mới kèm giải trình trong `docs/notes/assumptions.md`.

## Hệ quả
- **Tích cực:** Triệt tiêu hoàn toàn trôi sai số dấu phẩy động khi tính dầu và ngưỡng `30.0`, giữ 100% tính tất định đa nền tảng, và bảo toàn các cơ chế không bị thay thế của Phase 1–2 (`dash`, `charm`, `drifter`, `jumppad`, `wind`, `pause`).
- **Phạm vi ảnh hưởng:** Các kịch bản cũ kỳ vọng thắng ngay lập tức khi thắp đèn cuối (`all_lit`) hoặc kỳ vọng `+10` điểm khi nhặt đom đóm đã được cập nhật đồng bộ theo `Contract v1.2`.
