# BESIDE — GAME DESIGN DOCUMENT

> **Loại tài liệu:** Game Design Document (GDD)  
> **Trạng thái:** Bản thiết kế nền tảng — cần playtest để chốt cân bằng  
> **Baseline được đối chiếu:** `main` · `979fa96a79fa67c6ba6bb1617d89212e1191c6ed`  
> **Ngày rà soát:** 15-11-2026

Tài liệu này mô tả hướng thiết kế của Beside dựa trên code và tài liệu hiện có. Mọi nội dung đều được phân biệt giữa **đã triển khai**, **đang cần kiểm chứng/tinh chỉnh** và **đề xuất cho giai đoạn sau**. Đây không phải lời khẳng định rằng toàn bộ tính năng mục tiêu đã có trong bản chơi hiện tại.

---

## 1. Tầm nhìn sản phẩm

**Beside** là một game hành động phiêu lưu 3D góc nhìn thứ ba, đặt người chơi vào một thung lũng được tạo sinh. Người chơi khám phá địa hình, đối đầu sinh vật, thu thập trang bị và tìm các hầm ngục ẩn để vượt qua những đợt thử thách lớn hơn.

Trải nghiệm ưu tiên:
- **Dễ bắt đầu:** người chơi vào game, hiểu mục tiêu đầu tiên và điều khiển được ngay.
- **Khám phá có định hướng:** địa hình rộng nhưng không khiến người chơi mất phương hướng; bản đồ và dấu hiệu môi trường hỗ trợ tìm điểm đến.
- **Chiến đấu dễ đọc:** người chơi nhìn được hướng tấn công, thời điểm nguy hiểm và phản hồi khi hành động thành công.
- **Loot có ý nghĩa:** trang bị mới tạo ra lựa chọn về sát thương, độ bền và tốc độ, không chỉ là vật phẩm trang trí.
- **Chạy tốt trên nhiều thiết bị:** ưu tiên Android/mobile trước nhưng vẫn phải có trải nghiệm bàn phím + chuột tốt trên PC.

**Định vị bản hiện tại:** single-player, chạy trên trình duyệt, local-first. Chưa có backend tài khoản, multiplayer hoặc đồng bộ cloud.

## 2. Trụ cột thiết kế

| Trụ cột | Ý nghĩa trong gameplay | Tiêu chí kiểm chứng |
|---|---|---|
| Khám phá | Di chuyển qua các biome, nhận biết địa hình và tìm cổng hầm ngục | Người chơi mới tự tìm được mục tiêu đầu tiên mà không cần đọc hướng dẫn ngoài game |
| Hành động | Di chuyển, né tránh, tấn công và xử lý nhiều kiểu kẻ địch | Input phản hồi nhanh; đòn đánh và sát thương dễ nhận biết |
| Thu thập & trang bị | Nhặt đồ, so sánh chỉ số, trang bị hoặc bỏ vật phẩm | Mỗi món đồ có vai trò, rarity và ảnh hưởng gameplay rõ ràng |
| Thử thách theo phòng | Hầm ngục chia nhịp khám phá và giao tranh | Cửa, trạng thái phòng, phần thưởng và lối ra luôn nhất quán |
| Khả năng tiếp cận | Chơi được bằng touch hoặc keyboard/mouse | Không có thao tác thiết yếu chỉ dùng được trên một nền tảng |

Không mở rộng số lượng hệ thống chỉ để tăng độ dài danh sách tính năng. Mỗi tính năng mới phải củng cố ít nhất một trụ cột trên.

## 3. Đối tượng và nền tảng

### Nền tảng mục tiêu
- **Ưu tiên 1:** trình duyệt Android, cả portrait và landscape; thao tác bằng touch.
- **Ưu tiên 2:** trình duyệt desktop; bàn phím, chuột và pointer lock.
- **Kiến trúc hiện tại:** JavaScript không build step, Three.js r128, static hosting và offline shell.

Game hiện có thể chạy bằng touch joystick, vuốt để xoay camera và các nút hành động; desktop dùng WASD/phím mũi tên, chuột và phím tắt. Đây là game web, không nên mô tả nó như một ứng dụng Android native.

### Chất lượng hiệu năng
- Mốc thiết kế là **60 FPS ổn định** trên thiết bị mục tiêu đã chọn.
- 90/120/144 FPS là mức nâng cao, chỉ bật khi màn hình, GPU và nhiệt độ thiết bị cho phép.
- Không cam kết 144 FPS trên mọi máy. Cần benchmark cùng một cảnh, cùng preset và cùng thiết bị; ghi nhận frame cadence, draw calls, triangles, chunk count và tình trạng nhiệt.
- Low/Medium phải giữ gameplay rõ ràng; High chỉ tăng chất lượng nhìn thấy được, không thêm chi tiết gây nhiễu.

## 4. Thế giới

### 4.1 Cấu trúc overworld

**Đã triển khai:** overworld dùng smooth heightmap, chunk streaming, nước, thảm thực vật và màu địa hình thay đổi theo độ cao/biome. Runtime đang nạp `js/legacy-world.js`; renderer voxel block cũ không được load từ `index.html`.

Năm biome hiện diện trong dữ liệu tạo thế giới:
1. **Meadow:** đồng cỏ, vùng bắt đầu dễ quan sát.
2. **Forest:** cây và thảm thực vật dày hơn.
3. **Desert:** màu đất cát, cảm giác khô và thoáng.
4. **Snow:** địa hình cao/lạnh với bảng màu sáng.
5. **Autumn:** sắc lá và đất ấm, tạo tương phản với meadow/forest.

Đây là các biome trong hệ thống màu và tạo địa hình hiện có; chưa nên gọi chúng là năm campaign region có cốt truyện, nhiệm vụ và bộ quái riêng.

### 4.2 Hướng mở rộng môi trường

**Đề xuất:** mở rộng từng biome thành khu vực có bản sắc bằng landmark, đường đi, mật độ cây, màu ánh sáng, âm thanh môi trường, tài nguyên và phân bố encounter. Không tạo năm bản đồ lớn cùng lúc.

Thứ tự ưu tiên:
1. Làm khu vực xuất phát dễ đọc và có landmark ghi nhớ.
2. Tạo đường dẫn tự nhiên tới cổng dungeon đầu tiên.
3. Hoàn thiện một khu vực phụ có khác biệt thị giác và gameplay.
4. Chỉ sau khi vòng lặp đầu tiên tốt mới nhân rộng ra các biome còn lại.

### 4.3 Quy tắc khám phá
- Landmark phải nhìn thấy được từ khoảng cách hợp lý và không bị cây/địa hình che vô lý.
- Hạn chế đặt encounter sát spawn khiến người chơi mới bị áp đảo.
- Bản đồ cần phân biệt vị trí người chơi, quái, vật phẩm rơi và cổng.
- Không bắt người chơi đi bộ qua khoảng trống dài nếu không có phát hiện, tài nguyên hoặc quyết định thú vị.

## 5. Nhân vật và điều khiển

### 5.1 Khả năng hiện tại

**Đã triển khai:** nhân vật có di chuyển, nhảy, rơi, bơi, va chạm, camera góc nhìn thứ ba và chuyển góc nhìn. Camera có các chế độ rear/front/cinematic trong phần cài đặt. Nhân vật có máu, knockback, trạng thái chết/hồi sinh và trang bị đang dùng.

### 5.2 Sơ đồ điều khiển

| Hành động | Desktop | Mobile |
|---|---|---|
| Di chuyển | WASD / phím mũi tên | Joystick ảo |
| Xoay camera | Chuột khi pointer lock | Vuốt nửa phải màn hình |
| Nhảy | Space | Nút Nhảy |
| Tấn công | J hoặc chuột trái | Nút Đánh |
| Né tránh | Shift | Nút Lăn |
| Hành trang | I | Nút Túi |
| Tương tác | E | Nút Tương tác |
| Đổi góc nhìn | V | Nút Góc nhìn |
| Tạm dừng/cài đặt | Esc hoặc nút menu | Nút menu |

### 5.3 Nguyên tắc điều khiển
- Joystick và nút hành động phải có hit area đủ lớn, không chồng HUD hoặc vùng camera.
- Khi app/tab mất focus, mọi input đang giữ phải được reset.
- Touch camera không được vô tình kích hoạt nút hành động.
- Pointer lock chỉ là cách điều khiển desktop; cần có trạng thái hướng dẫn và cách tiếp tục sau khi thoát lock.
- Nút tương tác chỉ hiện khi có mục tiêu trong tầm với.

## 6. Chiến đấu và encounter

### 6.1 Vòng chiến đấu

Vòng cơ bản: **Quan sát → Tiếp cận/giữ khoảng cách → Tấn công hoặc né → Đọc phản hồi → Thu thập phần thưởng**.

**Đã triển khai:** tấn công theo hướng nhân vật, giới hạn tầm/khung góc đánh, chí mạng, sát thương, knockback, né tránh, thời gian bất tử ngắn sau khi trúng đòn và phản hồi HUD/âm thanh/hiệu ứng. Đòn đánh cơ bản có pha lấy đà, thời điểm sát thương được đồng bộ vào pha vung vũ khí; né tránh trong lúc lấy đà hủy cú đánh chưa chạm đích.

**Chưa có trong bản hiện tại:** hệ combo nhiều nhịp, heavy attack, skill tree, phép chủ động hoặc stamina economy. Không đưa chúng vào scope bắt buộc trước khi đòn đánh, hit detection và dodge hiện tại được playtest, cân bằng.

### 6.2 Roster sinh vật hiện có

| Sinh vật | Vai trò thiết kế | Trạng thái |
|---|---|---|
| Slime | Kẻ địch cơ bản, di chuyển theo nhịp nhảy | Có |
| Goblin | Đối thủ cận chiến cơ bản | Có |
| Archer | Gây áp lực từ xa bằng projectile | Có |
| Wolf | Di chuyển nhanh, áp sát | Có |
| Skeleton | Kẻ địch cận chiến có sức chịu đựng cao hơn | Có |
| Bat | Sinh vật bay, thay đổi mặt phẳng tiếp cận | Có |
| Spider | Sinh vật bò, silhouette khác nhóm humanoid | Có |
| Mushroom | Kẻ địch tầm xa với projectile riêng | Có |
| Boss | Encounter riêng trong phòng boss | Có |

Các vai trò trên là cách diễn giải thiết kế từ hành vi và chỉ số hiện tại, không đồng nghĩa mọi AI đã có nhiều biến thể chiến thuật. Mục tiêu tiếp theo là làm cho từng loại dễ phân biệt bằng silhouette, telegraph, tốc độ và khoảng cách hoạt động.

### 6.3 Quy tắc encounter
- Đừng để quá nhiều kẻ địch cùng lúc che khuất tín hiệu chiến đấu.
- Kẻ đánh xa cần có projectile dễ nhìn trên nền sáng và tối.
- Đòn nguy hiểm cần có telegraph rõ ràng, thời gian phản ứng hợp lý.
- Boss cần phân biệt được pha chuẩn bị, thời điểm gây nguy hiểm và khoảng hồi phục.
- Không dùng tăng máu đơn thuần làm cách duy nhất tăng độ khó.

## 7. Hầm ngục

### 7.1 Vòng lặp dungeon

**Đã triển khai:** cổng hầm ngục được sinh theo vùng; cổng đầu tiên được bố trí trong khoảng 24–42 world units từ điểm spawn ở các seed kiểm thử đại diện. Người chơi tiếp cận và tương tác để vào hầm ngục.

Luồng thiết kế:
1. Tìm cổng và kiểm tra tín hiệu trên minimap.
2. Tương tác để vào dungeon.
3. Khám phá hành lang/phòng.
4. Khi vào combat room, cửa khóa và encounter bắt đầu.
5. Đánh bại nhóm quái để mở lại lối đi.
6. Mở rương để nhận trang bị.
7. Vượt boss room.
8. Dùng lối ra/portal để trở lại overworld.

### 7.2 Quy tắc bố cục phòng
- Mỗi phòng cần có lối vào/lối ra đọc được.
- Phòng combat phải có đủ không gian để né tránh và quan sát enemy telegraph.
- Chest không đặt ở vị trí dễ bị che hoặc trùng với đường đi.
- Boss room phải tạo khoảng trống và tầm nhìn lớn hơn combat room thường.
- Room HUD phải nêu rõ số phòng và số kẻ địch còn lại.
- Dungeon generation phải dùng seed để có thể tái hiện lỗi và kiểm tra kết quả.

### 7.3 Phần cần hoàn thiện
- Tạo nhịp độ giữa combat room, treasure room và boss room thay vì xếp các trận giống nhau.
- Bổ sung landmark và màu ánh sáng riêng cho dungeon.
- Đo thời gian hoàn thành và số lần chết qua playtest; chưa đặt con số mục tiêu trước khi có dữ liệu.
- Kiểm tra lặp enter/exit, chết trong dungeon, reload trang và dọn tài nguyên scene.

## 8. Vật phẩm, loot và tiến trình

### 8.1 Trang bị hiện tại

Có ba slot trang bị:
- **Weapon:** kiếm, rìu chiến, dao găm, giáo.
- **Armor:** áo da, giáp xích, giáp thép.
- **Trinket:** nhẫn, bùa hộ mệnh, mề đay.

Bốn rarity hiện có: **Thường, Tốt, Hiếm, Sử thi**. Rarity quyết định số affix và màu hiển thị. Chỉ số hiện có gồm sát thương, hồi chiêu, tầm đánh, giảm sát thương, máu tối đa, tốc độ chạy và chí mạng.

### 8.2 Inventory và loot
- Inventory hiện có 24 ô.
- Người chơi có thể xem so sánh chỉ số, trang bị, tháo trang bị và vứt vật phẩm.
- Loot được tạo theo seed và nguồn rơi; chest có xác suất nhận đồ cao hơn enemy drop.
- Nếu inventory đầy, game phải báo rõ và không âm thầm làm mất vật phẩm.
- Khi túi đầy, chỉ những món được inventory chấp nhận mới được thu tự động; phần còn lại được đặt lại quanh lối ra hầm ngục trên overworld và có thông báo số lượng.
- Drop được chuyển lại phải dùng độ cao terrain overworld đã khôi phục, không dùng độ cao sàn dungeon.
- Drop trên mặt đất vẫn theo thời hạn tồn tại 120 giây của hệ thống loot hiện tại; đây không phải kho lưu trữ vĩnh viễn.

### 8.3 Tiến trình

**Đã có:** cấp dungeon được tính theo vị trí/vùng và ảnh hưởng scale chỉ số enemy/boss, hệ thống save giữ vị trí, máu, inventory, trang bị, thiết lập và dữ liệu module đã đăng ký.

**Chưa có:** XP của người chơi, level-up loop hoàn chỉnh, skill tree, quest progression, crafting, currency hoặc shop. Không hiển thị nút/tài nguyên giả cho các hệ thống này.

**Định hướng sau vertical slice:** ưu tiên mở rộng trang bị và encounter reward trước; chỉ thêm XP/skill tree khi gameplay chứng minh cần thêm lựa chọn phát triển nhân vật.

## 9. UI/UX

### Màn hình và thành phần
- HUD: máu, vũ khí đang dùng, trạng thái encounter, FPS/tọa độ dạng tùy chọn.
- Minimap: người chơi, quái, loot, cổng; có chế độ mở rộng và zoom.
- Inventory: trang bị đang mặc, 24 ô túi, chi tiết và so sánh chỉ số.
- Menu: hình ảnh, camera/điều khiển, hiệu năng, âm thanh và tiện ích.
- Toast/banner: nhặt đồ, bắt đầu/kết thúc encounter và thông báo gameplay.
- Death screen: thông báo gục ngã và hành động hồi sinh.

### Nguyên tắc thị giác
- Ưu tiên hierarchy, tương phản và kích thước chữ dễ đọc.
- Không đặt quá nhiều thông tin thường trực lên màn hình.
- Nền UI dùng surface đặc, viền tiết chế; tránh gradient trang trí.
- Tôn trọng safe area, portrait/landscape và `prefers-reduced-motion`.
- Chuyển động UI phải có thể bị ngắt; gameplay không phụ thuộc vào CSS animation event.
- Mỗi trạng thái lỗi hoặc thao tác không thành công phải có phản hồi dễ hiểu.

## 10. Art direction, animation và audio

### Art direction
Hướng hiện tại là **hybrid stylized-toon**:
- Terrain mượt theo heightmap, vertex colors theo biome/độ cao/độ dốc.
- Nhân vật và một số props giữ silhouette chunky/block-built để dễ đọc.
- Vegetation theo cụm và khoảng cách; hạn chế chi tiết nhỏ gây nhiễu trên mobile.
- GLB environment giữ nguồn PBR maps và được điều chỉnh để phù hợp ánh sáng mềm.
- Dùng palette chung; item rarity có màu thống nhất.

Không quay lại block-voxel terrain làm hướng mặc định. Mọi asset mới phải khớp scale, silhouette, chất liệu và budget trong Art Bible.

### Animation và game feel
Ưu tiên các trạng thái hiện có: idle, move, jump, landing, attack, dodge/roll, hurt, death. Nâng cấp theo thứ tự:
1. Root motion/pose rõ ràng và khớp tốc độ di chuyển.
2. Telegraph, hit confirmation và recovery window dễ đọc.
3. Animation chuyển trạng thái không giật hoặc giữ pose lỗi.
4. Đồng bộ nhẹ với VFX, âm thanh và rung tùy chọn.

### Audio
- Hiện có Web Audio synth làm fallback và hỗ trợ file audio tùy chọn.
- Bổ sung âm thanh chỉ khi có vai trò rõ: bước chân, môi trường, tấn công, trúng đòn, loot, cửa và boss.
- Audio phải theo volume setting, chỉ unlock theo user gesture và suspend hợp lý khi trang ẩn.
- Mọi file âm thanh phải có nguồn và license được ghi trong asset records.

## 11. Lưu dữ liệu và offline

- Save hiện dùng localStorage trên thiết bị/trình duyệt; đây không phải cloud save.
- Dữ liệu save có version và module registration; load phải validate item trước khi áp dụng.
- Autosave theo thay đổi, có lần lưu định kỳ và khi trang bị ẩn/pagehide.
- Offline shell cache các file runtime; model/audio tùy chọn có fallback. Không được để asset tải lỗi khiến game không thể khởi động.
- Khi thay schema save, phải có migration hoặc fallback an toàn; không âm thầm xóa save hợp lệ.

## 12. Kế hoạch sản phẩm theo giai đoạn

| Giai đoạn | Mục tiêu | Điều kiện kết thúc |
|---|---|---|
| **P0 — Chốt vertical slice hiện tại** | Xác minh vòng lặp spawn → tìm cổng → vào dungeon → combat → chest → boss → trở ra trên mobile và PC | Không kẹt trạng thái; input, save, loot và dungeon cleanup ổn định |
| **P1 — Làm game feel tốt** | Điều chỉnh movement, camera, hit detection, dodge, enemy telegraph, feedback và HUD | Người chơi có thể hiểu vì sao trúng đòn/thắng/thua; các hành động phản hồi nhất quán |
| **P2 — Hoàn thiện một khu vực** | Tăng landmark, môi trường, mật độ encounter, âm thanh và điểm khám phá trong khu vực xuất phát | Khu vực có nhịp khám phá rõ, không chỉ là địa hình trống |
| **P3 — Mở rộng nội dung** | Thêm biến thể phòng, enemy và vùng mới khi art/AI/budget đã sẵn sàng | Mỗi nội dung mới có bản sắc và không làm giảm hiệu năng |
| **P4 — Polish và release gate** | Kiểm thử thiết bị thật, save/offline, UI portrait/landscape, lỗi dài phiên và hiệu năng | Đạt checklist QA trên thiết bị tham chiếu; phát hành có changelog và cách báo lỗi |

**Quy tắc ưu tiên:** không mở rộng bản đồ lớn hoặc thêm nhiều hệ thống tiến trình trước khi P0 và P1 đạt điều kiện kết thúc.

## 13. Tiêu chí chấp nhận cho vertical slice

- [ ] New game khởi động được, mục tiêu tìm cổng dungeon được giải thích trong game.
- [ ] Cổng đầu tiên có thể tìm thấy qua thế giới và minimap trên các seed đại diện.
- [ ] Người chơi vào/ra dungeon được nhiều lần mà không nhân đôi enemy, loot, portal hoặc object.
- [ ] Combat room khóa/mở cửa đúng; room HUD cập nhật đúng số kẻ địch.
- [ ] Boss có thể bắt đầu, kết thúc và dọn projectile/telegraph đúng.
- [ ] Chest tạo loot hợp lệ; inventory đầy có thông báo và không mất đồ ngoài ý muốn.
- [ ] Equip/unequip cập nhật đúng chỉ số; save/reload giữ nguyên trang bị và inventory.
- [ ] Hành động cốt lõi dùng được cả touch lẫn keyboard/mouse.
- [ ] Portrait và landscape không che HUD hoặc nút thiết yếu.
- [ ] Asset tùy chọn tải lỗi vẫn có procedural fallback.
- [ ] Không có lỗi nghiêm trọng khi tab ẩn/hiện, mất focus, WebGL context lost hoặc reload.
- [ ] Có đo hiệu năng trên ít nhất một Android device thật và một desktop browser; tách biệt rõ kết quả thực đo với headless CI.

## 14. Những thứ chưa thuộc scope bản nền tảng

Để giữ phạm vi có thể hoàn thiện, chưa cam kết các tính năng sau:
- Multiplayer/co-op/PvP, tài khoản và cloud sync.
- Story campaign, NPC, dialogue và quest chain hoàn chỉnh.
- XP/skill tree, phép chủ động, crafting, shop/currency và hệ thống kinh tế.
- Nhiều thế giới lớn, mounts, guild hoặc live-service.
- Bắt buộc 144 FPS trên mọi thiết bị.

Các tính năng này chỉ được đưa vào roadmap sau khi có thiết kế riêng, lý do gameplay rõ ràng và đánh giá chi phí kỹ thuật.

## 15. Tài liệu tham chiếu trong repository

- [Art Bible](../ART.md) — visual direction, scale, palette, asset budget và quy trình asset.
- [Quality Upgrade Roadmap](../QUALITY_ROADMAP.md) — thứ tự cải thiện UI, animation, models, materials, audio, item systems, gameplay và performance.
- [Asset Sources](../ASSETS.md) — nguồn asset, license, immutable revisions và runtime model manifest.
- [GLB Asset Audit](../ASSET_AUDIT.md) — topology, texture và memory estimate.
- [Runtime State](../STATE.md) — nhật ký các stage đã hoàn thành.
- [Android Profiling](./ANDROID-PROFILING.md) — hướng dẫn thu thập profile trên thiết bị.

### Tài liệu nền tảng web
Các tài liệu này hỗ trợ những giới hạn nền tảng cần giữ khi triển khai; không có nghĩa là có thể nâng Three.js khỏi r128 mà không kiểm tra tương thích:
- [Three.js WebGLRenderer](https://threejs.org/docs/pages/WebGLRenderer.html)
- [Three.js GLTFLoader](https://threejs.org/docs/pages/GLTFLoader.html)
- [MDN Pointer Lock API](https://developer.mozilla.org/en-US/docs/Web/API/Pointer_Lock_API)
- [MDN Page Visibility API](https://developer.mozilla.org/en-US/docs/Web/API/Page_Visibility_API)
- [MDN Web Audio best practices](https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API/Best_practices)

---

**Quy tắc cập nhật GDD:** khi gameplay thay đổi, cập nhật trạng thái trong tài liệu và đối chiếu code trước khi mô tả tính năng là “đã có”. Không dùng kế hoạch này làm bằng chứng rằng tính năng đã được triển khai hoặc đã qua playtest trên thiết bị thật.


## QA / Developer Mode
- Settings exposes a code-gated, session-only test panel for world/time/teleport/dungeon navigation, player/camera, enemies/boss, loot preview/validation, graphics/effects, map/UI and diagnostics.
- QA actors can be released into gameplay for AI/combat checks and then removed through scoped QA cleanup.
- Temporary player/equipment/inventory and presentation changes are restored on close; save writes are suppressed while Dev Mode is open.
- The access code is a convenience gate in the browser, not server authentication. It does not execute arbitrary JavaScript.
