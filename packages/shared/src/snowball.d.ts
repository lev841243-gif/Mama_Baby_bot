declare module 'snowball-stemmers' {
  export function newStemmer(lang: string): { stem(word: string): string }
}
