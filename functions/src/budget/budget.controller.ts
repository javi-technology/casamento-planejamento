import { Request, Response, NextFunction } from 'express';
import * as budgetService from './budget.service';
import { validateBudgetInput, validateExpense } from './budget.validation';
import { Expense, WeddingBudget } from './types';
import { deleteContractObject } from '../contract/contract.service';

function validationResponse(res: Response, errors: unknown[]): void {
  res.status(400).json({
    error: 'Bad Request',
    message: 'Dados inválidos',
    details: errors,
  });
}

export async function getBudget(
  _req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    res.json(await budgetService.getBudget());
  } catch (error) {
    next(error);
  }
}

export async function updateBudget(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const errors = validateBudgetInput(req.body);
  if (errors.length) {
    validationResponse(res, errors);
    return;
  }

  try {
    res.json(
      await budgetService.updateBudget({
        guests: req.body.guests,
        maxBudget: req.body.maxBudget,
        categories: req.body.categories,
      }),
    );
  } catch (error) {
    next(error);
  }
}

export async function importBudget(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const errors = validateBudgetInput(req.body, true);
  if (errors.length) {
    validationResponse(res, errors);
    return;
  }

  try {
    res.json(await budgetService.importBudget(req.body as WeddingBudget));
  } catch (error) {
    next(error);
  }
}

export async function createExpense(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const errors = validateExpense(req.body);
  if (errors.length) {
    validationResponse(res, errors);
    return;
  }

  try {
    const expense = await budgetService.createExpense(
      req.body as Omit<Expense, 'id'>,
    );
    res.status(201).json(expense);
  } catch (error) {
    next(error);
  }
}

export async function updateExpense(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const existing = await budgetService.getExpense(req.params.id);
    if (!existing) {
      res
        .status(404)
        .json({ error: 'Not Found', message: 'Despesa não encontrada' });
      return;
    }
    const errors = validateExpense({ ...existing, ...req.body });
    if (errors.length) {
      validationResponse(res, errors);
      return;
    }
    const expense = await budgetService.updateExpense(req.params.id, req.body);
    res.json(expense);
  } catch (error) {
    next(error);
  }
}

export async function deleteExpense(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const expense = await budgetService.deleteExpense(req.params.id);
    if (!expense) {
      res
        .status(404)
        .json({ error: 'Not Found', message: 'Despesa não encontrada' });
      return;
    }
    if (expense.contract) {
      await deleteContractObject(expense.contract.path);
    }
    res.status(204).send();
  } catch (error) {
    next(error);
  }
}
