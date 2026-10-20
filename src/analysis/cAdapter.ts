import * as path from 'path';
import * as fs from 'fs';
import {
  AnalysisResult,
  CallInfo,
  ConditionInfo,
  FunctionInfo,
  LanguageAdapter,
  LoopInfo,
  ParserDiagnostic,
  ReturnInfo,
  SourceLocation,
  VariableInfo,
} from './types';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const Parser = require('web-tree-sitter');

export class CAdapter implements LanguageAdapter {
  public readonly language = 'c';

  private _parser: any = null;
  private _isInitialized = false;

  public async initialize(wasmDir: string): Promise<void> {
    if (this._isInitialized && this._parser) {
      return;
    }

    const treeSitterWasmPath = path.join(wasmDir, 'tree-sitter.wasm');
    const cWasmPath = path.join(wasmDir, 'tree-sitter-c.wasm');

    if (!fs.existsSync(treeSitterWasmPath)) {
      throw new Error(`Tree-sitter WASM not found at: ${treeSitterWasmPath}`);
    }
    if (!fs.existsSync(cWasmPath)) {
      throw new Error(`C grammar WASM not found at: ${cWasmPath}`);
    }

    await Parser.init({
      locateFile: () => treeSitterWasmPath,
    });

    const cLang = await Parser.Language.load(cWasmPath);
    this._parser = new Parser();
    this._parser.setLanguage(cLang);
    this._isInitialized = true;
  }

  public async parse(sourceCode: string): Promise<AnalysisResult> {
    if (!this._isInitialized || !this._parser) {
      throw new Error('CAdapter must be initialized with initialize(wasmDir) before parsing.');
    }

    if (!sourceCode || sourceCode.trim() === '') {
      return {
        language: this.language,
        status: 'success',
        functions: [],
        variables: [],
        loops: [],
        conditions: [],
        functionCalls: [],
        returnStatements: [],
        diagnostics: [],
        rawStructure: '(empty)',
        summaryText: 'Empty or blank file.',
      };
    }

    const tree = this._parser.parse(sourceCode);
    const rootNode = tree.rootNode;

    const functions: FunctionInfo[] = [];
    const variables: VariableInfo[] = [];
    const loops: LoopInfo[] = [];
    const conditions: ConditionInfo[] = [];
    const functionCalls: CallInfo[] = [];
    const returnStatements: ReturnInfo[] = [];
    const diagnostics: ParserDiagnostic[] = [];

    const visit = (node: any) => {
      if (node.type === 'ERROR' || node.isMissing()) {
        diagnostics.push({
          severity: 'error',
          message: node.isMissing()
            ? `Syntax error: Missing ${node.type}`
            : `Syntax error at or near '${node.text.slice(0, 30)}'`,
          location: toLocation(node),
        });
      }

      switch (node.type) {
        case 'function_definition': {
          let name = 'anonymous';
          const params: string[] = [];
          const declarator = node.childForFieldName('declarator');

          if (declarator) {
            const funcDecl = declarator.type === 'function_declarator'
              ? declarator
              : declarator.descendantsOfType?.('function_declarator')?.[0] || declarator;

            const nameNode = funcDecl.childForFieldName?.('declarator') || funcDecl.children?.find((c: any) => c.type === 'identifier');
            if (nameNode) {
              name = nameNode.text;
            }

            const paramList = funcDecl.childForFieldName?.('parameters') || funcDecl.children?.find((c: any) => c.type === 'parameter_list');
            if (paramList) {
              for (const child of paramList.children) {
                if (child.type === 'parameter_declaration') {
                  const paramDecl = child.childForFieldName('declarator') || child.children.find((c: any) => c.type === 'identifier');
                  if (paramDecl) {
                    params.push(paramDecl.text);
                  }
                }
              }
            }
          }

          functions.push({
            name,
            parameters: params,
            location: toLocation(node),
          });
          break;
        }

        case 'declaration': {
          for (const child of node.children) {
            if (child.type === 'init_declarator') {
              const nameNode = child.childForFieldName('declarator') || child.children.find((c: any) => c.type === 'identifier');
              const valNode = child.childForFieldName('value');
              if (nameNode) {
                variables.push({
                  name: nameNode.text,
                  inferredType: node.firstChild?.text,
                  assignedValue: valNode ? valNode.text : undefined,
                  location: toLocation(child),
                });
              }
            } else if (child.type === 'identifier') {
              variables.push({
                name: child.text,
                inferredType: node.firstChild?.text,
                location: toLocation(child),
              });
            }
          }
          break;
        }

        case 'while_statement':
        case 'for_statement':
        case 'do_statement': {
          const type = node.type === 'while_statement' ? 'while' : node.type === 'for_statement' ? 'for' : 'do-while';
          const conditionNode = node.childForFieldName('condition');
          loops.push({
            type,
            conditionText: conditionNode ? conditionNode.text : undefined,
            variables: extractIdentifiers(conditionNode),
            location: toLocation(node),
          });
          break;
        }

        case 'if_statement': {
          const condNode = node.childForFieldName('condition');
          conditions.push({
            conditionText: condNode ? condNode.text : '',
            hasElse: Boolean(node.childForFieldName('alternative')),
            location: toLocation(node),
          });
          break;
        }

        case 'call_expression': {
          const funcNode = node.childForFieldName('function');
          const argsNode = node.childForFieldName('arguments');
          const argCount = argsNode ? argsNode.namedChildren.length : 0;
          if (funcNode) {
            functionCalls.push({
              callerName: funcNode.text,
              argumentCount: argCount,
              location: toLocation(node),
            });
          }
          break;
        }

        case 'return_statement': {
          const expr = node.children.find((c: any) => c.type !== 'return' && c.type !== ';');
          returnStatements.push({
            hasValue: Boolean(expr),
            valueText: expr ? expr.text : undefined,
            location: toLocation(node),
          });
          break;
        }
      }

      for (const child of node.children) {
        visit(child);
      }
    };

    visit(rootNode);

    const hasErrors = diagnostics.length > 0;
    const summaryText = buildSummary(functions, loops, conditions, diagnostics);

    return {
      language: this.language,
      status: hasErrors ? 'partial' : 'success',
      functions,
      variables,
      loops,
      conditions,
      functionCalls,
      returnStatements,
      diagnostics,
      rawStructure: rootNode.toString(),
      summaryText,
    };
  }
}

function toLocation(node: any): SourceLocation {
  return {
    startLine: node.startPosition.row + 1,
    startColumn: node.startPosition.column + 1,
    endLine: node.endPosition.row + 1,
    endColumn: node.endPosition.column + 1,
  };
}

function extractIdentifiers(node: any): string[] {
  if (!node) {
    return [];
  }
  const idents: string[] = [];
  const walk = (n: any) => {
    if (n.type === 'identifier') {
      if (!idents.includes(n.text)) {
        idents.push(n.text);
      }
    }
    for (const child of n.children) {
      walk(child);
    }
  };
  walk(node);
  return idents;
}

function buildSummary(
  funcs: FunctionInfo[],
  loops: LoopInfo[],
  conds: ConditionInfo[],
  diags: ParserDiagnostic[]
): string {
  const parts: string[] = [];
  if (funcs.length > 0) {
    parts.push(`Functions: ${funcs.map((f) => `${f.name}(${f.parameters.join(', ')})`).join(', ')}`);
  }
  if (loops.length > 0) {
    parts.push(`Loops: ${loops.map((l) => `${l.type}${l.conditionText ? ` (${l.conditionText})` : ''}`).join(', ')}`);
  }
  if (conds.length > 0) {
    parts.push(`Conditions: ${conds.length} branching check(s)`);
  }
  if (diags.length > 0) {
    parts.push(`Diagnostics: ${diags.length} syntax error(s) detected`);
  }
  return parts.length > 0 ? parts.join(' | ') : 'No high-level structures detected.';
}
