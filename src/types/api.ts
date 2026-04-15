export interface ApiErrorResponse {
  error: true;
  message: string;
  code: string;
}

export interface ApiSuccessResponse {
  ok: true;
  message?: string;
}
