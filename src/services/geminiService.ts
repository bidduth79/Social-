import { GoogleGenAI } from "@google/genai";

// @ts-ignore
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || (import.meta as any).env.VITE_GEMINI_API_KEY || "" });

export async function summarizeText(text: string, tone: string = 'professional') {
  const apiKey = process.env.GEMINI_API_KEY || (import.meta as any).env.VITE_GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("Gemini API key is missing. Please set GEMINI_API_KEY in your environment.");
  }
  try {
    const tonePrompt = getTonePrompt(tone);
    const response = await ai.models.generateContent({
      model: "gemini-flash-latest",
      contents: `Please summarize the following text in Bengali (বাংলা). ${tonePrompt} Keep it concise but informative:\n\n${text}`
    });
    return response.text || "No summary generated.";
  } catch (error: any) {
    console.error("Gemini Error:", error);
    const message = error?.message || "Failed to generate summary.";
    throw new Error(`${message} Please check your API key and model permissions.`);
  }
}

export async function analyzePost(text: string, tone: string = 'professional') {
  const apiKey = process.env.GEMINI_API_KEY || (import.meta as any).env.VITE_GEMINI_API_KEY;
  if (!apiKey) throw new Error("Gemini API key is missing.");
  try {
    const tonePrompt = getTonePrompt(tone);
    const response = await ai.models.generateContent({
      model: "gemini-flash-latest",
      contents: `Please analyze this social media post for intelligence purposes in Bengali (বাংলা). ${tonePrompt}
      Extract the following information if available:
      - Sentiment (ইতিবাচক/নেতিবাচক/নিরপেক্ষ) with explanation
      - Key Entities (ব্যক্তি, স্থান, সংগঠন)
      - Main Topic (মূল বিষয়)
      - Potential Risks or Alerts (সম্ভাব্য ঝুঁকি বা সতর্কতা)
      
      Post text:\n\n${text}`
    });
    return response.text || "No analysis generated.";
  } catch (error: any) {
    throw new Error(error?.message || "Failed to analyze post.");
  }
}

export async function translateToBengali(text: string) {
  const apiKey = process.env.GEMINI_API_KEY || (import.meta as any).env.VITE_GEMINI_API_KEY;
  if (!apiKey) throw new Error("Gemini API key is missing.");
  try {
    const response = await ai.models.generateContent({
      model: "gemini-flash-latest",
      contents: `Translate the following text into high-quality, professional Bengali (বাংলা):\n\n${text}`
    });
    return response.text || "Translation failed.";
  } catch (error: any) {
    throw new Error(error?.message || "Failed to translate.");
  }
}

export async function factCheck(text: string) {
  const apiKey = process.env.GEMINI_API_KEY || (import.meta as any).env.VITE_GEMINI_API_KEY;
  if (!apiKey) throw new Error("Gemini API key is missing.");
  try {
    const response = await ai.models.generateContent({
      model: "gemini-flash-latest",
      contents: `Perform a preliminary fact-check on the following claim/text in Bengali (বাংলা). 
      Identify:
      - Veracity (সত্যতা যাচাই)
      - Missing Context (অনুপস্থিত প্রেক্ষাপট)
      - Potential Bias (সম্ভাব্য পক্ষপাতিত্ব)
      - Reliable Sources to check (যাচাই করার জন্য নির্ভরযোগ্য উৎস)
      
      Text:\n\n${text}`
    });
    return response.text || "Fact check failed.";
  } catch (error: any) {
    throw new Error(error?.message || "Failed to fact check.");
  }
}

export async function factCheckWithImage(text: string, imageData: string, mimeType: string) {
  const apiKey = process.env.GEMINI_API_KEY || (import.meta as any).env.VITE_GEMINI_API_KEY;
  if (!apiKey) throw new Error("Gemini API key is missing.");
  try {
    const response = await ai.models.generateContent({
      model: "gemini-flash-latest",
      contents: [
        {
          role: "user",
          parts: [
            { text: `Perform a preliminary fact-check on the following image and text in Bengali (বাংলা). 
            Identify:
            - Veracity (সত্যতা যাচাই)
            - Missing Context (অনুপস্থিত প্রেক্ষাপট)
            - Potential Bias (সম্ভাব্য পক্ষপাতিত্ব)
            - Reliable Sources to check (যাচাই করার জন্য নির্ভরযোগ্য উৎস)
            
            Additional Text: ${text || "No additional text provided"}` },
            {
              inlineData: {
                data: imageData,
                mimeType: mimeType
              }
            }
          ]
        }
      ]
    });
    return response.text || "Fact check failed.";
  } catch (error: any) {
    throw new Error(error?.message || "Failed to fact check with image.");
  }
}

export async function generateContent(topic: string, type: 'post' | 'thread' | 'alert' | 'report', tone: string = 'professional') {
  const apiKey = process.env.GEMINI_API_KEY || (import.meta as any).env.VITE_GEMINI_API_KEY;
  if (!apiKey) throw new Error("Gemini API key is missing.");
  try {
    const tonePrompt = getTonePrompt(tone);
    let prompt = "";
    
    switch(type) {
      case 'post': 
        prompt = `Write an engaging Facebook/Social media post in Bengali (বাংলা) about the following topic. ${tonePrompt} Include relevant hashtags.`;
        break;
      case 'thread':
        prompt = `Create a Twitter thread (3-5 posts) in Bengali (বাংলা) about the following topic. ${tonePrompt} Each post should be numbered.`;
        break;
      case 'alert':
        prompt = `Write a short, urgent breaking news alert in Bengali (বাংলা) about the following topic. ${tonePrompt} Keep it urgent and informative.`;
        break;
      case 'report':
        prompt = `Write a detailed investigative news report in Bengali (বাংলা) about the following topic. ${tonePrompt} Structure it with headings.`;
        break;
    }

    const response = await ai.models.generateContent({
      model: "gemini-flash-latest",
      contents: `${prompt}\n\nTopic/Details: ${topic}`
    });
    return response.text || "Generation failed.";
  } catch (error: any) {
    throw new Error(error?.message || "Failed to generate content.");
  }
}

export async function generateSearchQuery(description: string) {
  const apiKey = process.env.GEMINI_API_KEY || (import.meta as any).env.VITE_GEMINI_API_KEY;
  if (!apiKey) throw new Error("Gemini API key is missing.");
  try {
    const response = await ai.models.generateContent({
      model: "gemini-flash-latest",
      contents: `Transform this natural language request into a single high-quality search keyword/phrase for Google/Social Media.
      Use search operators like site:, intitle:, "exact match" if it helps. 
      Only return the final search query string, nothing else. No explanations.
      
      Request: ${description}`
    });
    return response.text.trim() || description;
  } catch (error: any) {
    return description;
  }
}

export async function getRelatedKeywords(keyword: string) {
  const apiKey = process.env.GEMINI_API_KEY || (import.meta as any).env.VITE_GEMINI_API_KEY;
  if (!apiKey) throw new Error("Gemini API key is missing.");
  try {
    const response = await ai.models.generateContent({
      model: "gemini-flash-latest",
      contents: `Given the search keyword "${keyword}", provide 6-8 highly relevant keywords or phrases used for intelligence gathering or news monitoring in Bengali (বাংলা) or English. 
      Provide them as a comma-separated list. No other text.`
    });
    const text = response.text || "";
    return text.split(',').map(k => k.trim()).filter(k => k && k !== keyword);
  } catch (error: any) {
    return [];
  }
}

function getTonePrompt(tone: string) {
  switch(tone) {
    case 'journalist': return "Use an authoritative, investigative journalist tone.";
    case 'analyst': return "Use a neutral, data-driven analyst tone.";
    case 'creative': return "Use a creative and engaging storytelling tone.";
    case 'professional': 
    default: return "Use a professional, formal, and informative tone.";
  }
}
