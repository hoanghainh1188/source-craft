// 059 + 231: kiểm "notebook (hoặc cả kho) còn đang tái lập chỉ mục" cho rag:ask. Thuần (deps tiêm vào) để test được.
// Per-notebook (research R4 của 059): chỉ chặn notebook CHƯA nhúng đủ vector (số vector < số chunk); notebook rỗng
// (0 chunk) không chặn. notebookId = null (tìm toàn cục 231) → chặn nếu CÒN BẤT KỲ notebook nào chưa nhúng xong,
// vì truy xuất toàn kho trên vector dở dang sẽ thiếu/lệch kết quả mà người dùng không biết (FR-010).

export interface ReindexCheckDeps {
  inProgress: () => boolean;
  listNotebookIds: () => string[];
  countChunks: (notebookId: string) => number;
  countVectors: (notebookId: string) => Promise<number>;
}

export function createReindexingCheck(
  deps: ReindexCheckDeps,
): (notebookId: string | null) => Promise<boolean> {
  const isIncomplete = async (notebookId: string): Promise<boolean> => {
    const chunks = deps.countChunks(notebookId);
    if (chunks === 0) return false;
    return (await deps.countVectors(notebookId)) < chunks;
  };

  return async (notebookId) => {
    if (!deps.inProgress()) return false;
    if (notebookId !== null) return isIncomplete(notebookId);
    for (const id of deps.listNotebookIds()) {
      if (await isIncomplete(id)) return true;
    }
    return false;
  };
}
