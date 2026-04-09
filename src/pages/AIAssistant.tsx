import { useState } from 'react';
import { Sparkles, Send, Loader2, Brain, ShieldAlert, Languages, FileText } from 'lucide-react';
import { Button } from '../components/ui/button';
import { motion, AnimatePresence } from 'motion/react';
import { summarizeText, analyzePost } from '../services/geminiService';
import { toast } from 'sonner';
import ReactMarkdown from 'react-markdown';

export default function AIAssistant() {
  const [input, setInput] = useState('');
  const [result, setResult] = useState('');
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<'summarize' | 'analyze'>('summarize');

  const handleAction = async () => {
    if (!input.trim()) {
      toast.error('Please enter some text to process');
      return;
    }

    setLoading(true);
    setResult('');
    try {
      let response = '';
      if (mode === 'summarize') {
        response = await summarizeText(input);
      } else {
        response = await analyzePost(input);
      }
      setResult(response);
    } catch (error: any) {
      toast.error(error.message || 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="h-full flex flex-col space-y-6 max-w-4xl mx-auto w-full pt-4 sm:pt-6 lg:pt-8 pb-8">
      <div className="flex items-center gap-4 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md p-6 rounded-3xl border border-white/20 dark:border-slate-800 shadow-xl shadow-blue-500/5">
        <div className="bg-gradient-to-br from-indigo-600 to-purple-600 p-3 rounded-2xl shadow-lg shadow-indigo-500/20">
          <Brain className="h-8 w-8 text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">AI Intelligence Hub</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 font-medium uppercase tracking-wider">Powered by Gemini 1.5 Flash</p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto pr-1 custom-scrollbar space-y-6">
        <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-6 shadow-lg">
          <div className="flex gap-2 mb-6 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl w-fit">
            <button
              onClick={() => setMode('summarize')}
              className={`px-4 py-2 rounded-lg text-sm font-bold transition-all flex items-center gap-2 ${mode === 'summarize' ? 'bg-white dark:bg-slate-700 text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
            >
              <FileText className="h-4 w-4" />
              Summarize
            </button>
            <button
              onClick={() => setMode('analyze')}
              className={`px-4 py-2 rounded-lg text-sm font-bold transition-all flex items-center gap-2 ${mode === 'analyze' ? 'bg-white dark:bg-slate-700 text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
            >
              <ShieldAlert className="h-4 w-4" />
              Analyze Post
            </button>
          </div>

          <div className="space-y-4">
            <div className="relative">
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder={mode === 'summarize' ? "Paste news article or long text here..." : "Paste social media post text for intelligence analysis..."}
                className="w-full h-48 p-4 rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 text-slate-900 dark:text-white focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none transition-all resize-none text-base"
              />
              <div className="absolute bottom-4 right-4 flex gap-2">
                <Button
                  onClick={() => setInput('')}
                  variant="ghost"
                  size="sm"
                  className="text-slate-400 hover:text-red-500"
                >
                  Clear
                </Button>
                <Button
                  onClick={handleAction}
                  disabled={loading}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white gap-2 rounded-xl px-6 shadow-lg shadow-indigo-500/20"
                >
                  {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                  {mode === 'summarize' ? 'Generate Summary' : 'Analyze Intelligence'}
                </Button>
              </div>
            </div>
          </div>
        </div>

        <AnimatePresence>
          {result && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 20 }}
              className="bg-white dark:bg-slate-900 rounded-3xl border border-indigo-100 dark:border-indigo-900/30 p-8 shadow-xl relative overflow-hidden group"
            >
              <div className="absolute top-0 left-0 w-1 h-full bg-indigo-600" />
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-2">
                  <div className="p-2 bg-indigo-50 dark:bg-indigo-900/30 rounded-lg">
                    <Languages className="h-5 w-5 text-indigo-600" />
                  </div>
                  <h3 className="text-xl font-bold text-slate-900 dark:text-white">Intelligence Output (বাংলা)</h3>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    navigator.clipboard.writeText(result);
                    toast.success('Copied to clipboard');
                  }}
                  className="text-indigo-600 hover:bg-indigo-50"
                >
                  Copy Result
                </Button>
              </div>
              <div className="prose prose-slate dark:prose-invert max-w-none">
                <div className="text-slate-700 dark:text-slate-300 leading-relaxed whitespace-pre-wrap">
                  <ReactMarkdown>{result}</ReactMarkdown>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {!result && !loading && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-6 rounded-2xl bg-slate-50 dark:bg-slate-800/30 border border-slate-100 dark:border-slate-800 text-center">
              <div className="bg-white dark:bg-slate-800 w-10 h-10 rounded-full flex items-center justify-center mx-auto mb-3 shadow-sm">
                <Languages className="h-5 w-5 text-indigo-500" />
              </div>
              <h4 className="font-bold text-slate-900 dark:text-white text-sm mb-1">Bengali Support</h4>
              <p className="text-xs text-slate-500">All summaries and analysis are provided in Bengali language.</p>
            </div>
            <div className="p-6 rounded-2xl bg-slate-50 dark:bg-slate-800/30 border border-slate-100 dark:border-slate-800 text-center">
              <div className="bg-white dark:bg-slate-800 w-10 h-10 rounded-full flex items-center justify-center mx-auto mb-3 shadow-sm">
                <ShieldAlert className="h-5 w-5 text-purple-500" />
              </div>
              <h4 className="font-bold text-slate-900 dark:text-white text-sm mb-1">OSINT Ready</h4>
              <p className="text-xs text-slate-500">Extract locations, names, and organizations from social posts.</p>
            </div>
            <div className="p-6 rounded-2xl bg-slate-50 dark:bg-slate-800/30 border border-slate-100 dark:border-slate-800 text-center">
              <div className="bg-white dark:bg-slate-800 w-10 h-10 rounded-full flex items-center justify-center mx-auto mb-3 shadow-sm">
                <Sparkles className="h-5 w-5 text-yellow-500" />
              </div>
              <h4 className="font-bold text-slate-900 dark:text-white text-sm mb-1">Fast Processing</h4>
              <p className="text-xs text-slate-500">Powered by Gemini 1.5 Flash for near-instant results.</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
