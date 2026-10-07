import { Request } from 'express';

const save = jest.fn();
const file = jest.fn(() => ({ save, delete: jest.fn() }));
const bucket = jest.fn(() => ({ file }));

jest.mock('firebase-admin/firestore', () => ({
  FieldValue: { delete: jest.fn(() => 'delete-field') },
  getFirestore: jest.fn(),
}));
jest.mock('firebase-admin/storage', () => ({
  getStorage: jest.fn(() => ({ bucket })),
}));
jest.mock('../budget/budget.service', () => ({
  getExpense: jest.fn(),
  updateExpense: jest.fn(),
}));

import * as budgetService from '../budget/budget.service';
import { uploadContract } from './contract.service';

const BOUNDARY = 'testboundary';

function uploadRequest(mimeType: string, fileName = 'contrato.pdf'): Request {
  const body = Buffer.from(
    `--${BOUNDARY}\r\n` +
      `Content-Disposition: form-data; name="file"; filename="${fileName}"\r\n` +
      `Content-Type: ${mimeType}\r\n\r\n` +
      '%PDF-1.4 conteudo\r\n' +
      `--${BOUNDARY}--\r\n`,
  );
  return {
    headers: { 'content-type': `multipart/form-data; boundary=${BOUNDARY}` },
    rawBody: body,
  } as unknown as Request;
}

describe('uploadContract', () => {
  const originalBucket = process.env.CONTRACTS_BUCKET;

  beforeEach(() => {
    jest.clearAllMocks();
    delete process.env.CONTRACTS_BUCKET;
    (budgetService.getExpense as jest.Mock).mockResolvedValue({
      id: 'exp-1',
      supplier: 'Buffet Sabor',
    });
  });

  afterAll(() => {
    if (originalBucket === undefined) {
      delete process.env.CONTRACTS_BUCKET;
    } else {
      process.env.CONTRACTS_BUCKET = originalBucket;
    }
  });

  it('grava no bucket padrão do projeto quando CONTRACTS_BUCKET não está definida', async () => {
    await uploadContract(uploadRequest('application/pdf'), 'exp-1');

    expect(bucket).toHaveBeenCalledWith('javitech-8797d.appspot.com');
    expect(file).toHaveBeenCalledWith('contratos/buffet-sabor/contrato.pdf');
    expect(save).toHaveBeenCalled();
  });

  it('usa CONTRACTS_BUCKET quando definida', async () => {
    process.env.CONTRACTS_BUCKET = 'outro-bucket';

    await uploadContract(uploadRequest('application/pdf'), 'exp-1');

    expect(bucket).toHaveBeenCalledWith('outro-bucket');
  });

  it('aceita PDF enviado com tipo genérico quando a extensão é .pdf', async () => {
    const contract = await uploadContract(
      uploadRequest('application/octet-stream', 'Contrato.PDF'),
      'exp-1',
    );

    expect(contract?.contentType).toBe('application/pdf');
    expect(save).toHaveBeenCalled();
  });

  it('rejeita arquivo que não é PDF', async () => {
    await expect(
      uploadContract(uploadRequest('image/png', 'foto.png'), 'exp-1'),
    ).rejects.toThrow('Apenas arquivos PDF são aceitos');
    expect(save).not.toHaveBeenCalled();
  });
});
