import { MAX_FILE_SIZE, ALLOWED_FILE_TYPES, CHATBOT_MAX_MESSAGE_LENGTH } from './constants';

export function validateEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export function validateFile(file: File): { valid: boolean; error?: string } {
  if (file.size > MAX_FILE_SIZE) {
    return { valid: false, error: 'O ficheiro excede o tamanho máximo de 10MB.' };
  }
  if (!ALLOWED_FILE_TYPES.includes(file.type)) {
    return { valid: false, error: 'Formato não suportado. Use PDF, JPG, PNG ou DOCX.' };
  }
  return { valid: true };
}

const ALLOWED_EXCEL_EXTENSIONS = ['.xlsx', '.xls', '.csv'];

export function validateExcelFile(file: File): { valid: boolean; error?: string } {
  if (file.size > MAX_FILE_SIZE) {
    return { valid: false, error: 'O ficheiro excede o tamanho máximo de 10MB.' };
  }
  const name = file.name.toLowerCase();
  if (!ALLOWED_EXCEL_EXTENSIONS.some((ext) => name.endsWith(ext))) {
    return { valid: false, error: 'Formato não suportado. Use .xlsx, .xls ou .csv.' };
  }
  return { valid: true };
}

export function validateChatMessage(message: string): { valid: boolean; error?: string } {
  const trimmed = message.trim();
  if (trimmed.length === 0) {
    return { valid: false, error: 'A mensagem não pode estar vazia.' };
  }
  if (trimmed.length > CHATBOT_MAX_MESSAGE_LENGTH) {
    return { valid: false, error: `A mensagem não pode exceder ${CHATBOT_MAX_MESSAGE_LENGTH} caracteres.` };
  }
  return { valid: true };
}

export function validateRequired(value: string, fieldName: string): string | null {
  if (!value || value.trim().length === 0) {
    return `${fieldName} é obrigatório.`;
  }
  return null;
}

export function validatePhone(phone: string): boolean {
  return /^\+?[\d\s()-]{9,20}$/.test(phone);
}
