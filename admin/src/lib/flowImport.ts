// 流程導入解析器 — md / xml / json / yaml → FlowNode[]
//
// 對應 AGENTS.md 第 10 節：外部導入流程定義（不從零建置），
// 匯入後轉為 FlowNode[] 供 FlowEditor 載入並細部微調。

import YAML from 'yaml'
import type { FlowNode } from '../components/FlowEditor'

interface RawNode {
  id?: string
  type?: string
  label?: string
  name?: string
  desc?: string
  description?: string
  color?: string
  enabled?: boolean
  config?: Record<string, any>
  inputs?: string
  outputs?: string
  propsSchema?: any[]
}

function normalize(n: RawNode, index: number, fallbackType: string): FlowNode {
  const type = n.type || fallbackType
  return {
    id: n.id || `${type}-${index + 1}`,
    type,
    label: n.label || n.name || `${type} ${index + 1}`,
    desc: n.desc || n.description || '',
    color: n.color,
    enabled: n.enabled ?? true,
    config: n.config ?? {},
    inputs: n.inputs,
    outputs: n.outputs,
    propsSchema: n.propsSchema,
  }
}

function inferType(label: string, hint?: string): string {
  if (hint) return hint
  const l = label.toLowerCase()
  if (l.includes('trigger') || l.includes('接收') || l.includes('收到')) return 'trigger'
  if (l.includes('llm') || l.includes('模型') || l.includes('解析') || l.includes('分類') || l.includes('生成')) return 'llm'
  if (l.includes('condition') || l.includes('判斷') || l.includes('檢查') || l.includes('檢驗')) return 'condition'
  if (l.includes('function') || l.includes('儲存') || l.includes('轉換') || l.includes('處理')) return 'function'
  if (l.includes('skill') || l.includes('子技能')) return 'skill'
  if (l.includes('storage') || l.includes('存')) return 'storage'
  if (l.includes('reply') || l.includes('回覆')) return 'reply'
  if (l.includes('memory') || l.includes('記憶')) return 'memory'
  return 'dummy'
}

/** JSON：FlowNode[] 原生格式 或 { nodes: [...] } */
export function parseFlowJson(text: string): FlowNode[] {
  const parsed = JSON.parse(text)
  const arr = Array.isArray(parsed) ? parsed : (parsed.nodes ?? [])
  return arr.map((n: RawNode, i: number) => normalize(n, i, inferType(n.label || n.name || '')))
}

/** YAML：nodes: 列表，每項 type/label/desc/config */
export function parseFlowYaml(text: string): FlowNode[] {
  const parsed = YAML.parse(text) as { nodes?: RawNode[] } | RawNode[] | null
  const arr = Array.isArray(parsed) ? parsed : (parsed?.nodes ?? [])
  return arr.map((n: RawNode, i: number) => normalize(n, i, inferType(n.label || n.name || '', n.type)))
}

/** XML：n8n 風格 <nodes><node type="..." name="...">（輕量解析，免 DOMParser） */
export function parseFlowXml(text: string): FlowNode[] {
  const nodes: FlowNode[] = []
  const re = /<node\b([^>]*)>([\s\S]*?)<\/node>/g
  let m: RegExpExecArray | null
  while ((m = re.exec(text)) !== null) {
    const attrs = m[1]
    const body = m[2]
    const getAttr = (name: string): string => {
      const am = attrs.match(new RegExp(`${name}\\s*=\\s*["']([^"']*)["']`))
      return am ? am[1] : ''
    }
    const descM = body.match(/<description[^>]*>([\s\S]*?)<\/description>/)
    const config: Record<string, any> = {}
    const configM = body.match(/<config[^>]*>([\s\S]*?)<\/config>/)
    if (configM) {
      const propRe = /<([\w]+)>([\s\S]*?)<\/\1>/g
      let pm: RegExpExecArray | null
      while ((pm = propRe.exec(configM[1])) !== null) {
        const v = pm[2].trim()
        config[pm[1]] = /^\d+$/.test(v) ? Number(v) : /^(true|false)$/i.test(v) ? v.toLowerCase() === 'true' : v
      }
    }
    const type = getAttr('type') || 'dummy'
    const name = getAttr('name') || ''
    const label = getAttr('label') || name || `${type} ${nodes.length + 1}`
    nodes.push(
      normalize(
        {
          id: getAttr('id') || undefined,
          type,
          label,
          name,
          desc: descM?.[1]?.trim() ?? '',
          config,
        },
        nodes.length,
        type,
      ),
    )
  }
  return nodes
}

/** Markdown：## 節點名（type） + 屬性清單（- 欄位: 值 / 輸入/輸出 段） */
export function parseFlowMd(text: string): FlowNode[] {
  const nodes: FlowNode[] = []
  const sections = text.split(/^##\s+/m).slice(1)
  for (const section of sections) {
    const lines = section.split('\n')
    const titleLine = lines[0].trim()
    const typeMatch = titleLine.match(/\((\w+)\)\s*$/)
    const label = typeMatch ? titleLine.slice(0, titleMatch.index).trim() : titleLine
    const type = typeMatch ? typeMatch[1] : inferType(label)
    const config: Record<string, any> = {}
    let inputs = ''
    let outputs = ''
    let desc = ''
    let inInputs = false
    let inOutputs = false
    for (const raw of lines.slice(1)) {
      const line = raw.trim()
      if (!line) continue
      if (line.startsWith('輸入') || line.startsWith('📥')) { inInputs = true; inOutputs = false; continue }
      if (line.startsWith('輸出') || line.startsWith('📤')) { inOutputs = true; inInputs = false; continue }
      if (inInputs) { inputs += line + '\n'; continue }
      if (inOutputs) { outputs += line + '\n'; continue }
      const prop = line.match(/^[-*]\s*([\w]+)\s*[:：]\s*(.+)$/)
      if (prop) {
        const v = prop[2].trim()
        config[prop[1]] = /^\d+$/.test(v) ? Number(v) : /^\d+\.\d+$/.test(v) ? Number(v) : /^(true|false)$/i.test(v) ? v.toLowerCase() === 'true' : v
      } else if (!desc) {
        desc = line
      }
    }
    nodes.push(normalize({ type, label: label.replace(/[\s]*[（(]\w+[）)]\s*$/, ''), desc, config, inputs: inputs.trim() || undefined, outputs: outputs.trim() || undefined }, nodes.length, type))
  }
  return nodes
}

/** 依副檔名/內容自動偵測格式並解析 */
export function parseFlowText(text: string, filename?: string): FlowNode[] {
  const name = (filename ?? '').toLowerCase()
  if (name.endsWith('.md')) return parseFlowMd(text)
  if (name.endsWith('.xml')) return parseFlowXml(text)
  if (name.endsWith('.yaml') || name.endsWith('.yml')) return parseFlowYaml(text)
  if (name.endsWith('.json')) return parseFlowJson(text)
  // 無副檔名：內容嗅探
  const trimmed = text.trim()
  if (trimmed.startsWith('{') || trimmed.startsWith('[')) return parseFlowJson(text)
  if (trimmed.startsWith('<')) return parseFlowXml(text)
  if (trimmed.startsWith('##')) return parseFlowMd(text)
  if (trimmed.includes('nodes:') || /^\w+:\s*$/.test(trimmed.split('\n')[0] ?? '')) return parseFlowYaml(text)
  throw new Error('無法辨識流程格式（支援 md / xml / json / yaml）')
}
