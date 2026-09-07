import { NextFunction, Request, Response } from 'express';
import {
  ContractError,
  getContractStream,
  removeContract,
  uploadContract as saveContract,
} from './contract.service';

export async function uploadContract(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    res.status(201).json({
      contract: await saveContract(req, req.params.id),
    });
  } catch (error) {
    next(error);
  }
}

export async function getContract(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const contract = await getContractStream(req.params.id);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `inline; filename="${contract.fileName}"`,
    );
    contract.stream.on('error', (error) => next(error));
    contract.stream.pipe(res);
  } catch (error) {
    next(error);
  }
}

export async function deleteContract(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    await removeContract(req.params.id);
    res.status(204).send();
  } catch (error) {
    next(error);
  }
}

export function contractErrorHandler(
  error: unknown,
  _req: Request,
  res: Response,
  next: NextFunction,
): void {
  if (error instanceof ContractError) {
    res.status(error.status).json({
      error: error.status === 404 ? 'Not Found' : 'Bad Request',
      message: error.message,
    });
    return;
  }
  next(error);
}
