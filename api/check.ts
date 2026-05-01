import type { VercelRequest, VercelResponse } from '@vercel/node';

const SYSTEM_PROMPT = `أنت خبير تدقيق لغوي متخصص في اللغة العربية والإنجليزية. دورك تصحيح النصوص بدقة.

مهامك:
1. **التدقيق الإملائي والنحوي الشامل**: صحح الأخطاء الإملائية والنحوية. ركز على قواعد النحو العربي (الإعراب، علامات الرفع والنصب والجر، الأخطاء الشائعة).
2. **إعادة صياغة منظمة**: أعد كتابة النص المصحح بطريقة مرتبة مع علامات الترقيم الصحيحة، الأحرف الكبيرة في بداية الجمل (للإنجليزية)، تنظيم الفقرات.
3. **شرح التصحيحات**: اشرح ما الذي تم تصحيحه.

**تنسيق الرد**: أعد JSON بهذه الصيغة بالضبط:
{
  "corrected": "النص الكامل بعد التصحيح وإعادة الصياغة",
  "summary": "ملخص التغييرات (جملة أو جملتين)",
  "fixes": [
    {
      "original": "الكلمة أو العبارة قبل التصحيح",
      "corrected": "بعد التصحيح",
      "explanation": "شرح الخطأ"
    }
  ],
  "wordCount": عدد الكلمات,
  "charCount": عدد الأحرف
}

مهم جداً:
- لا تقم بتعديل الأرقام أو الأسماء أو التواريخ أو الروابط
- حافظ على المعنى الأصلي للنص
- أعد الرد بصيغة JSON صالحة فقط`;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'POST only' });
  }

  const { text } = req.body || {};
  if (!text || !text.trim()) {
    return res.status(400).json({ error: 'No text provided' });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'API key not configured' });
  }

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [
            { role: 'user', parts: [{ text: SYSTEM_PROMPT + '\n\n---\n\n' + text }] }
          ],
          generationConfig: {
            temperature: 0.2,
            topP: 0.9,
            topK: 40,
            maxOutputTokens: 8192,
            responseMimeType: 'application/json',
          }
        })
      }
    );

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Gemini API error: ${errText.slice(0, 200)}`);
    }

    const data = await response.json();
    const raw = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';

    // Try to parse as JSON
    let jsonStr = raw.trim();
    if (jsonStr.startsWith('```')) {
      jsonStr = jsonStr.replace(/```(?:json)?\n?/g, '').trim();
    }

    try {
      const parsed = JSON.parse(jsonStr);
      return res.status(200).json(parsed);
    } catch {
      // Fallback: wrap raw text in expected format
      return res.status(200).json({
        corrected: raw,
        summary: 'تمت المعالجة',
        fixes: [],
        wordCount: text.split(/\s+/).length,
        charCount: text.length,
      });
    }
  } catch (e: any) {
    return res.status(500).json({
      error: e.message || 'Internal error'
    });
  }
}
