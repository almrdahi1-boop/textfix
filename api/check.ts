import type { VercelRequest, VercelResponse } from '@vercel/node';

const SYSTEM_PROMPT_AR = (caps: number) => {
  let rule = '';
  if (caps === 1) rule = '4. **تحويل جميع الحروف إلى كبيرة**: اجعل النص كله بأحرف كبيرة (UPPERCASE).';
  else if (caps === 2) rule = '4. **أول حرف من كل كلمة كبير**: اجعل أول حرف من كل كلمة كبيراً (Title Case، مثل العناوين).';
  else if (caps === 3) rule = '4. **أول حرف من كل جملة كبير**: اجعل أول حرف من كل جملة كبيراً فقط (Sentence case).';
  const r = rule ? `\n${rule}` : '';
  return `أنت خبير تدقيق لغوي متخصص في اللغة العربية والإنجليزية. دورك تصحيح النصوص بدقة.

مهامك:
1. **التدقيق الإملائي والنحوي الشامل**: صحح الأخطاء الإملائية والنحوية
2. **إعادة صياغة منظمة**: أعد كتابة النص المصحح مع علامات الترقيم الصحيحة والأحرف الكبيرة
3. **شرح التصحيحات**: اشرح ما الذي تم تصحيحه
${r}
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
};

const SYSTEM_PROMPT_EN = (caps: number) => {
  let rule = '';
  if (caps === 1) rule = '4. **Convert all letters to UPPERCASE**: Rewrite the entire text in uppercase.';
  else if (caps === 2) rule = '4. **Capitalize each word**: Rewrite in Title Case (first letter of every word capitalized).';
  else if (caps === 3) rule = '4. **Sentence case**: Capitalize only the first letter of each sentence.';
  const r = rule ? `\n${r}` : '';
  return `You are a professional proofreading expert specializing in Arabic and English. Correct text accurately.

Tasks:
1. **Spelling & Grammar Check**: Fix all errors
2. **Clean Rewrite**: Rewrite with proper punctuation and capitalization
3. **Explain Fixes**: Explain what was corrected
${r}
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
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'POST only' });
  }

  const { text, caps } = req.body || {};
  if (!text || !text.trim()) {
    return res.status(400).json({ error: 'No text provided' });
  }

  // caps: 0=no change, 1=UPPERCASE, 2=Title Case, 3=Sentence case
  const capsMode = typeof caps === 'number' && caps >= 1 && caps <= 3 ? caps : 0;

  const isArabic = /[\u0600-\u06FF]/.test(text);
  const sysPrompt = isArabic
    ? SYSTEM_PROMPT_AR(capsMode)
    : SYSTEM_PROMPT_EN(capsMode);

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
