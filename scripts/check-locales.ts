import fs from 'fs'

const SOURCE_DIR = 'src'
const LOCALE_DIR = `${SOURCE_DIR}/lib/locales`
const DEFAULT_LOCALE = 'cs'

// Patterns for detecting hardcoded user-facing text (generic Unicode patterns)
interface PatternConfig {
  pattern: RegExp
  description: string
  filterMatch?: (attrName: string) => boolean
}

// Technical/structural attributes that should be excluded from localization checks
const TECHNICAL_ATTRS = [
  'href',
  'src',
  'srcset',
  'class',
  'style',
  'type',
  'name',
  'id',
  'for',
  'method',
  'action',
  'target',
  'rel',
  'xmlns',
  'viewBox',
  'd',
  'fill',
  'stroke',
  'stroke-dasharray',
  'stroke-width',
  'stroke-linecap',
  'stroke-linejoin',
  'dasharray', // captured from stroke-dasharray by \w+ pattern
  'transform',
  'preserveAspectRatio',
  'xmlns:xlink',
  'role',
  'aria-label',
  'data-testid',
]

// Filter function for checking if an attribute is technical
const isTechnicalAttr = (attrName: string) => !TECHNICAL_ATTRS.includes(attrName)

const HARDCODED_TEXT_PATTERNS: PatternConfig[] = [
  // Text between regular HTML/Svelte tags (not after self-closing tags)
  // Uses 's' flag (dotAll) to allow matching across newlines
  // Script and style tags are filtered out before pattern matching
  // Avoids matching content with Svelte expressions (excludes { and })
  {
    pattern: /(?<!\/)>\s*(\p{L}[^<{}]*?[^\s<{}])\s*<(?:\/|\w)/gsu,
    description: 'Text content between HTML tags',
  },
  // Text starting with special symbols or arrows (multiline support)
  {
    pattern: />\s*([\p{So}\p{Sm}][\p{L}\s\p{P}\n\r]+)\s*</gsu,
    description: 'Text content starting with symbols or arrows',
  },
  // Text that comes after self-closing tags or components (avoid duplication with first pattern)
  {
    pattern: /\/>\s*([^\p{So}\p{Sm}]\p{L}[\p{L}\s\p{P}]*)<(?:\/|\w)/gu,
    description: 'Text content after self-closing tags',
  },
  // Hardcoded strings in user-facing attributes (double-quoted)
  // Matches: attributeName="Text with capital" or attributeName="text with spaces"
  // Excludes technical attributes and lowercase single-word/kebab-case values
  {
    pattern: /(\w+)="([A-Z][^"]*|[^"]*\s[^"]*)"/gu,
    description: 'Hardcoded text in HTML attributes',
    filterMatch: isTechnicalAttr,
  },
  // Hardcoded strings in user-facing attributes (single-quoted)
  {
    pattern: /(\w+)='([A-Z][^']*|[^']*\s[^']*)'/gu,
    description: 'Hardcoded text in HTML attributes',
    filterMatch: isTechnicalAttr,
  },
  // Direct text content that might be user-facing (like "Made with")
  {
    pattern: /(?<!\/\/\s*)(?<!\*\s+)(\p{Lu}\p{L}*(?:\s+\p{L}+)*)\s+<a/gu,
    description: 'Text followed by links (like "Made with <a>")',
  },
  // Text inside Svelte if blocks or other template syntax
  {
    pattern: /\}([A-Z][a-zA-Z\s]+)(?:\{|\s*<)/gu,
    description: 'Text content inside Svelte template blocks',
  },
  // Hardcoded user-facing strings in JavaScript variable assignments (sentences with capital letter start)
  {
    pattern: /(?<!!)(?<!==)(?<!=)=(?!=)\s*['"`]([A-Z][a-z]+(?:\s+[a-zA-Z]+)*[.!?]?)['"`]/gu,
    description: 'Hardcoded user-facing strings in JavaScript assignments',
  },
  // Hardcoded user-facing strings in JavaScript expressions (ternary, function calls, etc.)
  {
    pattern: /:\s*['"`]([A-Z][a-z]+(?:\s+[a-zA-Z0-9]+)*[.!?]?)['"`]/gu,
    description: 'Hardcoded user-facing strings in JavaScript expressions',
  },
]

// Text patterns to exclude (technical terms, single words, etc.)
const EXCLUDE_PATTERNS = [
  /^(OK|ID|API|URL|HTML|CSS|JS|TS|JSON|XML|HTTP|HTTPS|UTC|GMT|PDF|CSV|USD|EUR|CZK|GBP|Discord|Instagram|beta|and|FAQ|mailpit)$/i,
  /kalkul\.app/i, // Domain name
  /^\p{Lu}{2,4}$/u, // Acronyms (any uppercase letters)
  /^\d+$/, // Pure numbers
  /^[\w.-]+@[\w.-]+$/, // Email addresses
  /^https?:\/\//, // URLs
  /^data:/, // Data URIs (including base64)
  /^\/[/\w-]*$/, // File paths
  /^#[0-9a-fA-F]{3,8}$/, // Color codes
  /^[\d.]+%$/, // Percentages
  /^[\d.,]+$/, // Numbers with formatting
  /^\s*$/, // Whitespace only
  /^\{[^}]+\}/, // Template expressions (with or without newlines)
  /^\|\s*\w+/, // TypeScript union types
  /^&[a-zA-Z][a-zA-Z0-9]*;$/, // HTML entities
  /^[a-zA-Z_$][a-zA-Z0-9_$]*\s*[=(){}]/, // Code patterns (variable assignments, function calls)
  /^[a-zA-Z_$][a-zA-Z0-9_$.]*$/, // Simple variable names or property access
  /^\w+\s*[<>]=?\s*\w+/, // Comparisons
  /^=\s*\w+/, // Assignment operators or comparison starting with =
  /^[A-Za-z0-9+/=]{20,}/, // Base64-like strings (20+ chars of base64 alphabet)
]

function scanSourceFiles() {
  const localizedTextSet = new Set<string>()

  const filenames = fs.readdirSync(SOURCE_DIR, { recursive: true })
  filenames.forEach((filename) => {
    const filePath = `${SOURCE_DIR}/${filename}`
    const stat = fs.statSync(filePath)
    if (stat.isDirectory()) {
      return
    }

    // Skip server files as they contain backend-only messages
    if (filePath.includes('+server.ts')) {
      return
    }

    // Skip tests: their fixture schemas carry throwaway `message:` values that
    // are never rendered, so treating them as required translation keys would
    // report missing texts that must not exist in the locale files.
    if (/\.(test|spec)(\.svelte)?\.(ts|js)$/.test(filePath)) {
      return
    }

    const file = fs.readFileSync(filePath, { encoding: 'utf8' })

    // First, find simple $_('key') patterns
    const simpleTexts = file.matchAll(/\$_\([\s]*'(.*?)'/gim)
    for (const localizedText of simpleTexts) {
      if (!localizedTextSet.has(localizedText[1])) {
        localizedTextSet.add(localizedText[1])
      }
    }

    // Also find get(_)('key') patterns used in TypeScript files
    const getTexts = file.matchAll(/get\(_\)\([\s]*'(.*?)'/gim)
    for (const localizedText of getTexts) {
      if (!localizedTextSet.has(localizedText[1])) {
        localizedTextSet.add(localizedText[1])
      }
    }

    // Check for $_() calls with logic instead of simple string literals
    const logicInLocalizationCalls = file.matchAll(/\$_\(\s*([^'"][^)]*)\s*\)/gim)
    for (const match of logicInLocalizationCalls) {
      const content = match[1].trim()
      // Skip if it's just a simple variable or object access without operators
      if (
        content.includes('?') ||
        content.includes(':') ||
        content.includes('&&') ||
        content.includes('||')
      ) {
        console.log(`⚠️  Logic detected in $_() call in ${filePath}: ${match[0]}`)
      }
    }

    // Check for get(_)() calls with logic instead of simple string literals
    const logicInGetCalls = file.matchAll(/get\(_\)\(\s*([^'"][^)]*)\s*\)/gim)
    for (const match of logicInGetCalls) {
      const content = match[1].trim()
      // Skip if it's just a simple variable or object access without operators
      if (
        content.includes('?') ||
        content.includes(':') ||
        content.includes('&&') ||
        content.includes('||')
      ) {
        console.log(`⚠️  Logic detected in get(_)() call in ${filePath}: ${match[0]}`)
      }
    }

    // Scan for zod schema error messages
    if (filePath.endsWith('.ts') || filePath.endsWith('.js')) {
      // Find zod schema error messages like: message: 'error.key'
      const zodMessages = file.matchAll(/message:\s*['"`]([^'"`]+)['"`]/gim)
      for (const zodMessage of zodMessages) {
        if (!localizedTextSet.has(zodMessage[1])) {
          localizedTextSet.add(zodMessage[1])
        }
      }

      // Also find zod addIssue calls with message property
      const zodIssueMessages = file.matchAll(/message:\s*['"`]([^'"`]+)['"`]/gim)
      for (const issueMessage of zodIssueMessages) {
        if (!localizedTextSet.has(issueMessage[1])) {
          localizedTextSet.add(issueMessage[1])
        }
      }
    }
  })
  return localizedTextSet
}

function scanForHardcodedText(scanDir: string = SOURCE_DIR) {
  const hardcodedTextFound: Array<{ file: string; text: string; pattern: string; line?: number }> =
    []

  const filenames = fs.readdirSync(scanDir, { recursive: true })
  filenames.forEach((filename) => {
    const filePath = `${scanDir}/${filename}`
    const stat = fs.statSync(filePath)
    if (stat.isDirectory()) {
      return
    }

    // Only check .svelte files for hardcoded text
    if (!filePath.endsWith('.svelte')) {
      return
    }

    const file = fs.readFileSync(filePath, { encoding: 'utf8' })
    const lines = file.split('\n')

    // Check if file has exclusion comment in the first line
    if (lines[0] && lines[0].trim().startsWith('<!-- localization-exclude -->')) {
      return
    }

    // Separate script, style, and template sections
    // Remove <script> and <style> content to avoid matching code as user-facing text
    const scriptStyleRegex = /<(script|style)[^>]*>[\s\S]*?<\/\1>/gi
    const templateOnly = file.replace(scriptStyleRegex, (match) => {
      // Replace with same number of newlines to preserve line numbers
      return '\n'.repeat((match.match(/\n/g) || []).length)
    })

    // Check each pattern
    HARDCODED_TEXT_PATTERNS.forEach(({ pattern, description, filterMatch }) => {
      const regex = new RegExp(pattern.source, pattern.flags)
      let match

      // Use templateOnly for HTML content patterns, full file for JS patterns
      const searchText =
        description.includes('JavaScript') || description.includes('template blocks')
          ? file
          : templateOnly

      while ((match = regex.exec(searchText)) !== null) {
        // For patterns with filterMatch, check the attribute name (captured in group 1)
        if (filterMatch && match[1]) {
          const attrName = match[1]
          if (!filterMatch(attrName)) {
            continue // Skip this match if filterMatch returns false
          }
        }

        // Extract the actual text content (usually in capture group 1 or 2)
        // If filterMatch exists, text is in group 2, otherwise group 1
        const textContent = filterMatch ? match[2] : match[2] || match[1]
        if (!textContent) continue

        // Skip if text matches any exclude pattern
        const shouldExclude = EXCLUDE_PATTERNS.some((excludePattern) =>
          excludePattern.test(textContent.trim()),
        )
        if (shouldExclude) continue

        // Skip very short text
        if (textContent.trim().length < 3) {
          continue
        }

        // Find line number
        const beforeMatch = searchText.substring(0, match.index)
        const lineNumber = beforeMatch.split('\n').length

        hardcodedTextFound.push({
          file: filePath,
          text: textContent.trim(),
          pattern: description,
          line: lineNumber,
        })
      }
    })
  })

  return hardcodedTextFound
}

type Json = { [property: string]: Json }

function findDuplicateKeysInJsonString(jsonString: string, fileName: string): string[] {
  const duplicates: string[] = []
  const lines = jsonString.split('\n')
  const objectStack: string[] = [] // Track current object path
  const keysInCurrentObject = new Map<string, { keys: Set<string>; lines: Map<string, number> }>()

  lines.forEach((line, lineIndex) => {
    const trimmedLine = line.trim()
    const lineNumber = lineIndex + 1

    // Check if we're opening a new object
    const objectMatch = line.match(/^\s*"([^"]+)"\s*:\s*\{/)
    if (objectMatch) {
      const objectName = objectMatch[1]
      objectStack.push(objectName)
      const objectPath = objectStack.join('.')
      keysInCurrentObject.set(objectPath, { keys: new Set(), lines: new Map() })
      return
    }

    // Check if we're closing an object
    if (trimmedLine === '},' || trimmedLine === '}') {
      objectStack.pop()
      return
    }

    // Check for key-value pairs
    const keyMatch = line.match(/^\s*"([^"]+)"\s*:/)
    if (keyMatch) {
      const key = keyMatch[1]
      const currentPath = objectStack.join('.')

      if (keysInCurrentObject.has(currentPath)) {
        const objData = keysInCurrentObject.get(currentPath)!
        if (objData.keys.has(key)) {
          const firstOccurrence = objData.lines.get(key)!
          duplicates.push(
            `${fileName}: Duplicate key "${key}" in object "${currentPath}" on lines ${firstOccurrence} and ${lineNumber}`,
          )
        } else {
          objData.keys.add(key)
          objData.lines.set(key, lineNumber)
        }
      }
    }
  })

  return duplicates
}

function readLocaleData(locale: string): Json {
  const data = fs.readFileSync(`${LOCALE_DIR}/${locale}.json`, { encoding: 'utf8' })
  const localeData = JSON.parse(data)
  return localeData
}

function flattenLocale(json: Json): string[] {
  const localeTexts: string[] = []
  const keys = Object.keys(json)
  keys.forEach((key) => {
    if (typeof json[key] === 'string') {
      localeTexts.push(key)
    } else if (typeof json[key] === 'object') {
      const texts = flattenLocale(json[key]).map((text) => `${key}.${text}`)
      localeTexts.push(...texts)
    }
  })
  return localeTexts
}

function checkRecursively(text: string, keys: Json): boolean {
  if (keys[text]) {
    return true
  }
  const parts = text.split('.')
  if (parts.length === 0) {
    return false
  }

  const key = parts[0]
  if (keys[key]) {
    const rest = [...parts].slice(1).join('.')
    return checkRecursively(rest, keys[key])
  }

  return false
}

function checkTranslations() {
  // Check if --test flag is passed
  if (process.argv.includes('--test')) {
    console.log('Running check-locales tests against scripts/test-locales-examples.svelte...\n')
    const hardcodedText = scanForHardcodedText('scripts')

    if (hardcodedText.length > 0) {
      console.log('Test results - Found hardcoded text:\n')
      hardcodedText.forEach((item) => {
        console.log(`${item.file}:${item.line} - "${item.text}" (${item.pattern})`)
      })
    } else {
      console.log('No hardcoded text found in test file.')
    }

    console.log(`\nTest completed. Found ${hardcodedText.length} matches.`)
    return
  }

  const locale = process.argv[2] || DEFAULT_LOCALE
  const localizedTextSet = scanSourceFiles()
  const localeData = readLocaleData(locale)

  // Check for hardcoded user-facing text
  const hardcodedText = scanForHardcodedText()

  // Check for duplicate keys in all locale files
  const allDuplicates: string[] = []
  const localeFiles = fs.readdirSync(LOCALE_DIR).filter((file) => file.endsWith('.json'))

  for (const localeFile of localeFiles) {
    const filePath = `${LOCALE_DIR}/${localeFile}`
    const fileContent = fs.readFileSync(filePath, { encoding: 'utf8' })
    const duplicates = findDuplicateKeysInJsonString(fileContent, localeFile)
    allDuplicates.push(...duplicates)
  }

  // Check consistency between locale files
  const localeConsistencyErrors: string[] = []
  const allLocaleData: { [locale: string]: Json } = {}
  const allLocaleKeys: { [locale: string]: string[] } = {}

  // Load all locale data
  for (const localeFile of localeFiles) {
    const localeName = localeFile.replace('.json', '')
    allLocaleData[localeName] = readLocaleData(localeName)
    allLocaleKeys[localeName] = flattenLocale(allLocaleData[localeName])
  }

  // Check if all keys exist in all locales
  const allUniqueKeys = new Set<string>()
  Object.values(allLocaleKeys).forEach((keys) => keys.forEach((key) => allUniqueKeys.add(key)))

  for (const key of allUniqueKeys) {
    const localesWithKey = Object.entries(allLocaleKeys).filter(([, keys]) => keys.includes(key))
    const localesWithoutKey = Object.entries(allLocaleKeys).filter(
      ([, keys]) => !keys.includes(key),
    )

    if (localesWithoutKey.length > 0) {
      const withKeyLocales = localesWithKey.map(([locale]) => locale).join(', ')
      const withoutKeyLocales = localesWithoutKey.map(([locale]) => locale).join(', ')
      localeConsistencyErrors.push(
        `Key '${key}' exists in [${withKeyLocales}] but missing in [${withoutKeyLocales}]`,
      )
    }
  }

  if (allDuplicates.length > 0) {
    console.log('\nDuplicate keys found:\n')
    allDuplicates.forEach((dup) => console.log(dup))
  }

  if (localeConsistencyErrors.length > 0) {
    console.log('\nLocale consistency errors:\n')
    localeConsistencyErrors.forEach((error) => console.log(error))
  }

  const missingTexts: string[] = []
  for (const localizedText of localizedTextSet) {
    if (!checkRecursively(localizedText, localeData)) {
      missingTexts.push(localizedText)
    }
  }

  if (missingTexts.length > 0) {
    console.log('\nMissing texts:\n')
    missingTexts.forEach((text) => console.log(`'${text}'`))
  }

  const unusedTexts: string[] = []
  const localeTexts = flattenLocale(localeData)
  for (const localeText of localeTexts) {
    if (!localizedTextSet.has(localeText)) {
      unusedTexts.push(localeText)
    }
  }

  if (unusedTexts.length > 0) {
    console.log('\nUnused texts:\n')
    unusedTexts.forEach((text) => console.log(`'${text}'`))
  }

  if (hardcodedText.length > 0) {
    console.log('\nPotential hardcoded user-facing text found:\n')
    hardcodedText.forEach((item) => {
      console.log(`${item.file}:${item.line} - "${item.text}" (${item.pattern})`)
    })
  }

  if (
    missingTexts.length > 0 ||
    unusedTexts.length > 0 ||
    allDuplicates.length > 0 ||
    localeConsistencyErrors.length > 0 ||
    hardcodedText.length > 0
  ) {
    process.exit(1)
  }
}

checkTranslations()
