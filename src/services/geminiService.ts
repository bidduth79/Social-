import { GoogleGenAI } from "@google/genai";

// @ts-ignore
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || (import.meta as any).env.VITE_GEMINI_API_KEY || "" });

export async function summarizeText(text: string) {
  const apiKey = process.env.GEMINI_API_KEY || (import.meta as any).env.VITE_GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("Gemini API key is missing. Please set GEMINI_API_KEY in your environment.");
  }
  try {
    const response = await ai.models.generateContent({
      model: "gemini-flash-latest",
      contents: `Please summarize the following text in Bengali (বাংলা). Keep it concise but informative:\n\n${text}`
    });
    return response.text || "No summary generated.";
  } catch (error: any) {
    console.error("Gemini Error:", error);
    const message = error?.message || "Failed to generate summary.";
    throw new Error(`${message} Please check your API key and model permissions.`);
  }
}

export async function analyzePost(text: string) {
  const apiKey = process.env.GEMINI_API_KEY || (import.meta as any).env.VITE_GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("Gemini API key is missing. Please set GEMINI_API_KEY in your environment.");
  }
  try {
    const response = await ai.models.generateContent({
      model: "gemini-flash-latest",
      contents: `Please analyze this social media post for intelligence purposes in Bengali (বাংলা). 
      Extract the following information if available:
      - Sentiment (ইতিবাচক/নেতিবাচক/নিরপেক্ষ)
      - Key Entities (ব্যক্তি, স্থান, সংগঠন)
      - Main Topic (মূল বিষয়)
      - Potential Risks or Alerts (সম্ভাব্য ঝুঁকি বা সতর্কতা)
      
      Post text:\n\n${text}`
    });
    return response.text || "No analysis generated.";
  } catch (error: any) {
    console.error("Gemini Error:", error);
    const message = error?.message || "Failed to analyze post.";
    throw new Error(`${message} Please check your API key and model permissions.`);
  }
}
