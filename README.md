# Quiz Solver

Chrome Extension + Bridge Server dùng Kiro CLI trả lời câu hỏi trắc nghiệm.

## Cài đặt

```bash
# 1. Bridge server
cd bridge
npm install
npm start

# 2. Extension
# Chrome → chrome://extensions → Developer mode ON
# → Load unpacked → chọn thư mục extension/
```

## Sử dụng

1. Select text (câu hỏi + đáp án)
2. Nhấn `Ctrl+Q`
3. Đáp án hiện góc phải trên cùng → tự ẩn sau 5 giây

## Tuỳ chỉnh

Nếu `kiro-cli` không nằm trong PATH, đặt biến môi trường:

```bash
KIRO_PATH=/path/to/kiro-cli npm start
```
