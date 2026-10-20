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

export class PythonAdapter implements LanguageAdapter {
  public readonly language = 'python';

  private _parser: any = null;
  private _isInitialized = false;

  public async initialize(wasmDir: string): Promise<void> {
    if (this._isInitialized && this._parser) {
      return;
    }

    const treeSitterWasmPath = path.join(wasmDir, 'tree-sitter.wasm');
    const pythonWasmPath = path.join(wasmDir, 'tree-sitter-python.wasm');

    if (!fs.existsSync(treeSitterWasmPath)) {
      throw new Error(`Tree-sitter WASM not found at: ${treeSitterWasmPath}`);
    }
    if (!fs.existsSync(pythonWasmPath)) {
      throw new Error(`Python grammar WASM not found at: ${pythonWasmPath}`);
    }

    await Parser.init({
      locateFile: () => treeSitterWasmPath,
    });

    const pythonLang = await Parser.Language.load(pythonWasmPath);
    this._parser = new Parser();
    this._parser.setLanguage(pythonLang);
    this._isInitialized = true;
  }

  public async parse(sourceCode: string): Promise<AnalysisResult> {
    if (!this._isInitialized || !this._parser) {
      throw new Error('PythonAdapter must be initialized with initialize(wasmDir) before parsing.');
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

    // Recursive AST visitor
    const visit = (node: any) => {
      // Check for syntax errors
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
          const nameNode = node.childForFieldName('name') || node.children.find((c: any) => c.type === 'identifier');
          const paramsNode = node.childForFieldName('parameters') || node.children.find((c: any) => c.type === 'parameters');

          const params: string[] = [];
          if (paramsNode) {
            for (const child of paramsNode.children) {
              if (child.type === 'identifier') {
                params.push(child.text);
              }
            }
          }

          let hasReturn = false;
          const checkForReturn = (n: any) => {
            if (n.type === 'return_statement') hasReturn = true;
            for (const c of n.children) checkForReturn(c);
          };
          checkForReturn(node);

          if (nameNode) {
            functions.push({
              name: nameNode.text,
              parameters: params,
              location: toLocation(node),
              hasReturn,
            });
          }
          break;
        }

        case 'for_statement': {
          const leftNode = node.childForFieldName('left');
          const loopVars: string[] = [];
          if (leftNode) {
            loopVars.push(leftNode.text);
          }
          loops.push({
            type: 'for',
            variables: loopVars,
            location: toLocation(node),
          });
          break;
        }

        case 'while_statement': {
          const conditionNode = node.childForFieldName('condition');
          loops.push({
            type: 'while',
            conditionText: conditionNode ? conditionNode.text : '',
            variables: [],
            location: toLocation(node),
          });
          break;
        }

        case 'if_statement': {
          const conditionNode = node.childForFieldName('condition');
          conditions.push({
            type: 'if',
            conditionText: conditionNode ? conditionNode.text : '',
            location: toLocation(node),
          });
          break;
        }

        case 'elif_clause': {
          const conditionNode = node.childForFieldName('condition');
          conditions.push({
            type: 'elif',
            conditionText: conditionNode ? conditionNode.text : '',
            location: toLocation(node),
          });
          break;
        }

        case 'else_clause': {
          conditions.push({
            type: 'else',
            location: toLocation(node),
          });
          break;
        }

        case 'assignment': {
          const leftNode = node.childForFieldName('left');
          if (leftNode && leftNode.type === 'identifier') {
            variables.push({
              name: leftNode.text,
              location: toLocation(node),
            });
          }
          break;
        }

        case 'call': {
          const fnNode = node.childForFieldName('function');
          const argsNode = node.childForFieldName('arguments');
          const args: string[] = [];
          if (argsNode) {
            for (const child of argsNode.children) {
              if (child.type !== '(' && child.type !== ')' && child.type !== ',') {
                args.push(child.text);
              }
            }
          }
          if (fnNode) {
            functionCalls.push({
              functionName: fnNode.text,
              arguments: args,
              location: toLocation(node),
            });
          }
          break;
        }

        case 'return_statement': {
          returnStatements.push({
            valueText: node.children.length > 1 ? node.children[1].text : undefined,
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

    const status = diagnostics.length > 0 ? 'partial' : 'success';

    // Build human/LLM readable structural summary
    const summaryLines: string[] = [];
    if (functions.length > 0) {
      summaryLines.push(`Functions (${functions.length}): ${functions.map(f => `${f.name}(${f.parameters.join(', ')}) [L${f.location.startLine}]`).join(', ')}`);
    }
    if (loops.length > 0) {
      summaryLines.push(`Loops (${loops.length}): ${loops.map(l => `${l.type} loop [L${l.location.startLine}]`).join(', ')}`);
    }
    if (conditions.length > 0) {
      summaryLines.push(`Conditionals (${conditions.length}): ${conditions.map(c => `${c.type} [L${c.location.startLine}]`).join(', ')}`);
    }
    if (diagnostics.length > 0) {
      summaryLines.push(`Syntax Diagnostics (${diagnostics.length}): ${diagnostics.map(d => `${d.message} [L${d.location.startLine}]`).join('; ')}`);
    }

    return {
      language: this.language,
      status,
      functions,
      variables,
      loops,
      conditions,
      functionCalls,
      returnStatements,
      diagnostics,
      rawStructure: rootNode.toString(),
      summaryText: summaryLines.join('\n') || 'Simple statement sequence.',
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
