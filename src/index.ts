/**
 * hcaitools - Manus AI Platform
 * Main entry point
 */

import express from 'express';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', message: 'hcaitools is running' });
});

// Start server
app.listen(PORT, () => {
  console.log(`hcaitools server running on port ${PORT}`);
});

export { app };
