import type { VercelRequest, VercelResponse } from '@vercel/node';

const SYSTEM_PROMPT_AR = `أنت خبير تدقيق لغوي متخصص في اللغة العربية والإنجليزية. دورك تصحيح النصوص بدقة.

مهامك:
1. **التدقيق الإملائي والنحوي الشامل**: صحح الأخطاء الإملائية والنحوية
2. **إعادة صياغة منظمة**: أعد كتابة النص المصحح مع علامات الترقيم الصحيحة والأحرف الكبيرة
3. **شرح التصحيحات**: اشرح ما الذي تم تصحيحه

**تنسيق الرد**: JSON فقط:
{
  "corrected": "النص الكامل بعد التصحيح",
  "summary": "ملخص التغييرات",
  "fixes": [
    { "original": "الكلمة قبل", "corrected": "بعد التصحيح", "explanation": "شرح الخطأ" }
  ],
  "wordCount": 0,
  "charCount": 0
}`;

const SYSTEM_PROMPT_EN = `You are a professional proofreading expert specializing in Arabic and English. Correct text accurately.

Tasks:
1. **Spelling & Grammar Check**: Fix all errors
2. **Clean Rewrite**: Rewrite with proper punctuation and capitalization
3. **Explain Fixes**: Explain what was corrected

**Response format**: JSON only:
{
  "corrected": "Full corrected text",
  "summary": "Summary of changes",
  "fixes": [
    { "original": "Original", "corrected": "Corrected", "explanation": "Explanation" }
  ],
  "wordCount": 0,
  "charCount": 0
}`;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'POST only' });
  }

  const { text } = req.body || {};
  if (!text || !text.trim()) {
    return res.status(400).json({ error: 'No text provided' });
  }

  const isArabic = /[\u0600-\u06FF]/.test(text);
  const sysPrompt = isArabic ? SYSTEM_PROMPT_AR : SYSTEM_PROMPT_EN;

  const apiKey = process.env.GROQ_KEY;

  try {
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + apiKey
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        messages: [
          { role: 'system', content: sysPrompt },
          { role: 'user', content: text }
        ],
        temperature: 0.2,
        max_tokens: 4096,
        response_format: { type: 'json_object' }
      })
    });

    if (!response.ok) {
      const errBody = await response.text();
      throw new Error('Groq error: ' + errBody.slice(0, 200));
    }

    const data = await response.json();
    const raw = data?.choices?.[0]?.message?.content?.trim() || '{}';

    try {
      const parsed = JSON.parse(raw);
      return res.status(200).json(parsed);
    } catch {
      return res.status(200).json({
        corrected: raw,
        summary: isArabic ? 'تمت المعالجة' : 'Processed',
        fixes: [],
      });
    }
  } catch (e: any) {
    return res.status(500).json({ error: e.message || 'Internal error' });
  }
}
