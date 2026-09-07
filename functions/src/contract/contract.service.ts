import Busboy from 'busboy';
import { Request } from 'express';
import { getStorage } from 'firebase-admin/storage';
import { FieldValue } from 'firebase-admin/firestore';
import { getExpense, updateExpense } from '../budget/budget.service';

const MAX_FILE_SIZE = 10 * 1024 * 1024;

export function slug(value: string): string {
  return value
    .toLocaleLowerCase('pt-BR')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function bucket() {
  return getStorage().bucket(
    process.env.CONTRACTS_BUCKET ?? 'casamentoplanejamentojavi',
  );
}

export async function uploadContract(
  request: Request,
  expenseId: string,
): Promise<NonNullable<Awaited<ReturnType<typeof getExpense>>>['contract']> {
  const expense = await getExpense(expenseId);
  if (!expense) {
    throw new ContractError(404, 'Despesa não encontrada');
  }

  const rawBody = (request as Request & { rawBody?: Buffer }).rawBody;
  if (!rawBody) {
    throw new ContractError(400, 'Corpo do upload ausente');
  }

  const file = await readPdf(rawBody, request.headers);
  const path = `contratos/${slug(expense.supplier)}/contrato.pdf`;
  const target = bucket().file(path);
  await target.save(file.buffer, {
    resumable: false,
    contentType: 'application/pdf',
    metadata: {
      metadata: {
        supplier: expense.supplier,
        expenseId,
      },
    },
  });

  if (expense.contract?.path && expense.contract.path !== path) {
    await deleteContractObject(expense.contract.path);
  }

  const contract = {
    path,
    fileName: file.fileName || `contrato-${slug(expense.supplier)}.pdf`,
    contentType: 'application/pdf',
    size: file.buffer.length,
    uploadedAt: new Date().toISOString(),
  };
  await updateExpense(expenseId, { contract });
  return contract;
}

export async function deleteContractObject(path: string): Promise<void> {
  await bucket().file(path).delete({ ignoreNotFound: true });
}

export async function getContractStream(expenseId: string) {
  const expense = await getExpense(expenseId);
  if (!expense?.contract) {
    throw new ContractError(404, 'Contrato não encontrado');
  }
  return {
    stream: bucket().file(expense.contract.path).createReadStream(),
    fileName: `contrato-${slug(expense.supplier)}.pdf`,
  };
}

export async function removeContract(expenseId: string): Promise<boolean> {
  const expense = await getExpense(expenseId);
  if (!expense) {
    throw new ContractError(404, 'Despesa não encontrada');
  }
  if (!expense.contract) {
    return false;
  }

  await deleteContractObject(expense.contract.path);
  await updateExpense(expenseId, { contract: FieldValue.delete() as never });
  return true;
}

interface ParsedFile {
  buffer: Buffer;
  fileName: string;
}

function readPdf(
  rawBody: Buffer,
  headers: Request['headers'],
): Promise<ParsedFile> {
  return new Promise((resolve, reject) => {
    const parser = Busboy({
      headers: headers as Record<string, string>,
      limits: { fileSize: MAX_FILE_SIZE },
    });
    let parsed: ParsedFile | null = null;
    let tooLarge = false;

    parser.on('file', (fieldName, stream, info) => {
      if (fieldName !== 'file') {
        stream.resume();
        return;
      }

      if (info.mimeType !== 'application/pdf') {
        stream.resume();
        reject(new ContractError(400, 'Apenas arquivos PDF são aceitos'));
        return;
      }

      const chunks: Buffer[] = [];
      stream.on('data', (chunk: Buffer) => chunks.push(chunk));
      stream.on('limit', () => {
        tooLarge = true;
      });
      stream.on('end', () => {
        if (tooLarge) {
          reject(new ContractError(400, 'O contrato deve ter no máximo 10 MB'));
          return;
        }
        parsed = { buffer: Buffer.concat(chunks), fileName: info.filename };
      });
    });
    parser.on('finish', () => {
      if (!parsed && !tooLarge) {
        reject(new ContractError(400, 'Envie um arquivo PDF no campo file'));
        return;
      }
      if (parsed) {
        resolve(parsed);
      }
    });
    parser.on('error', reject);
    parser.end(rawBody);
  });
}

export class ContractError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}
