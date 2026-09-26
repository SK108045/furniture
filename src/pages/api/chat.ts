import type { APIRoute } from 'astro';
import { env } from '../../server/config';
import { shopProducts as products, money } from '../../data/products';
import { phone, whatsapp } from '../../data/contact';

const FALLBACK_KEY = 'AQ.Ab8RN6LDJO6RH9quRTsyVo2TfRAX18Ijam7oNcgA8sxkG4NDLw';

const productList = products
  .map(
    (p) =>
      `• ${p.name} (${p.category}): ${p.quoteOnly?'Price on enquiry; contact the shop for a quote':money(p.price)}${
        p.onSale ? ` [Selling price; original ${money(p.originalPrice)}, save ${money(p.savings)}]` : ''
      } - ${p.description}`
  )
  .join('\n');

const SYSTEM_INSTRUCTION = `You are Nicoo, the smart virtual assistant for Nicoo Funiture Hub in Donholm, Nairobi, Kenya.

KEY FACTS:
- Location: Donholm, Nairobi, Kenya. Open for visits and showroom trials.
- Phone / WhatsApp: ${phone} (${whatsapp}).
- Delivery: Available across Nairobi estates (rates confirmed with the shop based on your location).
- Payment: Secure M-Pesa payments accepted online and in-store.

OUR CURRENT PRODUCTS & PRICES:
${productList}

STRICT BEHAVIOR RULES:
1. Be extremely concise: answer in 1 to 2 sentences max (never exceed 3 sentences).
2. ONLY answer what was directly asked. Do not ramble, oversell, or add unnecessary disclaimers.
3. Use a warm, professional, Kenyan-friendly tone ("Karibu!", "Habari").
4. If asked about something completely unrelated (coding, homework, sports, etc.), decline in one friendly sentence and redirect to our furniture.
5. If someone wants to place an order, negotiate, or speak to someone, tell them to tap the WhatsApp button or message ${phone}.`;

export const POST: APIRoute = async ({ request }) => {
  try {
    const data = await request.json();
    const userMessage = (data.message || '').trim();
    const history = Array.isArray(data.history) ? data.history : [];

    if (!userMessage) {
      return new Response(JSON.stringify({ error: 'Message cannot be empty.' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const apiKey = env('GEMINI_API_KEY') || FALLBACK_KEY;
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-lite:generateContent?key=${apiKey}`;

    // Build conversation contents
    const contents: Array<{ role: 'user' | 'model'; parts: Array<{ text: string }> }> = [];

    // Add recent history (up to last 6 turns to keep context fast and lean)
    const recentHistory = history.slice(-6);
    for (const h of recentHistory) {
      if (h.role === 'user' || h.role === 'model') {
        contents.push({
          role: h.role,
          parts: [{ text: String(h.text || '') }],
        });
      }
    }

    // Add current user prompt
    contents.push({
      role: 'user',
      parts: [{ text: userMessage }],
    });

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        systemInstruction: {
          parts: [{ text: SYSTEM_INSTRUCTION }],
        },
        contents,
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 250,
        },
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error('Gemini API Error:', errText);
      return new Response(
        JSON.stringify({
          reply: `Karibu! We are here to help. You can also chat directly with us on WhatsApp at ${phone}.`,
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const resJson = await response.json();
    const candidate = resJson.candidates?.[0];
    const replyText =
      candidate?.content?.parts?.[0]?.text?.trim() ||
      `Karibu! Please reach us on WhatsApp at ${phone} and we will help you right away.`;

    return new Response(JSON.stringify({ reply: replyText }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Chat endpoint error:', error);
    return new Response(
      JSON.stringify({
        reply: `Karibu! Our Donholm shop is available on WhatsApp at ${phone}. How can we help?`,
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
