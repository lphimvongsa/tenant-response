import OpenAI from 'openai'

// DeepSeek is OpenAI-API-compatible; we point the OpenAI SDK at their endpoint.
export const deepseek = new OpenAI({
  apiKey: process.env.DEEPSEEK_KEY!,
  baseURL: 'https://api.deepseek.com/v1',
})

export const DEEPSEEK_MODEL = process.env.DEEPSEEK_MODEL!
