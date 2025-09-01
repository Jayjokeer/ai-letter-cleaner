import axios from "axios";
import dotenv from "dotenv";
dotenv.config();

export async function callOpenRouterSystem(prompt: string, model = process.env.MODEL): Promise<string> {
  const url = process.env.OPENROUTER_URL;
  if (!process.env.AI_KEY) throw new Error('Missing OPENROUTER_API_KEY in .env');
  if (!url) throw new Error('Missing OPENROUTER_URL in .env');

  const body = {
    model,
    messages: [
      { role: 'system', content: 'You are a helpful, precise document editor.' },
      { role: 'user', content: prompt }
    ],
    max_tokens: 800,
    temperature: 0.2
  };

  const resp = await axios.post(url, body, {
    headers: { Authorization: `Bearer ${process.env.AI_KEY}` }
  });

  // adapt responses: OpenRouter returns .choices[0].message.content or .choices[0].text
  const choices = resp.data?.choices;
  if (!choices || choices.length === 0) throw new Error('Invalid LLM response');
  const first = choices[0];
  const content = first?.message?.content ?? first?.text ?? '';
  if (typeof content !== 'string') throw new Error('Unexpected LLM content');
  return content;
}
