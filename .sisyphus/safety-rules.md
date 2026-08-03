# SAM 安全操作規範（強制）

> 基於實際事故教訓，任何 AI Agent 執行以下操作前必須通過此檢查。
> 版本：1.0.0 ｜ 最後更新：2026-08-03

## 第一條：絕對禁止自行執行

**所有破壞性操作一律不準直接執行**，只能輸出指令讓使用者複製貼上。

| 事故案例 | 禁止行為 | 正確做法 |
|---------|---------|---------|
| ArangoDB 整份覆寫 | `PUT /_api/document/...` | 使用 `PATCH` 或 AQL `UPDATE ... WITH { ... }` |
| ArangoDB collection 刪除 | `DROP COLLECTION` | 只刪除必要的 documents |
| Qdrant collection 重建 | `DELETE collection` + `CREATE` | 只操作必要的 points/vectors |
| SeaweedFS 檔案刪除 | `rm`、DELETE object | 先確認無引用再刪，輸出指令 |
| git 遺失工作進度 | `git reset --hard`、`git checkout` | 先問使用者 |
| 刪除檔案 | `rm`、`DELETE` API | 輸出指令給使用者 |
| sudo / 系統層操作 | 任何需要 root 權限的操作 | 輸出指令給使用者 |

## 第二條：三階段程序

### 階段一：停下來
自問：「這個操作可逆嗎？」
- 可逆 → 可以執行
- 不可逆 → 進入階段二
- 不確定 → 視為不可逆

### 階段二：輸出
```
⚠️ 即將執行不可逆操作
指令: xxx
影響: xxx
請確認是否執行
```

### 階段三：等回復
使用者說「執行」或自己複製指令執行。AI 不得代勞。

## 第三條：PATCH 原則（ArangoDB 專用）

更新文件時一律使用 `PATCH` 或 AQL `UPDATE ... WITH { ... }`：

```
✅ PATCH /_api/document/{collection}/{key}  { "field": "new_value" }
✅ FOR d IN col FILTER d._key == @key UPDATE d WITH { field: "new_value" } IN col
❌ PUT /_api/document/{collection}/{key}  (會清除所有未指定欄位)
```

## 第四條：基礎設施一律確認

涉及下列範圍時，**必須先列出完整指令，讓使用者手動執行**，AI 不得直接操作：

- ArangoDB（`:8529`）— DB/collection 結構變更、DROP
- Qdrant / Redis / SeaweedFS — 資料刪除、collection 重建
- tmux 服務（sam-server / sam-proxy / sam-admin / taskforge / vllm-vl）— 停止/重啟前先確認影響
- 任何 `sudo` 操作
- LINE Developers Console / Channel 設定變更

## 第五條：環境變數管理

- 敏感值（API key、token、secret）一律放 `server/.env`（已被 .gitignore）
- 新增 env 時同步更新 `server/.env.example`（可進版）
- 禁止把 `.env` 內容寫進 commit 或文件

## 第六條：測試資料清理

- 開發測試產生的 ArangoDB documents、SeaweedFS 檔案、Redis keys，用完必須清理
- 清理時用 `FILTER` 限定範圍（如 `FILTER m.userId LIKE "U_test_%"`），嚴禁 `REMOVE ALL`
