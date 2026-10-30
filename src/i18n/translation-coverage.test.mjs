import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import ts from 'typescript'

const projectRoot = fileURLToPath(new URL('../../', import.meta.url))

function parseRecords(relativePath, recordNames) {
  const absolutePath = path.join(projectRoot, relativePath)
  const sourceText = fs.readFileSync(absolutePath, 'utf8')
  const sourceFile = ts.createSourceFile(absolutePath, sourceText, ts.ScriptTarget.Latest, true, relativePath.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS)
  const records = new Map()

  function visit(node) {
    if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && recordNames.includes(node.name.text) && node.initializer && ts.isObjectLiteralExpression(node.initializer)) {
      const entries = new Map()
      for (const property of node.initializer.properties) {
        if (!ts.isPropertyAssignment(property)) continue
        const key = ts.isStringLiteral(property.name) || ts.isNoSubstitutionTemplateLiteral(property.name) ? property.name.text : null
        const value = ts.isStringLiteral(property.initializer) || ts.isNoSubstitutionTemplateLiteral(property.initializer) ? property.initializer.text : null
        if (key !== null && value !== null) entries.set(key, value)
      }
      records.set(node.name.text, entries)
    }
    ts.forEachChild(node, visit)
  }

  visit(sourceFile)
  return records
}

function getTranslationDictionaries() {
  const provider = parseRecords('src/i18n/LanguageProvider.tsx', ['english', 'arabic'])
  const parentage = parseRecords('src/i18n/parentage.ts', ['parentageEnglish', 'parentageArabic'])
  return {
    english: new Map([...parentage.get('parentageEnglish'), ...provider.get('english')]),
    arabic: new Map([...parentage.get('parentageArabic'), ...provider.get('arabic')]),
  }
}

function getSourceFiles(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const absolutePath = path.join(directory, entry.name)
    if (entry.isDirectory()) return getSourceFiles(absolutePath)
    return /\.tsx?$/.test(entry.name) ? [absolutePath] : []
  })
}

function getStaticTranslationKeys(expression) {
  if (ts.isStringLiteral(expression) || ts.isNoSubstitutionTemplateLiteral(expression)) return [expression.text]
  if (ts.isConditionalExpression(expression)) return [...getStaticTranslationKeys(expression.whenTrue), ...getStaticTranslationKeys(expression.whenFalse)]
  if (ts.isParenthesizedExpression(expression) || ts.isAsExpression(expression) || ts.isTypeAssertionExpression(expression)) return getStaticTranslationKeys(expression.expression)
  return []
}

function getApplicationTranslationKeys() {
  const sourceFiles = getSourceFiles(path.join(projectRoot, 'src'))
  const calls = []

  for (const absolutePath of sourceFiles) {
    const sourceText = fs.readFileSync(absolutePath, 'utf8')
    const sourceFile = ts.createSourceFile(absolutePath, sourceText, ts.ScriptTarget.Latest, true, absolutePath.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS)
    function visit(node) {
      const isTranslationCall = ts.isCallExpression(node) && (
        (ts.isIdentifier(node.expression) && node.expression.text === 't')
        || (ts.isPropertyAccessExpression(node.expression) && node.expression.name.text === 't')
      )
      if (isTranslationCall && node.arguments[0]) {
        const line = sourceFile.getLineAndCharacterOfPosition(node.getStart()).line + 1
        for (const key of getStaticTranslationKeys(node.arguments[0])) calls.push({ key, file: path.relative(projectRoot, absolutePath), line })
      }
      ts.forEachChild(node, visit)
    }
    visit(sourceFile)
  }

  return calls
}

test('every English translation and parentage key has an Arabic translation', () => {
  const { english, arabic } = getTranslationDictionaries()
  const missing = [...english.keys()].filter((key) => !arabic.has(key))
  assert.deepEqual(missing, [])
})

test('literal application translation calls resolve in Arabic', () => {
  const { arabic } = getTranslationDictionaries()
  const missing = getApplicationTranslationKeys().filter(({ key }) => !arabic.has(key))
  assert.deepEqual(missing, [])
})

test('dynamic translation placeholders match across languages except inflected Arabic forms', () => {
  const { english, arabic } = getTranslationDictionaries()
  const intentionallyInflected = /^(?:Died age (?:years|months|days) (?:one|two)|(?:Mother|Father) age at birth: (?:zero|one|two))$/
  const placeholders = (message) => [...message.matchAll(/\{([^{}]+)\}/g)].map((match) => match[1]).sort()
  const mismatched = [...english.keys()].filter((key) => !intentionallyInflected.test(key) && JSON.stringify(placeholders(english.get(key))) !== JSON.stringify(placeholders(arabic.get(key))))
  assert.deepEqual(mismatched, [])
})

test('Create and Save have explicit English and Arabic translations', () => {
  const { english, arabic } = getTranslationDictionaries()
  assert.equal(english.get('Create'), 'Create')
  assert.equal(arabic.get('Create'), '\u0625\u0646\u0634\u0627\u0621')
  assert.equal(english.get('Save'), 'Save')
  assert.equal(arabic.get('Save'), '\u062d\u0641\u0638')
})

test('Arabic kinship labels use precise brother and sister terms', () => {
  const { arabic } = getTranslationDictionaries()
  assert.equal(arabic.get('Brother'), '\u0623\u062e \u0634\u0642\u064a\u0642')
  assert.equal(arabic.get('Sister'), '\u0623\u062e\u062a \u0634\u0642\u064a\u0642\u0629')
  assert.equal(arabic.get('Maternal half-brother'), '\u0623\u062e \u0644\u0623\u0645')
  assert.equal(arabic.get('Maternal half-sister'), '\u0623\u062e\u062a \u0644\u0623\u0645')
  assert.equal(arabic.get('Paternal half-brother'), '\u0623\u062e \u0644\u0623\u0628')
  assert.equal(arabic.get('Paternal half-sister'), '\u0623\u062e\u062a \u0644\u0623\u0628')
})

test('translation sources contain no common UTF-8 mojibake markers', () => {
  const sources = ['src/i18n/LanguageProvider.tsx', 'src/i18n/parentage.ts']
    .map((relativePath) => fs.readFileSync(path.join(projectRoot, relativePath), 'utf8'))
    .join('\n')
  assert.doesNotMatch(sources, /[ØÙÃÂ]|â€/)
})
