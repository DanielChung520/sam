import 'dotenv/config';
import express from "express";
import cors from "cors";
import contactsRouter from "./routes/contacts.js";
import chatsRouter from "./routes/chats.js";
import channelsRouter from "./routes/channels.js";
import broadcastsRouter from "./routes/broadcasts.js";
import workspaceRouter from "./routes/workspace.js";
import webhookRouter from "./routes/webhook.js";
import authRouter from "./routes/auth.js";
import adminSkillsRouter from "./routes/adminSkills.js";
import articleReaderRouter from "./routes/articleReader.js";
import filesRouter from "./routes/files.js";
import agentSkillsRouter from "./routes/agentSkills.js";
import adminMetricsRouter from "./routes/adminMetrics.js";
import adminChannelsRouter from "./routes/adminChannels.js";
import adminSubAgentsRouter from "./routes/adminSubAgents.js";
import adminFilesRouter from "./routes/adminFiles.js";
import adminAgentsRouter from "./routes/adminAgents.js";
import adminAgentCenterRouter from "./routes/adminAgentCenter.js";
import adminAccountsRouter from "./routes/adminAccounts.js";
import memoriesRouter from "./routes/memories.js";
import adminMemoriesRouter from "./routes/adminMemories.js";
import adminBusinessDocsRouter from "./routes/adminBusinessDocs.js";
import mcpToolsRouter from "./routes/mcpTools.js";
import avatarsRouter from "./routes/avatars.js";
import { ensureSeeds } from "./scripts/ensureSeeds.js";
import { startNewsScheduler } from "./agent/newsScheduler.js";
import { startNewsPushScheduler } from "./agent/newsPushScheduler.js";

const app = express();
const port = process.env.PORT || 9091;

// Middleware
app.use(cors());
app.use(express.json({
  limit: '50mb',
  verify: (req: any, _res, buf) => {
    // 保留原始 body 供 LINE webhook 簽章驗證使用
    req.rawBody = buf;
  },
}));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

app.get('/api/v1/health', (req, res) => {
  console.log('Health check success');
  res.status(200).json({ status: 'ok' });
});

// Routes
app.use('/api/v1/contacts', contactsRouter);
app.use('/api/v1/chats', chatsRouter);
app.use('/api/v1/channels', channelsRouter);
app.use('/api/v1/broadcasts', broadcastsRouter);
app.use('/api/v1', workspaceRouter);
app.use('/api/v1/auth', authRouter);
app.use('/api/v1/admin/skills', adminSkillsRouter);
app.use('/api/v1/article-reader', articleReaderRouter);
app.use('/api/v1/files', filesRouter);
app.use('/api/v1/agent', agentSkillsRouter);
app.use('/api/v1/admin', adminMetricsRouter);
app.use('/api/v1/admin', adminChannelsRouter);
app.use('/api/v1/admin', adminSubAgentsRouter);
app.use('/api/v1/admin', adminFilesRouter);
app.use('/api/v1/admin', adminAgentsRouter);
app.use('/api/v1/admin', adminAgentCenterRouter);
app.use('/api/v1/admin', adminAccountsRouter);
app.use('/api/v1', memoriesRouter);
app.use('/api/v1/admin', adminMemoriesRouter);
app.use('/api/v1/admin', adminBusinessDocsRouter);
app.use('/api/v1', mcpToolsRouter);
app.use('/api/v1', avatarsRouter);

// LINE Webhook
app.use('/webhook', webhookRouter);

app.listen(port, () => {
  console.log(`Server listening at http://localhost:${port}/`);
  ensureSeeds().catch((e) => console.error('[seed] failed:', e));
  startNewsScheduler();
  startNewsPushScheduler();
});
