import { HttpErrorResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { ApiService } from '../core/api.service';
import { ExpenseSectionComponent } from './expense-section.component';

describe('ExpenseSectionComponent - upload de contrato', () => {
  let component: ExpenseSectionComponent;
  let api: jasmine.SpyObj<ApiService>;

  const selectFile = (file: File): Event =>
    ({ target: { files: [file], value: 'c:\\fakepath' } }) as unknown as Event;

  beforeEach(() => {
    api = jasmine.createSpyObj<ApiService>('ApiService', [
      'uploadContract',
      'updateBudget',
    ]);
    TestBed.configureTestingModule({
      imports: [ExpenseSectionComponent],
      providers: [{ provide: ApiService, useValue: api }],
    });
    component = TestBed.createComponent(
      ExpenseSectionComponent,
    ).componentInstance;
  });

  it('envia PDF com tipo vazio quando a extensão é .pdf', () => {
    api.uploadContract.and.returnValue(
      of({
        contract: {
          path: 'p',
          fileName: 'contrato.pdf',
          contentType: 'application/pdf',
          size: 1,
          uploadedAt: '2026-01-01T00:00:00.000Z',
        },
      }),
    );

    component.uploadContract(
      'exp-1',
      selectFile(new File(['%PDF'], 'Contrato.PDF', { type: '' })),
    );

    expect(api.uploadContract).toHaveBeenCalled();
    expect(component.contractError).toBe('');
  });

  it('rejeita arquivo que não é PDF sem chamar a API', () => {
    component.uploadContract(
      'exp-1',
      selectFile(new File(['x'], 'foto.png', { type: 'image/png' })),
    );

    expect(api.uploadContract).not.toHaveBeenCalled();
    expect(component.contractError).toBe('Selecione um arquivo PDF.');
  });

  it('rejeita PDF acima de 10 MB sem chamar a API', () => {
    const big = new File([new ArrayBuffer(10 * 1024 * 1024 + 1)], 'c.pdf', {
      type: 'application/pdf',
    });

    component.uploadContract('exp-1', selectFile(big));

    expect(api.uploadContract).not.toHaveBeenCalled();
    expect(component.contractError).toBe(
      'O contrato deve ter no máximo 10 MB.',
    );
  });

  it('exibe a mensagem devolvida pela API quando o upload falha', () => {
    api.uploadContract.and.returnValue(
      throwError(
        () =>
          new HttpErrorResponse({
            status: 400,
            error: { message: 'Apenas arquivos PDF são aceitos' },
          }),
      ),
    );

    component.uploadContract(
      'exp-1',
      selectFile(new File(['%PDF'], 'c.pdf', { type: 'application/pdf' })),
    );

    expect(component.contractError).toBe('Apenas arquivos PDF são aceitos');
    expect(component.uploadingId).toBeNull();
  });

  it('usa mensagem genérica quando a API não detalha o erro', () => {
    api.uploadContract.and.returnValue(
      throwError(() => new HttpErrorResponse({ status: 500 })),
    );

    component.uploadContract(
      'exp-1',
      selectFile(new File(['%PDF'], 'c.pdf', { type: 'application/pdf' })),
    );

    expect(component.contractError).toBe('Não foi possível anexar o contrato.');
  });
});
