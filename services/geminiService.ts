import { GoogleGenAI } from "@google/genai";
import { Sale, AddressPoint } from "../types";

export const generateDailyReport = async (sales: Sale[], addresses: AddressPoint[]): Promise<string> => {
  if (!process.env.API_KEY) {
    return "API Key non configurée. Impossible de générer le rapport IA.";
  }

  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
  const totalAmount = sales.reduce((sum, s) => sum + s.amount, 0);
  const doneCount = addresses.filter(a => a.status === 'DONE').length;
  const absentCount = addresses.filter(a => a.status === 'ABSENT').length;
  const avg = doneCount > 0 ? (totalAmount / doneCount).toFixed(2) : "0";

  const prompt = `
    Tu es un coach expert pour une amicale de sapeurs-pompiers. Analyse les résultats de la tournée actuelle :
    - Calendriers distribués : ${doneCount}
    - Total récolté : ${totalAmount}€
    - Moyenne par calendrier : ${avg}€
    - Personnes absentes rencontrées : ${absentCount}

    Rédige un message structuré en deux parties :
    1. **Axes d'amélioration** : Analyse le ratio et suggère une stratégie pour les absents ou pour augmenter la moyenne.
    2. **Motivation** : Un message fort pour booster le moral de l'équipe pour la suite de la tournée.
    
    Sois concis, percutant et utilise un ton "pompier" (camaraderie, engagement). Maximum 100 mots. Formate en Markdown.
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
    });
    return response.text || "Erreur lors de la génération du rapport.";
  } catch (error) {
    console.error("Gemini Error:", error);
    return "Erreur de connexion avec l'IA.";
  }
};

export const generateReceiptContent = async (sale: Sale): Promise<string> => {
  if (!process.env.API_KEY) return "Merci infiniment pour votre don qui soutient nos actions quotidiennes et notre amicale.";

  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
  const prompt = `Rédige une formule de remerciement très chaleureuse et professionnelle pour un don de ${sale.amount}€ effectué par ${sale.donatorName || 'un généreux donateur'} pour les calendriers des pompiers. 
  Le message doit être court (2-3 phrases) et souligner l'importance de ce geste pour la vie du centre de secours. Pas de signature, juste le corps du message.`;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
    });
    return response.text || "Merci pour votre générosité envers les Sapeurs-Pompiers.";
  } catch (error) {
    console.error("Gemini Receipt Error:", error);
    return "Merci pour votre soutien précieux aux Sapeurs-Pompiers.";
  }
};