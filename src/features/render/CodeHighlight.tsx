import { memo } from 'react'

interface Token {
  type:
    | 'text'
    | 'comment'
    | 'string'
    | 'keyword'
    | 'constant'
    | 'builtin'
    | 'function'
    | 'number'
    | 'operator'
    | 'decorator'
  value: string
}

const PYTHON_KEYWORDS = new Set([
  'def',
  'class',
  'return',
  'import',
  'from',
  'as',
  'if',
  'elif',
  'else',
  'for',
  'in',
  'while',
  'try',
  'except',
  'finally',
  'with',
  'lambda',
  'yield',
  'raise',
  'pass',
  'break',
  'continue',
  'and',
  'or',
  'not',
  'is',
  'global',
  'nonlocal',
  'assert',
  'async',
  'await',
])

const PYTHON_CONSTANTS = new Set(['True', 'False', 'None', 'self', 'cls'])

const PYTHON_BUILTINS = new Set([
  'df',
  'pd',
  'np',
  'plt',
  'print',
  'len',
  'range',
  'zip',
  'enumerate',
  'min',
  'max',
  'sum',
  'round',
  'int',
  'float',
  'str',
  'bool',
  'list',
  'dict',
  'set',
  'tuple',
  'abs',
  'all',
  'any',
  'isinstance',
  'type',
  'open',
  'map',
  'filter',
  'io',
  'scipy',
  'sklearn',
])

const SQL_KEYWORDS = new Set([
  'select',
  'from',
  'where',
  'group by',
  'order by',
  'having',
  'limit',
  'offset',
  'join',
  'left',
  'right',
  'full',
  'inner',
  'outer',
  'cross',
  'on',
  'as',
  'and',
  'or',
  'not',
  'in',
  'is',
  'null',
  'case',
  'when',
  'then',
  'else',
  'end',
  'distinct',
  'union',
  'all',
  'with',
  'desc',
  'asc',
  'like',
  'ilike',
  'between',
  'over',
  'partition by',
])

const SQL_FUNCTIONS = new Set([
  'count',
  'sum',
  'avg',
  'min',
  'max',
  'round',
  'coalesce',
  'nullif',
  'cast',
  'substring',
  'concat',
  'upper',
  'lower',
  'date_trunc',
  'extract',
  'row_number',
  'rank',
  'dense_rank',
])

function tokenizePython(code: string): Token[] {
  const tokens: Token[] = []
  // Regex pattern matching comments, docstrings, single/double strings, decorators, numbers, identifiers, operators, whitespace
  const pattern =
    /(#.*$)|("""[\s\S]*?"""|'''[\s\S]*?''')|([frbFRB]?"(?:[^"\\]|\\.)*"|[frbFRB]?'(?:[^'\\]|\\.)*')|(@\w+)|(\b\d+(?:\.\d+)?(?:[eE][+-]?\d+)?\b)|(\b[a-zA-Z_]\w*\b)|([+\-*/%=<>!&|^~:]+)|(\s+|[^\s\w])/gm

  let match: RegExpExecArray | null
  while ((match = pattern.exec(code)) !== null) {
    const [
      full,
      comment,
      docstring,
      stringLit,
      decorator,
      number,
      ident,
      operator,
    ] = match

    if (comment) {
      tokens.push({ type: 'comment', value: comment })
    } else if (docstring || stringLit) {
      tokens.push({ type: 'string', value: docstring || stringLit })
    } else if (decorator) {
      tokens.push({ type: 'decorator', value: decorator })
    } else if (number) {
      tokens.push({ type: 'number', value: number })
    } else if (ident) {
      if (PYTHON_KEYWORDS.has(ident)) {
        tokens.push({ type: 'keyword', value: ident })
      } else if (PYTHON_CONSTANTS.has(ident)) {
        tokens.push({ type: 'constant', value: ident })
      } else if (PYTHON_BUILTINS.has(ident)) {
        tokens.push({ type: 'builtin', value: ident })
      } else {
        // Peek ahead for function call: if next non-whitespace char is '('
        const afterIndex = match.index + full.length
        const remainder = code.slice(afterIndex)
        if (/^\s*\(/.test(remainder)) {
          tokens.push({ type: 'function', value: ident })
        } else {
          tokens.push({ type: 'text', value: ident })
        }
      }
    } else if (operator) {
      tokens.push({ type: 'operator', value: operator })
    } else {
      tokens.push({ type: 'text', value: full })
    }
  }

  return tokens
}

function tokenizeSql(code: string): Token[] {
  const tokens: Token[] = []
  const pattern =
    /(--.*$|\/\*[\s\S]*?\*\/)|('(?:[^'\\]|\\.)*')|(\b\d+(?:\.\d+)?\b)|(\b[a-zA-Z_]\w*\b)|([+\-*/%=<>!]+)|(\s+|[^\s\w])/gm

  let match: RegExpExecArray | null
  while ((match = pattern.exec(code)) !== null) {
    const [full, comment, stringLit, number, ident, operator] = match

    if (comment) {
      tokens.push({ type: 'comment', value: comment })
    } else if (stringLit) {
      tokens.push({ type: 'string', value: stringLit })
    } else if (number) {
      tokens.push({ type: 'number', value: number })
    } else if (ident) {
      const lower = ident.toLowerCase()
      if (SQL_KEYWORDS.has(lower)) {
        tokens.push({ type: 'keyword', value: ident })
      } else if (SQL_FUNCTIONS.has(lower)) {
        tokens.push({ type: 'function', value: ident })
      } else {
        tokens.push({ type: 'text', value: ident })
      }
    } else if (operator) {
      tokens.push({ type: 'operator', value: operator })
    } else {
      tokens.push({ type: 'text', value: full })
    }
  }

  return tokens
}

export interface CodeHighlightProps {
  code: string
  language?: string
}

export const CodeHighlight = memo(function CodeHighlight({
  code,
  language = '',
}: CodeHighlightProps) {
  const lang = language.toLowerCase()
  const isPython = lang === 'python' || lang === 'py'
  const isSql = lang === 'sql'

  let tokens: Token[]
  if (isPython) {
    tokens = tokenizePython(code)
  } else if (isSql) {
    tokens = tokenizeSql(code)
  } else {
    // If unknown language, try python tokenizing if it looks like code, or plain text
    tokens = tokenizePython(code)
  }

  return (
    <code>
      {tokens.map((token, index) => {
        if (token.type === 'text') {
          return token.value
        }
        return (
          <span key={index} className={`tok-${token.type}`}>
            {token.value}
          </span>
        )
      })}
    </code>
  )
})
