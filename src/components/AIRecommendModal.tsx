/* eslint-disable @typescript-eslint/no-explicit-any */

'use client';

import { Brain, Send, Sparkles, X } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';

import {
  addMovieTitleClickListeners,
  AI_RECOMMEND_PRESETS,
  AIMessage,
  cleanMovieTitle,
  formatAIResponseWithLinks,
  generateChatSummary,
  generateSearchUrl,
  sendAIRecommendMessage,
  MovieRecommendation,
} from '@/lib/ai-recommend.client';

interface AIRecommendModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface ExtendedAIMessage extends AIMessage {
  recommendations?: MovieRecommendation[];
}

export default function AIRecommendModal({ isOpen, onClose }: AIRecommendModalProps) {
  const router = useRouter();
  const [messages, setMessages] = useState<ExtendedAIMessage[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<{message: string, details?: string} | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);

  // 滚动到底部
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  // 从localStorage加载历史对话
  useEffect(() => {
    try {
      const cachedMessages = localStorage.getItem('ai-recommend-messages');
      if (cachedMessages) {
        const { messages: storedMessages, timestamp } = JSON.parse(cachedMessages);
        const now = new Date().getTime();
        // 30分钟缓存
        if (now - timestamp < 30 * 60 * 1000) {
          setMessages(storedMessages.map((msg: ExtendedAIMessage) => ({
            ...msg,
            timestamp: msg.timestamp || new Date().toISOString()
          })));
          return; // 有缓存就不显示欢迎消息
        }
      }
      
      // 没有有效缓存时显示欢迎消息
      const welcomeMessage: ExtendedAIMessage = {
        role: 'assistant',
        content: '你好！我是AI影视推荐助手，可以根据你的喜好为你推荐精彩的影视作品。请告诉我你想看什么类型的影片，或者描述一下你的心情和偏好吧！',
        timestamp: new Date().toISOString()
      };
      setMessages([welcomeMessage]);
    } catch (error) {
      console.error("Failed to load messages from cache", error);
    }
  }, []);

  // 保存对话到localStorage并滚动到底部
  useEffect(() => {
    scrollToBottom();
    try {
      const cache = {
        messages,
        timestamp: new Date().getTime()
      };
      localStorage.setItem('ai-recommend-messages', JSON.stringify(cache));
    } catch (error) {
      console.error("Failed to save messages to cache", error);
    }
  }, [messages]);

  // 处理片名点击搜索（保留用于文本中的链接点击）
  const handleTitleClick = (title: string) => {
    const cleanTitle = cleanMovieTitle(title);
    const searchUrl = generateSearchUrl(cleanTitle);
    router.push(searchUrl);
    onClose(); // 关闭对话框
  };

  // 处理推荐卡片点击
  const handleMovieSelect = (movie: MovieRecommendation) => {
    const searchQuery = encodeURIComponent(movie.title);
    router.push(`/search?q=${searchQuery}`);
    onClose(); // 关闭对话框
  };

  // 发送消息
  const sendMessage = async (content: string) => {
    if (!content.trim() || isLoading) return;

    const userMessage: AIMessage = {
      role: 'user',
      content: content.trim(),
      timestamp: new Date().toISOString(),
    };

    setMessages(prev => [...prev, userMessage]);
    setInputMessage('');
    setIsLoading(true);
    setError(null);

    try {
      // 智能上下文管理：只发送最近8条消息（4轮对话）
      const updatedMessages = [...messages, userMessage];
      const conversationHistory = updatedMessages.slice(-8);
      
      const response = await sendAIRecommendMessage(conversationHistory);
      const assistantMessage: ExtendedAIMessage = {
        role: 'assistant',
        content: response.choices[0].message.content,
        timestamp: new Date().toISOString(),
        recommendations: response.recommendations || [],
      };
      // 添加AI回复到完整的消息历史（不是截取的历史）
      setMessages([...updatedMessages, assistantMessage]);
    } catch (error) {
      console.error('AI推荐请求失败:', error);
      
      if (error instanceof Error) {
        // 尝试解析错误响应中的详细信息
        try {
          const errorResponse = JSON.parse(error.message);
          setError({
            message: errorResponse.error || error.message,
            details: errorResponse.details
          });
        } catch {
          setError({
            message: error.message,
            details: '如果问题持续，请联系管理员检查AI配置'
          });
        }
      } else {
        setError({
          message: '请求失败，请稍后重试',
          details: '未知错误，请检查网络连接'
        });
      }
    } finally {
      setIsLoading(false);
    }
  };

  // 处理预设问题
  const handlePresetClick = (preset: { title: string; message: string }) => {
    sendMessage(preset.message);
  };

  // 处理表单提交
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    sendMessage(inputMessage);
  };

  // 处理键盘事件
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage(inputMessage);
    }
  };

  // 重置对话
  const resetChat = () => {
    // 清除localStorage缓存
    try {
      localStorage.removeItem('ai-recommend-messages');
    } catch (error) {
      console.error("Failed to clear messages cache", error);
    }
    
    // 重新显示欢迎消息
    const welcomeMessage: ExtendedAIMessage = {
      role: 'assistant',
      content: '你好！我是AI影视推荐助手，可以根据你的喜好为你推荐精彩的影视作品。请告诉我你想看什么类型的影片，或者描述一下你的心情和偏好吧！',
      timestamp: new Date().toISOString()
    };
    setMessages([welcomeMessage]);
    setError(null);
    setInputMessage('');
  };

  // 不再需要为消息内容添加点击监听器，因为点击功能已移至右侧卡片

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* 背景遮罩 */}
      <div 
        className="absolute inset-0 bg-black bg-opacity-50 backdrop-blur-sm"
        onClick={onClose}
      />
      
      {/* 对话框 */}
      <div className="relative w-full max-w-4xl h-[80vh] mx-4 bg-white dark:bg-gray-900 rounded-lg shadow-2xl flex flex-col overflow-hidden">
        {/* 头部 */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700 bg-gradient-to-r from-blue-600 to-purple-600">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-white bg-opacity-20 rounded-lg">
              <Brain className="h-6 w-6 text-white" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">AI 影视推荐</h2>
              <p className="text-blue-100 text-sm">智能推荐，发现精彩内容</p>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            {messages.length > 0 && (
              <button
                onClick={resetChat}
                className="px-3 py-1 text-sm bg-white bg-opacity-20 text-white rounded-md hover:bg-opacity-30 transition-colors"
              >
                清空对话
              </button>
            )}
            <button
              onClick={onClose}
              className="p-2 hover:bg-white hover:bg-opacity-20 rounded-lg transition-colors text-white"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* 消息区域 */}
        <div 
          ref={messagesContainerRef}
          className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50 dark:bg-gray-800"
        >
          {messages.length <= 1 && messages.every(msg => msg.role === 'assistant' && msg.content.includes('AI影视推荐助手')) && (
            <div className="text-center py-8">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full mb-4">
                <Sparkles className="h-8 w-8 text-white" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">
                欢迎使用AI影视推荐
              </h3>
              <p className="text-gray-600 dark:text-gray-400 mb-6">
                告诉我你的喜好，我会为你推荐精彩的影视作品
              </p>
              
              {/* 预设问题 */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-w-2xl mx-auto">
                {AI_RECOMMEND_PRESETS.map((preset, index) => (
                  <button
                    key={index}
                    onClick={() => handlePresetClick(preset)}
                    className="p-3 text-left bg-white dark:bg-gray-700 rounded-lg border border-gray-200 dark:border-gray-600 hover:border-blue-500 dark:hover:border-blue-400 hover:shadow-md transition-all group"
                    disabled={isLoading}
                  >
                    <div className="font-medium text-gray-900 dark:text-gray-100 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                      {preset.title}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* 消息列表 */}
          {messages.map((message, index) => (
            <div
              key={index}
              className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[80%] p-3 rounded-lg ${
                  message.role === 'user'
                    ? 'bg-blue-600 text-white'
                    : 'bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 border border-gray-200 dark:border-gray-600'
                }`}
              >
                {message.role === 'assistant' ? (
                  <div
                    dangerouslySetInnerHTML={{
                      __html: formatAIResponseWithLinks(message.content, handleTitleClick),
                    }}
                    className="prose prose-sm dark:prose-invert max-w-none"
                  />
                ) : (
                  <div className="whitespace-pre-wrap">{message.content}</div>
                )}
              </div>
              
              {/* 推荐影片卡片 */}
              {message.role === 'assistant' && message.recommendations && message.recommendations.length > 0 && (
                <div className="mt-3 space-y-2 max-w-[80%]">
                  <div className="text-xs text-gray-500 dark:text-gray-400 mb-2 flex items-center justify-between">
                    <div className="flex items-center">
                      <span className="bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-400 px-2 py-1 rounded-full text-xs font-medium mr-2">
                        🎬 点击搜索
                      </span>
                      推荐影片卡片
                    </div>
                    <span className="text-gray-400 dark:text-gray-500">
                      {message.recommendations.length < 4 
                        ? `显示 ${message.recommendations.length} 个推荐`
                        : `显示前 4 个推荐`
                      }
                    </span>
                  </div>
                  {message.recommendations.map((movie, index) => (
                    <div
                      key={index}
                      onClick={() => handleMovieSelect(movie)}
                      className="p-3 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg cursor-pointer hover:shadow-md hover:border-blue-300 dark:hover:border-blue-600 hover:scale-[1.02] transition-all group"
                    >
                      <div className="flex items-start gap-3">
                        {movie.poster && (
                          <img
                            src={movie.poster}
                            alt={movie.title}
                            className="w-12 h-16 object-cover rounded flex-shrink-0"
                          />
                        )}
                        <div className="flex-1 min-w-0">
                          <h4 className="font-medium text-gray-900 dark:text-white text-sm flex items-center">
                            {movie.title}
                            {movie.year && (
                              <span className="text-gray-500 dark:text-gray-400 ml-1">({movie.year})</span>
                            )}
                            <span className="ml-auto opacity-0 group-hover:opacity-100 transition-opacity text-blue-500 text-xs">
                              🔍 搜索
                            </span>
                          </h4>
                          {movie.genre && (
                            <p className="text-xs text-blue-600 dark:text-blue-400 mt-1">{movie.genre}</p>
                          )}
                          <p className="text-xs text-gray-600 dark:text-gray-400 mt-1 line-clamp-2">
                            {movie.description}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}

          {/* 加载状态 */}
          {isLoading && (
            <div className="flex justify-start">
              <div className="bg-white dark:bg-gray-700 p-3 rounded-lg border border-gray-200 dark:border-gray-600">
                <div className="flex space-x-1">
                  <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce"></div>
                  <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                  <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                </div>
              </div>
            </div>
          )}

          {/* 错误提示 */}
          {error && (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 p-4 rounded-lg">
              <div className="flex items-start space-x-3">
                <div className="flex-shrink-0">
                  <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                  </svg>
                </div>
                <div className="flex-1">
                  <h3 className="text-sm font-medium text-red-800 dark:text-red-300">
                    {error.message}
                  </h3>
                  {error.details && (
                    <div className="mt-2 text-sm text-red-700 dark:text-red-400">
                      <p>{error.details}</p>
                    </div>
                  )}
                  <div className="mt-3">
                    <button
                      onClick={() => setError(null)}
                      className="text-sm bg-red-100 hover:bg-red-200 dark:bg-red-800 dark:hover:bg-red-700 text-red-800 dark:text-red-200 px-3 py-1 rounded-md transition-colors"
                    >
                      关闭
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* 输入区域 */}
        <div className="p-4 border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900">
          <form onSubmit={handleSubmit} className="flex space-x-3">
            <div className="flex-1">
              <textarea
                value={inputMessage}
                onChange={(e) => setInputMessage(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="输入您想要的影视推荐类型..."
                className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
                rows={2}
                disabled={isLoading}
              />
            </div>
            <button
              type="submit"
              disabled={!inputMessage.trim() || isLoading}
              className="px-6 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white rounded-lg font-medium transition-colors flex items-center space-x-2"
            >
              <Send className="h-4 w-4" />
              <span>发送</span>
            </button>
          </form>
          
          {/* 提示信息 */}
          <div className="mt-2 flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
            <span>💡 点击右侧影片卡片可直接搜索</span>
            <span>按 Enter 发送，Shift+Enter 换行</span>
          </div>
        </div>
      </div>
    </div>
  );
}