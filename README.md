# Figma Context MCP — Cached

<div align="center">
  <img src="./docs/logo.png" alt="Figma Context MCP Logo" width="200" style="border-radius: 50%; border: 3px solid #e0e0e0; padding: 10px; background-color: #ffffff;">
</div>

Phiên bản MCP hỗ trợ Figma với **bộ nhớ đệm bền vững trên máy cục bộ**. Dự án giúp giảm số lần gọi Figma API, tránh giới hạn tốc độ, tăng tốc độ phản hồi và làm việc ổn định hơn với các MCP client như Cursor.

> Phiên bản tiếng Anh: [README_EN.md](./README_EN.md)

## Tính năng

- Bộ nhớ đệm Figma file trên đĩa.
- Giảm số lần gọi Figma API.
- Thiết lập thời gian sống cache bằng TTL.
- Chọn thư mục cache tùy chỉnh.
- Cung cấp `figma_prepare_file` để chuẩn bị, xác thực và làm mới dữ liệu.
- Kiểm tra node ID trước khi truy xuất thiết kế.
- Cung cấp `forceRefresh` để bỏ qua cache và lấy dữ liệu mới nhất.
- Tải SVG/PNG vào thư mục Downloads hoặc thư mục do người dùng chọn.
- Caching theo mức node và cache LRU trong bộ nhớ.
- Tự động xóa cache hết hạn.
- Xem và dọn cache qua MCP tools.
- Hỗ trợ mã hóa cache tùy chọn bằng AES-256-CBC.
- Hỗ trợ vận hành qua stdio hoặc HTTP.

## Cài đặt và cấu hình nhanh

### 1. Tạo Figma Personal Access Token

Mở [Figma Developer Settings](https://www.figma.com/developers/api#access-tokens), tạo Personal Access Token và giữ token riêng tư.

### 2. Thêm MCP server vào Cursor

```json
{
  "mcpServers": {
    "Figma-Context-MCP-Cached": {
      "command": "npx",
      "args": [
        "-y",
        "@pactortester/figma-mcp-cached",
        "--stdio",
        "--figma-api-key=FIGMA_PERSONAL_ACCESS_TOKEN",
        "--figma-caching={\"ttl\":{\"value\":7,\"unit\":\"d\"}}"
      ]
    }
  }
}
```

Ví dụ trên bật cache với thời hạn 7 ngày.

### 3. Chạy tại máy phát triển

Yêu cầu Node.js 18 trở lên và pnpm.

```bash
pnpm install
pnpm build
pnpm start -- --stdio --figma-api-key=FIGMA_PERSONAL_ACCESS_TOKEN
```

Chế độ HTTP:

```bash
pnpm start -- --figma-api-key=FIGMA_PERSONAL_ACCESS_TOKEN --port=3333
```

Sau đó kết nối MCP client tới:

- Streamable HTTP: `http://localhost:3333/mcp`
- SSE: `http://localhost:3333/sse`
- Message: `http://localhost:3333/messages`

> Chế độ HTTP hiện không dùng xác thực MCP riêng. Chỉ chạy trên mạng tin cậy hoặc đặt bên sau reverse proxy có xác thực.

## Cách xác thực

Ưu tiên biến môi trường hoặc file `.env`:

```dotenv
# Một PAT đơn lẻ — tương thích với cấu hình hiện tại
FIGMA_API_KEY=figma_personal_access_token

# PAT pool — khi một PAT bị từ chối, hết quota hoặc bị 401/403/429
# Server tự thử PAT tiếp theo theo thứ tự. Ưu tiên pool này khi được đặt.
FIGMA_API_KEYS=["figma_pat_thanh_vien_1","figma_pat_thanh_vien_2","figma_pat_thanh_vien_3"]

FIGMA_OAUTH_TOKEN=
PORT=3333
OUTPUT_FORMAT=yaml
SKIP_IMAGE_DOWNLOADS=false
FIGMA_CACHING={"ttl":{"value":7,"unit":"d"}}
```

Cũng có thể dùng danh sách cách nhau bằng dấu phẩy:

```dotenv
FIGMA_API_KEYS=figma_pat_thanh_vien_1,figma_pat_thanh_vien_2,figma_pat_thanh_vien_3
```

Hoặc truyền qua dòng lệnh:

```bash
node dist/bin.js --port=3333 --figma-api-keys='["figma_pat_1","figma_pat_2","figma_pat_3"]'
```

Mặc định chương trình tải `.env` từ thư mục làm việc hiện tại. Có thể chỉ định file khác:

```bash
pnpm start -- --stdio --env=/duong-dan/den/.env
```

Các nguồn cấu hình theo thứ tự ưu tiên:

1. Tham số dòng lệnh.
2. Biến môi trường hoặc file `.env`.
3. Giá trị mặc định.

Không chia sẻ hoặc commit `FIGMA_API_KEY`, `FIGMA_OAUTH_TOKEN`, khoá mã hóa cache hoặc file `.env`.

## Tham số dòng lệnh

| Tham số | Kiểu | Mặc định | Mô tả |
|---|---|---:|---|
| `--figma-api-key` | chuỗi | — | Một Figma Personal Access Token đơn lẻ |
| `--figma-api-keys` | chuỗi JSON hoặc danh sách cách dấu phẩy | — | Pool PAT để tự chuyển key khi PAT bị lỗi hoặc hết quota |
| `--figma-oauth-token` | chuỗi | — | Figma OAuth Bearer token |
| `--env` | đường dẫn | `.env` trong thư mục làm việc | File môi trường tùy chỉnh |
| `--port` | số | `3333` | Cổng HTTP |
| `--json` | cờ | `false` | Trả dữ liệu JSON thay vì YAML |
| `--skip-image-downloads` | cờ | `false` | Không đăng ký công cụ tải ảnh |
| `--figma-caching` | chuỗi JSON | không bật | Cấu hình cache |
| `--stdio` | cờ | — | Chạy transport stdio |

## Cấu hình cache

Bật cache bằng tham số `--figma-caching` hoặc biến `FIGMA_CACHING`:

```json
{
  "ttl": {
    "value": 30,
    "unit": "d"
  },
  "cacheDir": "~/figma-cache",
  "autoCleanup": true,
  "cleanupInterval": {
    "value": 1,
    "unit": "h"
  },
  "maxMemoryCacheSize": 200,
  "encryptionKey": "khoa-bao-mat-khong-chia-se"
}

```

Cách sử dụng trong dòng lệnh:

```bash
--figma-caching={"ttl":{"value":30,"unit":"d"},"cacheDir":"~/figma-cache","autoCleanup":true,"cleanupInterval":{"value":1,"unit":"h"},"maxMemoryCacheSize":200,"encryptionKey":"khoa-bao-mat-khong-chia-se"}
```

### TTL

`ttl.value` là số lượng và `ttl.unit` nhận một trong các giá trị:

| Đơn vị | Ý nghĩa |
|---|---|
| `ms` | mili giây |
| `s` | giây |
| `m` | phút |
| `h` | giờ |
| `d` | ngày |

### Các tuỳ chọn cache

| Thuộc tính | Kiểu | Mặc định | Mô tả |
|---|---|---:|---|
| `ttl` | object | bắt buộc | Thời hạn cache |
| `cacheDir` | chuỗi | theo hệ điều hành | Thư mục lưu cache |
| `autoCleanup` | boolean | `true` | Tự động xóa cache hết hạn |
| `cleanupInterval` | object | 1 giờ | Chu kỳ chạy tự động cleanup |
| `maxMemoryCacheSize` | số | `100` | Số mục cache LRU tối đa trong bộ nhớ |
| `encryptionKey` | chuỗi | không bật | Khoá mã hóa cache |

Đường dẫn cache mặc định:

- Linux: `~/.cache/figma-mcp`
- macOS: `~/Library/Caches/FigmaMcp`
- Windows: `%LOCALAPPDATA%\FigmaMcpCache`

Không cung cấp `cacheDir` hoặc khóa có khoảng trắng không cần thiết. Sử dụng đường dẫn tuyệt đối nếu muốn kiểm soát dữ liệu rõ ràng.

## Cách cache hoạt động

1. Lần đầu truy vấn một Figma file, server gọi Figma API.
2. Toàn bộ dữ liệu trả về được nén và lưu local.
3. Trong thời hạn TTL, dữ liệu được đọc từ cache thay vì gọi lại API.
4. Khi cache hết hạn, server gọi Figma API để làm mới dữ liệu.
5. `figma_prepare_file` có thể kiểm tra cache và gọi lại API khi cần.

Cache phù hợp với thiết kế đã ổn định hoặc ít thay đổi. Khi dùng cache, dữ liệu có thể chưa phản ánh thay đổi mới nhất trên Figma cho đến khi cache hết hạn hoặc được làm mới thủ công.

Làm mới dữ liệu bằng cách:

- Gọi `figma_prepare_file` với `forceRefresh: true`.
- Yêu cầu AI "lấy dữ liệu Figma mới nhất".
- Xóa cache tương ứng trong thư mục cache.
- Gọi công cụ `cleanup_cache`.

## Các MCP tools

Dự án cung cấp năm công cụ MCP:

### `figma_prepare_file`

Chuẩn bị Figma file trước khi truy xuất dữ liệu.

| Tham số | Kiểu | Bắt buộc | Mô tả |
|---|---|---|---|
| `figmaUrl` | string | Có | Figma URL có dạng `https://www.figma.com/design/<fileKey>/...` hoặc `https://www.figma.com/file/<fileKey>/...` |
| `forceRefresh` | boolean | Không | Bỏ qua cache và lấy dữ liệu mới nhất |

Ví dụ:

```json
{
  "figmaUrl": "https://www.figma.com/design/FILE_KEY/ten-file?node-id=1234-5678",
  "forceRefresh": true
}
```

Workflow khuyến nghị:

```text
Người dùng cung cấp URL
  -> figma_prepare_file
  -> get_figma_data
```

### `get_figma_data`

Lấy dữ liệu thiết kế, bố cục, content, visual và component.

| Tham số | Kiểu | Bắt buộc | Mô tả |
|---|---|---|---|
| `fileKey` | string | Có | Key trong URL Figma |
| `nodeId` | string | Không | Node ID, ví dụ `1234:5678` hoặc `1234-5678` |
| `depth` | number | Không | Độ sâu truy cập node tree |

Ví dụ:

```json
{
  "fileKey": "FILE_KEY",
  "nodeId": "2777:9428",
  "depth": 5
}
```

Kết quả có thể bao gồm:

- `metadata`: thông tin file.
- `nodes`: node, layout, style và content.
- `globalVars`: biến style toàn cục.
- `components`: component definitions.
- `componentSets`: component sets.

Luôn gọi `figma_prepare_file` trước khi gọi `get_figma_data`.

### `download_figma_images`

Tải asset PNG/SVG từ Figma.

| Tham số | Kiểu | Bắt buộc | Mô tả |
|---|---|---|---|
| `fileKey` | string | Có | Figma file key |
| `nodes` | array | Có | Danh sách node cần xuất |
| `localPath` | string | Không | Thư mục lưu ảnh |
| `pngScale` | number | Không | Tỷ lệ xuất PNG, mặc định `2` |

Mỗi phần tử trong `nodes`:

| Trường | Kiểu | Bắt buộc | Mô tả |
|---|---|---|---|
| `nodeId` | string | Có | Node ID |
| `fileName` | string | Có | Tên file `.png` hoặc `.svg` |
| `imageRef` | string | Không | Image fill reference |
| `needsCropping` | boolean | Không | Có cần crop theo transform không |
| `cropTransform` | array | Không | Figma transform matrix |
| `requiresImageDimensions` | boolean | Không | Có cần trả kích thước ảnh không |

Ví dụ:

```json
{
  "fileKey": "FILE_KEY",
  "nodes": [
    {
      "nodeId": "2777-9428",
      "fileName": "hero-image.png"
    },
    {
      "nodeId": "2777-9430",
      "fileName": "icon-star.svg"
    }
  ],
  "pngScale": 2
}
```

Khi không chỉ định `localPath`, ảnh được lưu vào:

- macOS/Linux: `~/Downloads`
- Windows: `C:\Users\<username>\Downloads`

### `list_cache`

Liệt kê trạng thái cache.

Tham số: không có.

Thông tin trả về:

- `enabled`: cache có đang bật hay không.
- `cacheDir`: thư mục cache.
- `fileCount`: số file cache.
- `totalSize`: dung lượng đọc được.
- `ttl`: thời hạn cache.

### `cleanup_cache`

Xóa cache hết hạn hoặc bị lỗi.

Tham số: không có.

Thông tin trả về:

- `deletedFiles`: số file đã xóa.
- `previousSize`: dung lượng trước cleanup.
- `currentSize`: dung lượng sau cleanup.
- `currentFileCount`: số file còn lại.

## Khuôn mẫu cấu hình MCP

### Personal Access Token qua biến môi trường

```json
{
  "mcpServers": {
    "Figma-Context-MCP-Cached": {
      "command": "npx",
      "args": [
        "-y",
        "@pactortester/figma-mcp-cached",
        "--stdio"
      ],
      "env": {
        "FIGMA_API_KEY": "FIGMA_PERSONAL_ACCESS_TOKEN",
        "FIGMA_CACHING": "{\"ttl\":{\"value\":7,\"unit\":\"d\"}}"
      }
    }
  }
}
```

### OAuth Bearer token

```json
{
  "mcpServers": {
    "Figma-Context-MCP-Cached": {
      "command": "npx",
      "args": [
        "-y",
        "@pactortester/figma-mcp-cached",
        "--stdio",
        "--figma-oauth-token=FIGMA_OAUTH_TOKEN"
      ]
    }
  }
}
```

## Scripts phát triển

Xem chi tiết tại [SCRIPTS.md](./SCRIPTS.md).

```bash
pnpm install       # Cài dependency
pnpm dev           # Chạy build/watch
pnpm dev:cli       # Chạy development mode qua stdio
pnpm type-check    # Kiểm tra TypeScript
pnpm lint          # Chạy ESLint
pnpm test          # Chạy Jest
pnpm build         # Build package
pnpm start         # Chạy bản build
```

## Kiểm tra bảo mật cơ bản

- Không commit file `.env`.
- Không truyền token Figma qua prompt, issue hoặc log công khai.
- Tránh cung cấp `encryptionKey` hoặc cache key qua lịch sử shell.
- Chỉ chạy HTTP mode trên localhost hoặc mạng tin cậy.
- Chỉ tải image từ URL do Figma API cấp.
- Khi bật development logging, dữ liệu Figma có thể được ghi vào thư mục `logs/`.
- Xem lại cache trước khi đóng gói máy, sao lưu hoặc chia sẻ thư mục workspace.
- Nâng cấp dependency thường xuyên bằng `pnpm update` và `pnpm audit`.

Ví dụ kiểm tra bảo mật:

```bash
pnpm audit --prod
pnpm type-check
pnpm test
pnpm build
```

## Cảnh báo về cache và dữ liệu

- Nếu không cấu hình `FIGMA_CACHING`, cache đĩa không được bật.
- Cache lưu dữ liệu Figma; có thể chứa text, tên node, component và metadata.
- Cache mặc định chưa mã hóa dữ liệu.
- Cache legacy `.json` có thể đã từng lưu dữ liệu dạng plaintext.
- Khi đặt `encryptionKey`, giữ khoá an toàn vì mất khoá sẽ không đọc lại được cache.
- Cache có thể trả dữ liệu cũ trong thời gian TTL.

## Tương thích

- Tương thích với Figma Context MCP gốc.
- Hỗ trợ Node.js 18 trở lên.
- Có thể thay thế drop-in cho MCP client hỗ trợ stdio hoặc HTTP.
- Không cần thay đổi gọi tool nếu client đã tuân thủ interface MCP.

## Nhật ký thay đổi

Xem [CHANGELOG.md](./CHANGELOG.md).

## Giấy phép

Dự án phát hành theo [MIT License](./LICENSE).

## Cảm ơn

Dự án được phát triển dựa trên:

- [GLips/Figma-Context-MCP](https://github.com/GLips/Figma-Context-MCP/)
- [stone-w4tch3r/Figma-Context-MCP](https://github.com/stone-w4tch3r/Figma-Context-MCP)

Cảm ơn hai dự án đã cung cấp nền tảng và ý tưởng cho implementation gốc.

