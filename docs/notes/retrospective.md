# Retrospective — Dự án "Đảo Đèn Lồng" (AI SDLC · 4 Phases)

> **Dự án:** Đảo Đèn Lồng (`v1.0.0` · `Contract v1.3`)  
> **Quy trình:** 4 Phase liên tiếp (`PRD-0` → `TICKET-02` → `TICKET-03` → `TICKET-04`) kèm SDLC Harness & Kiểm chứng độc lập

---

## 1. Tổng hợp Đánh giá qua 4 Phase

| Phase | Trọng tâm chính | Kết quả Kiểm chứng nổi bật | Độ ổn định Contract |
|---|---|---|---|
| **Phase 1 (`PRD-0`)** | Lõi mô phỏng pure TS Đêm 1 (`v1.0`), CLI headless JSONL tất định, nhân vật Mây (`RobotExpressive` + nón lá), Bóng Mực (`Fox.glb`) | Chốt ranh giới đảo `PLAYABLE_RADIUS = 39m`, nhặt đom đóm, pulse đẩy/choáng, tất định byte-for-byte | `v1.0` |
| **Phase 2 (`TICKET-02`)** | Chuẩn hóa `12` bước tick (`v1.1`), bản đồ 3 hòn đảo + bục nhảy + tầng dốc + gió mạnh Đêm 3, Dash, Bùa Gió, Gió Lạc, Settings bền vững | Benchmark headless Đêm 3 hoàn thành đủ `21,600` tick (`< 30s`), sửa dứt điểm 0 lỗi web/render trên 3 Đêm | `v1.1` |
| **Phase 3 (`TICKET-03`)** | Change Request *"Đèn cạn dầu"* (`v1.2`): nhiên liệu `fuel_ticks` nguyên, Bóng Mực `drain`, thắp lại `5` đom đóm, sức chứa `10→20`, luật thắng `dawn_survived` | Viết `ADR-001`, phân biệt đèn tắt không cần màu (xẹp `20%` + vết rách), chế độ mù màu `#00B3FF`/`#FFFFFF+⚠`, `8/8` scenarios tất định | `v1.2` |
| **Phase 4 (`TICKET-04`)** | Đóng gói phát hành `v1.0.0` (`v1.3`): Benchmark 3D `1280×720`, Soak 10 Đêm, Bảng xếp hạng Top 10, Tiếp cận (`>=18px`, đổi phím, phụ đề, giảm CĐ), Demo & Release | `avg_fps 175.9`, `p1_low_fps 78.3`, `load_ms 543`, Soak `10` Đêm `0` crash (`55.48 → 59.73 MB`), Chrome QA `0` lỗi | `v1.3` |

---

## 2. Điều gì hiệu quả và chưa hiệu quả khi làm việc với AI

### Hiệu quả cao
- **Khóa quy tắc kiến trúc trong `AGENTS.md` + `game.contract.json`:** Tách tuyệt đối `src/core/` (100% pure TypeScript) khỏi `src/render/` giúp mọi thay đổi đồ họa, âm thanh hay UI Accessibility ở Phase 3–4 **không bao giờ** làm sai lệch output JSONL headless.
- **Số nguyên cho bộ đếm vật lý & nhiên liệu:** Quy đổi toàn bộ timer và nhiên liệu sang đơn vị nguyên `1/60` tick (`fuel_ticks` `0..6000`) từ đầu Phase 2–3 loại bỏ hoàn toàn lỗi trôi dấu phẩy động IEEE-754 tại mốc `30.0` và `0.0`.
- **Phân vai Agent rõ ràng:** Dùng `browser` subagent đọc nguyên văn đề bài + trực tiếp bấm chơi/kiểm tra console/DOM, và dùng `research` subagent review độc lập theo đúng Spec trước khi gắn tag từng phase.

### Chưa hiệu quả / Bài học rút ra
- **Tài liệu dài dễ trôi chuẩn nhỏ:** Các khóa enum cụ thể (như `reason: "lanterns_short"` thay vì `"dawn"`) hoặc thông số biên kịch bản test dễ bị AI kế thừa nhầm từ phase cũ nếu không rà soát từng chuỗi sự kiện JSONL bằng reviewer độc lập.
- **Đo hiệu năng & bộ nhớ trên môi trường thực tế cần chạy thật sớm:** Các tối ưu suy đoán trên giấy không thay thế được việc chạy thẳng trên Chrome/Intel Iris Xe và Node V8 thực tế để thấy rõ nút thắt.

---

## 3. Những lần AI sai & Cách phát hiện

1. **Phase 1 — Lỗi đi ra ngoài ranh giới đảo & hụt đom đóm:** Khởi đầu cấu hình chưa khóa bán kính an toàn mặt đất tại `39m` và dùng `distanceXZ` lỏng lẻo với chênh cao Y -> phát hiện nhờ **vòng chơi thử thực tế (Chrome playtest)** và khóa chặt trong `world.ts` + unit test.
2. **Phase 2 — Nhân vật Đêm 3 rơi xuống vực & vòng lặp UI Settings 60 FPS:** `spawnPos` Đêm 3 đặt tại `[0,0,0]` trùng ngay lõi tháp chuông nên benchmark 21,600 tick chết ở tick 302 -> **Independent Reviewer (`research`)** và kiểm tra `end.ticks === 21600` trong `core.test.ts` bắt được ngay trước khi commit.
3. **Phase 3 — Sai tên lý do thua bình minh (`'dawn'` thay vì `'lanterns_short'`) & Pulse scenario bị hụt khoảng cách:** **Reviewer độc lập (`research`)** soi đối chiếu từng dòng với Test Contract v1.2 phát hiện `'dawn'` chưa cập nhật sang `'lanterns_short'` và phát hiện kịch bản `p3-shade-drain-and-dawn-win` bắn Pulse ở khoảng cách `12.57m > 5m`.
4. **Phase 4 — `p1_low_fps = 17.9 FPS` và Soak RSS nhảy `+22%` ở run ngắn:**
   - Chạy thử `bench.mjs` thực tế lộ ngay 3 nguyên nhân: rendering HiDPI (`devicePixelRatio > 1`), `625` draw calls rời mỗi frame qua ANGLE D3D11, và spawn PowerShell đo RAM ngay trong cửa sổ 30s -> chuyển sang `InstancedMesh` (~25 draw calls), `pixelRatio = 1`, shadow map tĩnh và dời đo RAM ra ngoài cửa sổ FPS đã đẩy `p1_low_fps` từ **`17.9` → `78.3 FPS`** (`avg_fps 175.9`).
   - Chạy thử `soak.mjs` lộ V8 mở rộng semi-space lên 16MB trong 3 Đêm đầu -> thêm `--max-semi-space-size=1` + `gc()` sau reset giữ chênh lệch RSS 10 Đêm chỉ còn **`7.7%`** (`55.48 → 59.73 MB`).

---

## 4. Harness nào giúp nhiều nhất?

1. **`scripts/verify.mjs` + `npm test` (Vitest + Contract Test):** Tự động kiểm tra `DEFAULT_TUNING === game.contract.json`, chạy 2x JSONL đối chiếu byte-for-byte trên tất cả scenarios, kiểm tra benchmark `18,000` ticks và mã thoát `2` chỉ trong ~2 giây.
2. **`.githooks/pre-commit`:** Chặn mọi commit có lỗi TypeScript hoặc test đỏ ngay tại máy cá nhân.
3. **Subagent Review độc lập (`research`) + Chrome QA (`browser`):** Phản biện chéo hoàn toàn khách quan giúp phát hiện gần như toàn bộ lỗi hợp đồng và lỗi UX thực tế mà model thực thi dễ bỏ qua.

---

## 5. Ước tính Token, Chi phí AI & Chiến lược tiết kiệm Token

| Giai đoạn | Input Tokens (ước tính) | Output Tokens (ước tính) | Tổng cộng |
|---|---:|---:|---:|
| CP0 + Phase 1 | ~80,000 | ~28,000 | ~108,000 |
| Phase 2 | ~92,000 | ~33,000 | ~125,000 |
| Phase 3 | ~68,000 | ~24,000 | ~92,000 |
| Phase 4 | ~95,000 | ~38,000 | ~133,000 |
| **Tổng 4 Phase** | **~335,000** | **~123,000** | **~458,000 tokens** |

*Chi phí tham khảo (theo đơn giá model flash/pro hỗn hợp):* khoảng **\$0.80 – \$1.80 USD** cho toàn bộ 4 phase sản phẩm hoàn chỉnh.

**Cách đã áp dụng để tiết kiệm token:**
- Giữ `AGENTS.md` cô đọng (`< 30` dòng), ghi rõ quy ước và lệnh kiểm chứng thay vì lặp lại trong prompt.
- Đọc file theo đúng khoảng dòng cần sửa (`StartLine`/`EndLine`), gộp các lệnh `read_file`/`edit_file` độc lập song song trong cùng một lượt.
- Giao việc đọc Lab Board dài & quét code diện rộng cho subagent tóm tắt đúng phần cần dùng, tránh làm phình ngữ cảnh của agent điều phối chính.

---

## 6. Nếu làm lại từ đầu sẽ đổi gì?

1. Ngay từ Phase 1 sẽ tạo **schema validator / shared helpers** trong `src/core/` (giống cách `src/core/leaderboard.ts` dùng chung ở Phase 4) để mọi hằng số, tên event (`lanterns_short`, `dawn_survived`) và validate input không bao giờ lệch giữa test, CLI và UI.
2. Tạo sớm kịch bản kiểm tra độ mượt 3D (`InstancedMesh` / object pool) ngay từ khi thêm hiệu ứng để tránh tối ưu muộn ở Phase 4.
