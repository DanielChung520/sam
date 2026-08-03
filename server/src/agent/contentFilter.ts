// PII + forbidden content filter
//
// 萃取前過濾敏感個資與不值得記錄的內容（學 aibox-th forbidden patterns）

const PII_PATTERNS: Array<{ name: string; regex: RegExp }> = [
  { name: 'credit_card', regex: /\b\d{4}[-\s]?\d{4}[-\s]?\d{4}[-\s]?\d{4}\b/ },
  { name: 'taiwan_mobile', regex: /\b09\d{8}\b/ },
  { name: 'taiwan_id', regex: /[A-Z][12]\d{8}/ },
  { name: 'us_phone', regex: /\b\d{3}[-\s]?\d{3}[-\s]?\d{4}\b/ },
  { name: 'email', regex: /[\w.-]+@[\w.-]+\.\w+/ },
];

const FORBIDDEN_PATTERNS: Array<{ name: string; regex: RegExp }> = [
  { name: 'greeting', regex: /^(你好|哈囉|hi|hello|hey)\s*[!.,。，]?\s*$/i },
  { name: 'thanks', regex: /^(謝謝|thank you|thanks|thx|3q)\s*[!.,。，]?\s*$/i },
  { name: 'goodbye', regex: /^(再見|bye|goodbye|88)\s*[!.,。，]?\s*$/i },
  { name: 'code_pattern', regex: /(代碼模式|程式碼模式|code pattern|architecture[:\s])/i },
  { name: 'file_path', regex: /文件路徑[:\s]|file path[:\s]/i },
  { name: 'git_history', regex: /git (log|blame)|Git 歷史/i },
  { name: 'debug_steps', regex: /調試方案[:\s]|調試步驟[:\s]|debug steps/i },
];

export interface FilterResult {
  passed: boolean;
  detectedPII: string[];
  detectedForbidden: string[];
}

export function filterContent(content: string): FilterResult {
  const detectedPII: string[] = [];
  for (const p of PII_PATTERNS) {
    if (p.regex.test(content)) detectedPII.push(p.name);
  }
  const detectedForbidden: string[] = [];
  for (const p of FORBIDDEN_PATTERNS) {
    if (p.regex.test(content)) detectedForbidden.push(p.name);
  }
  return {
    passed: detectedPII.length === 0 && detectedForbidden.length === 0,
    detectedPII,
    detectedForbidden,
  };
}

export function redactPII(content: string): string {
  let redacted = content;
  for (const p of PII_PATTERNS) {
    redacted = redacted.replace(p.regex, `[REDACTED:${p.name}]`);
  }
  return redacted;
}