// 自我介紹文案 — 新用戶/問「你是誰」時回覆
//
// 內容：我是誰 + 簡單問候 + `/` 提示（列出工作項目）
// follow 事件與 greeting skill 共用，維持一致體驗。

export function buildSelfIntro(name?: string): string {
  const displayName = name && name.trim() ? name.trim() : 'AI 助理';
  return `我是「${displayName}」分身助理，您若有什麼事，交代給我，我會隨時向${displayName}提醒，或轉告！`;
}
