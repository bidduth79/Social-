import { useState } from 'react';
import { Sparkles, Send, Loader2, Brain, ShieldAlert, Languages, FileText, SearchCheck, PenTool, History as HistoryIcon, Trash2, Camera, X as CloseIcon, Facebook, Twitter } from 'lucide-react';
import { Button } from '../components/ui/button';
import { motion, AnimatePresence } from 'motion/react';
import { summarizeText, analyzePost, translateToBengali, factCheck, generateContent, factCheckWithImage } from '../services/geminiService';
import { toast } from 'sonner';
import { cn } from '../lib/utils';
import ReactMarkdown from 'react-markdown';

type AIMode = 'summarize' | 'analyze' | 'translate' | 'factcheck' | 'draft';
type AITone = 'professional' | 'journalist' | 'analyst' | 'creative';
type DraftType = 'post' | 'thread' | 'alert' | 'report';

export default function AIAssistant() {
  const [input, setInput] = useState('');
  const [result, setResult] = useState('');
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<AIMode>('summarize');
  const [tone, setTone] = useState<AITone>('professional');
  const [draftType, setDraftType] = useState<DraftType>('post');
  const [history, setHistory] = useState<{mode: AIMode, input: string, result: string, time: string}[]>(() => {
    const saved = localStorage.getItem('ai_intelligence_history');
    return saved ? JSON.parse(saved) : [];
  });

  const [showHistoryDetail, setShowHistoryDetail] = useState(false);
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        toast.error('Image size should be less than 5MB');
        return;
      }
      setSelectedImage(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const removeImage = () => {
    setSelectedImage(null);
    setImagePreview(null);
  };

  const handleAction = async () => {
    if (!input.trim() && !selectedImage) {
      toast.error('Please enter some text or upload an image to process');
      return;
    }

    setLoading(true);
    setResult('');
    try {
      let response = '';
      
      if (mode === 'factcheck' && selectedImage && imagePreview) {
        const base64Data = imagePreview.split(',')[1];
        response = await factCheckWithImage(input, base64Data, selectedImage.type);
      } else {
        switch(mode) {
          case 'summarize': response = await summarizeText(input, tone); break;
          case 'analyze': response = await analyzePost(input, tone); break;
          case 'translate': response = await translateToBengali(input); break;
          case 'factcheck': response = await factCheck(input); break;
          case 'draft': response = await generateContent(input, draftType, tone); break;
        }
      }
      setResult(response);
      
      const newHistory = [{
        mode,
        input: input.slice(0, 100) + (input.length > 100 ? '...' : '') + (selectedImage ? ' [Image]' : ''),
        result: response,
        time: new Date().toLocaleTimeString()
      }, ...history].slice(0, 10);
      
      setHistory(newHistory);
      localStorage.setItem('ai_intelligence_history', JSON.stringify(newHistory));
    } catch (error: any) {
      toast.error(error.message || 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  const clearHistory = () => {
    setHistory([]);
    localStorage.removeItem('ai_intelligence_history');
    setShowHistoryDetail(false);
    toast.success('History cleared');
  };

  const modes: {id: AIMode, label: string, icon: any, color: string, bg: string, hover: string}[] = [
    { id: 'summarize', label: 'Summarize', icon: FileText, color: 'text-blue-600', bg: 'bg-blue-50', hover: 'hover:bg-blue-100' },
    { id: 'analyze', label: 'Analyze', icon: ShieldAlert, color: 'text-red-600', bg: 'bg-red-50', hover: 'hover:bg-red-100' },
    { id: 'translate', label: 'Translate', icon: Languages, color: 'text-indigo-600', bg: 'bg-indigo-50', hover: 'hover:bg-indigo-100' },
    { id: 'factcheck', label: 'Fact Check', icon: SearchCheck, color: 'text-emerald-600', bg: 'bg-emerald-50', hover: 'hover:bg-emerald-100' },
    { id: 'draft', label: 'Content Lab', icon: PenTool, color: 'text-purple-600', bg: 'bg-purple-50', hover: 'hover:bg-purple-100' },
  ];

  const tones: {id: AITone, label: string, desc: string}[] = [
    { id: 'professional', label: 'Professional', desc: 'Standard formal tone' },
    { id: 'journalist', label: 'Journalist', desc: 'Authoritative reporting' },
    { id: 'analyst', label: 'Analyst', desc: 'Neutral & data-driven' },
    { id: 'creative', label: 'Storyteller', desc: 'Engaging & narrative' },
  ];

  const draftTypes: {id: DraftType, label: string, icon: any}[] = [
    { id: 'post', label: 'FB Post', icon: Facebook },
    { id: 'thread', label: 'X Thread', icon: Twitter },
    { id: 'alert', label: 'Alert', icon: Sparkles },
    { id: 'report', label: 'Report', icon: FileText },
  ];

  return (
    <div className="h-full flex flex-col space-y-6 max-w-5xl mx-auto w-full pt-4 sm:pt-6 lg:pt-8 pb-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md p-6 rounded-3xl border border-white/20 dark:border-slate-800 shadow-xl shadow-blue-500/5">
        <div className="flex items-center gap-4">
          <div className="bg-gradient-to-br from-indigo-600 to-purple-600 p-3 rounded-2xl shadow-lg shadow-indigo-500/20">
            <Brain className="h-8 w-8 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">AI Intelligence Hub</h1>
            <p className="text-sm text-slate-500 dark:text-slate-400 font-medium uppercase tracking-wider">Powered by Gemini 1.5 Flash</p>
          </div>
        </div>
        
        <div className="flex gap-2">
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => setShowHistoryDetail(!showHistoryDetail)}
            className={cn(
              "rounded-xl gap-2 transition-all",
              showHistoryDetail ? "bg-slate-100 border-slate-300" : "hover:bg-slate-50"
            )}
          >
            <HistoryIcon className="h-4 w-4" />
            {showHistoryDetail ? 'Hide History' : 'Recent History'}
          </Button>
          {history.length > 0 && (
            <Button variant="outline" size="sm" onClick={clearHistory} className="rounded-xl gap-2 text-red-500 border-red-100 hover:bg-red-50">
              <Trash2 className="h-4 w-4" />
              Clear History
            </Button>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto pr-1 custom-scrollbar space-y-6">
        <div className="grid lg:grid-cols-1 gap-6">
          <div className="space-y-6">
            <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-6 shadow-lg">
              <div className="flex flex-wrap gap-2 mb-4">
                {modes.map((m) => (
                  <button
                    key={m.id}
                    onClick={() => setMode(m.id)}
                    className={cn(
                      "px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all flex items-center gap-2 border",
                      mode === m.id 
                        ? cn("shadow-md scale-105 border-transparent", m.bg, m.color) 
                        : cn("bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-500 hover:shadow-sm", m.hover)
                    )}
                  >
                    <m.icon className={cn("h-4 w-4", mode === m.id ? m.color : "text-slate-400")} />
                    {m.label}
                  </button>
                ))}
              </div>

              {/* Advanced Options Bar */}
              <div className="flex flex-col sm:flex-row gap-4 mb-6 p-4 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-100 dark:border-slate-700">
                <div className="flex-1 space-y-2">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Response Tone (আউটপুট টোন)</label>
                  <div className="flex flex-wrap gap-2">
                    {tones.map((t) => (
                      <button
                        key={t.id}
                        onClick={() => setTone(t.id)}
                        className={cn(
                          "px-3 py-1.5 rounded-lg text-xs font-semibold transition-all border",
                          tone === t.id
                            ? "bg-indigo-600 text-white border-transparent shadow-sm"
                            : "bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-800 hover:bg-slate-100"
                        )}
                      >
                        {t.label}
                      </button>
                    ))}
                  </div>
                </div>

                {mode === 'draft' && (
                  <div className="flex-1 space-y-2 sm:border-l sm:pl-4 border-slate-200 dark:border-slate-700">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Content Type (কন্টেন্ট টাইপ)</label>
                    <div className="flex flex-wrap gap-2">
                      {draftTypes.map((dt) => (
                        <button
                          key={dt.id}
                          onClick={() => setDraftType(dt.id)}
                          className={cn(
                            "px-3 py-1.5 rounded-lg text-xs font-semibold transition-all border flex items-center gap-1.5",
                            draftType === dt.id
                              ? "bg-purple-600 text-white border-transparent shadow-sm"
                              : "bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-800 hover:bg-slate-100"
                          )}
                        >
                          <dt.icon className="h-3 w-3" />
                          {dt.label}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div className="space-y-4">
                <div className="relative">
                  <textarea
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    placeholder={
                      mode === 'summarize' ? "Paste news article or long text here..." : 
                      mode === 'analyze' ? "Paste social media post text for intelligence analysis..." :
                      mode === 'translate' ? "Paste text to translate into Bengali..." :
                      mode === 'factcheck' ? "Paste a claim or news to verify (You can also upload a screenshot)..." :
                      "Describe the topic you want to write a post about..."
                    }
                    className="w-full h-64 p-6 rounded-3xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 text-slate-900 dark:text-white focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none transition-all resize-none text-base leading-relaxed"
                  />
                  
                  {imagePreview && (
                    <div className="absolute top-6 right-6 group">
                      <div className="relative">
                        <img 
                          src={imagePreview} 
                          alt="Preview" 
                          className="h-32 w-32 object-cover rounded-2xl border-2 border-indigo-500 shadow-lg"
                        />
                        <button 
                          onClick={removeImage}
                          className="absolute -top-2 -right-2 bg-red-500 text-white p-1 rounded-full shadow-md hover:bg-red-600 transition-colors"
                        >
                          <CloseIcon className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  )}

                  <div className="absolute bottom-6 left-6 flex gap-3">
                    {mode === 'factcheck' && (
                      <div className="relative">
                        <input
                          type="file"
                          accept="image/*"
                          onChange={handleImageChange}
                          className="hidden"
                          id="image-upload"
                        />
                        <label
                          htmlFor="image-upload"
                          className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-bold text-slate-600 dark:text-slate-300 hover:border-indigo-500 hover:text-indigo-600 cursor-pointer transition-all shadow-sm"
                        >
                          <Camera className="h-4 w-4" />
                          Upload Screenshot
                        </label>
                      </div>
                    )}
                  </div>

                  <div className="absolute bottom-6 right-6 flex gap-3">
                    <Button
                      onClick={() => {
                        setInput('');
                        removeImage();
                      }}
                      variant="ghost"
                      size="sm"
                      className="text-slate-400 hover:text-red-500 rounded-xl"
                    >
                      Clear
                    </Button>
                    <Button
                      onClick={handleAction}
                      disabled={loading}
                      className="bg-indigo-600 hover:bg-indigo-700 text-white gap-2 rounded-2xl px-8 py-6 shadow-lg shadow-indigo-500/20 text-lg font-bold"
                    >
                      {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Sparkles className="h-5 w-5" />}
                      Process Intelligence
                    </Button>
                  </div>
                </div>
              </div>
            </div>

            <AnimatePresence>
              {showHistoryDetail && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-6 shadow-lg overflow-hidden"
                >
                  <div className="flex items-center gap-2 mb-6">
                    <HistoryIcon className="h-5 w-5 text-slate-400" />
                    <h3 className="font-bold text-slate-900 dark:text-white">Recent History</h3>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                    {history.length === 0 ? (
                      <div className="text-center py-8 col-span-full">
                        <p className="text-sm text-slate-400 italic">No history yet</p>
                      </div>
                    ) : (
                      history.map((item, idx) => (
                        <button
                          key={idx}
                          onClick={() => {
                            setMode(item.mode);
                            setResult(item.result);
                            setShowHistoryDetail(false);
                          }}
                          className="w-full text-left p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-700 hover:border-indigo-300 transition-all group"
                        >
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-[10px] font-bold uppercase tracking-tighter text-indigo-500">{item.mode}</span>
                            <span className="text-[10px] text-slate-400">{item.time}</span>
                          </div>
                          <p className="text-xs text-slate-600 dark:text-slate-400 line-clamp-2 font-medium">{item.input}</p>
                        </button>
                      ))
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            <AnimatePresence>
              {result && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 20 }}
                  className="bg-white dark:bg-slate-900 rounded-3xl border border-indigo-100 dark:border-indigo-900/30 p-8 shadow-xl relative overflow-hidden group"
                >
                  <div className="absolute top-0 left-0 w-1.5 h-full bg-indigo-600" />
                  <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-3">
                      <div className="p-2.5 bg-indigo-50 dark:bg-indigo-900/30 rounded-xl">
                        <Languages className="h-6 w-6 text-indigo-600" />
                      </div>
                      <div>
                        <h3 className="text-xl font-bold text-slate-900 dark:text-white">Intelligence Output</h3>
                        <p className="text-xs text-slate-500 uppercase tracking-widest font-bold">Bengali (বাংলা) Language</p>
                      </div>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        navigator.clipboard.writeText(result);
                        toast.success('Copied to clipboard');
                      }}
                      className="text-indigo-600 border-indigo-100 hover:bg-indigo-50 rounded-xl"
                    >
                      Copy Result
                    </Button>
                  </div>
                  <div className="prose prose-slate dark:prose-invert max-w-none">
                    <div className="text-slate-700 dark:text-slate-300 leading-relaxed whitespace-pre-wrap text-lg">
                      <ReactMarkdown>{result}</ReactMarkdown>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </div>
  );
}
