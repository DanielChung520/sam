




SAM (Sales Assistant Management) 銷售助理管理系統系統完整設計與技術規格書 (System Architecture & Specification Document)文件版本：v1.0.0撰寫日期：2026 年 7 月系統定位：結合「LINE 官方/個人分身」、「台灣地端 MoE 路由門衛」、「低成本 Token 聚合套利」與「USB 實體私有數據保險箱」之混合雲 AI 銷售與 CRM 系統。1. 系統概述 (System Overview)1.1 產品核心價值 (Core Value Proposition)零信任極致資安 (Zero-Trust Local Privacy)：客戶私密金鑰 (Provider Keys)、CRM 對話紀錄、名片 JSON 與向量知識庫 (RAG) 100% 儲存於使用者實體 USB 隨身碟 (SeaweedFS Node) 中。拔除隨身碟即物理銷毀雲端暫存。高 EQ 個人化公關銷售 (High-EQ Personal Persona)：24 小時接管 LINE 訊息，結合客戶歷史互動與職業標籤，進行一對一客製化擬稿與排程群發，擺脫傳統罐頭訊息。混合雲 MoE 智能路由 (Hybrid MoE Cost-Security Arbitrage)：台灣地端門衛先進行 PII 去識別化過濾，80% 常規任務洗入極低成本 API 渠道，高敏感任務留存台灣地端小模型，綜合 Token 成本降低 70%+。1.2 系統總體架構圖 (System Architecture Diagram)+-----------------------------------------------------------------------------------+
|                                  [ 用戶端 Client ]                                |
|  +-----------------------------------+    +------------------------------------+  |
|  |  LINE App (外部客戶對話介面)      |    |  SAM Mobile Web/App (業務管理介面)  |  |
|  +-----------------------------------+    +------------------------------------+  |
+----------------------------------|------------------------------------------------+
                                   | HTTP/Webhook / Encrypted Tunnel
                                   v
+-----------------------------------------------------------------------------------+
|                         [ 雲端服務層 Cloud Infrastructure ]                       |
|  +-----------------------------------------------------------------------------+  |
|  | 1. LINE Channel Gateway & Rate Limiter (風控佇列 & 狀態機)                  |  |
|  +-----------------------------------------------------------------------------+  |
|  | 2. 台灣在地 MoE 智能路由門衛 (Taiwan Gateway Engine)                        |  |
|  |    - PII 去識別化過濾器 (Anonymizer)                                        |  |
|  |    - 繁簡/用語在地化後處理器 (Post-processing)                               |  |
|  +-----------------------------------------------------------------------------+  |
|  | 3. 大陸/低價 API 聚合中繼站 (LLM Aggregator Proxy)                            |  |
|  |    - Header/Metadata Stripping (去除來源痕跡)                               |  |
|  +-----------------------------------------------------------------------------+  |
+----------------------------------|------------------------------------------------+
                                   | Dynamic Encrypted Query
                                   v
+-----------------------------------------------------------------------------------+
|                      [ 地端資安保險箱 Local Hardware Vault ]                      |
|  +-----------------------------------------------------------------------------+  |
|  | 實體加密 USB 隨身碟 (Hardware Security Node)                               |  |
|  |  - Provider API Keys (用戶私密金鑰)                                         |  |
|  |  - SeaweedFS Local Volume Node (原始文件、名片圖檔、CRM 紀錄)                 |  |
|  |  - Local Vector DB (SQLite-vec/LanceDB - 本地知識庫)                         |  |
|  |  - WireGuard / Cloudflare Local Tunnel Client                                  |  |
|  +-----------------------------------------------------------------------------+  |
+-----------------------------------------------------------------------------------+
2. 前端規格與 UI/UX 頁面 (Front-End Specification)2.1 手機端 App (LINE 分身管理助理)2.1.1 頂部狀態列 (USB Security Status Bar)元件說明：即時顯示實體 USB 隨身碟與地端 SeaweedFS 節點連線狀態。狀態 A (連線中)：顯示「USB 硬體資安金鑰已連接 / SeaweedFS 私有知識庫同步中」，綠色/琥珀色燈號。狀態 B (已拔除)：顯示「USB 已拔除！物理斷連保護中」，紅色燈號。全站停止對外請求私密資料，隱藏機密 CRM 數據。2.1.2 View 1: 對話與 AI 接管 (Chats & Human-in-the-Loop)對話清單 (Chat List)：按時間排序，顯示好友頭像、姓名、職稱、CRM 熱度積分 (例：🔥92) 及最新訊息。AI 草稿擬訂框 (AI Draft Card)：當系統接收到訊息時，AI 讀取地端 USB 知識庫，自動擬定「高 EQ 擬真回覆」。按鈕操作：「一鍵同意發送 (LINE API)」、「手動微調」、「切換純真人接管」。2.1.3 View 2: 好友 CRM 與 OCR 名片解析 (Friends CRM & Card Parser)熱度分級卡片：將好友分為「高熱度 VIP」、「常規互動」、「沉睡待喚醒」三大分類。名片掃瞄相機 (OCR Scanner)：拍照/上傳名片圖檔 $\rightarrow$ 雲端解析 OCR $\rightarrow$ 輸出標準格式名片 JSON。JSON 結構包含：name, company, title, phone, email, tags, ai_greeting_preference。動作按鈕：「將資料加密寫入 USB 隨身碟」。2.1.4 View 3: 安全排程群發 (Safe Scheduled Broadcast)風控群發控制器：遵守 LINE 官方 API 頻率限制，設定隨機發送時間間隔 (例如 15~45 秒)。一對一客製化變數：自動讀取 USB 名冊，發送時替換 {職稱}、{暱稱}、{歷史互動興趣}（例：高爾夫、特定產品）。進度指示器：即時顯示進度條 (例如 6/18 完成)。2.1.5 View 4: 高 EQ 公關賀卡與 Persona 設定 (Agent & Greetings)語氣 Tone 調設定：高 EQ 商務禮貌體（稱「您/辛苦了」）親切朋友體（使用表情符號）專業簡潔體公關賀卡產生器：提供「三節/中秋祝賀」、「拜訪後感謝」、「升遷/生日恭賀」模組，一鍵生成並套用受眾背景。2.1.6 View 5: 焦點新聞與個人 AI 討論室 (Workspace)產業焦點摘要：每日自動爬取並生成半導體、金融、房產等產業新聞 AI 摘要，作為業務拜訪話題。個人 AI 對話室：提供業務員個人腦力激盪、草擬郵件、合約初步審查之獨立 AI 沙盒。2.2 B2B 企業級 SAM 管理後台 (Web Dashboard)企業戰情室 (Sales Analytics)：統計團隊名片收集量、顧客熱度分佈、AI 擬稿採用率、預估成交機率。智慧客戶地圖 (Customer Heatmap)：將 CRM 名片地址轉化為地圖熱力圖，輔助業務外勤區域派單。客戶資產離職交接 (Asset Handoff)：一鍵轉移特定客戶標籤與對話歷史至新業務員的 SAM 系統中。3. 後端服務與雲端微服務架構 (Back-End Microservices)3.1 台灣 MoE (Mixture of Experts) 門衛與路由服務 (MoE Gateway)[ Incoming Request ]
       │
       ▼
 [ PII Anonymizer ] ──► (移除 身份證/電話/真實姓名/公司內部代碼)
       │
       ▼
 [ Task Classifier ]
       │
       ├─► 1. 高敏感/法務個資 ──────────► [ 台灣地端模型 ] (Llama-3-Taiwan / 14B)
       ├─► 2. 毫秒級極簡任務 (招呼/摘要) ─► [ 地端極小模型 ] (Qwen-2.5-1.5B)
       └─► 3. 複雜邏輯/寫程式/長文案 ─────► [ 大陸低價 API 聚合中繼站 ] (DeepSeek-R1 / Qwen)
                                                      │
                                                      ▼
 [ Post-Processing Pipeline ] ◄───────────────────────┘
  ( 繁簡校正 / 台灣用語替換 / 強制 System Prompt 注入 / HTTP Header 清理 )
       │
       ▼
[ Response to Client ]
敏感資料去識別化 (PII Anonymization Filter)：使用 Regex + NER (命名實體識別) 模組，過濾客戶真實姓名、電話、身份證字號、信用卡號等，替換為變數標籤 (如 [CLIENT_NAME_1])。用語在地化後處理 (Post-Processing Engine)：自動校正大陸詞彙（例：將「信息」修正為「資訊」、「軟件」修正為「軟體」、「服務器」修正為「伺服器」）。強制 System Prompt 覆蓋：鎖定模型身份，消除原廠模型的身份自我宣告。3.2 大陸低價 Token 洗入與 API 聚合中繼站 (LLM Aggregator Proxy)Header/Metadata Stripping：徹底移除 x-deepseek-req-id、server: qwen-gateway 等非標準 HTTP Header，偽裝為標準 OpenAI endpoint 格式。Failover 備援機制：主通道 (如 DeepSeek-R1) 延遲 > 3000ms 或發生 5xx 錯誤時，在 50ms 內無感切換至備用 Provider (如 Qwen-2.5 / GLM-4)。3.3 LINE Messaging API 通訊服務 (LINE Channel Manager)Webhook 處理佇列：使用 Redis + Celery / BullMQ 接收 LINE 龐大併發訊息。模擬真人回應延遲 (Human Emulation)：訊息處理完成後，加上可設定的隨機延遲 (如 3~8 秒)，避免過快秒回曝露機器人特徵。4. 地端 USB 資安保險箱與儲存架構 (Local USB Hardware Vault)4.1 海藻儲存系統 (SeaweedFS Local Architecture)硬體載體：預載容量 64GB / 128GB USB 3.2 隨身碟。部署元件：seaweedfs 單一二進位檔 (包含 Master, Volume, Filer 功能)。儲存目錄結構：/seaweedfs/filers/cards/：原始名片照片及 OCR JSON。/seaweedfs/filers/crm/：好友 CRM 熱度歷史、個人化 Persona Prompt。/seaweedfs/filers/keys/：RSA 私鑰與加密儲存的 Provider API Keys。4.2 本地向量資料庫 (Local Vector Engine)使用 SQLite-vec 或 LanceDB 輕量級嵌入式向量資料庫。知識庫 (RAG) 向量運算直接於本地端 CPU 進行，僅傳回 Similarity Score 最高的Top-K 文本片段 (Context) 給雲端 MoE。4.3 加密隧道與物理斷連 (Secure Tunneling & Kill-Switch)隧道建構：USB 插入時，執行檔啟動 Cloudflare Tunnel / WireGuard Client，建立動態 TLS 加密管道連結至台灣 MoE Gateway。物理斷連 (Kill-Switch Mechanism)：當 USB 被拔除，地端 Filer 服務終止，隧道中斷。雲端 MoE 閘道偵測到連線中斷後，立刻清除記憶體 (RAM) 中的任何臨時 Token，退回「系統離線」狀態，達到雲端零殘留。5. 資料庫 Schema 與 API 介面規範 (Database & API Specs)5.1 資料庫 Schema (SQLite / PostgreSQL)-- 1. 好友與 CRM 熱度表 (Contacts)
CREATE TABLE contacts (
    contact_id VARCHAR(64) PRIMARY KEY, -- LINE User ID (Encrypted)
    display_name VARCHAR(128) NOT NULL,
    company VARCHAR(128),
    title VARCHAR(128),
    heat_score INT DEFAULT 50, -- CRM 熱度積分 (0-100)
    tags TEXT, -- JSON Array: ["VIP", "高爾夫", "高意向"]
    ai_persona_notes TEXT, -- 特殊對話偏好
    last_interaction_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 2. 名片 OCR 結構化資料表 (BusinessCards)
CREATE TABLE business_cards (
    card_id VARCHAR(64) PRIMARY KEY,
    contact_id VARCHAR(64) REFERENCES contacts(contact_id),
    image_seaweed_path VARCHAR(256), -- SeaweedFS 圖檔路徑
    raw_ocr_json TEXT, -- 完整 OCR JSON 解析結果
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 3. 訊息與 AI 草稿記錄表 (Messages)
CREATE TABLE messages (
    message_id VARCHAR(64) PRIMARY KEY,
    contact_id VARCHAR(64) REFERENCES contacts(contact_id),
    sender_type VARCHAR(16), -- 'USER', 'FRIEND', 'AI_AGENT'
    content TEXT NOT NULL,
    ai_draft_content TEXT, -- AI 預先擬稿內容
    status VARCHAR(16), -- 'PENDING_APPROVAL', 'SENT', 'FAILED'
    sent_at TIMESTAMP
);

-- 4. 安全排程群發任務表 (BroadcastTasks)
CREATE TABLE broadcast_tasks (
    task_id VARCHAR(64) PRIMARY KEY,
    campaign_name VARCHAR(128),
    target_filter_json TEXT, -- 受眾篩選條件
    scheduled_at TIMESTAMP,
    status VARCHAR(16), -- 'QUEUED', 'PROCESSING', 'COMPLETED'
    delay_interval_seconds INT DEFAULT 30
);
5.2 核心 RESTful API 端點介面HTTP MethodEndpoint說明存取位置POST/api/v1/ocr/scan-card上傳名片照片，回傳結構化 JSON雲端處理 $\rightarrow$ 寫入地端POST/api/v1/chat/generate-draft觸發 AI 讀取 USB Context 並生成回覆草稿地端 RAG $\rightarrow$ MoE GatewayPOST/api/v1/chat/send-message人類點擊同意，透過 LINE API 發送訊息雲端 GatewayPOST/api/v1/broadcast/create建立客製化安全排程群發專案地端佇列 $\rightarrow$ 雲端執行GET/api/v1/system/usb-status查詢 USB 實體 Key 與 SeaweedFS 節點健康度本地 Tunnel 檢測6. 非功能性需求與安全性規範 (Non-Functional Requirements)6.1 效能與延遲 (Performance Standards)TTFT (Time to First Token)：台灣在地 MoE 回應首字延遲 $\le 800\text{ ms}$。名片 OCR 辨識時間：上傳至傳回 JSON 結構化資料 $\le 2.5\text{ 秒}$。LINE Webhook 處理：對 LINE 伺服器的 200 OK 響應時間 $\le 500\text{ ms}$ (非同步進入 Redis 佇列)。6.2 資安與合規性 (Security & Compliance)傳輸層加密：雲地通訊全程採用 TLS 1.3 / WireGuard 雙向認證加密隧道 (mTLS)。零殘留檢驗 (Zero-Storage Verification)：雲端伺服器內部的快取記憶體 (Redis) 對話紀錄設定 TTL $\le 60\text{ 秒}$，逾時強行銷毀。法規符合：符合台灣《個人資料保護法》(PII Act) 之「資料處理過境去識別化」與「當事人地端自主留存」條款。6.3 部署與交付 (Deployment)地端 USB 韌體：提供跨平台 (Windows / macOS) 之 .exe / .app 一鍵自動啟動打包檔，內含輕量化 SeaweedFS 執行檔與 Tunnel Agent。雲端部署：以 Docker Container 化封裝，支援 Kubernetes 彈性擴增 MoE Gateway 節點。[規格書完]
