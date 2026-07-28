import express from "express";
import cors from "cors";
import contactsRouter from "./routes/contacts.js";
import chatsRouter from "./routes/chats.js";
import broadcastsRouter from "./routes/broadcasts.js";
import workspaceRouter from "./routes/workspace.js";

const app = express();
const port = process.env.PORT || 9091;

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

app.get('/api/v1/health', (req, res) => {
  console.log('Health check success');
  res.status(200).json({ status: 'ok' });
});

// Routes
app.use('/api/v1/contacts', contactsRouter);
app.use('/api/v1/chats', chatsRouter);
app.use('/api/v1/broadcasts', broadcastsRouter);
app.use('/api/v1', workspaceRouter);

app.listen(port, () => {
  console.log(`Server listening at http://localhost:${port}/`);
});
