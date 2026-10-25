import { coreVi } from "./domains/core";
import { appVi } from "./domains/app";
import { notebooksVi } from "./domains/notebooks";
import { searchVi } from "./domains/search";
import { sourcesVi } from "./domains/sources";
import { viewerVi } from "./domains/viewer";
import { chatVi } from "./domains/chat";
import { studioVi } from "./domains/studio";
import { aiVi } from "./domains/ai";
import { backupVi } from "./domains/backup";
import { crashVi } from "./domains/crash";
import { auditVi } from "./domains/audit";
import { dialogsVi } from "./domains/dialogs";
import { a11yVi } from "./domains/a11y";
import { menuVi } from "./domains/menu";
import { meetingVi } from "./domains/meeting";
import { aboutVi } from "./domains/about";

// 123 — tệp dịch NGÔN NGỮ NGUỒN (tiếng Việt), ghép từ các domain ở ./domains (mỗi domain một tệp để nhiều người
// sửa song song). Kiểu `Messages` suy từ đây; en.ts phải đủ khoá + cùng placeholder (tsc + i18n-catalog.test.ts).

export const vi = {
  ...coreVi,
  app: appVi,
  notebooks: notebooksVi,
  search: searchVi,
  sources: sourcesVi,
  viewer: viewerVi,
  chat: chatVi,
  studio: studioVi,
  ai: aiVi,
  backup: backupVi,
  crash: crashVi,
  audit: auditVi,
  dialogs: dialogsVi,
  a11y: a11yVi,
  menu: menuVi,
  meeting: meetingVi,
  about: aboutVi,
} as const;
