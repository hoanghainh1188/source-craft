import type { Messages } from "./translate";
import { coreEn } from "./domains/core";
import { appEn } from "./domains/app";
import { notebooksEn } from "./domains/notebooks";
import { searchEn } from "./domains/search";
import { sourcesEn } from "./domains/sources";
import { viewerEn } from "./domains/viewer";
import { chatEn } from "./domains/chat";
import { studioEn } from "./domains/studio";
import { aiEn } from "./domains/ai";
import { backupEn } from "./domains/backup";
import { crashEn } from "./domains/crash";
import { auditEn } from "./domains/audit";
import { dialogsEn } from "./domains/dialogs";
import { a11yEn } from "./domains/a11y";
import { menuEn } from "./domains/menu";
import { meetingEn } from "./domains/meeting";
import { aboutEn } from "./domains/about";

// 123 — bản English (bản dịch phát sinh từ vi.ts; thuật ngữ theo cột English của docs/00-glossary.md).

export const en: Messages = {
  ...coreEn,
  app: appEn,
  notebooks: notebooksEn,
  search: searchEn,
  sources: sourcesEn,
  viewer: viewerEn,
  chat: chatEn,
  studio: studioEn,
  ai: aiEn,
  backup: backupEn,
  crash: crashEn,
  audit: auditEn,
  dialogs: dialogsEn,
  a11y: a11yEn,
  menu: menuEn,
  meeting: meetingEn,
  about: aboutEn,
};
