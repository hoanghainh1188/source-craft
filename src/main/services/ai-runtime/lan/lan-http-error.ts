// #228: lỗi HTTP từ máy chủ LAN AI — giữ mã trạng thái để provider đổi sang lỗi người-dùng-thấy (không lộ thân phản hồi).
// Message giữ dạng "HTTP <status>: <text>" như trước (lanAi:testConnection hiện nguyên văn).

export class LanHttpError extends Error {
  constructor(
    readonly status: number,
    statusText: string,
  ) {
    super(`HTTP ${status}: ${statusText}`);
    this.name = "LanHttpError";
  }
}

/** Tuỳ chọn lệnh gọi LAN: signal gộp (huỷ của người dùng + timeout) do provider quản lý. */
export interface LanChatOptions {
  signal?: AbortSignal;
}
