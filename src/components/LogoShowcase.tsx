import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Check, Loader2, RefreshCw, Palette } from 'lucide-react';
import { GoogleGenAI } from "@google/genai";

interface LogoShowcaseProps {
  onClose: () => void;
  onSelect: (logoUrl: string) => void;
}

export default function LogoShowcase({ onClose, onSelect }: LogoShowcaseProps) {
  const [logos, setLogos] = useState<{ name: string; data: string }[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedLogo, setSelectedLogo] = useState<string | null>(null);

  const generateLogos = async () => {
    setIsLoading(true);
    try {
      const apiKey = process.env.GEMINI_API_KEY;
      const genAI = new GoogleGenAI({ apiKey });

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

      const results: { name: string; data: string }[] = [];

      for (const concept of concepts) {
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
      setLogos(results);
    } catch (error) {
      console.error("Logo generation error:", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    generateLogos();
  }, []);

  return (
    <div className="fixed inset-0 z-[120] bg-black/40 backdrop-blur-md flex items-center justify-center p-6">
      <motion.div
        initial={{ scale: 0.9, opacity: 0, y: 20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        className="bg-white rounded-[40px] shadow-2xl w-full max-w-3xl overflow-hidden flex flex-col max-h-[90vh]"
      >
        {/* Header */}
        <div className="p-8 border-b border-gray-50 flex items-center justify-between bg-gray-50/50">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-black text-white rounded-2xl flex items-center justify-center">
              <Palette className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-xl font-black text-gray-900">Logo Concepts</h3>
              <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">AI Generated for Zenith</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button 
              onClick={generateLogos} 
              disabled={isLoading}
              className="p-3 hover:bg-white rounded-2xl transition-colors shadow-sm disabled:opacity-50"
              title="Regenerate"
            >
              <RefreshCw className={`w-5 h-5 text-gray-400 ${isLoading ? 'animate-spin' : ''}`} />
            </button>
            <button onClick={onClose} className="p-3 hover:bg-white rounded-2xl transition-colors shadow-sm">
              <X className="w-5 h-5 text-gray-400" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-8">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-20 space-y-4">
              <Loader2 className="w-12 h-12 text-black animate-spin" />
              <p className="text-sm font-bold text-gray-400 uppercase tracking-widest animate-pulse">Designing your brand...</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              {logos.map((logo, idx) => (
                <motion.div
                  key={idx}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.1 }}
                  className={`relative group cursor-pointer rounded-[32px] overflow-hidden border-4 transition-all ${
                    selectedLogo === logo.data ? 'border-black scale-105' : 'border-transparent hover:border-gray-100'
                  }`}
                  onClick={() => setSelectedLogo(logo.data)}
                >
                  <img 
                    src={logo.data} 
                    alt={logo.name} 
                    className="w-full aspect-square object-cover"
                    referrerPolicy="no-referrer"
                  />
                  <div className="absolute inset-x-0 bottom-0 p-4 bg-gradient-to-t from-black/60 to-transparent">
                    <p className="text-white font-black text-sm">{logo.name}</p>
                  </div>
                  {selectedLogo === logo.data && (
                    <div className="absolute top-4 right-4 w-8 h-8 bg-black text-white rounded-full flex items-center justify-center shadow-lg">
                      <Check className="w-5 h-5" />
                    </div>
                  )}
                </motion.div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-8 border-t border-gray-50 flex gap-4 bg-gray-50/30">
          <button
            onClick={onClose}
            className="flex-1 py-4 rounded-2xl font-bold text-gray-500 hover:bg-gray-100 transition-all"
          >
            Cancel
          </button>
          <button
            onClick={() => selectedLogo && onSelect(selectedLogo)}
            disabled={!selectedLogo || isLoading}
            className="flex-[2] py-4 bg-black text-white rounded-2xl font-bold flex items-center justify-center gap-2 hover:bg-gray-800 transition-all active:scale-95 disabled:opacity-50"
          >
            Use This Logo
          </button>
        </div>
      </motion.div>
    </div>
  );
}
