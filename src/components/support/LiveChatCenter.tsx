import React, { useState, useEffect, useRef } from 'react';
import { db } from '../../firebase';
import { 
  collection, 
  doc, 
  setDoc, 
  updateDoc, 
  addDoc, 
  onSnapshot, 
  query, 
  where, 
  orderBy,
  limit
} from 'firebase/firestore';
import { 
  MessageSquare, 
  Send, 
  User, 
  Bike, 
  Store, 
  CheckCheck, 
  Search, 
  UserCheck, 
  Paperclip, 
  Smile, 
  PhoneCall, 
  ExternalLink, 
  MoreVertical,
  ChevronRight,
  UserX,
  X,
  RefreshCw,
  AlertCircle,
  Clock,
  ThumbsUp,
  Image,
  FileText,
  Mic,
  DollarSign,
  Share2,
  CheckCircle2,
  UserPlus
} from 'lucide-react';
import { ChatSession, ChatMessage, Order, Rider, Restaurant, Customer } from '../../types';
import QuickActionsPanel from './QuickActionsPanel';

interface LiveChatCenterProps {
  orders: Order[];
  riders: Rider[];
  restaurants: Restaurant[];
  customers: Customer[];
  onInitiateRefund?: (order: Order, sessionId: string) => void;
}

export default function LiveChatCenter({
  orders,
  riders,
  restaurants,
  customers,
  onInitiateRefund
}: LiveChatCenterProps) {
  
  // Real-time states
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [selectedSession, setSelectedSession] = useState<ChatSession | null>(null);
  
  // Local Interactive states
  const [chatSearch, setChatSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<'all' | 'customer' | 'rider' | 'restaurant' | 'staff'>('all');
  const [messageInput, setMessageInput] = useState('');
  const [typingState, setTypingState] = useState(false);
  const [attachmentMenuOpen, setAttachmentMenuOpen] = useState(false);
  const [emojiMenuOpen, setEmojiMenuOpen] = useState(false);
  const [quickActionUserId, setQuickActionUserId] = useState<string | null>(null);
  const [mobileActiveTab, setMobileActiveTab] = useState<'sessions' | 'chat' | 'actions'>('sessions');

  // References
  const messageEndRef = useRef<HTMLDivElement>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // 1. Sync Live Chat Sessions from Firestore
  useEffect(() => {
    const q = query(collection(db, 'chat_sessions'), orderBy('lastMessageTime', 'desc'));
    const unsub = onSnapshot(q, (snapshot) => {
      const items: ChatSession[] = [];
      snapshot.forEach(d => {
        items.push({ id: d.id, ...d.data() } as ChatSession);
      });
      setSessions(items);
    });

    return () => unsub();
  }, []);

  // 2. Sync Selected Session's messages in real-time
  useEffect(() => {
    if (!selectedSession) {
      setMessages([]);
      return;
    }

    const q = query(
      collection(db, 'chat_messages'),
      where('sessionId', '==', selectedSession.id)
    );

    const unsub = onSnapshot(q, (snapshot) => {
      const items: ChatMessage[] = [];
      snapshot.forEach(d => {
        items.push({ id: d.id, ...d.data() } as ChatMessage);
      });
      
      // Sort in memory to bypass composite index requirement
      items.sort((a, b) => new Date(a.sentAt).getTime() - new Date(b.sentAt).getTime());
      
      setMessages(items);
      
      // Scroll to bottom
      setTimeout(() => {
        messageEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      }, 100);

      // Mark messages as read by admin/support
      markSessionMessagesAsRead(selectedSession.id);
    });

    return () => unsub();
  }, [selectedSession]);

  const markSessionMessagesAsRead = async (sessionId: string) => {
    try {
      await updateDoc(doc(db, 'chat_sessions', sessionId), {
        unreadCount: 0
      });
    } catch (e) {
      console.error(e);
    }
  };



  // Typing status update
  const handleInputKeyPress = () => {
    if (!selectedSession) return;
    
    if (!typingState) {
      setTypingState(true);
      updateDoc(doc(db, 'chat_sessions', selectedSession.id), {
        [`typingStatus.admin`]: true
      });
    }

    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    
    typingTimeoutRef.current = setTimeout(() => {
      setTypingState(false);
      updateDoc(doc(db, 'chat_sessions', selectedSession.id), {
        [`typingStatus.admin`]: false
      });
    }, 2000);
  };

  // Send message
  const handleSendMessage = async (textToSend?: string, attachment?: { url: string, name: string, type: 'image' | 'document' }) => {
    if (!selectedSession) return;
    const body = textToSend || messageInput;
    if (!body.trim() && !attachment) return;

    try {
      const msgRef = doc(collection(db, 'chat_messages'));
      const newMsg: ChatMessage = {
        id: msgRef.id,
        sessionId: selectedSession.id,
        senderId: 'admin_bhopal',
        senderName: 'Ting Tong Support',
        senderRole: 'admin',
        text: body,
        sentAt: new Date().toISOString(),
        readBy: ['admin_bhopal']
      };

      if (attachment) {
        newMsg.fileUrl = attachment.url;
        newMsg.fileName = attachment.name;
        newMsg.fileType = attachment.type;
      }

      await setDoc(msgRef, newMsg);

      // Update session header
      await updateDoc(doc(db, 'chat_sessions', selectedSession.id), {
        lastMessageText: attachment ? `📎 ${attachment.name}` : body,
        lastMessageTime: new Date().toISOString(),
        status: 'open',
        [`typingStatus.admin`]: false
      });

      if (!textToSend) setMessageInput('');
      setAttachmentMenuOpen(false);
      setEmojiMenuOpen(false);

      // Scroll down
      setTimeout(() => {
        messageEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      }, 50);

    } catch (err: any) {
      alert("Error sending message: " + err.message);
    }
  };



  // File Attachment Handler
  const handleFileAttach = (type: 'image' | 'document') => {
    const attachmentUrls = {
      image: "https://images.unsplash.com/photo-1517841905240-472988babdf9?w=400&auto=format&fit=crop",
      document: "https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf"
    };
    
    handleSendMessage(
      `Shared a support ${type}`, 
      { 
        url: attachmentUrls[type], 
        name: type === 'image' ? 'receipt_screenshot.png' : 'invoice_compliance.pdf', 
        type 
      }
    );
  };

  const handleCloseSession = async (sessId: string) => {
    try {
      await updateDoc(doc(db, 'chat_sessions', sessId), { status: 'closed' });
      if (selectedSession && selectedSession.id === sessId) {
        setSelectedSession({ ...selectedSession, status: 'closed' });
      }
      alert("Session archived successfully. Closed status logged.");
    } catch (e: any) {
      alert("Error closing chat: " + e.message);
    }
  };

  const handleReopenSession = async (sessId: string) => {
    try {
      await updateDoc(doc(db, 'chat_sessions', sessId), { status: 'open' });
      if (selectedSession && selectedSession.id === sessId) {
        setSelectedSession({ ...selectedSession, status: 'open' });
      }
      alert("Session reopened! Active support agent assigned.");
    } catch (e: any) {
      alert("Reopen error: " + e.message);
    }
  };



  // Filtering Logic
  const filteredSessions = sessions.filter(s => {
    const matchRole = roleFilter === 'all' || s.userRole === roleFilter;
    const matchSearch = s.userName.toLowerCase().includes(chatSearch.toLowerCase()) || 
                        (s.lastMessageText && s.lastMessageText.toLowerCase().includes(chatSearch.toLowerCase()));
    return matchRole && matchSearch;
  });

  const getRoleIcon = (role: string) => {
    if (role === 'rider') return <Bike className="w-3.5 h-3.5 text-amber-500" />;
    if (role === 'restaurant') return <Store className="w-3.5 h-3.5 text-indigo-400" />;
    if (role === 'staff') return <UserCheck className="w-3.5 h-3.5 text-rose-400" />;
    return <User className="w-3.5 h-3.5 text-emerald-400" />;
  };

  // Look up phone numbers for quick actions
  const getContactInfo = (userId: string, role: string) => {
    if (role === 'rider') {
      const r = riders.find(item => item.id === userId);
      return { phone: r?.phone || '9876543210', name: r?.name || 'Rider' };
    } else if (role === 'restaurant') {
      const v = restaurants.find(item => item.id === userId);
      return { phone: v?.phone || '9988776655', name: v?.name || 'Restaurant' };
    } else {
      const c = customers.find(item => item.id === userId);
      return { phone: c?.phone || '9123456789', name: c?.name || 'Customer' };
    }
  };

  return (
    <div className="flex flex-col lg:grid lg:grid-cols-12 gap-4 lg:gap-6 bg-slate-950 border border-slate-900 rounded-3xl overflow-hidden p-1 shadow-2xl h-auto lg:h-[75vh]" id="live-chat-center-container">
      
      {/* Mobile Tab Selector */}
      <div className="flex lg:hidden bg-slate-900 border-b border-slate-850 p-1.5 rounded-2xl m-2 shrink-0 gap-1">
        <button
          onClick={() => setMobileActiveTab('sessions')}
          className={`flex-1 py-2.5 text-[10px] font-black uppercase tracking-wider rounded-xl transition ${
            mobileActiveTab === 'sessions' ? 'bg-amber-500 text-slate-950 shadow-md' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          Queue ({sessions.length})
        </button>
        <button
          onClick={() => setMobileActiveTab('chat')}
          className={`flex-1 py-2.5 text-[10px] font-black uppercase tracking-wider rounded-xl transition relative ${
            mobileActiveTab === 'chat' ? 'bg-amber-500 text-slate-950 shadow-md' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          Chat Canvas
          {sessions.some(s => s.unreadCount > 0) && (
            <span className="absolute top-2 right-4 w-1.5 h-1.5 bg-rose-500 rounded-full animate-ping" />
          )}
        </button>
        <button
          onClick={() => setMobileActiveTab('actions')}
          className={`flex-1 py-2.5 text-[10px] font-black uppercase tracking-wider rounded-xl transition ${
            mobileActiveTab === 'actions' ? 'bg-amber-500 text-slate-950 shadow-md' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          Actions
        </button>
      </div>

      {/* LEFT SIDEBAR: ACTIVE SESSIONS QUEUE */}
      <div className={`lg:col-span-4 bg-slate-900 border-r border-slate-850 flex flex-col h-[50vh] lg:h-full ${mobileActiveTab === 'sessions' ? 'flex' : 'hidden lg:flex'}`}>
        
        {/* Search and Filters */}
        <div className="p-4 border-b border-slate-850 space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-500" />
            <input
              type="text"
              value={chatSearch}
              onChange={(e) => setChatSearch(e.target.value)}
              placeholder="Search chat sessions..."
              className="w-full bg-slate-950 border border-slate-800 rounded-xl py-2 pl-9 pr-4 text-xs text-slate-200 outline-none focus:border-amber-500 transition"
            />
          </div>

          <div className="flex flex-wrap gap-1">
            {(['all', 'customer', 'rider', 'restaurant', 'staff'] as const).map(role => (
              <button
                key={role}
                onClick={() => setRoleFilter(role)}
                className={`px-2 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider transition ${
                  roleFilter === role 
                    ? 'bg-amber-500 text-slate-950 shadow-md' 
                    : 'bg-slate-950 text-slate-400 hover:text-slate-200'
                }`}
              >
                {role}
              </button>
            ))}
          </div>
        </div>

        {/* Sessions list */}
        <div className="flex-1 overflow-y-auto divide-y divide-slate-850/60 p-2 space-y-1">
          {filteredSessions.map(sess => {
            const isSelected = selectedSession?.id === sess.id;
            const isTyping = sess.typingStatus?.[sess.id];
            
            return (
              <div
                key={sess.id}
                onClick={() => {
                  setSelectedSession(sess);
                  setMobileActiveTab('chat');
                }}
                className={`p-3 rounded-2xl cursor-pointer transition flex items-start gap-3 relative ${
                  isSelected 
                    ? 'bg-slate-950 border border-slate-800' 
                    : 'bg-slate-900/30 hover:bg-slate-950/40'
                }`}
              >
                {/* Online Status Dot */}
                <div className="relative shrink-0 mt-0.5">
                  <div className="w-8 h-8 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center font-bold text-slate-300 text-xs">
                    {sess.userName.charAt(0)}
                  </div>
                  <span className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-slate-900 ${
                    (sess.onlineStatus || '').toUpperCase() === 'ONLINE' ? 'bg-emerald-500 animate-pulse' : 'bg-slate-600'
                  }`} />
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex justify-between items-start">
                    <span className="font-bold text-xs text-slate-200 truncate flex items-center gap-1">
                      {getRoleIcon(sess.userRole)}
                      {sess.userName}
                    </span>
                    <span className="text-[8px] text-slate-500 font-mono">
                      {sess.lastMessageTime ? new Date(sess.lastMessageTime).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : ''}
                    </span>
                  </div>

                  <p className="text-[10px] text-slate-400 truncate mt-1">
                    {isTyping ? (
                      <span className="text-amber-500 font-bold italic animate-pulse">is typing...</span>
                    ) : (
                      sess.lastMessageText || 'No messages'
                    )}
                  </p>

                  <div className="flex items-center justify-between mt-2">
                    <span className={`text-[8px] px-1.5 py-0.5 rounded font-black uppercase ${
                      sess.status === 'waiting' ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20' :
                      sess.status === 'closed' ? 'bg-slate-800 text-slate-500' :
                      'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                    }`}>
                      {sess.status}
                    </span>
                    
                    {sess.unreadCount > 0 && (
                      <span className="bg-amber-500 text-slate-950 text-[9px] font-black h-4 w-4 rounded-full flex items-center justify-center animate-bounce">
                        {sess.unreadCount}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}

          {filteredSessions.length === 0 && (
            <div className="text-center py-12 text-slate-500 text-xs font-mono">
              No matching support sessions.
            </div>
          )}
        </div>

      </div>

      {/* CENTER: ACTIVE CHAT CANVAS */}
      <div className={`lg:col-span-5 bg-slate-900 flex flex-col h-[65vh] lg:h-full border-r border-slate-850 ${mobileActiveTab === 'chat' ? 'flex' : 'hidden lg:flex'}`}>
        
        {selectedSession ? (
          <div className="flex-1 flex flex-col h-full justify-between overflow-hidden">
            
            {/* Active Session Header */}
            <div className="p-4 border-b border-slate-850 flex items-center justify-between shrink-0 bg-slate-950/40">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center font-bold text-slate-200 text-xs">
                  {selectedSession.userName.charAt(0)}
                </div>
                <div>
                  <h4 className="font-bold text-xs text-slate-200 flex items-center gap-1">
                    {getRoleIcon(selectedSession.userRole)}
                    {selectedSession.userName}
                  </h4>
                  <span className="text-[9px] text-slate-500 block uppercase font-black">
                    Role: {selectedSession.userRole} | Agent: {selectedSession.assignedAgentName || 'None'}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-1">
                {selectedSession.status === 'closed' ? (
                  <button
                    onClick={() => handleReopenSession(selectedSession.id)}
                    className="bg-emerald-500 hover:bg-emerald-600 text-slate-950 text-[9px] font-black uppercase px-2.5 py-1.5 rounded-lg flex items-center gap-1 transition"
                  >
                    <RefreshCw className="w-3 h-3" /> Reopen
                  </button>
                ) : (
                  <button
                    onClick={() => handleCloseSession(selectedSession.id)}
                    className="bg-slate-950 hover:bg-slate-900 border border-slate-800 text-slate-300 text-[9px] font-bold uppercase px-2.5 py-1.5 rounded-lg flex items-center gap-1 transition"
                  >
                    <UserX className="w-3 h-3 text-rose-500" /> Close Session
                  </button>
                )}
              </div>
            </div>

            {/* Chat message list area */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-950/25">
              
              {/* Initial welcome ticket log if matches customer */}
              <div className="p-3 rounded-2xl bg-slate-950/60 border border-slate-850 text-[11px] text-slate-400 space-y-1">
                <p className="font-bold text-slate-200">Incident Connection Initiated</p>
                <p className="leading-relaxed">This secure chat bridge is managed under Ting Tong Support Center parameters.</p>
              </div>

              {messages.map((msg) => {
                const isAdmin = msg.senderRole === 'admin';
                return (
                  <div key={msg.id} className={`flex flex-col ${isAdmin ? 'items-end' : 'items-start'}`}>
                    <div className="text-[8px] text-slate-500 mb-1 px-1">{msg.senderName}</div>
                    
                    <div className={`p-3 rounded-2xl max-w-[80%] text-xs leading-relaxed space-y-2 ${
                      isAdmin 
                        ? 'bg-amber-500 text-slate-950 font-medium rounded-tr-none shadow-md' 
                        : 'bg-slate-900 text-slate-100 border border-slate-800 rounded-tl-none'
                    }`}>
                      {msg.text && <p>{msg.text}</p>}

                      {msg.fileUrl && (
                        <div className="rounded-xl overflow-hidden bg-slate-950/40 border border-slate-850 p-2 space-y-1">
                          {msg.fileType === 'image' ? (
                            <img src={msg.fileUrl} alt={msg.fileName} className="max-w-full h-auto rounded-lg object-cover max-h-32" />
                          ) : (
                            <div className="flex items-center gap-2">
                              <FileText className="w-5 h-5 text-amber-500 shrink-0" />
                              <span className="text-[10px] font-mono truncate">{msg.fileName}</span>
                            </div>
                          )}
                          <a href={msg.fileUrl} target="_blank" rel="noreferrer" className="text-[9px] text-amber-500 font-bold block hover:underline">
                            Open Attachment ↗
                          </a>
                        </div>
                      )}
                    </div>

                    <span className="text-[8px] text-slate-500 mt-1 px-1 flex items-center gap-1 font-mono">
                      {new Date(msg.sentAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                      {isAdmin && <CheckCheck className="w-3 h-3 text-amber-500 shrink-0" />}
                    </span>
                  </div>
                );
              })}

              {/* Partner typing indicator */}
              {selectedSession.typingStatus?.[selectedSession.id] && (
                <div className="flex flex-col items-start animate-pulse">
                  <span className="text-[8px] text-slate-500 mb-1">{selectedSession.userName}</span>
                  <div className="bg-slate-900 border border-slate-800 p-2 px-4 rounded-full text-xs text-amber-400 font-bold">
                    typing...
                  </div>
                </div>
              )}

              <div ref={messageEndRef} />
            </div>

            {/* Message input bar with attachment upload control */}
            <div className="p-3 border-t border-slate-850 shrink-0 space-y-2 bg-slate-950/40 relative">
              
              {/* Emoji bar drawer */}
              {emojiMenuOpen && (
                <div className="absolute bottom-16 left-4 bg-slate-900 border border-slate-800 p-2.5 rounded-2xl flex gap-1.5 shadow-xl z-20">
                  {['👍', '👌', '🙏', '🙌', '⚠️', '✅', '❌', '😊'].map(emoji => (
                    <button
                      key={emoji}
                      onClick={() => {
                        setMessageInput(prev => prev + emoji);
                        setEmojiMenuOpen(false);
                      }}
                      className="text-base hover:scale-125 transition"
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              )}

              {/* Attachment options drawer */}
              {attachmentMenuOpen && (
                <div className="absolute bottom-16 left-12 bg-slate-900 border border-slate-800 p-2 rounded-2xl flex flex-col gap-1 shadow-xl z-20">
                  <button
                    onClick={() => handleFileAttach('image')}
                    className="flex items-center gap-2 p-2 hover:bg-slate-950 rounded-xl text-[10px] font-bold text-slate-300"
                  >
                    <Image className="w-3.5 h-3.5 text-amber-500" /> Share Image
                  </button>
                  <button
                    onClick={() => handleFileAttach('document')}
                    className="flex items-center gap-2 p-2 hover:bg-slate-950 rounded-xl text-[10px] font-bold text-slate-300"
                  >
                    <FileText className="w-3.5 h-3.5 text-indigo-400" /> Share Document
                  </button>
                </div>
              )}

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setEmojiMenuOpen(!emojiMenuOpen)}
                  className="bg-slate-950 border border-slate-800 text-slate-400 p-2.5 rounded-xl hover:text-slate-200 cursor-pointer"
                >
                  <Smile className="w-4 h-4 text-amber-500" />
                </button>

                <button
                  type="button"
                  onClick={() => setAttachmentMenuOpen(!attachmentMenuOpen)}
                  className="bg-slate-950 border border-slate-800 text-slate-400 p-2.5 rounded-xl hover:text-slate-200 cursor-pointer"
                >
                  <Paperclip className="w-4 h-4 text-indigo-400" />
                </button>

                <input
                  type="text"
                  value={messageInput}
                  onKeyPress={handleInputKeyPress}
                  onChange={(e) => setMessageInput(e.target.value)}
                  placeholder="Type support response message..."
                  disabled={selectedSession.status === 'closed'}
                  className="bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-slate-100 flex-1 outline-none focus:border-amber-500 transition"
                />

                <button
                  onClick={() => handleSendMessage()}
                  disabled={selectedSession.status === 'closed'}
                  className="bg-amber-500 disabled:opacity-40 text-slate-950 p-2.5 rounded-xl hover:brightness-110 cursor-pointer transition shrink-0"
                >
                  <Send className="w-4 h-4" />
                </button>
              </div>
            </div>

          </div>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-slate-500 text-xs py-24 text-center">
            <MessageSquare className="w-12 h-12 text-slate-700 mb-2 animate-bounce" />
            <p className="font-bold text-slate-400 mb-1 text-sm">Enterprise Chat Canvas</p>
            <p className="max-w-xs leading-relaxed text-[11px]">Select an active customer, rider, vendor, or staff conversation thread from the queue to start a real-time messaging session.</p>
          </div>
        )}

      </div>

      {/* RIGHT SIDEBAR: QUICK AGENT ACTIONS PANEL */}
      <div className={`lg:col-span-3 h-[65vh] lg:h-full overflow-y-auto ${mobileActiveTab === 'actions' ? 'block' : 'hidden lg:block'}`}>
        {selectedSession ? (
          <QuickActionsPanel
            userId={selectedSession.userId}
            userRole={selectedSession.userRole}
            conversationId={selectedSession.id}
            conversationType="chat"
            orders={orders}
            riders={riders}
            restaurants={restaurants}
            customers={customers}
            onAgentAssigned={(agentName) => {
              setSelectedSession(prev => prev ? { ...prev, assignedAgentName: agentName } : null);
            }}
            onInitiateRefund={(order) => {
              if (onInitiateRefund) {
                onInitiateRefund(order, selectedSession.id);
              }
            }}
          />
        ) : (
          <div className="bg-slate-900 border border-slate-850 rounded-3xl p-6 text-center text-slate-500 text-xs py-12">
            <UserPlus className="w-8 h-8 text-slate-700 mx-auto mb-2" />
            <p className="font-bold text-slate-400">Quick Actions</p>
            <p className="text-[10px] text-slate-500 mt-1">Select a conversation to view Quick Actions.</p>
          </div>
        )}
      </div>

    </div>
  );
}
