export interface SourceLocation {
  startLine: number;
  startColumn: number;
  endLine: number;
  endColumn: number;
}

export interface FunctionInfo {
  name: string;
  parameters: string[];
  location: SourceLocation;
  hasReturn?: boolean;
}

export interface VariableInfo {
  name: string;
  location: SourceLocation;
  isParameter?: boolean;
  inferredType?: string;
  assignedValue?: string;
}

export interface LoopInfo {
  type: 'for' | 'while' | 'do-while';
  conditionText?: string;
  variables: string[];
  location: SourceLocation;
}

export interface ConditionInfo {
  type?: 'if' | 'elif' | 'else';
  hasElse?: boolean;
  conditionText?: string;
  location: SourceLocation;
}

export interface CallInfo {
  functionName?: string;
  callerName?: string;
  arguments?: string[];
  argumentCount?: number;
  location: SourceLocation;
}

export interface ReturnInfo {
  hasValue?: boolean;
  valueText?: string;
  location: SourceLocation;
}

export interface ParserDiagnostic {
  severity: 'error' | 'warning' | 'info';
  message: string;
  location: SourceLocation;
}

export interface AnalysisResult {
  language: string;
  status: 'success' | 'partial' | 'error';
  functions: FunctionInfo[];
  variables: VariableInfo[];
  loops: LoopInfo[];
  conditions: ConditionInfo[];
  functionCalls: CallInfo[];
  returnStatements: ReturnInfo[];
  diagnostics: ParserDiagnostic[];
  rawStructure?: string;
  summaryText?: string;
}

export interface LanguageAdapter {
  readonly language: string;
  initialize(wasmDir: string): Promise<void>;
  parse(sourceCode: string): Promise<AnalysisResult>;
}
