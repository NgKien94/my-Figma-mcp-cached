# Sử dụng Figma MCP Cached với Claude trên mạng nội bộ

Tài liệu này hướng dẫn chạy **Figma MCP Cached** ở chế độ HTTP trên một máy chủ trong mạng nội bộ, sau đó kết nối Claude Code hoặc Claude Desktop để team sử dụng chung.

## 1. Chuẩn bị máy chủ

Yêu cầu:

- Node.js 18 trở lên.
- pnpm.
- PAT Figma của các thành viên hoặc tài khoản có quyền truy cập file cần xử lý.
- Máy chủ có địa chỉ IP trong mạng LAN mà máy thành viên có thể truy cập.

Tại thư mục dự án:

```bash
pnpm install
pnpm build
```

## 2. Cấu hình PAT pool

Tạo hoặc cập nhật file `.env` tại thư mục dự án:

```dotenv
FIGMA_API_KEYS=["pat_1","pat_2","pat_3"]
PORT=3333
FIGMA_CACHING={"ttl":{"value":7,"unit":"d"}}
```

Các thuộc tính:

- `FIGMA_API_KEYS`: danh sách PAT của thành viên. Có thể dùng JSON array hoặc danh sách cách nhau bằng dấu phẩy.
- `PORT`: cổng HTTP MCP. Mặc định là `3333`.
- `FIGMA_CACHING`: cấu hình cache đĩa và thời gian sống cache.

Danh sách PAT dạng dấu phẩy:

```dotenv
FIGMA_API_KEYS=pat_1,pat_2,pat_3
```

Vẫn hỗ trợ cấu hình PAT đơn lẻ cũ:

```dotenv
FIGMA_API_KEY=pat_1
```

Khi `FIGMA_API_KEYS` được cấu hình, pool này có ưu tiên cao hơn `FIGMA_API_KEY`.

Khi một PAT trả về `401`, `403` hoặc `429`, server sẽ tự thử PAT kế tiếp trong pool.

> Không commit file `.env` hoặc chia sẻ PAT cho người không cần truy cập. PAT hiện nằm trên máy chủ và không cần cấu hình trên từng máy Claude.

## 3. Chạy cache MCP server

Chạy server ở chế độ HTTP:

```bash
pnpm start
```

Hoặc chạy file build trực tiếp:

```bash
node dist/bin.js --port=3333
```

Server phải tiếp tục chạy trong suốt thời gian team sử dụng MCP.

Server hiện bind HTTP trên `0.0.0.0`, vì vậy máy thành viên trong LAN có thể kết nối nếu firewall cho phép.

## 4. Tìm địa chỉ máy chủ

Trên máy chạy MCP server:

```bash
hostname -I
```

Chọn địa chỉ LAN phù hợp, ví dụ `192.168.1.50`.

Endpoint MCP là:

```text
http://IP_MÁY_CHỦ:3333/mcp
```

Ví dụ:

```text
http://192.168.1.50:3333/mcp
```

Chế độ HTTP hiện không có xác thực MCP riêng. Chỉ chạy trong mạng LAN tin cậy, giới hạn firewall theo subnet và không public port ra Internet.

## 5. Kết nối bằng Claude Code

Trên máy thành viên, thêm MCP server HTTP:

```bash
claude mcp add --transport http figma-cached http://192.168.1.50:3333/mcp
```

Thay `192.168.1.50` bằng IP máy chủ thực tế.

Kiểm tra danh sách MCP:

```bash
claude mcp list
```

Khởi động Claude Code:

```bash
claude
```

Trong phiên Claude, mở giao diện MCP bằng:

```text
/mcp
```

Server nên xuất hiện với tên `figma-cached`.

Nếu đã có server Figma khác, ví dụ Framelink, hãy tắt server trùng tên để Claude không chọn nhầm.

Trong Claude Code, mở giao diện quản lý MCP:

```text
/mcp
```

Trong giao diện đó:

1. Chọn server Figma hoặc Framelink.
2. Chọn lệnh tắt server (`Disable` hoặc `Disconnect`) thay vì gỡ cấu hình.
3. Giữ nguyên server `figma-cached` ở trạng thái bật.

Sau đó khởi động lại Claude Code để kết nối MCP được làm mới:

```bash
claude
```

Cách này chỉ tắt server trong phiên Claude hiện tại hoặc theo cấu hình được Claude hỗ trợ, không xóa cấu hình MCP khỏi máy.

## 6. Kết nối bằng Claude Desktop

Thêm cấu hình sau vào MCP configuration của Claude Desktop:

```json
{
  "mcpServers": {
    "figma-cached": {
      "type": "http",
      "url": "http://192.168.1.50:3333/mcp"
    }
  }
}
```

Thay `192.168.1.50` bằng IP máy chủ.

Sau đó khởi động lại Claude Desktop để MCP được nạp lại.

## 7. Cách MCP hoạt động

MCP cung cấp các công cụ:

- `figma_prepare_file`: chuẩn bị Figma file, kiểm tra cache và làm mới dữ liệu khi cần.
- `get_figma_data`: lấy layout, text, style, component và cấu trúc node.
- `download_figma_images`: xuất và tải ảnh PNG/SVG.
- `list_cache`: xem trạng thái cache.
- `cleanup_cache`: xóa cache hết hạn hoặc hỏng.

Quy trình bình thường:

```text
Figma URL
  -> figma_prepare_file
  -> cache hoặc Figma API
  -> get_figma_data
  -> Claude xử lý dữ liệu
```

Cache chỉ hoạt động khi `FIGMA_CACHING` được cấu hình. Trong thời gian TTL, server có thể trả dữ liệu local mà không gọi Figma API.

## 8. Prompt lấy một section hoặc màn hình

Link section cần chứa `node-id` để AI biết node cụ thể cần xử lý:

```text
https://www.figma.com/design/FILE_KEY/Project-name?node-id=1234-5678
```

Ví dụ prompt implement section:

```text
Dùng MCP server `figma-cached` để xử lý link Figma sau:

https://www.figma.com/design/FILE_KEY/Project-name?node-id=1234-5678

Thực hiện:
1. Gọi `figma_prepare_file` với Figma URL.
2. Gọi `get_figma_data` để lấy section và các màn hình con.
3. Ưu tiên cache local nếu cache còn trong TTL.
4. Chỉ gọi lại Figma khi cache thiếu, cache hết hạn hoặc tôi yêu cầu forceRefresh=true.
5. Trích xuất từng frame/màn hình trong section:
   - Tên màn hình
   - Layout hierarchy
   - Text
   - Component và variant
   - Typography
   - Màu sắc
   - Spacing
   - Trạng thái UI

Sau đó implement section thành code React, sử dụng giá trị layout và style chính xác từ Figma.
```

## 9. Prompt chỉ phân tích dữ liệu

```text
Dùng MCP server `figma-cached`.

Phân tích section Figma sau:
https://www.figma.com/design/FILE_KEY/Project-name?node-id=1234-5678

Thực hiện:
1. Gọi `figma_prepare_file` trước.
2. Gọi `get_figma_data`.
3. Không dùng Figma MCP khác.
4. Không gọi lại Figma nếu cache còn hợp lệ.
5. Tách kết quả theo từng frame/màn hình con.

Với từng màn hình, mô tả bố cục, content, hierarchy, component, style và responsive behavior nếu dữ liệu cho phép.
```

## 10. Prompt ép làm mới dữ liệu

```text
Dùng MCP server `figma-cached`.

Thiết kế vừa được cập nhật. Lấy dữ liệu mới nhất cho:
https://www.figma.com/design/FILE_KEY/Project-name?node-id=1234-5678

Gọi `figma_prepare_file` với:
{
  "figmaUrl": "https://www.figma.com/design/FILE_KEY/Project-name?node-id=1234-5678",
  "forceRefresh": true
}

Sau đó gọi `get_figma_data` và implement những thay đổi mới nhất.
```

## 11. Cache và làm mới

Cache giúp giảm số lần gọi Figma API:

- Cache còn hiệu lực: Claude đọc dữ liệu local.
- Cache hết hạn: server gọi Figma để làm mới.
- Cache thiếu node: server có thể gọi Figma lại.
- `forceRefresh: true`: luôn làm mới dữ liệu file.
- Không cache: bỏ cấu hình `FIGMA_CACHING` để phục vụ dữ liệu mới qua API ở mỗi lần cần.

Khi link không có `node-id`, MCP thường xem đó là toàn bộ Figma file thay vì một section cụ thể. Hãy copy link trực tiếp của section hoặc frame để có `node-id` chính xác.

## 12. PAT và quyền truy cập

- PAT pool chỉ được đặt trên máy chủ MCP.
- Mỗi PAT phải có quyền truy cập các file Figma cần xử lý.
- PAT cá nhân không tự có quyền truy cập file mà chủ PAT không được xem.
- PAT chung trong team cần thuộc tài khoản workspace có quyền phù hợp.
- Cache dữ liệu có thể chứa text, tên node, component, style và metadata thiết kế.

## 13. Bảo mật mạng LAN

Vì server HTTP chưa có authentication riêng, chỉ nên triển khai trong môi trường tin cậy:

- Giới hạn firewall cổng `3333` theo subnet nội bộ.
- Không forward port `3333` ra Internet.
- Không chạy server trên Wi-Fi công cộng.
- Không bật development mode trong production để tránh ghi dữ liệu Figma vào thư mục `logs/`.
- Không commit PAT hoặc khoá mã hóa cache.
- Tắt server bằng `Ctrl+C` khi không cần tiếp tục dùng.

## 14. Chế độ stdio

Chế độ stdio chỉ dùng khi Claude chạy cùng máy với MCP server:

```bash
pnpm start -- --stdio
```

Hoặc MCP server có thể được Claude tự khởi động qua cấu hình stdio. Chế độ này không mở cổng `3333` và không phù hợp để nhiều máy team kết nối trực tiếp.

Để team dùng chung qua LAN, tiếp tục dùng HTTP như hướng dẫn ở trên.
