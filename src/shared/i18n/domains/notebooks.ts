import type { Widen } from "../translate";

// 123 — khoá dịch domain "notebooks" (màn Notebooks: lưới, thẻ, modal tạo/sửa, xác nhận xoá).
// vi nguồn as const; en phải cùng cấu trúc + placeholder.

export const notebooksVi = {
  new: "Notebook mới",
  grid: {
    title: "Notebook của bạn",
    subtitle: "Mỗi notebook là một không gian riêng cho một chủ đề nghiên cứu",
    searchPlaceholder: "Tìm notebook… (⌘K)",
    searchLabel: "Tìm notebook",
    create: "Tạo notebook mới",
    emptyTitle: "Chưa có notebook nào",
    emptySub: "Tạo notebook đầu tiên để bắt đầu nạp nguồn và hỏi đáp.",
    noResultTitle: "Không tìm thấy notebook",
    noResultSub: "Không có notebook nào khớp “{query}”. Thử từ khoá khác.",
    exportPackage: "Xuất gói sổ tay (.scnb)…",
    importPackage: "Nhập từ gói (.scnb)…",
    readOnlyBadge: "Dùng chung (Chỉ đọc)",
  },
  card: {
    sources: { one: "{count} nguồn", other: "{count} nguồn" },
    edited: "Sửa {time}",
    edit: "Sửa",
  },
  modal: {
    editTitle: "Sửa notebook",
    name: "Tên",
    namePlaceholder: "Tên notebook…",
    color: "Màu",
    swatch: "Màu {color}",
    create: "Tạo",
  },
  delete: {
    title: "Xoá notebook?",
    body: "Notebook “{name}” sẽ bị xoá vĩnh viễn. Hành động này không thể hoàn tác.",
  },
} as const;

export const notebooksEn: Widen<typeof notebooksVi> = {
  new: "New notebook",
  grid: {
    title: "Your notebooks",
    subtitle: "Each notebook is a separate space for one research topic",
    searchPlaceholder: "Search… (⌘K)",
    searchLabel: "Search notebooks",
    create: "Create a new notebook",
    emptyTitle: "No notebooks yet",
    emptySub:
      "Create your first notebook to start adding sources and asking questions.",
    noResultTitle: "No notebooks found",
    noResultSub: "No notebook matches “{query}”. Try a different keyword.",
    exportPackage: "Export notebook package (.scnb)…",
    importPackage: "Import from package (.scnb)…",
    readOnlyBadge: "Shared (Read-Only)",
  },
  card: {
    sources: { one: "{count} source", other: "{count} sources" },
    edited: "Edited {time}",
    edit: "Edit",
  },
  modal: {
    editTitle: "Edit notebook",
    name: "Name",
    namePlaceholder: "Notebook name…",
    color: "Color",
    swatch: "Color {color}",
    create: "Create",
  },
  delete: {
    title: "Delete notebook?",
    body: "Notebook “{name}” will be permanently deleted. This can't be undone.",
  },
};
