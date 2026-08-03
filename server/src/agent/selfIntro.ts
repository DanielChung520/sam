// 自我介紹文案 — 新用戶/問「你是誰」時回覆
//
// 內容：我是誰 + 簡單問候 + `/` 提示（列出工作項目）
// follow 事件與 greeting skill 共用，維持一致體驗。

export function buildSelfIntro(name?: string): string {
  const displayName = name && name.trim() ? name.trim() : 'AI 助理';
  return [
    `您好！我是「${displayName}」，您的 LINE 業務助理 🤝`,
    '',
    '我可以幫您處理各種工作，例如：',
    '• 回答產品 / 服務相關問題',
    '• 協助分析客戶與需求',
    '• 整理資料與撰寫內容',
    '• 安排群發與問候',
    '',
    '👉 若您有特定工作指示，請輸入 `/` 查看完整工作項目。',
    '',
    '期待為您服務 😊',
  ].join('\n');
}
