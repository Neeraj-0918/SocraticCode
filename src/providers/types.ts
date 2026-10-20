import { TutorRequest, TutorResponse } from '../tutor/types';

export interface AIProvider {
  readonly name: string;
  isConfigured(): Promise<boolean>;
  generateResponse(request: TutorRequest): Promise<TutorResponse>;
  testConnection?(): Promise<boolean>;
}
