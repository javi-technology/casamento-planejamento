import * as admin from 'firebase-admin';
import express, { NextFunction, Request, Response } from 'express';
import { onRequest } from 'firebase-functions/v2/https';
import {
  createExpense,
  deleteExpense,
  getBudget,
  importBudget,
  updateBudget,
  updateExpense,
} from './budget/budget.controller';
import {
  deleteContract,
  getContract,
  uploadContract,
} from './contract/contract.controller';
import { contractErrorHandler } from './contract/contract.controller';
import {
  authMiddleware,
  AuthenticatedRequest,
} from './middleware/auth.middleware';

admin.initializeApp();

const app = express();
app.use(express.json({ limit: '10mb' }));
app.use((req: Request, res: Response, next: NextFunction) => {
  const startedAt = Date.now();
  res.on('finish', () => {
    console.log(
      `[${req.method}] ${req.path} → ${res.statusCode} (${Date.now() - startedAt}ms)`,
    );
  });
  next();
});

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', project: 'casamento-planejamento' });
});

app.use('/api/*', authMiddleware);

app.get('/api/me', (req, res) => {
  const user = (req as AuthenticatedRequest).user;
  res.json({ uid: user.uid, email: user.email });
});
app.get('/api/budget', getBudget);
app.put('/api/budget', updateBudget);
app.post('/api/budget/import', importBudget);
app.post('/api/expenses', createExpense);
app.put('/api/expenses/:id', updateExpense);
app.delete('/api/expenses/:id', deleteExpense);
app.post('/api/expenses/:id/contract', uploadContract);
app.get('/api/expenses/:id/contract', getContract);
app.delete('/api/expenses/:id/contract', deleteContract);

app.use(contractErrorHandler);
app.use((error: Error, req: Request, res: Response, _next: NextFunction) => {
  console.error('[unhandledError]', {
    method: req.method,
    path: req.path,
    message: error.message,
    stack: error.stack,
  });
  res
    .status(500)
    .json({ error: 'Internal Server Error', message: 'Erro interno' });
});

export { app };
export const api = onRequest({ region: 'us-central1', memory: '256MiB' }, app);
