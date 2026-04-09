import { GoogleGenAI } from "@google/genai";

// @ts-ignore
const ai = new GoogleGenAI({ apiKey: import.meta.env.VITE_GEMINI_API_KEY || "" });

export async function summarizeText(text: string) {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `Please summarize the following text in Bengali (বাংলা). Keep it concise but informative:\n\n${text}`
    });
    return response.text || "No summary generated.";
  } catch (error) {
    console.error("Gemini Error:", error);
    throw new Error("Failed to generate summary. Please check your API key.");
  }
}

export async function analyzePost(text: string) {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `Please analyze this social media post for intelligence purposes in Bengali (বাংলা). 
      Extract the following information if available:
      - Sentiment (ইতিবাচক/নেতিবাচক/নিরপেক্ষ)
      - Key Entities (ব্যক্তি, স্থান, সংগঠন)
      - Main Topic (মূল বিষয়)
      - Potential Risks or Alerts (সম্ভাব্য ঝুঁকি বা সতর্কতা)
      
      Post text:\n\n${text}`
    });
    return response.text || "No analysis generated.";
  } catch (error) {
    console.error("Gemini Error:", error);
    throw new Error("Failed to analyze post.");
  }
}
