# Cập nhật dự án bằng ZIP

Workflow **Import ZIP and open sync PR** sẽ tự giải nén ZIP, chạy kiểm tra JavaScript và mở Pull Request vào `main`. ZIP không được giải nén trực tiếp lên `main`.

## Cách sử dụng

1. Mở [nhánh của repository](https://github.com/slgamervn/Beside/branches) và tạo một nhánh mới từ `main`, ví dụ `upload-art-bible`.
2. Chuyển sang nhánh đó, chọn **Add file → Upload files**.
3. Tải ZIP lên thư mục gốc và đặt đúng tên `incoming-art-bible.zip`.
4. Chọn **Commit changes** trực tiếp vào nhánh `upload-art-bible`. Đừng commit ZIP trực tiếp lên `main`.
5. Mở tab **Actions** để theo dõi workflow. Workflow kiểm tra ZIP, giải nén lên một bản sạch từ `main`, chạy `node tests/headless-camera-smoke.cjs`, rồi tạo hoặc cập nhật PR `Sync complete art bible archive`.
6. Khi PR xanh và đã xem phần **Files changed**, nhấn **Merge pull request**. Sau đó có thể xóa nhánh tải lên.

## Lưu ý

- ZIP phải chứa các đường dẫn tương đối từ thư mục gốc dự án, ví dụ `index.html`, `gallery.js`, `js/player.js`; không bọc tất cả tệp bên trong một thư mục cấp cao.
- Workflow từ chối đường dẫn thoát khỏi thư mục dự án, symlink, ZIP quá lớn, hoặc tệp trong `.git/` và `.github/`.
- Workflow giữ lại `js/audio-fix.js` hiện có và thêm thẻ script tương ứng vào `index.html` nếu ZIP cũ bỏ sót.
- Nếu bước tạo PR báo thiếu quyền, vào **Settings → Actions → General** và bật **Allow GitHub Actions to create and approve pull requests**. Workflow cần quyền ghi nội dung và Pull Requests.
- Tệp không có trong ZIP không bị tự động xóa khỏi repository; chỉ các tệp được ZIP cung cấp mới được tạo hoặc ghi đè.
