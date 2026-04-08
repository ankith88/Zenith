import { GoogleGenAI } from "@google/genai";

const apiKey = process.env.GEMINI_API_KEY;
const genAI = new GoogleGenAI({ apiKey });

async function generateLogos() {
  const concepts = [
    {
      name: "The Summit",
      prompt: "A minimalist and sharp logo for a financial app named 'Zenith'. The logo features a stylized upward-pointing arrow or mountain peak integrated into a bold, modern letter 'Z'. Professional, clean, vector style, white background, high contrast, primary color: Deep Indigo."
    },
    {
      name: "The Horizon",
      prompt: "A celestial and clean logo for a financial app named 'Zenith'. A circular emblem representing a rising sun at its highest point. Sophisticated gradient from Deep Indigo to Electric Blue. Modern, premium, vector style, white background."
    },
    {
      name: "The Ascent",
      prompt: "An abstract and tech-forward logo for a financial app named 'Zenith'. Three rising bars of different heights that form the shape of a 'Z'. Representing growth and financial ascent. Modern, sleek, vector style, white background, primary color: Emerald Green."
    }
  ];

  const results = [];

  for (const concept of concepts) {
    console.log(`Generating ${concept.name}...`);
    const response = await genAI.models.generateContent({
      model: "gemini-2.5-flash-image",
      contents: {
        parts: [
          {
            text: concept.prompt,
          },
        ],
      },
      config: {
        imageConfig: {
          aspectRatio: "1:1",
        },
      },
    });

    for (const part of response.candidates[0].content.parts) {
      if (part.inlineData) {
        results.push({
          name: concept.name,
          data: `data:image/png;base64,${part.inlineData.data}`
        });
      }
    }
  }

  return results;
}

export const logoService = {
  generateLogos
};
