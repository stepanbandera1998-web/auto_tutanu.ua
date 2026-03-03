import { GoogleGenAI } from "@google/genai";

export const generateProductDescription = async (productName: string) => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.error("GEMINI_API_KEY is missing in environment");
    throw new Error("API ключ не знайдено в налаштуваннях сервера.");
  }
  
  const ai = new GoogleGenAI({ apiKey });
  
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `Напиши короткий, привабливий опис для товару "${productName}" для магазину автомобільних дисків. Використовуй українську мову. Опис має бути професійним та технічно грамотним.`,
    });
    
    if (!response.text) {
      throw new Error("ШІ повернув порожню відповідь.");
    }
    
    return response.text;
  } catch (error: any) {
    console.error("AI generation error details:", error);
    throw new Error(`Помилка ШІ: ${error.message || "невідома помилка"}`);
  }
};
